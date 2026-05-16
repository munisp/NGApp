"""
TinyLiveness ONNX-based passive liveness detector.

Integrates the TinyLiveness EfficientNet-B0 model as the primary passive
liveness detection engine, replacing hand-crafted heuristics with a trained
ML model (98.25% accuracy, 0.999 AUC, 5.6ms latency).

Reference: https://github.com/yuvrajraina/TinyLiveness
"""
import os
import logging
import numpy as np
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

# ImageNet normalization constants
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# Decision thresholds (calibrated from TinyLiveness evaluation)
LIVE_THRESHOLD = 0.65
SPOOF_THRESHOLD = 0.35


class TinyLivenessDetector:
    """ONNX-based passive liveness detector using EfficientNet-B0."""

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or os.getenv(
            "TINYLIVENESS_MODEL_PATH",
            "/app/models/tinyliveness_efficientnet_b0.onnx"
        )
        self._session = None
        self._available = False
        self._init_model()

    def _init_model(self):
        try:
            import onnxruntime as ort
            if not os.path.exists(self.model_path):
                logger.warning(
                    "TinyLiveness ONNX model not found at %s. "
                    "Falling back to heuristic mode.",
                    self.model_path,
                )
                return
            self._session = ort.InferenceSession(
                self.model_path,
                providers=["CPUExecutionProvider"],
            )
            self._available = True
            logger.info("TinyLiveness model loaded from %s", self.model_path)
        except ImportError:
            logger.warning(
                "onnxruntime not installed. TinyLiveness unavailable. "
                "Install with: pip install onnxruntime"
            )
        except Exception as e:
            logger.error("Failed to load TinyLiveness model: %s", e)

    @property
    def is_available(self) -> bool:
        return self._available

    def preprocess(self, face_crop_bgr: np.ndarray) -> np.ndarray:
        """Preprocess a BGR face crop to model input tensor.

        Args:
            face_crop_bgr: OpenCV BGR image of aligned face crop.

        Returns:
            Float32 tensor of shape (1, 3, 224, 224) normalized with
            ImageNet mean/std.
        """
        import cv2
        rgb = cv2.cvtColor(face_crop_bgr, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(rgb, (224, 224), interpolation=cv2.INTER_LINEAR)
        arr = resized.astype(np.float32) / 255.0
        arr = (arr - IMAGENET_MEAN) / IMAGENET_STD
        # HWC -> CHW
        arr = np.transpose(arr, (2, 0, 1))
        # Add batch dimension
        return np.expand_dims(arr, axis=0)

    def predict(self, face_crop_bgr: np.ndarray) -> dict:
        """Run liveness prediction on a face crop.

        Args:
            face_crop_bgr: OpenCV BGR image of the detected face region.

        Returns:
            dict with keys:
                live_probability: float in [0, 1]
                decision: "live" | "manual_review" | "spoof"
                model_used: "tinyliveness_onnx"
        """
        if not self._available:
            return {
                "live_probability": None,
                "decision": "unavailable",
                "model_used": "none",
            }

        input_tensor = self.preprocess(face_crop_bgr)
        input_name = self._session.get_inputs()[0].name
        output_name = self._session.get_outputs()[0].name

        outputs = self._session.run(
            [output_name],
            {input_name: input_tensor},
        )

        logits = outputs[0][0]
        if len(logits) == 1:
            live_prob = float(_sigmoid(logits[0]))
        else:
            live_prob = float(_softmax(logits)[1])

        if live_prob >= LIVE_THRESHOLD:
            decision = "live"
        elif live_prob <= SPOOF_THRESHOLD:
            decision = "spoof"
        else:
            decision = "manual_review"

        return {
            "live_probability": round(live_prob, 4),
            "decision": decision,
            "model_used": "tinyliveness_onnx",
        }


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + np.exp(-x))


def _softmax(x: np.ndarray) -> np.ndarray:
    e_x = np.exp(x - np.max(x))
    return e_x / e_x.sum()
