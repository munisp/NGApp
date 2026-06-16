"""
Face Feature Extraction & Matching
====================================
Extracts 128-d face embeddings and computes similarity scores.
Uses face_recognition (dlib) as primary, OpenCV DNN as fallback.
"""

import logging
from dataclasses import dataclass
from typing import List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger("liveness.face_matcher")


@dataclass
class FaceEmbedding:
    """128-dimensional face feature vector."""
    vector: np.ndarray  # (128,) float64
    model: str  # "dlib" or "opencv_dnn"


@dataclass
class MatchResult:
    """Face matching result between two images."""
    similarity: float  # 0.0 - 1.0
    distance: float    # Euclidean distance
    is_match: bool     # True if similarity >= threshold
    threshold: float
    confidence: float  # Calibrated confidence 0-100
    embedding_model: str


class FaceFeatureExtractor:
    """Extract face embeddings for matching and identification."""

    def __init__(self):
        self._backend = "none"
        self._face_rec = None
        self._dnn_net = None
        self._init_backend()

    def _init_backend(self):
        # Try face_recognition (dlib) first
        try:
            import face_recognition
            self._face_rec = face_recognition
            self._backend = "dlib"
            logger.info("[FaceFeatureExtractor] Using dlib backend (128-d embeddings)")
            return
        except ImportError:
            logger.warning("[FaceFeatureExtractor] face_recognition not available")

        # Fallback: OpenCV DNN face embedder
        try:
            model_path = cv2.data.haarcascades  # check OpenCV is usable
            self._backend = "opencv_histogram"
            logger.info("[FaceFeatureExtractor] Using OpenCV histogram fallback")
        except Exception:
            logger.error("[FaceFeatureExtractor] No face embedding backend available")

    def extract(self, face_image: np.ndarray) -> Optional[FaceEmbedding]:
        """Extract face embedding from a cropped face image (BGR)."""
        if face_image is None or face_image.size == 0:
            return None

        if self._backend == "dlib":
            return self._extract_dlib(face_image)
        elif self._backend == "opencv_histogram":
            return self._extract_histogram(face_image)
        return None

    def _extract_dlib(self, face_image: np.ndarray) -> Optional[FaceEmbedding]:
        rgb = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
        # Detect face locations in the crop (should find 1)
        locations = self._face_rec.face_locations(rgb, model="hog")
        if not locations:
            # Use full image as face region
            h, w = rgb.shape[:2]
            locations = [(0, w, h, 0)]

        encodings = self._face_rec.face_encodings(rgb, known_face_locations=locations)
        if not encodings:
            return None

        return FaceEmbedding(
            vector=np.array(encodings[0], dtype=np.float64),
            model="dlib",
        )

    def _extract_histogram(self, face_image: np.ndarray) -> Optional[FaceEmbedding]:
        """Fallback: color histogram as pseudo-embedding (128-d)."""
        hsv = cv2.cvtColor(face_image, cv2.COLOR_BGR2HSV)
        # 3-channel histogram: H(64 bins) + S(32 bins) + V(32 bins) = 128 dims
        hist_h = cv2.calcHist([hsv], [0], None, [64], [0, 180]).flatten()
        hist_s = cv2.calcHist([hsv], [1], None, [32], [0, 256]).flatten()
        hist_v = cv2.calcHist([hsv], [2], None, [32], [0, 256]).flatten()
        vec = np.concatenate([hist_h, hist_s, hist_v])
        # L2 normalize
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return FaceEmbedding(vector=vec, model="opencv_histogram")


class FaceMatcher:
    """Compare two face images and determine if they match."""

    def __init__(self, match_threshold: float = 0.6):
        self.extractor = FaceFeatureExtractor()
        self.match_threshold = match_threshold

    def match(
        self,
        face_a: np.ndarray,
        face_b: np.ndarray,
        threshold: Optional[float] = None,
    ) -> MatchResult:
        """Compare two face images. Returns match result with confidence."""
        thresh = threshold or self.match_threshold

        emb_a = self.extractor.extract(face_a)
        emb_b = self.extractor.extract(face_b)

        if emb_a is None or emb_b is None:
            return MatchResult(
                similarity=0.0,
                distance=999.0,
                is_match=False,
                threshold=thresh,
                confidence=0.0,
                embedding_model="none",
            )

        # Euclidean distance
        distance = float(np.linalg.norm(emb_a.vector - emb_b.vector))

        # Convert distance to similarity (0-1 scale)
        # For dlib: distance < 0.6 is same person (lower = more similar)
        # Similarity = 1 - (distance / max_distance)
        if emb_a.model == "dlib":
            max_dist = 1.2  # practical max for dlib
            similarity = max(0.0, 1.0 - (distance / max_dist))
            is_match = distance < thresh
        else:
            # Histogram: use cosine similarity
            cos_sim = float(np.dot(emb_a.vector, emb_b.vector))
            similarity = max(0.0, min(1.0, cos_sim))
            distance = 1.0 - similarity
            is_match = similarity >= (1.0 - thresh)

        # Calibrate confidence (0-100 scale)
        confidence = _calibrate_confidence(similarity, emb_a.model)

        return MatchResult(
            similarity=round(similarity, 4),
            distance=round(distance, 4),
            is_match=is_match,
            threshold=thresh,
            confidence=round(confidence, 2),
            embedding_model=emb_a.model,
        )

    def extract_embedding(self, face_image: np.ndarray) -> Optional[FaceEmbedding]:
        """Extract embedding for storage/later comparison."""
        return self.extractor.extract(face_image)


def _calibrate_confidence(similarity: float, model: str) -> float:
    """Convert raw similarity to calibrated confidence score (0-100)."""
    if model == "dlib":
        # dlib similarity 0.5 → ~50%, 0.7 → ~80%, 0.9 → ~98%
        if similarity >= 0.9:
            return 95 + (similarity - 0.9) * 50
        elif similarity >= 0.7:
            return 70 + (similarity - 0.7) * 125
        elif similarity >= 0.5:
            return 40 + (similarity - 0.5) * 150
        else:
            return similarity * 80
    else:
        return similarity * 100
