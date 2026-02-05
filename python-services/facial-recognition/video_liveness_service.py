#!/usr/bin/env python3
"""
Video Liveness Detection Service
Prevents photo spoofing with random challenges (blink, turn head, smile, nod)
"""

import os
import sys
import json
import random
import base64
import logging
from typing import List, Dict, Optional
from datetime import datetime
import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from deepface import DeepFace
import mediapipe as mp

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Video Liveness Detection Service")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MediaPipe Face Mesh for landmark detection
try:
    # Try new API (MediaPipe 0.10+)
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision
    face_mesh = None  # Will initialize per-request
    USE_NEW_API = True
except ImportError:
    # Fallback to old API
    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )
    USE_NEW_API = False

# Challenge types
CHALLENGE_TYPES = ["blink", "turn_left", "turn_right", "smile", "nod"]

class LivenessChallenge(BaseModel):
    session_id: str
    challenges: List[str]

class LivenessVerification(BaseModel):
    session_id: str
    video_base64: str
    reference_image_base64: str

class LivenessResult(BaseModel):
    session_id: str
    passed: bool
    confidence: float
    challenges_completed: List[str]
    failed_challenges: List[str]
    anti_spoofing_score: float
    face_match_confidence: float
    details: Dict

# Store active sessions
active_sessions: Dict[str, Dict] = {}

def generate_random_challenges(count: int = 3) -> List[str]:
    """Generate random liveness challenges."""
    return random.sample(CHALLENGE_TYPES, min(count, len(CHALLENGE_TYPES)))

def detect_blink(landmarks, frame_idx: int, history: List) -> bool:
    """Detect eye blink using Eye Aspect Ratio (EAR)."""
    # Left eye landmarks: 362, 385, 387, 263, 373, 380
    # Right eye landmarks: 33, 160, 158, 133, 153, 144
    
    left_eye = [landmarks[362], landmarks[385], landmarks[387], 
                landmarks[263], landmarks[373], landmarks[380]]
    right_eye = [landmarks[33], landmarks[160], landmarks[158],
                 landmarks[133], landmarks[153], landmarks[144]]
    
    def eye_aspect_ratio(eye):
        # Vertical distances
        v1 = np.linalg.norm(np.array([eye[1].x - eye[5].x, eye[1].y - eye[5].y]))
        v2 = np.linalg.norm(np.array([eye[2].x - eye[4].x, eye[2].y - eye[4].y]))
        # Horizontal distance
        h = np.linalg.norm(np.array([eye[0].x - eye[3].x, eye[0].y - eye[3].y]))
        return (v1 + v2) / (2.0 * h)
    
    left_ear = eye_aspect_ratio(left_eye)
    right_ear = eye_aspect_ratio(right_eye)
    ear = (left_ear + right_ear) / 2.0
    
    history.append(ear)
    if len(history) > 10:
        history.pop(0)
    
    # Blink detected if EAR drops below threshold
    if len(history) >= 5:
        avg_ear = sum(history) / len(history)
        if ear < 0.2 and avg_ear > 0.25:
            return True
    
    return False

def detect_head_turn(landmarks, direction: str) -> bool:
    """Detect head turn left or right."""
    # Use nose tip (1) and face oval landmarks
    nose_tip = landmarks[1]
    left_face = landmarks[234]
    right_face = landmarks[454]
    
    # Calculate horizontal position relative to face width
    face_width = abs(right_face.x - left_face.x)
    nose_offset = (nose_tip.x - left_face.x) / face_width
    
    if direction == "turn_left":
        return nose_offset < 0.35  # Nose moved to left
    elif direction == "turn_right":
        return nose_offset > 0.65  # Nose moved to right
    
    return False

def detect_smile(landmarks) -> bool:
    """Detect smile using mouth landmarks."""
    # Mouth corners: 61 (left), 291 (right)
    # Upper lip: 13
    # Lower lip: 14
    
    left_corner = landmarks[61]
    right_corner = landmarks[291]
    upper_lip = landmarks[13]
    lower_lip = landmarks[14]
    
    # Calculate mouth width and height
    mouth_width = np.linalg.norm(np.array([right_corner.x - left_corner.x, 
                                           right_corner.y - left_corner.y]))
    mouth_height = np.linalg.norm(np.array([upper_lip.x - lower_lip.x,
                                            upper_lip.y - lower_lip.y]))
    
    # Smile ratio (wider mouth relative to height)
    smile_ratio = mouth_width / (mouth_height + 0.001)
    
    return smile_ratio > 3.5

def detect_nod(landmarks, frame_idx: int, history: List) -> bool:
    """Detect head nod (up and down movement)."""
    # Use nose tip vertical position
    nose_tip = landmarks[1]
    
    history.append(nose_tip.y)
    if len(history) > 15:
        history.pop(0)
    
    # Nod detected if vertical movement exceeds threshold
    if len(history) >= 10:
        y_values = history[-10:]
        y_range = max(y_values) - min(y_values)
        if y_range > 0.05:  # Significant vertical movement
            return True
    
    return False

def detect_screen_replay(frames: List[np.ndarray]) -> float:
    """Detect screen replay attack using texture analysis."""
    # Analyze texture patterns (moiré effect from screen)
    scores = []
    
    for frame in frames[::5]:  # Sample every 5th frame
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Calculate Laplacian variance (blur detection)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        # FFT analysis for moiré patterns
        f = np.fft.fft2(gray)
        fshift = np.fft.fftshift(f)
        magnitude_spectrum = 20 * np.log(np.abs(fshift) + 1)
        
        # High frequency content indicates real face
        high_freq_energy = np.sum(magnitude_spectrum[100:150, 100:150])
        
        score = (laplacian_var / 1000) + (high_freq_energy / 10000)
        scores.append(min(score, 1.0))
    
    return sum(scores) / len(scores) if scores else 0.0

def detect_mask_attack(frame: np.ndarray) -> float:
    """Detect 3D mask attack using depth cues."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Calculate image sharpness (masks are usually less sharp)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    sharpness = laplacian.var()
    
    # Color histogram analysis (masks have different color distribution)
    hist = cv2.calcHist([frame], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
    hist = cv2.normalize(hist, hist).flatten()
    entropy = -np.sum(hist * np.log2(hist + 1e-7))
    
    # Combine scores
    score = (sharpness / 1000) + (entropy / 10)
    return min(score, 1.0)

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "video_liveness_detection"}

@app.post("/api/liveness/start-session")
async def start_liveness_session(challenge_count: int = 3) -> LivenessChallenge:
    """Start a new liveness detection session with random challenges."""
    session_id = f"liveness_{datetime.now().strftime('%Y%m%d%H%M%S')}_{random.randint(1000, 9999)}"
    challenges = generate_random_challenges(challenge_count)
    
    active_sessions[session_id] = {
        "challenges": challenges,
        "created_at": datetime.now().isoformat(),
        "status": "pending"
    }
    
    logger.info(f"Started liveness session {session_id} with challenges: {challenges}")
    
    return LivenessChallenge(session_id=session_id, challenges=challenges)

@app.post("/api/liveness/verify")
async def verify_liveness(request: LivenessVerification) -> LivenessResult:
    """Verify liveness using video with random challenges."""
    session_id = request.session_id
    
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = active_sessions[session_id]
    required_challenges = session["challenges"]
    
    try:
        # Decode video from base64
        video_bytes = base64.b64decode(request.video_base64)
        video_path = f"/tmp/{session_id}.mp4"
        with open(video_path, "wb") as f:
            f.write(video_bytes)
        
        # Decode reference image
        ref_image_bytes = base64.b64decode(request.reference_image_base64)
        ref_image_path = f"/tmp/{session_id}_ref.jpg"
        with open(ref_image_path, "wb") as f:
            f.write(ref_image_bytes)
        
        # Process video
        cap = cv2.VideoCapture(video_path)
        frames = []
        frame_idx = 0
        
        challenges_completed = []
        challenge_history = {challenge: [] for challenge in required_challenges}
        blink_history = []
        nod_history = []
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            frames.append(frame)
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Process frame with MediaPipe
            if USE_NEW_API:
                # Skip face mesh processing for new API (not fully supported yet)
                # Fall back to basic frame analysis
                continue
            else:
                results = face_mesh.process(rgb_frame)
                if not results.multi_face_landmarks:
                    continue
                landmarks = results.multi_face_landmarks[0].landmark
                
                # Check each required challenge
                for challenge in required_challenges:
                    if challenge in challenges_completed:
                        continue
                    
                    detected = False
                    if challenge == "blink":
                        detected = detect_blink(landmarks, frame_idx, blink_history)
                    elif challenge == "turn_left":
                        detected = detect_head_turn(landmarks, "turn_left")
                    elif challenge == "turn_right":
                        detected = detect_head_turn(landmarks, "turn_right")
                    elif challenge == "smile":
                        detected = detect_smile(landmarks)
                    elif challenge == "nod":
                        detected = detect_nod(landmarks, frame_idx, nod_history)
                    
                    if detected:
                        challenge_history[challenge].append(frame_idx)
                        if len(challenge_history[challenge]) >= 3:  # Require 3 detections
                            challenges_completed.append(challenge)
                            logger.info(f"Challenge '{challenge}' completed at frame {frame_idx}")
            
            frame_idx += 1
        
        cap.release()
        
        # Anti-spoofing detection
        screen_replay_score = detect_screen_replay(frames)
        mask_score = detect_mask_attack(frames[len(frames)//2]) if frames else 0.0
        anti_spoofing_score = (screen_replay_score + mask_score) / 2.0
        
        # Face matching with reference image
        try:
            result = DeepFace.verify(
                ref_image_path,
                video_path,
                model_name="Facenet512",
                enforce_detection=False
            )
            face_match_confidence = 1.0 - result["distance"]
        except Exception as e:
            logger.error(f"Face matching failed: {e}")
            face_match_confidence = 0.0
        
        # Calculate overall confidence
        challenge_completion_rate = len(challenges_completed) / len(required_challenges)
        confidence = (
            challenge_completion_rate * 0.4 +
            anti_spoofing_score * 0.3 +
            face_match_confidence * 0.3
        )
        
        # Determine if passed
        passed = (
            challenge_completion_rate >= 0.67 and  # At least 2/3 challenges
            anti_spoofing_score > 0.5 and
            face_match_confidence > 0.6
        )
        
        failed_challenges = [c for c in required_challenges if c not in challenges_completed]
        
        # Update session
        session["status"] = "completed"
        session["passed"] = passed
        session["completed_at"] = datetime.now().isoformat()
        
        # Cleanup
        os.remove(video_path)
        os.remove(ref_image_path)
        
        logger.info(f"Liveness verification completed: session={session_id}, passed={passed}, confidence={confidence:.2f}")
        
        return LivenessResult(
            session_id=session_id,
            passed=passed,
            confidence=confidence,
            challenges_completed=challenges_completed,
            failed_challenges=failed_challenges,
            anti_spoofing_score=anti_spoofing_score,
            face_match_confidence=face_match_confidence,
            details={
                "total_frames": frame_idx,
                "challenge_completion_rate": challenge_completion_rate,
                "screen_replay_score": screen_replay_score,
                "mask_score": mask_score
            }
        )
    
    except Exception as e:
        logger.error(f"Liveness verification failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5011, log_level="info")
