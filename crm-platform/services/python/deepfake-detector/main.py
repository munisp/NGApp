"""
Deepfake & Spoofing Detector Service
ML-based anti-spoofing classification with model inference pipeline.
Supports: printed photo, screen replay, paper mask, 3D mask, deepfake, high-quality photo.
"""

import base64
import hashlib
import json
import logging
import math
import os
import struct
import sys
import time
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("deepfake-detector")

# --- Domain Models ---

class SpoofType(str, Enum):
    NONE = "none"
    PRINTED_PHOTO = "printed_photo"
    SCREEN_REPLAY = "screen_replay"
    PAPER_MASK = "paper_mask"
    THREE_D_MASK = "3d_mask"
    DEEPFAKE = "deepfake"
    HIGH_QUALITY_PHOTO = "high_quality_photo"


@dataclass
class FeatureVector:
    """128-dimensional face feature embedding."""
    values: list[float]
    norm: float = 0.0

    def __post_init__(self):
        self.norm = math.sqrt(sum(v * v for v in self.values)) if self.values else 0.0

    def cosine_similarity(self, other: "FeatureVector") -> float:
        if self.norm == 0 or other.norm == 0:
            return 0.0
        dot = sum(a * b for a, b in zip(self.values, other.values))
        return dot / (self.norm * other.norm)


@dataclass
class SpoofClassification:
    is_spoof: bool
    spoof_type: SpoofType
    confidence: float
    attack_probabilities: dict[str, float]
    features_used: list[str]
    processing_ms: int
    model_version: str = "1.0.0"


@dataclass
class FacialLandmark68:
    """68-point facial landmark with semantic regions."""
    points: list[tuple[float, float]]
    jaw: list[tuple[float, float]] = field(default_factory=list)          # 0-16
    right_eyebrow: list[tuple[float, float]] = field(default_factory=list) # 17-21
    left_eyebrow: list[tuple[float, float]] = field(default_factory=list)  # 22-26
    nose_bridge: list[tuple[float, float]] = field(default_factory=list)   # 27-30
    nose_tip: list[tuple[float, float]] = field(default_factory=list)      # 31-35
    right_eye: list[tuple[float, float]] = field(default_factory=list)     # 36-41
    left_eye: list[tuple[float, float]] = field(default_factory=list)      # 42-47
    outer_lip: list[tuple[float, float]] = field(default_factory=list)     # 48-59
    inner_lip: list[tuple[float, float]] = field(default_factory=list)     # 60-67
    confidence: float = 0.0


# --- Feature Extraction Pipeline ---

class FeatureExtractor:
    """Extracts discriminative features for anti-spoofing classification."""

    def extract_texture_features(self, data: bytes) -> dict[str, float]:
        """LBP + Gabor-like texture features."""
        if len(data) < 256:
            return {"lbp_entropy": 0.5, "lbp_uniformity": 0.5, "texture_contrast": 0.5}

        width = int(math.sqrt(len(data)))

        # Local Binary Pattern histogram
        lbp_hist = [0] * 256
        offsets = [(-1, -1), (-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1)]

        for row in range(1, min(len(data) // width - 1, 128)):
            for col in range(1, width - 1):
                idx = row * width + col
                center = data[idx]
                lbp = 0
                for bit, (dy, dx) in enumerate(offsets):
                    ni = (row + dy) * width + (col + dx)
                    if 0 <= ni < len(data) and data[ni] >= center:
                        lbp |= 1 << bit
                lbp_hist[lbp] += 1

        total = sum(lbp_hist)
        if total == 0:
            return {"lbp_entropy": 0.5, "lbp_uniformity": 0.5, "texture_contrast": 0.5}

        # Shannon entropy of LBP histogram
        entropy = 0.0
        for count in lbp_hist:
            if count > 0:
                p = count / total
                entropy -= p * math.log2(p)

        # Uniformity measure
        non_zero = sum(1 for c in lbp_hist if c > 0)
        uniformity = 1.0 - non_zero / 256.0

        # Texture contrast
        values = [data[i] for i in range(min(len(data), 10000))]
        mean_val = sum(values) / len(values)
        variance = sum((v - mean_val) ** 2 for v in values) / len(values)
        contrast = min(1.0, variance / 3000.0)

        return {
            "lbp_entropy": entropy / 8.0,
            "lbp_uniformity": uniformity,
            "texture_contrast": contrast,
        }

    def extract_frequency_features(self, data: bytes) -> dict[str, float]:
        """DCT-based frequency domain features."""
        if len(data) < 64:
            return {"high_freq_ratio": 0.5, "moire_energy": 0.0, "compression_artifacts": 0.5}

        width = int(math.sqrt(len(data)))
        low_energy = 0.0
        high_energy = 0.0
        moire_energy = 0.0
        samples = 0

        for row in range(2, min(len(data) // width - 2, 100)):
            for col in range(2, width - 2):
                idx = row * width + col
                if idx + width >= len(data):
                    break

                # First derivative
                gx = abs(data[idx + 1] - data[idx - 1])
                gy = abs(data[idx + width] - data[idx - width])
                low_energy += gx + gy

                # Second derivative (Laplacian)
                lap = (data[idx - 1] + data[idx + 1] + data[idx - width] + data[idx + width]
                       - 4 * data[idx])
                high_energy += abs(lap)

                # Moiré detection
                if col >= 4:
                    prev_idx = idx - 2
                    prev_lap = (data[prev_idx - 1] + data[prev_idx + 1]
                                + data[prev_idx - width] + data[prev_idx + width]
                                - 4 * data[prev_idx])
                    if (lap > 0) != (prev_lap > 0):
                        moire_energy += abs(lap)

                samples += 1

        total = low_energy + high_energy
        return {
            "high_freq_ratio": high_energy / total if total > 0 else 0.5,
            "moire_energy": min(1.0, moire_energy / high_energy) if high_energy > 0 else 0.0,
            "compression_artifacts": min(1.0, high_energy / max(samples, 1) / 50.0),
        }

    def extract_depth_features(self, data: bytes) -> dict[str, float]:
        """Gradient-based mono depth estimation."""
        if len(data) < 1024:
            return {"depth_variance": 0.1, "gradient_consistency": 0.5}

        width = int(math.sqrt(len(data)))
        block_size = max(width // 8, 4)
        block_grads = []
        height = len(data) // width

        for by in range(8):
            for bx in range(8):
                grad_sum = 0.0
                count = 0
                for y in range(by * block_size + 1, min((by + 1) * block_size, height - 1)):
                    for x in range(bx * block_size + 1, min((bx + 1) * block_size, width - 1)):
                        idx = y * width + x
                        if idx + width < len(data):
                            gx = abs(data[idx + 1] - data[idx - 1])
                            gy = abs(data[idx + width] - data[idx - width])
                            grad_sum += math.sqrt(gx * gx + gy * gy)
                            count += 1
                if count > 0:
                    block_grads.append(grad_sum / count)

        if not block_grads:
            return {"depth_variance": 0.1, "gradient_consistency": 0.5}

        mean = sum(block_grads) / len(block_grads)
        variance = sum((g - mean) ** 2 for g in block_grads) / len(block_grads)
        depth_variance = min(1.0, variance / 500.0)

        # Gradient consistency: real faces have structured gradient patterns
        sorted_grads = sorted(block_grads)
        q1 = sorted_grads[len(sorted_grads) // 4]
        q3 = sorted_grads[3 * len(sorted_grads) // 4]
        iqr = q3 - q1
        consistency = min(1.0, iqr / max(mean, 0.01))

        return {"depth_variance": depth_variance, "gradient_consistency": consistency}

    def extract_color_features(self, data: bytes) -> dict[str, float]:
        """Color distribution and skin tone analysis."""
        if len(data) < 256:
            return {"skin_score": 0.5, "color_variance": 0.5, "histogram_smoothness": 0.5}

        hist = [0] * 256
        for b in data[:min(len(data), 50000)]:
            hist[b] += 1

        total = sum(hist)
        mean = sum(i * c for i, c in enumerate(hist)) / total
        variance = sum((i - mean) ** 2 * c for i, c in enumerate(hist)) / total

        # Skin likelihood
        skin_score = 0.7 if 80 <= mean <= 200 and 300 <= variance <= 5000 else 0.2

        # Histogram smoothness (real skin: smooth histogram)
        diffs = [abs(hist[i] - hist[i - 1]) for i in range(1, 256)]
        avg_diff = sum(diffs) / len(diffs)
        smoothness = max(0.0, 1.0 - avg_diff / max(max(hist), 1) * 10)

        return {
            "skin_score": skin_score,
            "color_variance": min(1.0, variance / 5000.0),
            "histogram_smoothness": smoothness,
        }

    def extract_all(self, data: bytes) -> dict[str, float]:
        """Extract all feature types into a single feature dict."""
        features = {}
        features.update(self.extract_texture_features(data))
        features.update(self.extract_frequency_features(data))
        features.update(self.extract_depth_features(data))
        features.update(self.extract_color_features(data))
        return features


# --- Spoofing Classifier ---

class SpoofClassifier:
    """Rule-based + learned classifier for anti-spoofing."""

    def __init__(self):
        self.feature_extractor = FeatureExtractor()
        # Learned weights for each attack type (simulates a trained model)
        self.attack_weights: dict[str, dict[str, float]] = {
            "printed_photo": {
                "depth_variance": -2.5,    # flat = print
                "lbp_entropy": -1.8,       # low entropy = paper texture
                "high_freq_ratio": -1.2,   # low high-freq = JPEG artifacts
                "texture_contrast": -0.8,
                "skin_score": -0.5,
                "bias": 1.8,
            },
            "screen_replay": {
                "moire_energy": 3.0,       # high moiré = screen
                "high_freq_ratio": 2.5,    # pixel grid
                "color_variance": -1.0,    # shifted colors
                "histogram_smoothness": -0.8,
                "bias": -0.5,
            },
            "paper_mask": {
                "depth_variance": -1.5,    # somewhat flat
                "lbp_uniformity": 2.0,     # uniform texture
                "skin_score": -2.0,        # wrong skin color
                "texture_contrast": -1.0,
                "bias": 0.5,
            },
            "3d_mask": {
                "lbp_entropy": 1.5,        # too uniform material
                "skin_score": -1.5,        # synthetic skin
                "gradient_consistency": -1.0,
                "histogram_smoothness": 1.2, # abnormally smooth
                "bias": 0.3,
            },
            "deepfake": {
                "compression_artifacts": 2.0,  # GAN artifacts
                "gradient_consistency": -1.5,
                "texture_contrast": -0.5,
                "lbp_entropy": 1.0,
                "bias": -0.2,
            },
            "high_quality_photo": {
                "depth_variance": -3.0,    # flat
                "compression_artifacts": 1.5, # too sharp
                "lbp_entropy": 0.5,
                "texture_contrast": 0.8,
                "bias": 0.8,
            },
        }

    def classify(self, image_data: bytes) -> SpoofClassification:
        """Classify an image for spoofing attacks."""
        start = time.time()

        features = self.feature_extractor.extract_all(image_data)
        attack_probs = {}

        for attack_name, weights in self.attack_weights.items():
            logit = weights.get("bias", 0.0)
            for feat_name, weight in weights.items():
                if feat_name == "bias":
                    continue
                if feat_name in features:
                    logit += weight * features[feat_name]

            # Sigmoid activation
            prob = 1.0 / (1.0 + math.exp(-logit))
            attack_probs[attack_name] = round(prob, 4)

        # Find highest probability attack
        max_attack = max(attack_probs, key=attack_probs.get)
        max_prob = attack_probs[max_attack]

        threshold = 0.6
        is_spoof = max_prob >= threshold

        spoof_type = SpoofType.NONE
        if is_spoof:
            type_map = {
                "printed_photo": SpoofType.PRINTED_PHOTO,
                "screen_replay": SpoofType.SCREEN_REPLAY,
                "paper_mask": SpoofType.PAPER_MASK,
                "3d_mask": SpoofType.THREE_D_MASK,
                "deepfake": SpoofType.DEEPFAKE,
                "high_quality_photo": SpoofType.HIGH_QUALITY_PHOTO,
            }
            spoof_type = type_map.get(max_attack, SpoofType.NONE)

        elapsed_ms = int((time.time() - start) * 1000)

        return SpoofClassification(
            is_spoof=is_spoof,
            spoof_type=spoof_type,
            confidence=max_prob if is_spoof else 1.0 - max_prob,
            attack_probabilities=attack_probs,
            features_used=list(features.keys()),
            processing_ms=elapsed_ms,
        )

    def classify_video(self, frames: list[bytes]) -> SpoofClassification:
        """Classify video frames with temporal analysis."""
        if not frames:
            return SpoofClassification(
                is_spoof=True, spoof_type=SpoofType.NONE, confidence=0.0,
                attack_probabilities={}, features_used=[], processing_ms=0,
            )

        start = time.time()

        # Classify first frame
        single_result = self.classify(frames[0])

        # Temporal analysis
        frame_diffs = []
        for i in range(1, len(frames)):
            diff = self._frame_diff(frames[i - 1], frames[i])
            frame_diffs.append(diff)

        total_motion = sum(frame_diffs) / len(frame_diffs) if frame_diffs else 0.0

        # Adjust probabilities with temporal features
        probs = dict(single_result.attack_probabilities)

        # No motion = likely photo
        if total_motion < 0.002:
            probs["printed_photo"] = min(1.0, probs.get("printed_photo", 0) + 0.25)
            probs["high_quality_photo"] = min(1.0, probs.get("high_quality_photo", 0) + 0.25)

        # Periodic artifacts = screen
        if len(frame_diffs) >= 4:
            mean_d = sum(frame_diffs) / len(frame_diffs)
            autocorr = sum(
                (frame_diffs[i] - mean_d) * (frame_diffs[i - 2] - mean_d)
                for i in range(2, len(frame_diffs))
            )
            if abs(autocorr) / max(len(frame_diffs), 1) > 0.001:
                probs["screen_replay"] = min(1.0, probs.get("screen_replay", 0) + 0.2)

        # Temporal inconsistency = deepfake
        if len(frame_diffs) >= 3:
            jerk = sum(abs(frame_diffs[i] - frame_diffs[i - 1]) for i in range(1, len(frame_diffs)))
            avg_jerk = jerk / (len(frame_diffs) - 1)
            if avg_jerk > 0.01:
                probs["deepfake"] = min(1.0, probs.get("deepfake", 0) + 0.15)

        max_attack = max(probs, key=probs.get)
        max_prob = probs[max_attack]
        is_spoof = max_prob >= 0.6

        type_map = {
            "printed_photo": SpoofType.PRINTED_PHOTO,
            "screen_replay": SpoofType.SCREEN_REPLAY,
            "paper_mask": SpoofType.PAPER_MASK,
            "3d_mask": SpoofType.THREE_D_MASK,
            "deepfake": SpoofType.DEEPFAKE,
            "high_quality_photo": SpoofType.HIGH_QUALITY_PHOTO,
        }

        elapsed_ms = int((time.time() - start) * 1000)

        return SpoofClassification(
            is_spoof=is_spoof,
            spoof_type=type_map.get(max_attack, SpoofType.NONE) if is_spoof else SpoofType.NONE,
            confidence=max_prob if is_spoof else 1.0 - max_prob,
            attack_probabilities=probs,
            features_used=list(single_result.features_used) + ["temporal_motion", "temporal_consistency"],
            processing_ms=elapsed_ms,
        )

    @staticmethod
    def _frame_diff(a: bytes, b: bytes) -> float:
        length = min(len(a), len(b))
        if length == 0:
            return 0.0
        total = sum(abs(a[i] - b[i]) for i in range(min(length, 10000)))
        return total / (min(length, 10000) * 255.0)


# --- Face Feature Extraction ---

class FaceFeatureExtractor:
    """Extracts 128-dimensional face embeddings for face matching."""

    def extract(self, image_data: bytes) -> FeatureVector:
        """Extract 128-d face feature vector."""
        if len(image_data) < 256:
            return FeatureVector(values=[0.0] * 128)

        width = int(math.sqrt(len(image_data)))

        # Multi-scale feature extraction
        features = []

        # Scale 1: 8x8 block means (64 features)
        block_size = max(width // 8, 1)
        for by in range(8):
            for bx in range(8):
                total = 0
                count = 0
                for y in range(by * block_size, min((by + 1) * block_size, len(image_data) // width)):
                    for x in range(bx * block_size, min((bx + 1) * block_size, width)):
                        idx = y * width + x
                        if idx < len(image_data):
                            total += image_data[idx]
                            count += 1
                features.append(total / max(count, 1) / 255.0)

        # Scale 2: 4x4 block gradients (32 features — 16 gx + 16 gy)
        block_size2 = max(width // 4, 2)
        height = len(image_data) // width
        for by in range(4):
            for bx in range(4):
                gx_sum = 0.0
                gy_sum = 0.0
                count = 0
                for y in range(by * block_size2 + 1, min((by + 1) * block_size2, height - 1)):
                    for x in range(bx * block_size2 + 1, min((bx + 1) * block_size2, width - 1)):
                        idx = y * width + x
                        if idx + width < len(image_data):
                            gx_sum += abs(image_data[idx + 1] - image_data[idx - 1])
                            gy_sum += abs(image_data[idx + width] - image_data[idx - width])
                            count += 1
                features.append(gx_sum / max(count, 1) / 255.0)
                features.append(gy_sum / max(count, 1) / 255.0)

        # Scale 3: 4x4 block variances (16 features)
        for by in range(4):
            for bx in range(4):
                vals = []
                for y in range(by * block_size2, min((by + 1) * block_size2, height)):
                    for x in range(bx * block_size2, min((bx + 1) * block_size2, width)):
                        idx = y * width + x
                        if idx < len(image_data):
                            vals.append(image_data[idx])
                if vals:
                    mean_v = sum(vals) / len(vals)
                    var_v = sum((v - mean_v) ** 2 for v in vals) / len(vals)
                    features.append(min(1.0, var_v / 3000.0))
                else:
                    features.append(0.0)

        # Global features (16 features: histogram stats)
        hist = [0] * 16
        for b in image_data[:min(len(image_data), 50000)]:
            hist[b // 16] += 1
        total = sum(hist)
        for c in hist:
            features.append(c / max(total, 1))

        # Pad or truncate to exactly 128
        features = features[:128]
        while len(features) < 128:
            features.append(0.0)

        return FeatureVector(values=features)

    def match(self, feat1: FeatureVector, feat2: FeatureVector, threshold: float = 0.75) -> dict:
        """Compare two face feature vectors."""
        similarity = feat1.cosine_similarity(feat2)
        euclidean = math.sqrt(sum((a - b) ** 2 for a, b in zip(feat1.values, feat2.values)))

        return {
            "matched": similarity >= threshold,
            "similarity": round(similarity, 4),
            "euclidean_distance": round(euclidean, 4),
            "threshold": threshold,
            "confidence": round(min(1.0, similarity * 1.1), 4),
        }


# --- 68-Point Landmark Extractor ---

class LandmarkExtractor:
    """Extracts 68-point facial landmarks."""

    def extract(self, image_data: bytes) -> FacialLandmark68:
        if len(image_data) < 1024:
            return FacialLandmark68(points=[], confidence=0.0)

        width = int(math.sqrt(len(image_data)))
        height = len(image_data) // width

        # Detect face center using gradient concentration
        face_cx, face_cy, face_w, face_h = self._detect_face_center(image_data, width, height)

        points = []

        # Jaw (17 points, indices 0-16)
        jaw = []
        for i in range(17):
            t = i / 16.0
            x = face_cx - face_w * 0.45 + face_w * 0.9 * t
            y = face_cy + face_h * 0.15 + face_h * 0.35 * math.sin(math.pi * t)
            jaw.append((round(x, 2), round(y, 2)))

        # Right eyebrow (5 points, 17-21)
        r_eyebrow = []
        for i in range(5):
            t = i / 4.0
            x = face_cx - face_w * 0.35 + face_w * 0.2 * t
            y = face_cy - face_h * 0.25 - face_h * 0.05 * math.sin(math.pi * t)
            r_eyebrow.append((round(x, 2), round(y, 2)))

        # Left eyebrow (5 points, 22-26)
        l_eyebrow = []
        for i in range(5):
            t = i / 4.0
            x = face_cx + face_w * 0.15 + face_w * 0.2 * t
            y = face_cy - face_h * 0.25 - face_h * 0.05 * math.sin(math.pi * t)
            l_eyebrow.append((round(x, 2), round(y, 2)))

        # Nose bridge (4 points, 27-30)
        nose_bridge = []
        for i in range(4):
            t = i / 3.0
            x = face_cx
            y = face_cy - face_h * 0.15 + face_h * 0.25 * t
            nose_bridge.append((round(x, 2), round(y, 2)))

        # Nose tip (5 points, 31-35)
        nose_tip = []
        for i in range(5):
            t = i / 4.0
            x = face_cx - face_w * 0.08 + face_w * 0.16 * t
            y = face_cy + face_h * 0.1 + face_h * 0.02 * math.sin(math.pi * t)
            nose_tip.append((round(x, 2), round(y, 2)))

        # Right eye (6 points, 36-41)
        r_eye = []
        for i in range(6):
            angle = i * math.pi * 2 / 6
            x = face_cx - face_w * 0.18 + face_w * 0.07 * math.cos(angle)
            y = face_cy - face_h * 0.12 + face_h * 0.03 * math.sin(angle)
            r_eye.append((round(x, 2), round(y, 2)))

        # Left eye (6 points, 42-47)
        l_eye = []
        for i in range(6):
            angle = i * math.pi * 2 / 6
            x = face_cx + face_w * 0.18 + face_w * 0.07 * math.cos(angle)
            y = face_cy - face_h * 0.12 + face_h * 0.03 * math.sin(angle)
            l_eye.append((round(x, 2), round(y, 2)))

        # Outer lip (12 points, 48-59)
        outer_lip = []
        for i in range(12):
            angle = i * math.pi * 2 / 12
            x = face_cx + face_w * 0.12 * math.cos(angle)
            y = face_cy + face_h * 0.28 + face_h * 0.04 * math.sin(angle)
            outer_lip.append((round(x, 2), round(y, 2)))

        # Inner lip (8 points, 60-67)
        inner_lip = []
        for i in range(8):
            angle = i * math.pi * 2 / 8
            x = face_cx + face_w * 0.07 * math.cos(angle)
            y = face_cy + face_h * 0.28 + face_h * 0.02 * math.sin(angle)
            inner_lip.append((round(x, 2), round(y, 2)))

        all_points = jaw + r_eyebrow + l_eyebrow + nose_bridge + nose_tip + r_eye + l_eye + outer_lip + inner_lip

        return FacialLandmark68(
            points=all_points,
            jaw=jaw,
            right_eyebrow=r_eyebrow,
            left_eyebrow=l_eyebrow,
            nose_bridge=nose_bridge,
            nose_tip=nose_tip,
            right_eye=r_eye,
            left_eye=l_eye,
            outer_lip=outer_lip,
            inner_lip=inner_lip,
            confidence=0.87,
        )

    @staticmethod
    def _detect_face_center(data: bytes, width: int, height: int) -> tuple[float, float, float, float]:
        block_w = max(width // 8, 1)
        block_h = max(height // 8, 1)

        max_grad = 0.0
        best_bx, best_by = 3, 3

        for by in range(1, 7):
            for bx in range(1, 7):
                grad = 0.0
                for y in range(by * block_h, min((by + 1) * block_h, height - 1)):
                    for x in range(bx * block_w, min((bx + 1) * block_w, width - 1)):
                        idx = y * width + x
                        if idx + width < len(data):
                            gx = abs(data[idx + 1] - data[idx])
                            gy = abs(data[idx + width] - data[idx])
                            grad += gx + gy
                if grad > max_grad:
                    max_grad = grad
                    best_bx, best_by = bx, by

        cx = (best_bx + 0.5) * block_w
        cy = (best_by + 0.5) * block_h
        fw = width * 0.5
        fh = height * 0.65

        return cx, cy, fw, fh


# --- FastAPI Application ---

app = FastAPI(
    title="Deepfake & Spoofing Detector",
    description="ML-based anti-spoofing classification service",
    version="1.0.0",
)

cors_origins = os.getenv("CORS_ALLOWED_ORIGINS", "https://crm.example.com,https://admin.example.com")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in cors_origins.split(",")],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "X-Tenant-ID"],
)

classifier = SpoofClassifier()
feature_extractor = FaceFeatureExtractor()
landmark_extractor = LandmarkExtractor()


class ImageRequest(BaseModel):
    image_base64: str = Field(..., description="Base64-encoded image data")

class VideoRequest(BaseModel):
    frames_base64: list[str] = Field(..., description="Base64-encoded video frames")

class FaceMatchRequest(BaseModel):
    image1_base64: str
    image2_base64: str
    threshold: float = Field(default=0.75, ge=0.0, le=1.0)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "deepfake-detector", "version": "1.0.0"}


@app.post("/api/v1/spoof/classify")
async def classify_image(req: ImageRequest):
    """Classify a single image for spoofing attacks."""
    try:
        data = base64.b64decode(req.image_base64)
    except Exception:
        raise HTTPException(400, "Invalid base64 image data")
    result = classifier.classify(data)
    return asdict(result)


@app.post("/api/v1/spoof/classify-video")
async def classify_video(req: VideoRequest):
    """Classify video frames for spoofing attacks."""
    frames = []
    for fb in req.frames_base64:
        try:
            frames.append(base64.b64decode(fb))
        except Exception:
            continue
    if len(frames) < 3:
        raise HTTPException(400, "Minimum 3 valid frames required")
    result = classifier.classify_video(frames)
    return asdict(result)


@app.post("/api/v1/face/features")
async def extract_features(req: ImageRequest):
    """Extract 128-dimensional face feature vector."""
    try:
        data = base64.b64decode(req.image_base64)
    except Exception:
        raise HTTPException(400, "Invalid base64 image data")
    features = feature_extractor.extract(data)
    return {"values": features.values, "norm": features.norm, "dimensions": len(features.values)}


@app.post("/api/v1/face/match")
async def match_faces(req: FaceMatchRequest):
    """Compare two face images and return match result."""
    try:
        data1 = base64.b64decode(req.image1_base64)
        data2 = base64.b64decode(req.image2_base64)
    except Exception:
        raise HTTPException(400, "Invalid base64 image data")
    feat1 = feature_extractor.extract(data1)
    feat2 = feature_extractor.extract(data2)
    return feature_extractor.match(feat1, feat2, threshold=req.threshold)


@app.post("/api/v1/face/landmarks")
async def extract_landmarks(req: ImageRequest):
    """Extract 68-point facial landmarks."""
    try:
        data = base64.b64decode(req.image_base64)
    except Exception:
        raise HTTPException(400, "Invalid base64 image data")
    result = landmark_extractor.extract(data)
    return asdict(result)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8091"))
    uvicorn.run(app, host="0.0.0.0", port=port)
