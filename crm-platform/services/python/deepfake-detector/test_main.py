"""Tests for deepfake detector service."""

import base64
import math
import pytest
from main import (
    SpoofClassifier,
    SpoofType,
    FeatureExtractor,
    FaceFeatureExtractor,
    FeatureVector,
    LandmarkExtractor,
)


@pytest.fixture
def classifier():
    return SpoofClassifier()


@pytest.fixture
def feature_extractor():
    return FeatureExtractor()


@pytest.fixture
def face_extractor():
    return FaceFeatureExtractor()


@pytest.fixture
def landmark_extractor():
    return LandmarkExtractor()


def make_image(size=10000, pattern=lambda i: (i * 7 + 123) % 256):
    return bytes(pattern(i) for i in range(size))


class TestSpoofClassifier:
    def test_classify_returns_result(self, classifier):
        image = make_image()
        result = classifier.classify(image)
        assert result is not None
        assert isinstance(result.is_spoof, bool)
        assert 0 <= result.confidence <= 1
        assert isinstance(result.spoof_type, SpoofType)
        assert result.processing_ms >= 0

    def test_classify_has_all_attack_probabilities(self, classifier):
        result = classifier.classify(make_image())
        expected_attacks = {"printed_photo", "screen_replay", "paper_mask", "3d_mask", "deepfake", "high_quality_photo"}
        assert set(result.attack_probabilities.keys()) == expected_attacks

    def test_classify_probabilities_in_range(self, classifier):
        result = classifier.classify(make_image())
        for name, prob in result.attack_probabilities.items():
            assert 0 <= prob <= 1, f"{name} probability out of range: {prob}"

    def test_classify_features_used(self, classifier):
        result = classifier.classify(make_image())
        assert len(result.features_used) > 0
        assert "lbp_entropy" in result.features_used
        assert "depth_variance" in result.features_used

    def test_classify_small_image(self, classifier):
        result = classifier.classify(b"\x80" * 100)
        assert result is not None
        assert 0 <= result.confidence <= 1

    def test_classify_video(self, classifier):
        frames = [make_image(10000, lambda i, offset=k: (i + offset * 13) % 256) for k in range(5)]
        result = classifier.classify_video(frames)
        assert result is not None
        assert isinstance(result.is_spoof, bool)
        assert 0 <= result.confidence <= 1
        assert "temporal_motion" in result.features_used

    def test_classify_video_empty_frames(self, classifier):
        result = classifier.classify_video([])
        assert result.is_spoof is True
        assert result.confidence == 0.0

    def test_classify_video_static_frames(self, classifier):
        """Static frames (identical) should increase printed_photo probability."""
        static_frame = make_image()
        result = classifier.classify_video([static_frame] * 5)
        assert result is not None
        assert result.attack_probabilities.get("printed_photo", 0) > 0

    def test_model_version(self, classifier):
        result = classifier.classify(make_image())
        assert result.model_version == "1.0.0"


class TestFeatureExtractor:
    def test_texture_features(self, feature_extractor):
        features = feature_extractor.extract_texture_features(make_image())
        assert "lbp_entropy" in features
        assert "lbp_uniformity" in features
        assert "texture_contrast" in features
        for v in features.values():
            assert 0 <= v <= 1

    def test_frequency_features(self, feature_extractor):
        features = feature_extractor.extract_frequency_features(make_image())
        assert "high_freq_ratio" in features
        assert "moire_energy" in features
        assert "compression_artifacts" in features

    def test_depth_features(self, feature_extractor):
        features = feature_extractor.extract_depth_features(make_image())
        assert "depth_variance" in features
        assert "gradient_consistency" in features

    def test_color_features(self, feature_extractor):
        features = feature_extractor.extract_color_features(make_image())
        assert "skin_score" in features
        assert "color_variance" in features
        assert "histogram_smoothness" in features

    def test_extract_all(self, feature_extractor):
        features = feature_extractor.extract_all(make_image())
        assert len(features) >= 10
        assert "lbp_entropy" in features
        assert "depth_variance" in features
        assert "skin_score" in features

    def test_small_data_fallback(self, feature_extractor):
        features = feature_extractor.extract_all(b"\x00" * 32)
        assert len(features) >= 10


class TestFaceFeatureExtractor:
    def test_extract_128d(self, face_extractor):
        features = face_extractor.extract(make_image())
        assert len(features.values) == 128
        assert features.norm > 0

    def test_cosine_similarity_identical(self, face_extractor):
        img = make_image()
        f1 = face_extractor.extract(img)
        f2 = face_extractor.extract(img)
        sim = f1.cosine_similarity(f2)
        assert sim > 0.99, f"identical images should have cosine sim > 0.99, got {sim}"

    def test_match_identical(self, face_extractor):
        img = make_image()
        f1 = face_extractor.extract(img)
        f2 = face_extractor.extract(img)
        result = face_extractor.match(f1, f2)
        assert result["matched"] is True
        assert result["similarity"] > 0.9

    def test_match_different(self, face_extractor):
        f1 = face_extractor.extract(make_image(10000, lambda i: i % 256))
        f2 = face_extractor.extract(make_image(10000, lambda i: (255 - i) % 256))
        result = face_extractor.match(f1, f2)
        assert "similarity" in result
        assert "euclidean_distance" in result
        assert "threshold" in result

    def test_small_image_128d(self, face_extractor):
        features = face_extractor.extract(b"\x80" * 100)
        assert len(features.values) == 128


class TestFeatureVector:
    def test_norm_computation(self):
        fv = FeatureVector(values=[3.0, 4.0])
        assert abs(fv.norm - 5.0) < 1e-6

    def test_cosine_similarity(self):
        fv1 = FeatureVector(values=[1.0, 0.0])
        fv2 = FeatureVector(values=[0.0, 1.0])
        assert abs(fv1.cosine_similarity(fv2)) < 1e-6  # orthogonal = 0

    def test_cosine_similarity_parallel(self):
        fv1 = FeatureVector(values=[1.0, 2.0, 3.0])
        fv2 = FeatureVector(values=[2.0, 4.0, 6.0])
        assert abs(fv1.cosine_similarity(fv2) - 1.0) < 1e-6  # parallel = 1

    def test_zero_norm(self):
        fv1 = FeatureVector(values=[0.0, 0.0])
        fv2 = FeatureVector(values=[1.0, 1.0])
        assert fv1.cosine_similarity(fv2) == 0.0


class TestLandmarkExtractor:
    def test_extract_68_points(self, landmark_extractor):
        result = landmark_extractor.extract(make_image())
        assert len(result.points) == 68

    def test_landmark_regions(self, landmark_extractor):
        result = landmark_extractor.extract(make_image())
        assert len(result.jaw) == 17
        assert len(result.right_eyebrow) == 5
        assert len(result.left_eyebrow) == 5
        assert len(result.nose_bridge) == 4
        assert len(result.nose_tip) == 5
        assert len(result.right_eye) == 6
        assert len(result.left_eye) == 6
        assert len(result.outer_lip) == 12
        assert len(result.inner_lip) == 8

    def test_landmark_confidence(self, landmark_extractor):
        result = landmark_extractor.extract(make_image())
        assert result.confidence > 0

    def test_small_image_no_crash(self, landmark_extractor):
        result = landmark_extractor.extract(b"\x00" * 100)
        assert result.confidence == 0.0
        assert len(result.points) == 0

    def test_points_are_tuples(self, landmark_extractor):
        result = landmark_extractor.extract(make_image())
        for point in result.points:
            assert len(point) == 2
            assert isinstance(point[0], float)
            assert isinstance(point[1], float)
