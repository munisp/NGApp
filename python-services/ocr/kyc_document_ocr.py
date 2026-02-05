#!/usr/bin/env python3
"""
KYC Document OCR Service
Extracts structured data from African ID documents using PaddleOCR
Supports: Nigerian National ID, Kenyan National ID, Ghanaian Ghana Card, South African ID
"""

import os
import sys
import json
import base64
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from io import BytesIO

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from PIL import Image

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Global OCR engine
paddle_ocr = None


def load_paddle_ocr():
    """Lazy load PaddleOCR"""
    global paddle_ocr
    if paddle_ocr is None:
        try:
            from paddleocr import PaddleOCR
            paddle_ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
            print("✓ PaddleOCR loaded successfully for KYC document extraction")
        except Exception as e:
            print(f"✗ Failed to load PaddleOCR: {e}")
            paddle_ocr = False
    return paddle_ocr


def extract_text_from_image(image_data: bytes) -> List[Tuple[str, float, List[int]]]:
    """
    Extract text from image using PaddleOCR
    Returns list of (text, confidence, bbox) tuples
    """
    ocr = load_paddle_ocr()
    if not ocr:
        return []
    
    try:
        # Convert bytes to numpy array
        image = Image.open(BytesIO(image_data))
        img_array = np.array(image)
        
        # Run OCR
        result = ocr.ocr(img_array, cls=True)
        
        # Extract text with confidence and bounding boxes
        extracted_data = []
        if result and result[0]:
            for line in result[0]:
                if line and len(line) >= 2:
                    bbox = line[0]  # Bounding box coordinates
                    text_info = line[1]  # (text, confidence)
                    text = text_info[0]
                    confidence = text_info[1]
                    
                    # Calculate center Y position for vertical ordering
                    center_y = (bbox[0][1] + bbox[2][1]) / 2
                    
                    extracted_data.append((text, confidence, center_y))
        
        # Sort by vertical position (top to bottom)
        extracted_data.sort(key=lambda x: x[2])
        
        return extracted_data
    except Exception as e:
        print(f"OCR extraction error: {e}")
        import traceback
        traceback.print_exc()
        return []


def parse_nigerian_national_id(text_lines: List[Tuple[str, float, float]]) -> Dict:
    """Parse Nigerian National ID (NIN)"""
    
    full_text = ' '.join([line[0] for line in text_lines])
    
    # Extract NIN (11 digits)
    nin_match = re.search(r'\b(\d{11})\b', full_text)
    nin = nin_match.group(1) if nin_match else ""
    
    # Extract full name (usually after "Name" or "Surname")
    name = ""
    for i, (text, conf, _) in enumerate(text_lines):
        if 'name' in text.lower() or 'surname' in text.lower():
            # Next line usually contains the name
            if i + 1 < len(text_lines):
                name = text_lines[i + 1][0]
                break
    
    # Extract date of birth (DD/MM/YYYY or DD-MM-YYYY)
    dob = ""
    dob_patterns = [
        r'(\d{2}[/-]\d{2}[/-]\d{4})',
        r'(\d{4}[/-]\d{2}[/-]\d{2})',
    ]
    for pattern in dob_patterns:
        match = re.search(pattern, full_text)
        if match:
            dob = normalize_date(match.group(1))
            break
    
    # Extract address (usually after "Address")
    address = ""
    for i, (text, conf, _) in enumerate(text_lines):
        if 'address' in text.lower():
            # Next 2-3 lines usually contain address
            address_parts = []
            for j in range(i + 1, min(i + 4, len(text_lines))):
                address_parts.append(text_lines[j][0])
            address = ', '.join(address_parts)
            break
    
    return {
        'documentNumber': nin,
        'fullName': name,
        'dateOfBirth': dob,
        'address': address,
        'documentType': 'national_id',
        'country': 'Nigeria',
        'confidence': calculate_confidence(text_lines),
    }


def parse_kenyan_national_id(text_lines: List[Tuple[str, float, float]]) -> Dict:
    """Parse Kenyan National ID"""
    
    full_text = ' '.join([line[0] for line in text_lines])
    
    # Extract ID number (7-8 digits)
    id_match = re.search(r'\b(\d{7,8})\b', full_text)
    id_number = id_match.group(1) if id_match else ""
    
    # Extract full name
    name = ""
    for i, (text, conf, _) in enumerate(text_lines):
        if 'name' in text.lower():
            if i + 1 < len(text_lines):
                name = text_lines[i + 1][0]
                break
    
    # Extract date of birth
    dob = ""
    dob_patterns = [
        r'(\d{2}[/-]\d{2}[/-]\d{4})',
        r'(\d{4}[/-]\d{2}[/-]\d{2})',
    ]
    for pattern in dob_patterns:
        match = re.search(pattern, full_text)
        if match:
            dob = normalize_date(match.group(1))
            break
    
    # Extract district/location
    address = ""
    for i, (text, conf, _) in enumerate(text_lines):
        if 'district' in text.lower() or 'location' in text.lower():
            if i + 1 < len(text_lines):
                address = text_lines[i + 1][0]
                break
    
    return {
        'documentNumber': id_number,
        'fullName': name,
        'dateOfBirth': dob,
        'address': address,
        'documentType': 'national_id',
        'country': 'Kenya',
        'confidence': calculate_confidence(text_lines),
    }


def parse_ghanaian_ghana_card(text_lines: List[Tuple[str, float, float]]) -> Dict:
    """Parse Ghanaian Ghana Card"""
    
    full_text = ' '.join([line[0] for line in text_lines])
    
    # Extract Ghana Card number (GHA-XXXXXXXXX-X format)
    card_match = re.search(r'GHA-\d{9}-\d', full_text)
    card_number = card_match.group(0) if card_match else ""
    
    # Extract full name
    name = ""
    for i, (text, conf, _) in enumerate(text_lines):
        if 'name' in text.lower() or 'surname' in text.lower():
            if i + 1 < len(text_lines):
                name = text_lines[i + 1][0]
                break
    
    # Extract date of birth
    dob = ""
    dob_patterns = [
        r'(\d{2}[/-]\d{2}[/-]\d{4})',
        r'(\d{4}[/-]\d{2}[/-]\d{2})',
    ]
    for pattern in dob_patterns:
        match = re.search(pattern, full_text)
        if match:
            dob = normalize_date(match.group(1))
            break
    
    # Extract address
    address = ""
    for i, (text, conf, _) in enumerate(text_lines):
        if 'address' in text.lower() or 'residential' in text.lower():
            address_parts = []
            for j in range(i + 1, min(i + 3, len(text_lines))):
                address_parts.append(text_lines[j][0])
            address = ', '.join(address_parts)
            break
    
    return {
        'documentNumber': card_number,
        'fullName': name,
        'dateOfBirth': dob,
        'address': address,
        'documentType': 'national_id',
        'country': 'Ghana',
        'confidence': calculate_confidence(text_lines),
    }


def parse_south_african_id(text_lines: List[Tuple[str, float, float]]) -> Dict:
    """Parse South African ID"""
    
    full_text = ' '.join([line[0] for line in text_lines])
    
    # Extract ID number (13 digits)
    id_match = re.search(r'\b(\d{13})\b', full_text)
    id_number = id_match.group(1) if id_match else ""
    
    # South African ID encodes DOB in first 6 digits (YYMMDD)
    dob = ""
    if id_number and len(id_number) == 13:
        try:
            yy = int(id_number[0:2])
            mm = int(id_number[2:4])
            dd = int(id_number[4:6])
            
            # Determine century (assume 1900s if > current year, else 2000s)
            current_year = datetime.now().year % 100
            if yy > current_year:
                yyyy = 1900 + yy
            else:
                yyyy = 2000 + yy
            
            dob = f"{yyyy}-{mm:02d}-{dd:02d}"
        except ValueError:
            pass
    
    # Extract full name
    name = ""
    for i, (text, conf, _) in enumerate(text_lines):
        if 'name' in text.lower() or 'surname' in text.lower():
            if i + 1 < len(text_lines):
                name = text_lines[i + 1][0]
                break
    
    # Extract address
    address = ""
    for i, (text, conf, _) in enumerate(text_lines):
        if 'address' in text.lower():
            address_parts = []
            for j in range(i + 1, min(i + 3, len(text_lines))):
                address_parts.append(text_lines[j][0])
            address = ', '.join(address_parts)
            break
    
    return {
        'documentNumber': id_number,
        'fullName': name,
        'dateOfBirth': dob,
        'address': address,
        'documentType': 'national_id',
        'country': 'South Africa',
        'confidence': calculate_confidence(text_lines),
    }


def parse_passport(text_lines: List[Tuple[str, float, float]]) -> Dict:
    """Parse international passport"""
    
    full_text = ' '.join([line[0] for line in text_lines])
    
    # Extract passport number (alphanumeric, 6-9 characters)
    passport_match = re.search(r'\b([A-Z]{1,2}\d{6,8})\b', full_text)
    passport_number = passport_match.group(1) if passport_match else ""
    
    # Extract full name (usually after "Name" or "Surname")
    name = ""
    for i, (text, conf, _) in enumerate(text_lines):
        if 'name' in text.lower() or 'surname' in text.lower():
            if i + 1 < len(text_lines):
                name = text_lines[i + 1][0]
                break
    
    # Extract date of birth
    dob = ""
    dob_patterns = [
        r'(\d{2}[/-]\d{2}[/-]\d{4})',
        r'(\d{4}[/-]\d{2}[/-]\d{2})',
    ]
    for pattern in dob_patterns:
        match = re.search(pattern, full_text)
        if match:
            dob = normalize_date(match.group(1))
            break
    
    # Extract nationality
    nationality = ""
    for i, (text, conf, _) in enumerate(text_lines):
        if 'nationality' in text.lower():
            if i + 1 < len(text_lines):
                nationality = text_lines[i + 1][0]
                break
    
    return {
        'documentNumber': passport_number,
        'fullName': name,
        'dateOfBirth': dob,
        'address': nationality,  # Use nationality as address for passports
        'documentType': 'passport',
        'country': nationality,
        'confidence': calculate_confidence(text_lines),
    }


def parse_drivers_license(text_lines: List[Tuple[str, float, float]]) -> Dict:
    """Parse driver's license"""
    
    full_text = ' '.join([line[0] for line in text_lines])
    
    # Extract license number (varies by country)
    license_match = re.search(r'\b([A-Z0-9]{6,15})\b', full_text)
    license_number = license_match.group(1) if license_match else ""
    
    # Extract full name
    name = ""
    for i, (text, conf, _) in enumerate(text_lines):
        if 'name' in text.lower():
            if i + 1 < len(text_lines):
                name = text_lines[i + 1][0]
                break
    
    # Extract date of birth
    dob = ""
    dob_patterns = [
        r'(\d{2}[/-]\d{2}[/-]\d{4})',
        r'(\d{4}[/-]\d{2}[/-]\d{2})',
    ]
    for pattern in dob_patterns:
        match = re.search(pattern, full_text)
        if match:
            dob = normalize_date(match.group(1))
            break
    
    # Extract address
    address = ""
    for i, (text, conf, _) in enumerate(text_lines):
        if 'address' in text.lower():
            address_parts = []
            for j in range(i + 1, min(i + 3, len(text_lines))):
                address_parts.append(text_lines[j][0])
            address = ', '.join(address_parts)
            break
    
    return {
        'documentNumber': license_number,
        'fullName': name,
        'dateOfBirth': dob,
        'address': address,
        'documentType': 'drivers_license',
        'country': 'Unknown',
        'confidence': calculate_confidence(text_lines),
    }


def normalize_date(date_str: str) -> str:
    """Normalize date to YYYY-MM-DD format"""
    try:
        # Handle different date formats
        if '/' in date_str:
            parts = date_str.split('/')
        elif '-' in date_str:
            parts = date_str.split('-')
        else:
            return date_str
        
        if len(parts) != 3:
            return date_str
        
        # Determine format (DD/MM/YYYY or YYYY/MM/DD)
        if len(parts[0]) == 4:
            # YYYY/MM/DD
            return f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
        else:
            # DD/MM/YYYY
            year = parts[2]
            if len(year) == 2:
                year = '20' + year
            return f"{year}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
    except Exception:
        return date_str


def calculate_confidence(text_lines: List[Tuple[str, float, float]]) -> float:
    """Calculate overall confidence score from OCR results"""
    if not text_lines:
        return 0.0
    
    confidences = [conf for _, conf, _ in text_lines]
    return sum(confidences) / len(confidences)


def detect_document_type(text_lines: List[Tuple[str, float, float]]) -> str:
    """Detect document type from extracted text"""
    
    full_text = ' '.join([line[0] for line in text_lines]).lower()
    
    # Check for Nigerian ID
    if 'nigeria' in full_text or 'nin' in full_text or re.search(r'\b\d{11}\b', full_text):
        return 'nigerian_national_id'
    
    # Check for Kenyan ID
    if 'kenya' in full_text or 'republic of kenya' in full_text:
        return 'kenyan_national_id'
    
    # Check for Ghana Card
    if 'ghana' in full_text or re.search(r'GHA-\d{9}-\d', full_text):
        return 'ghanaian_ghana_card'
    
    # Check for South African ID
    if 'south africa' in full_text or re.search(r'\b\d{13}\b', full_text):
        return 'south_african_id'
    
    # Check for passport
    if 'passport' in full_text:
        return 'passport'
    
    # Check for driver's license
    if 'driver' in full_text or 'license' in full_text or 'licence' in full_text:
        return 'drivers_license'
    
    return 'unknown'


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'kyc-document-ocr',
        'paddleocr': paddle_ocr is not None and paddle_ocr is not False,
    })


@app.route('/extract-document', methods=['POST'])
def extract_document():
    """Extract structured data from KYC document image"""
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
        text_lines = extract_text_from_image(image_data)
        
        if not text_lines:
            return jsonify({'error': 'No text found in document image'}), 400
        
        # Detect document type
        doc_type = detect_document_type(text_lines)
        
        # Parse based on document type
        if doc_type == 'nigerian_national_id':
            result = parse_nigerian_national_id(text_lines)
        elif doc_type == 'kenyan_national_id':
            result = parse_kenyan_national_id(text_lines)
        elif doc_type == 'ghanaian_ghana_card':
            result = parse_ghanaian_ghana_card(text_lines)
        elif doc_type == 'south_african_id':
            result = parse_south_african_id(text_lines)
        elif doc_type == 'passport':
            result = parse_passport(text_lines)
        elif doc_type == 'drivers_license':
            result = parse_drivers_license(text_lines)
        else:
            return jsonify({'error': 'Unknown document type'}), 400
        
        # Add raw OCR text for debugging
        result['rawText'] = [line[0] for line in text_lines]
        result['detectedType'] = doc_type
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error extracting document data: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('KYC_OCR_PORT', 5008))
    print(f"Starting KYC Document OCR Service on port {port}...")
    print("Loading PaddleOCR...")
    load_paddle_ocr()
    print("KYC Document OCR Service ready!")
    app.run(host='0.0.0.0', port=port, debug=False)
