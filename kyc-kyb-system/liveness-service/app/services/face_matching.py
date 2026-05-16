import cv2
import numpy as np
import dlib
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

class FaceMatchingService:
    def __init__(self):
        self.face_detector = dlib.get_frontal_face_detector()
        self.shape_predictor = dlib.shape_predictor("/app/models/shape_predictor_68_face_landmarks.dat")
        self.face_recognizer = dlib.face_recognition_model_v1("/app/models/dlib_face_recognition_resnet_model_v1.dat")
    
    def match_faces(self, image1_path: str, image2_path: str) -> Dict[str, Any]:
        try:
            face1_encoding = self._get_face_encoding(image1_path)
            face2_encoding = self._get_face_encoding(image2_path)
            
            if face1_encoding is None or face2_encoding is None:
                return {
                    "match": False,
                    "confidence": 0.0,
                    "error": "Could not detect face in one or both images"
                }
            
            distance = np.linalg.norm(face1_encoding - face2_encoding)
            
            similarity = max(0, 1 - (distance / 0.6))
            
            match = similarity >= 0.6
            
            return {
                "match": match,
                "confidence": similarity,
                "distance": distance
            }
            
        except Exception as e:
            logger.error(f"Face matching failed: {str(e)}")
            return {
                "match": False,
                "confidence": 0.0,
                "error": str(e)
            }
    
    def _get_face_encoding(self, image_path: str) -> np.ndarray:
        image = cv2.imread(image_path)
        if image is None:
            return None
        
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        faces = self.face_detector(rgb_image)
        
        if len(faces) == 0:
            return None
        
        face = faces[0]
        
        shape = self.shape_predictor(rgb_image, face)
        
        face_encoding = self.face_recognizer.compute_face_descriptor(rgb_image, shape)
        
        return np.array(face_encoding)
    
    def extract_face_features(self, image_path: str) -> Dict[str, Any]:
        try:
            image = cv2.imread(image_path)
            if image is None:
                return {"error": "Invalid image file"}
            
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            faces = self.face_detector(gray)
            
            if len(faces) == 0:
                return {"error": "No face detected"}
            
            face = faces[0]
            shape = self.shape_predictor(gray, face)
            
            landmarks = []
            for i in range(68):
                landmarks.append({
                    "x": shape.part(i).x,
                    "y": shape.part(i).y
                })
            
            face_width = face.right() - face.left()
            face_height = face.bottom() - face.top()
            
            left_eye_center = np.mean([[landmarks[i]["x"], landmarks[i]["y"]] for i in range(36, 42)], axis=0)
            right_eye_center = np.mean([[landmarks[i]["x"], landmarks[i]["y"]] for i in range(42, 48)], axis=0)
            eye_distance = np.linalg.norm(left_eye_center - right_eye_center)
            
            nose_tip = [landmarks[30]["x"], landmarks[30]["y"]]
            
            mouth_left = [landmarks[48]["x"], landmarks[48]["y"]]
            mouth_right = [landmarks[54]["x"], landmarks[54]["y"]]
            mouth_width = np.linalg.norm(np.array(mouth_left) - np.array(mouth_right))
            
            return {
                "face_detected": True,
                "face_bounds": {
                    "left": face.left(),
                    "top": face.top(),
                    "right": face.right(),
                    "bottom": face.bottom()
                },
                "face_dimensions": {
                    "width": face_width,
                    "height": face_height
                },
                "landmarks_count": len(landmarks),
                "eye_distance": float(eye_distance),
                "mouth_width": float(mouth_width),
                "face_ratio": face_width / face_height if face_height > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Feature extraction failed: {str(e)}")
            return {"error": str(e)}
