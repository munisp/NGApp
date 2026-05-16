import cv2
import numpy as np
import dlib
from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.liveness import LivenessCheck, LivenessType, LivenessStatus, SpoofingType
from app.services.tinyliveness_detector import TinyLivenessDetector
import uuid
from datetime import datetime
import logging
from dapr.clients import DaprClient
import json

logger = logging.getLogger(__name__)


class LivenessDetectionService:
    def __init__(self, db: Session):
        self.db = db
        self.face_detector = dlib.get_frontal_face_detector()
        self.shape_predictor = dlib.shape_predictor("/app/models/shape_predictor_68_face_landmarks.dat")
        self.face_recognizer = dlib.face_recognition_model_v1("/app/models/dlib_face_recognition_resnet_model_v1.dat")
        self.dapr_client = DaprClient()
        self.tinyliveness = TinyLivenessDetector()

    async def check_liveness(
        self,
        customer_id: str,
        media_path: str,
        liveness_type: LivenessType,
        document_id: str = None
    ) -> LivenessCheck:
        check = LivenessCheck(
            id=uuid.uuid4(),
            customer_id=uuid.UUID(customer_id),
            document_id=uuid.UUID(document_id) if document_id else None,
            liveness_type=liveness_type,
            status=LivenessStatus.PROCESSING
        )

        if liveness_type == LivenessType.PASSIVE:
            check.image_path = media_path
        else:
            check.video_path = media_path

        self.db.add(check)
        self.db.commit()

        try:
            if liveness_type == LivenessType.PASSIVE:
                result = self._passive_liveness_check(media_path)
            else:
                result = self._active_liveness_check(media_path)

            check.liveness_score = result["liveness_score"]
            check.is_live = result["is_live"]
            check.spoofing_detected = result["spoofing_detected"]
            check.spoofing_type = result.get("spoofing_type", SpoofingType.NONE)
            check.metadata = result.get("metadata", {})
            check.status = LivenessStatus.PASSED if result["is_live"] else LivenessStatus.FAILED

            self.db.commit()

            await self._publish_event(check)

            return check

        except Exception as e:
            logger.error(f"Liveness check failed: {str(e)}")
            check.status = LivenessStatus.ERROR
            check.error_message = str(e)
            self.db.commit()
            raise

    def _passive_liveness_check(self, image_path: str) -> Dict[str, Any]:
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError("Invalid image file")

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = self.face_detector(gray)

        if len(faces) == 0:
            return {
                "liveness_score": 0.0,
                "is_live": False,
                "spoofing_detected": True,
                "spoofing_type": SpoofingType.NONE,
                "metadata": {"error": "No face detected"}
            }

        if len(faces) > 1:
            return {
                "liveness_score": 0.0,
                "is_live": False,
                "spoofing_detected": True,
                "spoofing_type": SpoofingType.NONE,
                "metadata": {"error": "Multiple faces detected"}
            }

        face = faces[0]

        # Supplementary heuristic signals (kept for metadata/audit)
        texture_score = self._analyze_texture(gray, face)
        color_score = self._analyze_color_distribution(image, face)
        reflection_score = self._detect_screen_reflection(image, face)
        depth_score = self._analyze_depth_cues(gray, face)

        # Extract face crop for TinyLiveness
        top = max(0, face.top())
        bottom = min(image.shape[0], face.bottom())
        left = max(0, face.left())
        right = min(image.shape[1], face.right())
        face_crop = image[top:bottom, left:right]

        # Primary: TinyLiveness ML model
        if self.tinyliveness.is_available and face_crop.size > 0:
            ml_result = self.tinyliveness.predict(face_crop)
            liveness_score = ml_result["live_probability"]
            is_live = ml_result["decision"] == "live"
            spoofing_detected = ml_result["decision"] == "spoof"
            detection_method = "tinyliveness_onnx"
        else:
            # Fallback: weighted heuristic scoring (original logic)
            liveness_score = (
                texture_score * 0.3 +
                color_score * 0.25 +
                reflection_score * 0.25 +
                depth_score * 0.2
            )
            is_live = liveness_score >= 0.65
            spoofing_detected = not is_live
            detection_method = "heuristic_fallback"

        spoofing_type = SpoofingType.NONE
        if spoofing_detected:
            if reflection_score < 0.4:
                spoofing_type = SpoofingType.PHOTO
            elif texture_score < 0.5:
                spoofing_type = SpoofingType.VIDEO
            elif color_score < 0.5:
                spoofing_type = SpoofingType.MASK

        return {
            "liveness_score": liveness_score,
            "is_live": is_live,
            "spoofing_detected": spoofing_detected,
            "spoofing_type": spoofing_type,
            "metadata": {
                "detection_method": detection_method,
                "texture_score": texture_score,
                "color_score": color_score,
                "reflection_score": reflection_score,
                "depth_score": depth_score,
            }
        }

    def _active_liveness_check(self, video_path: str) -> Dict[str, Any]:
        cap = cv2.VideoCapture(video_path)

        if not cap.isOpened():
            raise ValueError("Invalid video file")

        frame_count = 0
        motion_scores = []
        face_positions = []
        ml_scores = []

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_count % 5 == 0:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = self.face_detector(gray)

                if len(faces) > 0:
                    face = faces[0]
                    face_positions.append((face.left(), face.top(), face.right(), face.bottom()))

                    if len(face_positions) > 1:
                        motion = self._calculate_motion(face_positions[-2], face_positions[-1])
                        motion_scores.append(motion)

                    # Run TinyLiveness on sampled frames
                    if self.tinyliveness.is_available:
                        top = max(0, face.top())
                        bottom = min(frame.shape[0], face.bottom())
                        left = max(0, face.left())
                        right = min(frame.shape[1], face.right())
                        face_crop = frame[top:bottom, left:right]
                        if face_crop.size > 0:
                            ml_result = self.tinyliveness.predict(face_crop)
                            if ml_result["live_probability"] is not None:
                                ml_scores.append(ml_result["live_probability"])

            frame_count += 1

        cap.release()

        if len(motion_scores) == 0:
            return {
                "liveness_score": 0.0,
                "is_live": False,
                "spoofing_detected": True,
                "spoofing_type": SpoofingType.NONE,
                "metadata": {"error": "No motion detected"}
            }

        avg_motion = np.mean(motion_scores)
        motion_variance = np.var(motion_scores)

        motion_score = min(avg_motion / 50.0, 1.0)
        variance_score = min(motion_variance / 100.0, 1.0)

        # Combine motion analysis with ML liveness scores
        motion_liveness = motion_score * 0.6 + variance_score * 0.4

        if ml_scores:
            avg_ml_score = float(np.mean(ml_scores))
            # Weighted: 50% motion analysis + 50% ML liveness
            liveness_score = motion_liveness * 0.5 + avg_ml_score * 0.5
            detection_method = "hybrid_motion_tinyliveness"
        else:
            liveness_score = motion_liveness
            avg_ml_score = None
            detection_method = "motion_only"

        is_live = liveness_score >= 0.6
        spoofing_detected = not is_live

        spoofing_type = SpoofingType.NONE
        if spoofing_detected:
            if avg_motion < 10:
                spoofing_type = SpoofingType.PHOTO
            elif motion_variance < 20:
                spoofing_type = SpoofingType.VIDEO

        return {
            "liveness_score": liveness_score,
            "is_live": is_live,
            "spoofing_detected": spoofing_detected,
            "spoofing_type": spoofing_type,
            "metadata": {
                "detection_method": detection_method,
                "avg_motion": float(avg_motion),
                "motion_variance": float(motion_variance),
                "frame_count": frame_count,
                "avg_ml_liveness": avg_ml_score,
                "ml_frame_samples": len(ml_scores),
            }
        }

    def _analyze_texture(self, gray_image: np.ndarray, face: dlib.rectangle) -> float:
        face_region = gray_image[face.top():face.bottom(), face.left():face.right()]

        if face_region.size == 0:
            return 0.0

        laplacian = cv2.Laplacian(face_region, cv2.CV_64F)
        variance = laplacian.var()

        texture_score = min(variance / 500.0, 1.0)

        return texture_score

    def _analyze_color_distribution(self, image: np.ndarray, face: dlib.rectangle) -> float:
        face_region = image[face.top():face.bottom(), face.left():face.right()]

        if face_region.size == 0:
            return 0.0

        hsv = cv2.cvtColor(face_region, cv2.COLOR_BGR2HSV)

        hist_h = cv2.calcHist([hsv], [0], None, [180], [0, 180])
        hist_s = cv2.calcHist([hsv], [1], None, [256], [0, 256])

        h_variance = np.var(hist_h)
        s_variance = np.var(hist_s)

        color_score = min((h_variance + s_variance) / 10000.0, 1.0)

        return color_score

    def _detect_screen_reflection(self, image: np.ndarray, face: dlib.rectangle) -> float:
        face_region = image[face.top():face.bottom(), face.left():face.right()]

        if face_region.size == 0:
            return 0.0

        gray = cv2.cvtColor(face_region, cv2.COLOR_BGR2GRAY)

        bright_pixels = np.sum(gray > 200)
        total_pixels = gray.size
        bright_ratio = bright_pixels / total_pixels

        reflection_score = 1.0 - min(bright_ratio * 5, 1.0)

        return reflection_score

    def _analyze_depth_cues(self, gray_image: np.ndarray, face: dlib.rectangle) -> float:
        face_region = gray_image[face.top():face.bottom(), face.left():face.right()]

        if face_region.size == 0:
            return 0.0

        edges = cv2.Canny(face_region, 50, 150)
        edge_density = np.sum(edges > 0) / edges.size

        depth_score = min(edge_density * 10, 1.0)

        return depth_score

    def _calculate_motion(self, pos1: Tuple, pos2: Tuple) -> float:
        dx = pos2[0] - pos1[0]
        dy = pos2[1] - pos1[1]
        motion = np.sqrt(dx**2 + dy**2)
        return motion

    async def _publish_event(self, check: LivenessCheck):
        event_data = {
            "check_id": str(check.id),
            "customer_id": str(check.customer_id),
            "liveness_type": check.liveness_type.value,
            "is_live": check.is_live,
            "liveness_score": check.liveness_score,
            "spoofing_detected": check.spoofing_detected,
            "status": check.status.value,
            "timestamp": datetime.utcnow().isoformat()
        }

        try:
            self.dapr_client.publish_event(
                pubsub_name="kafka-pubsub",
                topic_name="kyc.liveness.checked",
                data=json.dumps(event_data)
            )
        except Exception as e:
            logger.error(f"Failed to publish event: {str(e)}")

    def get_liveness_check(self, check_id: str) -> LivenessCheck:
        return self.db.query(LivenessCheck).filter(LivenessCheck.id == uuid.UUID(check_id)).first()

    def get_customer_checks(self, customer_id: str) -> list[LivenessCheck]:
        return self.db.query(LivenessCheck).filter(LivenessCheck.customer_id == uuid.UUID(customer_id)).all()
