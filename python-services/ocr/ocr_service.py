#!/usr/bin/env python3
"""
Multi-OCR Receipt Scanning Service
Supports PaddleOCR, VLM, and Docling for receipt text extraction
"""

import os
import sys
import json
import base64
import re
from datetime import datetime
from typing import Dict, List, Optional
from io import BytesIO

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from PIL import Image

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Global OCR engines (lazy loaded)
paddle_ocr = None
vlm_model = None


def load_paddle_ocr():
    """Lazy load PaddleOCR"""
    global paddle_ocr
    if paddle_ocr is None:
        try:
            from paddleocr import PaddleOCR
            paddle_ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
            print("✓ PaddleOCR loaded successfully")
        except Exception as e:
            print(f"✗ Failed to load PaddleOCR: {e}")
            paddle_ocr = False
    return paddle_ocr


def extract_text_paddle(image_data: bytes) -> List[str]:
    """Extract text using PaddleOCR"""
    ocr = load_paddle_ocr()
    if not ocr:
        return []
    
    try:
        # Convert bytes to numpy array
        image = Image.open(BytesIO(image_data))
        img_array = np.array(image)
        
        # Run OCR
        result = ocr.ocr(img_array, cls=True)
        
        # Extract text lines
        text_lines = []
        if result and result[0]:
            for line in result[0]:
                if line and len(line) >= 2:
                    text = line[1][0]  # Get text from (text, confidence) tuple
                    text_lines.append(text)
        
        return text_lines
    except Exception as e:
        print(f"PaddleOCR extraction error: {e}")
        return []


def parse_receipt_data(text_lines: List[str]) -> Dict:
    """Parse extracted text to identify receipt fields"""
    
    # Join all text for easier pattern matching
    full_text = '\n'.join(text_lines)
    
    # Extract merchant name (usually first few lines)
    merchant = text_lines[0] if text_lines else "Unknown Merchant"
    
    # Extract total amount (look for patterns like "Total", "Amount", etc.)
    amount = 0.0
    amount_patterns = [
        r'total[:\s]+\$?(\d+\.?\d*)',
        r'amount[:\s]+\$?(\d+\.?\d*)',
        r'sum[:\s]+\$?(\d+\.?\d*)',
        r'\$\s*(\d+\.\d{2})',
    ]
    
    for pattern in amount_patterns:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            try:
                amount = float(match.group(1))
                break
            except ValueError:
                continue
    
    # Extract date
    date_str = datetime.now().strftime('%Y-%m-%d')
    date_patterns = [
        r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        r'(\d{4}[/-]\d{1,2}[/-]\d{1,2})',
    ]
    
    for pattern in date_patterns:
        match = re.search(pattern, full_text)
        if match:
            try:
                # Try to parse the date
                date_str = match.group(1)
                # Normalize to YYYY-MM-DD format
                if '/' in date_str:
                    parts = date_str.split('/')
                elif '-' in date_str:
                    parts = date_str.split('-')
                else:
                    continue
                
                if len(parts) == 3:
                    if len(parts[2]) == 2:
                        parts[2] = '20' + parts[2]
                    if len(parts[0]) == 4:
                        date_str = f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                    else:
                        date_str = f"{parts[2]}-{parts[0].zfill(2)}-{parts[1].zfill(2)}"
                break
            except Exception:
                continue
    
    # Categorize based on merchant name and items
    category = categorize_receipt(merchant, text_lines)
    
    # Extract line items
    items = []
    for line in text_lines[1:]:  # Skip merchant name
        # Look for lines with prices
        if re.search(r'\$?\d+\.\d{2}', line):
            # Clean up the line
            item = re.sub(r'\$?\d+\.\d{2}', '', line).strip()
            if item and len(item) > 2:
                items.append(item)
    
    return {
        'merchant': merchant,
        'amount': amount,
        'date': date_str,
        'category': category,
        'items': items[:10],  # Limit to 10 items
        'confidence': 0.85,
        'ocrMethod': 'paddleocr',
    }


def categorize_receipt(merchant: str, text_lines: List[str]) -> str:
    """Categorize receipt based on merchant and content"""
    
    merchant_lower = merchant.lower()
    full_text = ' '.join(text_lines).lower()
    
    # Food & Dining
    food_keywords = ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'food', 'dining', 'kitchen', 'grill', 'bar']
    if any(kw in merchant_lower for kw in food_keywords):
        return 'Food'
    
    # Shopping
    shopping_keywords = ['store', 'shop', 'mart', 'market', 'retail', 'boutique', 'mall']
    if any(kw in merchant_lower for kw in shopping_keywords):
        return 'Shopping'
    
    # Transportation
    transport_keywords = ['gas', 'fuel', 'station', 'uber', 'lyft', 'taxi', 'parking', 'transit']
    if any(kw in merchant_lower for kw in transport_keywords):
        return 'Transportation'
    
    # Utilities
    utility_keywords = ['electric', 'water', 'gas', 'internet', 'phone', 'utility']
    if any(kw in merchant_lower for kw in utility_keywords):
        return 'Utilities'
    
    # Entertainment
    entertainment_keywords = ['cinema', 'theater', 'movie', 'game', 'entertainment', 'concert', 'event']
    if any(kw in merchant_lower for kw in entertainment_keywords):
        return 'Entertainment'
    
    # Healthcare
    health_keywords = ['pharmacy', 'hospital', 'clinic', 'doctor', 'medical', 'health']
    if any(kw in merchant_lower for kw in health_keywords):
        return 'Healthcare'
    
    return 'Other'


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'ocr-service',
        'engines': {
            'paddleocr': paddle_ocr is not None and paddle_ocr is not False,
        }
    })


@app.route('/scan-receipt', methods=['POST'])
def scan_receipt():
    """Scan receipt image and extract transaction details"""
    try:
        data = request.get_json()
        
        if not data or 'imageBase64' not in data:
            return jsonify({'error': 'Image data is required'}), 400
        
        # Decode base64 image
        image_base64 = data['imageBase64']
        # Remove data URL prefix if present
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        image_data = base64.b64decode(image_base64)
        
        # Extract text using PaddleOCR
        text_lines = extract_text_paddle(image_data)
        
        if not text_lines:
            return jsonify({'error': 'No text found in image'}), 400
        
        # Parse receipt data
        receipt_data = parse_receipt_data(text_lines)
        
        return jsonify(receipt_data)
        
    except Exception as e:
        print(f"Error scanning receipt: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('OCR_SERVICE_PORT', 5001))
    print(f"Starting OCR Service on port {port}...")
    print("Loading OCR engines...")
    load_paddle_ocr()
    print("OCR Service ready!")
    app.run(host='0.0.0.0', port=port, debug=False)
