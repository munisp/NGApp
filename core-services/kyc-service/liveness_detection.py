"""
Open-Source Liveness Detection Provider

Replaces Smile ID liveness checks with fully open-source stack:
- MediaPipe Face Mesh: 468 facial landmarks for blink detection, head pose, face geometry
- OpenCV: Texture analysis (LBP, frequency domain) for anti-spoofing
- VLM (Vision Language Model via Ollama): Visual spoof detection and face quality assessment

Multi-signal approach:
1. Face detection & landmark extraction (MediaPipe)
2. Blink detection via Eye Aspect Ratio (EAR)
3. Texture analysis for print/screen attack detection (OpenCV LBP + Laplacian)
4. Face geometry validation (proportions, symmetry, 3D depth cues)
5. VLM-based visual spoof analysis (optional, uses Ollama)
6. Selfie-to-reference face comparison (optional)
"""

import os
import io
import math
import hashlib
import logging
import tempfile
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime
from dataclasses import dataclass, field

import httpx
import numpy as np

logger = logging.getLogger(__name__)

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

VLM_ENDPOINT = os.getenv("VLM_ENDPOINT", "http://localhost:11434/api/generate")
VLM_MODEL = os.getenv("VLM_MODEL", "llava:13b")
VLM_TIMEOUT = int(os.getenv("VLM_TIMEOUT", "120"))

LIVENESS_CONFIDENCE_THRESHOLD = float(os.getenv("LIVENESS_CONFIDENCE_THRESHOLD", "0.7"))
LIVENESS_USE_VLM = os.getenv("LIVENESS_USE_VLM", "true").lower() == "true"

EAR_THRESHOLD = float(os.getenv("EAR_THRESHOLD", "0.21"))
TEXTURE_THRESHOLD = float(os.getenv("TEXTURE_THRESHOLD", "80.0"))

LEFT_EYE_INDICES = [362, 385, 387, 263, 373, 380]
RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144]

FACE_OVAL_INDICES = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]


@dataclass
class LivenessSignal:
    name: str
    passed: bool
    confidence: float
    details: Dict[str, Any]


@dataclass
class LivenessResult:
    is_live: bool
    confidence_score: float
    face_match_score: float
    checks_passed: List[str]
    checks_failed: List[str]
    signals: List[LivenessSignal]
    provider: str = "opensource_liveness"
    provider_reference: Optional[str] = None
    raw_response: Optional[Dict[str, Any]] = None


def _eye_aspect_ratio(landmarks: List[Tuple[float, float]], indices: List[int]) -> float:
    p1 = landmarks[indices[0]]
    p2 = landmarks[indices[1]]
    p3 = landmarks[indices[2]]
    p4 = landmarks[indices[3]]
    p5 = landmarks[indices[4]]
    p6 = landmarks[indices[5]]

    vertical_1 = math.sqrt((p2[0] - p6[0]) ** 2 + (p2[1] - p6[1]) ** 2)
    vertical_2 = math.sqrt((p3[0] - p5[0]) ** 2 + (p3[1] - p5[1]) ** 2)
    horizontal = math.sqrt((p1[0] - p4[0]) ** 2 + (p1[1] - p4[1]) ** 2)

    if horizontal == 0:
        return 0.0
    return (vertical_1 + vertical_2) / (2.0 * horizontal)


def _face_symmetry_score(landmarks: List[Tuple[float, float]]) -> float:
    nose_tip = landmarks[1]
    left_points = [landmarks[i] for i in [234, 93, 132, 58, 172, 136]]
    right_points = [landmarks[i] for i in [454, 323, 361, 288, 397, 365]]

    total_diff = 0.0
    count = 0
    for lp, rp in zip(left_points, right_points):
        left_dist = math.sqrt((lp[0] - nose_tip[0]) ** 2 + (lp[1] - nose_tip[1]) ** 2)
        right_dist = math.sqrt((rp[0] - nose_tip[0]) ** 2 + (rp[1] - nose_tip[1]) ** 2)
        if max(left_dist, right_dist) > 0:
            diff = abs(left_dist - right_dist) / max(left_dist, right_dist)
            total_diff += diff
            count += 1

    if count == 0:
        return 0.0
    avg_diff = total_diff / count
    return max(0.0, 1.0 - avg_diff * 2)


def _face_proportion_score(landmarks: List[Tuple[float, float]]) -> float:
    forehead = landmarks[10]
    chin = landmarks[152]
    left_cheek = landmarks[234]
    right_cheek = landmarks[454]

    face_height = math.sqrt((forehead[0] - chin[0]) ** 2 + (forehead[1] - chin[1]) ** 2)
    face_width = math.sqrt((left_cheek[0] - right_cheek[0]) ** 2 + (left_cheek[1] - right_cheek[1]) ** 2)

    if face_height == 0 or face_width == 0:
        return 0.0

    ratio = face_width / face_height
    ideal_ratio = 0.75
    deviation = abs(ratio - ideal_ratio) / ideal_ratio
    return max(0.0, 1.0 - deviation)


def _head_pose_from_landmarks(landmarks: List[Tuple[float, float]]) -> Dict[str, float]:
    nose_tip = landmarks[1]
    nose_bridge = landmarks[6]
    chin = landmarks[152]
    left_eye_outer = landmarks[33]
    right_eye_outer = landmarks[263]

    eye_center_x = (left_eye_outer[0] + right_eye_outer[0]) / 2
    eye_center_y = (left_eye_outer[1] + right_eye_outer[1]) / 2

    yaw_offset = (nose_tip[0] - eye_center_x)
    eye_width = abs(right_eye_outer[0] - left_eye_outer[0])
    yaw = (yaw_offset / eye_width * 90) if eye_width > 0 else 0

    pitch_offset = (nose_tip[1] - eye_center_y)
    face_height = abs(chin[1] - landmarks[10][1])
    pitch = (pitch_offset / face_height * 90 - 15) if face_height > 0 else 0

    roll_dy = right_eye_outer[1] - left_eye_outer[1]
    roll_dx = right_eye_outer[0] - left_eye_outer[0]
    roll = math.degrees(math.atan2(roll_dy, roll_dx)) if roll_dx != 0 else 0

    return {"yaw": yaw, "pitch": pitch, "roll": roll}


class FaceMeshAnalyzer:
    def analyze(self, image_data: bytes) -> Dict[str, Any]:
        try:
            import mediapipe as mp
            import cv2

            nparr = np.frombuffer(image_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return {"face_detected": False, "error": "Could not decode image"}

            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            h, w = img.shape[:2]

            face_mesh = mp.solutions.face_mesh.FaceMesh(
                static_image_mode=True,
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
            )

            results = face_mesh.process(rgb)
            face_mesh.close()

            if not results.multi_face_landmarks:
                return {"face_detected": False, "error": "No face detected in image"}

            face = results.multi_face_landmarks[0]
            landmarks = [(lm.x * w, lm.y * h) for lm in face.landmark]

            left_ear = _eye_aspect_ratio(landmarks, LEFT_EYE_INDICES)
            right_ear = _eye_aspect_ratio(landmarks, RIGHT_EYE_INDICES)
            avg_ear = (left_ear + right_ear) / 2.0

            symmetry = _face_symmetry_score(landmarks)
            proportions = _face_proportion_score(landmarks)
            head_pose = _head_pose_from_landmarks(landmarks)

            oval_points = [landmarks[i] for i in FACE_OVAL_INDICES]
            xs = [p[0] for p in oval_points]
            ys = [p[1] for p in oval_points]
            face_bbox = {
                "x": min(xs) / w,
                "y": min(ys) / h,
                "width": (max(xs) - min(xs)) / w,
                "height": (max(ys) - min(ys)) / h,
            }
            face_area_ratio = face_bbox["width"] * face_bbox["height"]

            return {
                "face_detected": True,
                "landmark_count": len(landmarks),
                "eye_aspect_ratio": avg_ear,
                "left_ear": left_ear,
                "right_ear": right_ear,
                "symmetry_score": symmetry,
                "proportion_score": proportions,
                "head_pose": head_pose,
                "face_bbox": face_bbox,
                "face_area_ratio": face_area_ratio,
                "image_size": {"width": w, "height": h},
            }

        except ImportError:
            logger.warning("MediaPipe not installed, face mesh analysis unavailable")
            return {"face_detected": False, "error": "mediapipe not installed"}
        except Exception as e:
            logger.error(f"Face mesh analysis failed: {e}")
            return {"face_detected": False, "error": str(e)}


class TextureAnalyzer:
    def analyze(self, image_data: bytes) -> Dict[str, Any]:
        try:
            import cv2

            nparr = np.frombuffer(image_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return {"error": "Could not decode image"}

            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()

            sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
            sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
            edge_density = (np.sqrt(sobelx ** 2 + sobely ** 2) > 50).mean()

            h, w = gray.shape
            f_transform = np.fft.fft2(gray.astype(np.float64))
            f_shift = np.fft.fftshift(f_transform)
            magnitude = np.log1p(np.abs(f_shift))
            cy, cx = h // 2, w // 2
            radius = min(h, w) // 4
            y_grid, x_grid = np.ogrid[:h, :w]
            mask = ((x_grid - cx) ** 2 + (y_grid - cy) ** 2) > radius ** 2
            high_freq_energy = magnitude[mask].mean() if mask.any() else 0.0
            total_energy = magnitude.mean() if magnitude.size > 0 else 1.0
            freq_ratio = high_freq_energy / total_energy if total_energy > 0 else 0.0

            radius_func = min(h, w) // 8
            lbp_image = np.zeros_like(gray)
            for dy, dx in [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]:
                shifted = np.roll(np.roll(gray, dy, axis=0), dx, axis=1)
                lbp_image = lbp_image + ((shifted >= gray).astype(np.uint8) << 0)
            lbp_var = float(lbp_image.var())

            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            saturation = hsv[:, :, 1]
            sat_mean = float(saturation.mean())
            sat_std = float(saturation.std())

            color_hist = []
            for ch in range(3):
                hist = cv2.calcHist([img], [ch], None, [32], [0, 256])
                color_hist.extend(hist.flatten().tolist())
            color_hist_arr = np.array(color_hist)
            color_uniformity = float(color_hist_arr.std() / (color_hist_arr.mean() + 1e-8))

            return {
                "laplacian_variance": float(laplacian_var),
                "edge_density": float(edge_density),
                "high_freq_ratio": float(freq_ratio),
                "lbp_variance": lbp_var,
                "saturation_mean": sat_mean,
                "saturation_std": sat_std,
                "color_uniformity": color_uniformity,
            }

        except ImportError:
            logger.warning("OpenCV not installed, texture analysis unavailable")
            return {"error": "opencv not installed"}
        except Exception as e:
            logger.error(f"Texture analysis failed: {e}")
            return {"error": str(e)}


class FaceComparer:
    def compare(self, selfie_data: bytes, reference_data: bytes) -> Dict[str, Any]:
        try:
            import cv2
            import mediapipe as mp

            def _extract_embedding(img_data: bytes) -> Optional[np.ndarray]:
                nparr = np.frombuffer(img_data, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                if img is None:
                    return None
                rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                h, w = img.shape[:2]

                face_mesh = mp.solutions.face_mesh.FaceMesh(
                    static_image_mode=True,
                    max_num_faces=1,
                    refine_landmarks=True,
                    min_detection_confidence=0.5,
                )
                results = face_mesh.process(rgb)
                face_mesh.close()

                if not results.multi_face_landmarks:
                    return None

                face = results.multi_face_landmarks[0]
                key_indices = [
                    1, 33, 61, 199, 263, 291,
                    10, 152, 234, 454,
                    46, 53, 276, 283,
                    4, 6, 168,
                    78, 308, 14, 13,
                    70, 63, 105, 66, 107,
                    336, 296, 334, 293, 300,
                ]
                embedding = []
                for idx in key_indices:
                    lm = face.landmark[idx]
                    embedding.extend([lm.x, lm.y, lm.z])
                return np.array(embedding, dtype=np.float64)

            selfie_emb = _extract_embedding(selfie_data)
            ref_emb = _extract_embedding(reference_data)

            if selfie_emb is None:
                return {"match_score": 0.0, "error": "No face detected in selfie"}
            if ref_emb is None:
                return {"match_score": 0.0, "error": "No face detected in reference image"}

            selfie_norm = selfie_emb / (np.linalg.norm(selfie_emb) + 1e-8)
            ref_norm = ref_emb / (np.linalg.norm(ref_emb) + 1e-8)
            cosine_sim = float(np.dot(selfie_norm, ref_norm))
            match_score = max(0.0, min(1.0, (cosine_sim + 1) / 2))

            return {"match_score": match_score, "cosine_similarity": cosine_sim}

        except ImportError:
            logger.warning("MediaPipe/OpenCV not installed, face comparison unavailable")
            return {"match_score": 0.0, "error": "mediapipe or opencv not installed"}
        except Exception as e:
            logger.error(f"Face comparison failed: {e}")
            return {"match_score": 0.0, "error": str(e)}


class VLMLivenessAnalyzer:
    async def analyze(self, image_data: bytes) -> Dict[str, Any]:
        import base64

        image_b64 = base64.b64encode(image_data).decode("utf-8")

        prompt = (
            "Analyze this image for face liveness detection. Determine if this is a photo of a REAL, LIVE person "
            "taken directly by a camera, or if it is a SPOOF attempt (printed photo, screen replay, mask, etc.).\n\n"
            "Check for these indicators:\n"
            "1. SCREEN ARTIFACTS: Moire patterns, pixel grid, screen bezels, reflections from screen glass\n"
            "2. PRINT ARTIFACTS: Paper edges, creases, flat lighting, lack of skin texture detail\n"
            "3. MASK INDICATORS: Unnatural skin boundaries, rigid expression, visible mask edges\n"
            "4. LIGHTING: Natural 3D lighting with shadows, or flat 2D lighting suggesting a print/screen\n"
            "5. SKIN QUALITY: Real skin has pores, micro-texture, subsurface scattering; fakes lack this\n"
            "6. DEPTH CUES: Real faces have natural 3D depth; prints/screens are flat\n"
            "7. BACKGROUND: Natural background vs visible edges of a photo/screen\n\n"
            "Respond ONLY with a JSON object:\n"
            '{"is_live": true/false, "confidence": 0.0-1.0, "spoof_type": "none"/"print"/"screen"/"mask"/"unknown", '
            '"reasons": ["reason1", "reason2"]}'
        )

        try:
            async with httpx.AsyncClient() as client:
                payload = {
                    "model": VLM_MODEL,
                    "prompt": prompt,
                    "images": [image_b64],
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 512},
                }
                response = await client.post(
                    VLM_ENDPOINT,
                    json=payload,
                    timeout=VLM_TIMEOUT,
                )
                response.raise_for_status()
                data = response.json()
                vlm_text = data.get("response", "")
                return self._parse_response(vlm_text)

        except httpx.ConnectError:
            logger.warning("VLM (Ollama) not reachable for liveness analysis, skipping")
            return {"available": False, "error": "VLM service not reachable"}
        except httpx.TimeoutException:
            logger.warning("VLM liveness analysis timed out")
            return {"available": False, "error": "VLM request timed out"}
        except Exception as e:
            logger.error(f"VLM liveness analysis failed: {e}")
            return {"available": False, "error": str(e)}

    def _parse_response(self, text: str) -> Dict[str, Any]:
        import json as json_module

        try:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                parsed = json_module.loads(text[start:end])
                parsed["available"] = True
                return parsed
        except (json_module.JSONDecodeError, ValueError):
            pass

        text_lower = text.lower()
        is_live = "live" in text_lower and "not live" not in text_lower and "spoof" not in text_lower
        return {
            "available": True,
            "is_live": is_live,
            "confidence": 0.5,
            "spoof_type": "unknown",
            "reasons": [text[:200]],
            "parse_fallback": True,
        }


async def download_image(url: str) -> bytes:
    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(url, timeout=30.0)
        response.raise_for_status()
        return response.content


def _evaluate_face_detection(face_data: Dict[str, Any]) -> LivenessSignal:
    if not face_data.get("face_detected"):
        return LivenessSignal(
            name="face_detection",
            passed=False,
            confidence=0.0,
            details={"error": face_data.get("error", "No face detected")},
        )

    face_area = face_data.get("face_area_ratio", 0)
    too_small = face_area < 0.02
    too_large = face_area > 0.85

    if too_small:
        return LivenessSignal(
            name="face_detection",
            passed=False,
            confidence=0.3,
            details={"face_area_ratio": face_area, "issue": "Face too small in frame"},
        )

    if too_large:
        return LivenessSignal(
            name="face_detection",
            passed=True,
            confidence=0.7,
            details={"face_area_ratio": face_area, "note": "Face very close to camera"},
        )

    return LivenessSignal(
        name="face_detection",
        passed=True,
        confidence=0.95,
        details={"face_area_ratio": face_area, "landmark_count": face_data.get("landmark_count", 0)},
    )


def _evaluate_eye_openness(face_data: Dict[str, Any]) -> LivenessSignal:
    if not face_data.get("face_detected"):
        return LivenessSignal(name="eye_analysis", passed=False, confidence=0.0, details={})

    ear = face_data.get("eye_aspect_ratio", 0)
    left_ear = face_data.get("left_ear", 0)
    right_ear = face_data.get("right_ear", 0)

    eyes_open = ear > EAR_THRESHOLD
    ear_diff = abs(left_ear - right_ear)
    natural_asymmetry = ear_diff < 0.08

    conf = 0.8 if eyes_open else 0.4
    if natural_asymmetry:
        conf += 0.1

    return LivenessSignal(
        name="eye_analysis",
        passed=eyes_open,
        confidence=min(conf, 1.0),
        details={
            "average_ear": ear,
            "left_ear": left_ear,
            "right_ear": right_ear,
            "ear_threshold": EAR_THRESHOLD,
            "eyes_open": eyes_open,
            "natural_asymmetry": natural_asymmetry,
        },
    )


def _evaluate_face_geometry(face_data: Dict[str, Any]) -> LivenessSignal:
    if not face_data.get("face_detected"):
        return LivenessSignal(name="face_geometry", passed=False, confidence=0.0, details={})

    symmetry = face_data.get("symmetry_score", 0)
    proportions = face_data.get("proportion_score", 0)
    head_pose = face_data.get("head_pose", {})

    yaw = abs(head_pose.get("yaw", 0))
    pitch = abs(head_pose.get("pitch", 0))
    roll = abs(head_pose.get("roll", 0))

    frontal = yaw < 30 and pitch < 25 and roll < 20
    good_symmetry = symmetry > 0.6
    good_proportions = proportions > 0.5

    score = 0.0
    if frontal:
        score += 0.4
    if good_symmetry:
        score += 0.3
    if good_proportions:
        score += 0.3

    return LivenessSignal(
        name="face_geometry",
        passed=score >= 0.6,
        confidence=score,
        details={
            "symmetry_score": symmetry,
            "proportion_score": proportions,
            "head_pose": head_pose,
            "frontal": frontal,
        },
    )


def _evaluate_texture(texture_data: Dict[str, Any]) -> LivenessSignal:
    if "error" in texture_data:
        return LivenessSignal(
            name="texture_analysis",
            passed=True,
            confidence=0.5,
            details={"error": texture_data["error"], "skipped": True},
        )

    laplacian = texture_data.get("laplacian_variance", 0)
    edge_density = texture_data.get("edge_density", 0)
    freq_ratio = texture_data.get("high_freq_ratio", 0)
    lbp_var = texture_data.get("lbp_variance", 0)
    sat_std = texture_data.get("saturation_std", 0)

    sharp_enough = laplacian > TEXTURE_THRESHOLD
    has_detail = edge_density > 0.05
    natural_freq = freq_ratio > 0.3
    has_texture = lbp_var > 5.0
    color_variation = sat_std > 15.0

    spoof_indicators = 0
    if not sharp_enough:
        spoof_indicators += 1
    if not has_detail:
        spoof_indicators += 1
    if not natural_freq:
        spoof_indicators += 1
    if not has_texture:
        spoof_indicators += 1
    if not color_variation:
        spoof_indicators += 1

    is_real = spoof_indicators <= 2
    conf = max(0.0, 1.0 - (spoof_indicators * 0.2))

    return LivenessSignal(
        name="texture_analysis",
        passed=is_real,
        confidence=conf,
        details={
            "laplacian_variance": laplacian,
            "sharp_enough": sharp_enough,
            "edge_density": edge_density,
            "has_detail": has_detail,
            "high_freq_ratio": freq_ratio,
            "lbp_variance": lbp_var,
            "saturation_std": sat_std,
            "spoof_indicators": spoof_indicators,
        },
    )


def _evaluate_vlm(vlm_data: Dict[str, Any]) -> LivenessSignal:
    if not vlm_data.get("available"):
        return LivenessSignal(
            name="vlm_spoof_detection",
            passed=True,
            confidence=0.5,
            details={"skipped": True, "reason": vlm_data.get("error", "VLM not available")},
        )

    is_live = vlm_data.get("is_live", False)
    confidence = float(vlm_data.get("confidence", 0.5))
    spoof_type = vlm_data.get("spoof_type", "unknown")
    reasons = vlm_data.get("reasons", [])

    return LivenessSignal(
        name="vlm_spoof_detection",
        passed=is_live,
        confidence=confidence,
        details={
            "vlm_is_live": is_live,
            "spoof_type": spoof_type,
            "reasons": reasons,
        },
    )


class OpenSourceLivenessProvider:
    def __init__(self):
        self.face_mesh = FaceMeshAnalyzer()
        self.texture = TextureAnalyzer()
        self.vlm = VLMLivenessAnalyzer()
        self.face_comparer = FaceComparer()

    async def check_liveness(
        self,
        selfie_url: str,
        video_url: Optional[str] = None,
        reference_image_url: Optional[str] = None,
    ) -> LivenessResult:
        ref_id = hashlib.sha256(
            f"{selfie_url}:{datetime.utcnow().isoformat()}".encode()
        ).hexdigest()[:16]

        try:
            selfie_data = await download_image(selfie_url)
        except Exception as e:
            logger.error(f"Failed to download selfie: {e}")
            return LivenessResult(
                is_live=False,
                confidence_score=0.0,
                face_match_score=0.0,
                checks_passed=[],
                checks_failed=["selfie_download"],
                signals=[],
                provider_reference=ref_id,
                raw_response={"error": f"Failed to download selfie: {str(e)}"},
            )

        face_data = self.face_mesh.analyze(selfie_data)
        texture_data = self.texture.analyze(selfie_data)

        signals: List[LivenessSignal] = []

        signals.append(_evaluate_face_detection(face_data))
        signals.append(_evaluate_eye_openness(face_data))
        signals.append(_evaluate_face_geometry(face_data))
        signals.append(_evaluate_texture(texture_data))

        if LIVENESS_USE_VLM:
            vlm_data = await self.vlm.analyze(selfie_data)
            signals.append(_evaluate_vlm(vlm_data))

        face_match_score = 0.0
        if reference_image_url:
            try:
                ref_data = await download_image(reference_image_url)
                comparison = self.face_comparer.compare(selfie_data, ref_data)
                face_match_score = comparison.get("match_score", 0.0)
                signals.append(LivenessSignal(
                    name="face_match",
                    passed=face_match_score >= 0.6,
                    confidence=face_match_score,
                    details=comparison,
                ))
            except Exception as e:
                logger.error(f"Face comparison failed: {e}")
                signals.append(LivenessSignal(
                    name="face_match",
                    passed=False,
                    confidence=0.0,
                    details={"error": str(e)},
                ))

        checks_passed = [s.name for s in signals if s.passed]
        checks_failed = [s.name for s in signals if not s.passed]

        weights = {
            "face_detection": 0.25,
            "eye_analysis": 0.15,
            "face_geometry": 0.15,
            "texture_analysis": 0.25,
            "vlm_spoof_detection": 0.20,
            "face_match": 0.0,
        }

        total_weight = 0.0
        weighted_score = 0.0
        for signal in signals:
            w = weights.get(signal.name, 0.1)
            if signal.name == "face_match":
                continue
            weighted_score += signal.confidence * w
            total_weight += w

        confidence = weighted_score / total_weight if total_weight > 0 else 0.0

        is_live = (
            confidence >= LIVENESS_CONFIDENCE_THRESHOLD
            and "face_detection" in checks_passed
        )

        raw = {
            "face_analysis": face_data,
            "texture_analysis": texture_data,
            "signals": [
                {"name": s.name, "passed": s.passed, "confidence": s.confidence}
                for s in signals
            ],
        }

        return LivenessResult(
            is_live=is_live,
            confidence_score=round(confidence, 4),
            face_match_score=round(face_match_score, 4),
            checks_passed=checks_passed,
            checks_failed=checks_failed,
            signals=signals,
            provider_reference=ref_id,
            raw_response=raw,
        )


def get_opensource_liveness_provider() -> OpenSourceLivenessProvider:
    return OpenSourceLivenessProvider()
