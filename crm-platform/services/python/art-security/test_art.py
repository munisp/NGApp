"""Tests for ART Security service data models and logic."""
import unittest
from main import MLModel, AttackResult, DefenseResult, RobustnessReport


class TestMLModel(unittest.TestCase):
    def test_model_creation(self):
        model = MLModel("model-1", "Fraud Detector", "neural_network", 0.95, "fraud_detection", "deployed")
        self.assertEqual(model.model_id, "model-1")
        self.assertEqual(model.name, "Fraud Detector")
        self.assertEqual(model.accuracy, 0.95)

    def test_model_to_dict(self):
        model = MLModel("model-1", "Fraud Detector", "neural_network", 0.95, "fraud_detection", "deployed")
        d = model.to_dict()
        self.assertIsInstance(d, dict)
        self.assertEqual(d["model_id"], "model-1")
        self.assertEqual(d["model_type"], "neural_network")
        self.assertEqual(d["purpose"], "fraud_detection")
        self.assertEqual(d["status"], "deployed")


class TestAttackResult(unittest.TestCase):
    def test_attack_result_creation(self):
        result = AttackResult(
            attack_type="evasion",
            attack_name="FGSM",
            model_id="model-1",
            success_rate=0.15,
            perturbation_size=0.03,
            original_accuracy=0.95,
            adversarial_accuracy=0.80,
            severity="high",
            mitigated=True,
        )
        self.assertEqual(result.attack_name, "FGSM")
        self.assertTrue(result.mitigated)

    def test_attack_result_to_dict(self):
        result = AttackResult("evasion", "PGD", "model-1", 0.2, 0.05, 0.95, 0.75, "critical", False)
        d = result.to_dict()
        self.assertEqual(d["attack_type"], "evasion")
        self.assertAlmostEqual(d["accuracy_drop"], 0.2)
        self.assertFalse(d["mitigated"])

    def test_accuracy_drop_calculation(self):
        result = AttackResult("poisoning", "BackdoorAttack", "model-2", 0.1, 0.01, 0.98, 0.88, "high", True)
        d = result.to_dict()
        self.assertAlmostEqual(d["accuracy_drop"], 0.10)


class TestDefenseResult(unittest.TestCase):
    def test_defense_result(self):
        defense = DefenseResult(
            defense_name="Adversarial Training",
            model_id="model-1",
            clean_accuracy=0.95,
            robust_accuracy=0.88,
            attack_defended="FGSM",
            overhead_ms=12.5,
        )
        d = defense.to_dict()
        self.assertEqual(d["defense_name"], "Adversarial Training")
        self.assertAlmostEqual(d["accuracy_trade_off"], 0.07)
        self.assertEqual(d["overhead_ms"], 12.5)


class TestRobustnessReport(unittest.TestCase):
    def test_report_creation(self):
        report = RobustnessReport("model-1", 0.85, 14, 13, "certified")
        d = report.to_dict()
        self.assertEqual(d["overall_robustness_score"], 0.85)
        self.assertEqual(d["attacks_tested"], 14)
        self.assertEqual(d["attacks_mitigated"], 13)
        self.assertAlmostEqual(d["mitigation_rate"], 13 / 14)
        self.assertEqual(d["certification_status"], "certified")

    def test_zero_attacks_division(self):
        report = RobustnessReport("model-2", 0.0, 0, 0, "pending")
        d = report.to_dict()
        self.assertEqual(d["mitigation_rate"], 0.0)


if __name__ == "__main__":
    unittest.main()
