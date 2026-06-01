"""
Unit tests for the PINN surrogate model.
Tests cover: architecture, physics constraints, inference, uncertainty quantification,
and the physics fallback when the model is not trained.
"""

from __future__ import annotations

import sys
import os

# Ensure the app directory is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

import numpy as np
import pytest
import torch

from pinn_surrogate import (
    PINNSurrogate,
    PINNBlock,
    NormStats,
    physics_loss,
    predict_pinn,
    get_training_status,
    _physics_fallback,
    _params_to_input_vector,
    N_INPUTS,
    N_OUTPUTS,
    OUTPUT_TARGETS,
    INPUT_FEATURES,
)


# ─── Architecture Tests ───────────────────────────────────────────────────────

def test_pinn_block_preserves_shape():
    block = PINNBlock(dim=64, dropout=0.0)
    x = torch.randn(8, 64)
    out = block(x)
    assert out.shape == (8, 64), "PINNBlock must preserve tensor shape"


def test_pinn_surrogate_forward_shape():
    model = PINNSurrogate(hidden_dim=64, n_blocks=2, dropout=0.0)
    x = torch.randn(4, N_INPUTS)
    out = model(x)
    assert out.shape == (4, N_OUTPUTS), f"Expected (4, {N_OUTPUTS}), got {out.shape}"


def test_pinn_surrogate_mc_dropout_returns_mean_std():
    model = PINNSurrogate(hidden_dim=64, n_blocks=2, dropout=0.1)
    x = torch.randn(2, N_INPUTS)
    mean, std = model.predict_with_uncertainty(x, n_samples=20)
    assert mean.shape == (2, N_OUTPUTS)
    assert std.shape  == (2, N_OUTPUTS)
    # Std should be non-negative
    assert (std >= 0).all(), "Uncertainty std must be non-negative"


def test_pinn_mc_dropout_produces_nonzero_uncertainty():
    """With dropout > 0, MC samples should yield non-trivial uncertainty."""
    model = PINNSurrogate(hidden_dim=64, n_blocks=2, dropout=0.2)
    x = torch.randn(1, N_INPUTS)
    _, std = model.predict_with_uncertainty(x, n_samples=30)
    # At least some outputs should have non-zero uncertainty
    assert std.sum().item() > 0, "MC Dropout should produce non-zero uncertainty"


def test_pinn_surrogate_no_nan_in_output():
    model = PINNSurrogate()
    x = torch.randn(10, N_INPUTS)
    out = model(x)
    assert not torch.isnan(out).any(), "Model output must not contain NaN"


# ─── Normalization Tests ──────────────────────────────────────────────────────

def test_norm_stats_fit_and_transform():
    stats = NormStats()
    X = np.random.randn(100, N_INPUTS).astype(np.float32) * 1000 + 500
    stats.fit(X)
    X_norm = stats.transform(X)
    # After normalization, mean should be ~0 and std ~1
    assert abs(X_norm.mean()) < 0.1, "Normalized mean should be near 0"
    assert abs(X_norm.std() - 1.0) < 0.2, "Normalized std should be near 1"


def test_norm_stats_state_dict_roundtrip():
    stats = NormStats()
    X = np.random.randn(50, N_INPUTS).astype(np.float32)
    stats.fit(X)
    sd = stats.state_dict()
    stats2 = NormStats()
    stats2.load_state_dict(sd)
    np.testing.assert_allclose(stats.mean, stats2.mean, rtol=1e-5)
    np.testing.assert_allclose(stats.std,  stats2.std,  rtol=1e-5)


# ─── Physics Constraint Tests ─────────────────────────────────────────────────

def test_physics_loss_penalizes_pwf_above_pr():
    """Physics loss should be > 0 when Pwf > Pr (violation)."""
    batch = 4
    inputs  = torch.zeros(batch, N_INPUTS)
    inputs[:, 0] = 3000.0  # reservoir_pressure

    outputs = torch.zeros(batch, N_OUTPUTS)
    outputs[:, 0] = 500.0   # q_bpd
    outputs[:, 1] = 4000.0  # pwf_psi > pr — VIOLATION
    outputs[:, 2] = -1000.0 # drawdown (negative — violation)
    outputs[:, 3] = 0.5     # sanding_index
    outputs[:, 4] = 50.0    # risk_score

    loss = physics_loss(inputs, outputs)
    assert loss.item() > 0, "Physics loss must penalize Pwf > Pr"


def test_physics_loss_near_zero_for_valid_outputs():
    """Physics loss should be near zero for physically valid outputs."""
    batch = 4
    inputs  = torch.zeros(batch, N_INPUTS)
    inputs[:, 0] = 3000.0  # reservoir_pressure

    outputs = torch.zeros(batch, N_OUTPUTS)
    outputs[:, 0] = 800.0   # q_bpd (positive)
    outputs[:, 1] = 2100.0  # pwf_psi < pr
    outputs[:, 2] = 900.0   # drawdown = pr - pwf (approx)
    outputs[:, 3] = 0.3     # sanding_index in [0,1]
    outputs[:, 4] = 30.0    # risk_score in [0,100]

    loss = physics_loss(inputs, outputs)
    # Should be small but not necessarily zero due to drawdown consistency term
    assert loss.item() < 10.0, f"Physics loss for valid outputs should be small, got {loss.item()}"


def test_physics_loss_penalizes_negative_flow():
    batch = 2
    inputs  = torch.zeros(batch, N_INPUTS)
    inputs[:, 0] = 3000.0
    outputs = torch.zeros(batch, N_OUTPUTS)
    outputs[:, 0] = -100.0  # negative q — VIOLATION
    outputs[:, 1] = 2000.0
    outputs[:, 2] = 1000.0
    outputs[:, 3] = 0.5
    outputs[:, 4] = 50.0
    loss = physics_loss(inputs, outputs)
    assert loss.item() > 0, "Physics loss must penalize negative flow rate"


# ─── Inference Tests ──────────────────────────────────────────────────────────

def test_params_to_input_vector_shape():
    params = {
        "reservoir_pressure": 3000.0,
        "q_max": 1500.0,
        "skin_factor": 0.0,
        "tvd_ft": 8000.0,
    }
    vec = _params_to_input_vector(params)
    assert vec.shape == (1, N_INPUTS), f"Expected (1, {N_INPUTS}), got {vec.shape}"


def test_params_to_input_vector_uses_defaults():
    """Calling with empty dict should use defaults without error."""
    vec = _params_to_input_vector({})
    assert vec.shape == (1, N_INPUTS)
    assert not np.isnan(vec).any()


def test_physics_fallback_returns_all_targets():
    params = {
        "reservoir_pressure": 3500.0,
        "q_max": 2000.0,
        "skin_factor": 2.0,
        "ucs_psi": 3000.0,
        "lot_pressure_ppg": 14.5,
        "decline_rate_di": 0.08,
    }
    result = _physics_fallback(params)
    for target in OUTPUT_TARGETS:
        assert target in result, f"Fallback missing target: {target}"
        assert "mean" in result[target]
        assert "std"  in result[target]
        assert "lower" in result[target]
        assert "upper" in result[target]
        assert result[target]["mean"] >= 0, f"Fallback {target} mean should be non-negative"


def test_physics_fallback_model_trained_false():
    result = _physics_fallback({})
    assert result["model_trained"] is False


def test_predict_pinn_returns_fallback_when_untrained():
    """Before training, predict_pinn should return physics fallback."""
    # Reset training state
    import pinn_surrogate as ps
    ps._training_metadata["trained"] = False
    ps._model = None

    params = {"reservoir_pressure": 3000.0, "q_max": 1500.0}
    result = predict_pinn(params)
    assert result["model_trained"] is False
    for target in OUTPUT_TARGETS:
        assert target in result


def test_predict_pinn_all_outputs_have_uncertainty():
    """Even in fallback mode, all outputs should have uncertainty bounds."""
    import pinn_surrogate as ps
    ps._training_metadata["trained"] = False
    ps._model = None

    result = predict_pinn({"reservoir_pressure": 3000.0})
    for target in OUTPUT_TARGETS:
        assert result[target]["cv_pct"] > 0, f"{target} should have non-zero uncertainty"


# ─── Training Status Tests ────────────────────────────────────────────────────

def test_get_training_status_returns_dict():
    status = get_training_status()
    assert isinstance(status, dict)
    assert "trained" in status
    assert "model_version" in status


def test_feature_and_target_counts():
    """Ensure feature/target lists are consistent with model dimensions."""
    assert len(INPUT_FEATURES) == N_INPUTS, f"Expected {N_INPUTS} features, got {len(INPUT_FEATURES)}"
    assert len(OUTPUT_TARGETS) == N_OUTPUTS, f"Expected {N_OUTPUTS} targets, got {len(OUTPUT_TARGETS)}"


# ─── HTTP Endpoint Tests ──────────────────────────────────────────────────────

def test_pinn_predict_endpoint_via_http():
    """Test the /pinn/predict endpoint through the FastAPI test client."""
    from fastapi.testclient import TestClient
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
    from main import app

    client = TestClient(app)
    payload = {
        "reservoir_pressure": 3500.0,
        "q_max": 2000.0,
        "skin_factor": 0.0,
        "esp_frequency_hz": 0.0,
        "wellhead_pressure": 200.0,
        "tvd_ft": 8000.0,
        "fluid_gradient": 0.433,
        "water_cut": 0.3,
        "gor_scf_per_bbl": 500.0,
        "avg_bulk_density_gcc": 2.4,
        "lot_pressure_ppg": 14.5,
        "current_mud_weight_ppg": 10.5,
        "ucs_psi": 3000.0,
        "friction_angle_deg": 30.0,
        "biot_coefficient": 0.8,
        "decline_rate_di": 0.08,
        "b_factor": 0.5,
        "mc_samples": 10,
    }
    response = client.post("/pinn/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    for target in OUTPUT_TARGETS:
        assert target in data, f"Response missing target: {target}"


def test_pinn_status_endpoint_via_http():
    from fastapi.testclient import TestClient
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
    from main import app

    client = TestClient(app)
    response = client.get("/pinn/status")
    assert response.status_code == 200
    data = response.json()
    assert "trained" in data or "available" in data
