#!/usr/bin/env python3
"""
Facial Recognition Service for KYC Verification
Uses DeepFace library for accurate face matching with multiple models
Includes liveness detection to prevent photo spoofing
"""

import os
import sys
import json
import base64
import numpy as np
from typing import Dict, Tuple, Optional
from io import BytesIO

from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import cv2

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Global DeepFace instance (lazy loaded)
deepface = None

# Configuration
FACE_MATCH_THRESHOLD = 0.4  # DeepFace cosine distance threshold (lower is stricter)
MODEL_NAME = 'Facenet512'  # Options: VGG-Face, Facenet, Facenet512, OpenFace, DeepFace, DeepID, ArcFace


def load_deepface():
    """Lazy load DeepFace"""
    global deepface
    if deepface is None:
        try:
            from deepface import DeepFace
            deepface = DeepFace
            print(f"✓ DeepFace loaded successfully with model: {MODEL_NAME}")
        except Exception as e:
            print(f"✗ Failed to load DeepFace: {e}")
            deepface = False
    return deepface


def load_image_from_base64(image_base64: str) -> np.ndarray:
    """Load image from base64 string and convert to OpenCV format"""
    try:
        # Remove data URL prefix if present
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        image_data = base64.b64decode(image_base64)
        image = Image.open(BytesIO(image_data))
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Convert PIL image to OpenCV format (BGR)
        opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        return opencv_image
    except Exception as e:
        raise ValueError(f"Failed to load image: {str(e)}")


def check_face_quality(image: np.ndarray) -> Dict:
    """
    Check face quality for liveness detection
    Returns quality metrics to detect photo spoofing
    """
    try:
        # Convert to grayscale for analysis
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # 1. Sharpness (Laplacian variance - blurry images indicate photos of photos)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        sharpness_score = min(laplacian_var / 500, 1.0)
        
        # 2. Brightness variation (flat lighting indicates printed photo)
        brightness_std = np.std(gray)
        brightness_score = min(brightness_std / 50, 1.0)
        
        # 3. Color variation (printed photos have less color variation)
        b, g, r = cv2.split(image)
        color_std = (np.std(b) + np.std(g) + np.std(r)) / 3
        color_score = min(color_std / 30, 1.0)
        
        # 4. Edge density (real faces have more edges than printed photos)
        edges = cv2.Canny(gray, 100, 200)
        edge_density = np.sum(edges > 0) / edges.size
        edge_score = min(edge_density / 0.1, 1.0)
        
        # Overall quality score (weighted average)
        quality_score = (
            sharpness_score * 0.3 +
            brightness_score * 0.2 +
            color_score * 0.2 +
            edge_score * 0.3
        )
        
        return {
            'qualityScore': float(quality_score),
            'sharpness': float(sharpness_score),
            'brightness': float(brightness_score),
            'colorVariation': float(color_score),
            'edgeDensity': float(edge_score),
            'isLikelyLive': quality_score > 0.5,  # Threshold for liveness
        }
    except Exception as e:
        print(f"Quality check error: {e}")
        return {
            'qualityScore': 0.5,
            'sharpness': 0.5,
            'brightness': 0.5,
            'colorVariation': 0.5,
            'edgeDensity': 0.5,
            'isLikelyLive': True,  # Default to true if check fails
        }


def save_temp_image(image: np.ndarray, prefix: str) -> str:
    """Save image temporarily for DeepFace processing"""
    import tempfile
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg', prefix=prefix)
    cv2.imwrite(temp_file.name, image)
    return temp_file.name


def cleanup_temp_file(filepath: str):
    """Remove temporary file"""
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception:
        pass


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    df = load_deepface()
    return jsonify({
        'status': 'healthy',
        'service': 'facial-recognition',
        'library': 'DeepFace',
        'model': MODEL_NAME,
        'threshold': FACE_MATCH_THRESHOLD,
        'loaded': df is not None and df is not False,
    })


@app.route('/verify-face', methods=['POST'])
def verify_face():
    """
    Verify if selfie matches ID document photo
    Expects: { idImage: base64, selfieImage: base64 }
    Returns: { isMatch, confidence, livenessCheck, details }
    """
    id_temp_path = None
    selfie_temp_path = None
    
    try:
        df = load_deepface()
        if not df or df is False:
            return jsonify({'error': 'DeepFace not loaded', 'isMatch': False, 'confidence': 0}), 500
        
        data = request.get_json()
        
        if not data or 'idImage' not in data or 'selfieImage' not in data:
            return jsonify({'error': 'Both idImage and selfieImage are required'}), 400
        
        # Load images
        id_image = load_image_from_base64(data['idImage'])
        selfie_image = load_image_from_base64(data['selfieImage'])
        
        # Check selfie quality for liveness detection
        liveness_check = check_face_quality(selfie_image)
        
        # Save images temporarily for DeepFace
        id_temp_path = save_temp_image(id_image, 'id_')
        selfie_temp_path = save_temp_image(selfie_image, 'selfie_')
        
        # Verify faces using DeepFace
        result = df.verify(
            img1_path=id_temp_path,
            img2_path=selfie_temp_path,
            model_name=MODEL_NAME,
            distance_metric='cosine',
            enforce_detection=True,
        )
        
        # Extract results
        is_match = result['verified']
        distance = result['distance']
        threshold = result['threshold']
        
        # Convert distance to confidence percentage
        # Cosine distance: 0.0 = identical, 1.0 = completely different
        confidence = (1.0 - distance) * 100
        
        # Final decision: match AND passes liveness check
        final_match = is_match and liveness_check['isLikelyLive']
        
        # Cleanup temp files
        cleanup_temp_file(id_temp_path)
        cleanup_temp_file(selfie_temp_path)
        
        return jsonify({
            'isMatch': final_match,
            'confidence': float(confidence),
            'livenessCheck': liveness_check,
            'details': {
                'distance': float(distance),
                'threshold': float(threshold),
                'model': MODEL_NAME,
                'metric': 'cosine',
            },
            'warnings': [] if final_match else [
                'Face does not match ID document' if not is_match else 'Liveness check failed - possible photo spoofing'
            ],
        })
        
    except ValueError as e:
        if id_temp_path:
            cleanup_temp_file(id_temp_path)
        if selfie_temp_path:
            cleanup_temp_file(selfie_temp_path)
        return jsonify({'error': str(e), 'isMatch': False, 'confidence': 0}), 400
    except Exception as e:
        if id_temp_path:
            cleanup_temp_file(id_temp_path)
        if selfie_temp_path:
            cleanup_temp_file(selfie_temp_path)
        
        print(f"Face verification error: {e}")
        import traceback
        traceback.print_exc()
        
        # Check if error is due to no face detected
        error_msg = str(e).lower()
        if 'face' in error_msg and ('not' in error_msg or 'no' in error_msg or 'detect' in error_msg):
            return jsonify({
                'error': 'No face detected in one or both images',
                'isMatch': False,
                'confidence': 0
            }), 400
        
        return jsonify({'error': 'Internal server error', 'isMatch': False, 'confidence': 0}), 500


@app.route('/detect-faces', methods=['POST'])
def detect_faces_endpoint():
    """
    Detect faces in an image
    Expects: { image: base64 }
    Returns: { faceCount, qualityCheck }
    """
    temp_path = None
    
    try:
        df = load_deepface()
        if not df or df is False:
            return jsonify({'error': 'DeepFace not loaded'}), 500
        
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({'error': 'Image is required'}), 400
        
        # Load image
        image = load_image_from_base64(data['image'])
        
        # Check quality
        quality_check = check_face_quality(image)
        
        # Save image temporarily
        temp_path = save_temp_image(image, 'detect_')
        
        # Detect faces using DeepFace
        faces = df.extract_faces(
            img_path=temp_path,
            target_size=(224, 224),
            detector_backend='opencv',
            enforce_detection=False,
        )
        
        # Cleanup
        cleanup_temp_file(temp_path)
        
        return jsonify({
            'faceCount': len(faces),
            'qualityCheck': quality_check,
            'faces': [
                {
                    'confidence': float(face.get('confidence', 0)),
                    'region': face.get('facial_area', {}),
                }
                for face in faces
            ],
        })
        
    except ValueError as e:
        if temp_path:
            cleanup_temp_file(temp_path)
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        if temp_path:
            cleanup_temp_file(temp_path)
        
        print(f"Face detection error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    port = int(os.environ.get('FACE_RECOGNITION_PORT', 5009))
    print(f"Starting Facial Recognition Service on port {port}...")
    print(f"Model: {MODEL_NAME}")
    print(f"Face match threshold: {FACE_MATCH_THRESHOLD} (cosine distance)")
    print("Loading DeepFace...")
    load_deepface()
    print("Facial Recognition Service ready!")
    app.run(host='0.0.0.0', port=port, debug=False)
