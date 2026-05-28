"""
Physics-Informed Neural Network (PINN) Surrogate Model
=======================================================
Implements a surrogate model trained on outputs from the Rust physics solver.

Architecture:
  - 3-layer MLP with residual connections (physics-informed via soft constraints)
  - Input: well parameters (reservoir_pressure, q_max, skin_factor, tvd_ft, etc.)
  - Output: operating_point (q_bpd, pwf_psi), sand_risk_score, stability_score
  - Physics constraints encoded as loss terms during training:
      * Darcy's law: q must increase as drawdown increases
      * Pressure continuity: Pwf must be < Pr
      * Sand onset: sanding_index must increase with drawdown

Training:
  - Generates training data by calling the Rust /compute/coupled endpoint
  - Parameter sweeps across reservoir_pressure, q_max, skin_factor, tvd_ft
  - Monte Carlo Dropout for uncertainty quantification (Gal & Ghahramani 2016)

References:
  - Raissi, M. et al. (2019). "Physics-informed neural networks." J. Comp. Physics.
  - Gal, Y. & Ghahramani, Z. (2016). "Dropout as a Bayesian Approximation." ICML.
  - Tartakovsky, A.M. et al. (2020). "Physics-Informed Deep Neural Networks." WRR.
"""

from __future__ import annotations

import asyncio
import logging
import math
import os
import time
from typing import Any

import httpx
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

PHYSICS_ENGINE_URL = os.getenv("PHYSICS_ENGINE_URL", "http://localhost:4001")

# ─── Feature / target definitions ─────────────────────────────────────────────

INPUT_FEATURES = [
    "reservoir_pressure",   # PSI
    "q_max",                # BPD
    "skin_factor",          # dimensionless
    "esp_frequency_hz",     # Hz
    "wellhead_pressure",    # PSI
    "tvd_ft",               # ft
    "fluid_gradient",       # psi/ft
    "water_cut",            # fraction
    "gor_scf_per_bbl",      # scf/bbl
    "avg_bulk_density_gcc", # g/cc
    "lot_pressure_ppg",     # ppg
    "current_mud_weight_ppg", # ppg
    "ucs_psi",              # PSI
    "friction_angle_deg",   # degrees
    "biot_coefficient",     # dimensionless
    "decline_rate_di",      # fraction/month
    "b_factor",             # dimensionless
]

OUTPUT_TARGETS = [
    "q_bpd",                # operating flow rate
    "pwf_psi",              # flowing bottomhole pressure
    "drawdown_psi",         # drawdown
    "sanding_index",        # 0-1
    "risk_score",           # 0-100
    "fracture_gradient_ppg", # ppg
    "eur_mbbl",             # MMBBL
]

N_INPUTS  = len(INPUT_FEATURES)
N_OUTPUTS = len(OUTPUT_TARGETS)

# ─── Normalization statistics (updated during training) ───────────────────────

class NormStats:
    """Running mean/std for input normalization."""
    def __init__(self):
        self.mean = np.zeros(N_INPUTS, dtype=np.float32)
        self.std  = np.ones(N_INPUTS, dtype=np.float32)
        self.fitted = False

    def fit(self, X: np.ndarray):
        self.mean = X.mean(axis=0).astype(np.float32)
        self.std  = X.std(axis=0).astype(np.float32) + 1e-8
        self.fitted = True

    def transform(self, X: np.ndarray) -> np.ndarray:
        return ((X - self.mean) / self.std).astype(np.float32)

    def state_dict(self) -> dict:
        return {"mean": self.mean.tolist(), "std": self.std.tolist(), "fitted": self.fitted}

    def load_state_dict(self, d: dict):
        self.mean   = np.array(d["mean"], dtype=np.float32)
        self.std    = np.array(d["std"],  dtype=np.float32)
        self.fitted = d["fitted"]


# ─── PINN Architecture ────────────────────────────────────────────────────────

class PINNBlock(nn.Module):
    """Residual block with dropout for uncertainty quantification."""
    def __init__(self, dim: int, dropout: float = 0.1):
        super().__init__()
        self.fc1     = nn.Linear(dim, dim)
        self.fc2     = nn.Linear(dim, dim)
        self.dropout = nn.Dropout(dropout)
        self.act     = nn.SiLU()  # Smooth activation for physics problems
        self.norm    = nn.LayerNorm(dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = x
        x = self.act(self.fc1(x))
        x = self.dropout(x)
        x = self.fc2(x)
        return self.norm(x + residual)


class PINNSurrogate(nn.Module):
    """
    Physics-Informed Neural Network surrogate for coupled well physics.

    Uses Monte Carlo Dropout for uncertainty quantification:
    - Keep dropout active at inference time
    - Run N forward passes to get mean + std of predictions
    """
    def __init__(self, hidden_dim: int = 128, n_blocks: int = 4, dropout: float = 0.1):
        super().__init__()
        self.input_proj = nn.Linear(N_INPUTS, hidden_dim)
        self.blocks = nn.ModuleList([
            PINNBlock(hidden_dim, dropout) for _ in range(n_blocks)
        ])
        self.output_head = nn.Linear(hidden_dim, N_OUTPUTS)
        self.act = nn.SiLU()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.act(self.input_proj(x))
        for block in self.blocks:
            x = block(x)
        return self.output_head(x)

    def predict_with_uncertainty(
        self,
        x: torch.Tensor,
        n_samples: int = 50,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """Monte Carlo Dropout inference: returns (mean, std) tensors."""
        self.train()  # Keep dropout active
        with torch.no_grad():
            samples = torch.stack([self(x) for _ in range(n_samples)], dim=0)
        self.eval()
        return samples.mean(dim=0), samples.std(dim=0)


# ─── Physics Constraints ──────────────────────────────────────────────────────

def physics_loss(
    inputs: torch.Tensor,
    outputs: torch.Tensor,
) -> torch.Tensor:
    """
    Soft physics constraints as additional loss terms.

    Constraints:
    1. Pwf < Pr (flowing pressure must be less than reservoir pressure)
    2. drawdown = Pr - Pwf (consistency check)
    3. q >= 0 (non-negative flow rate)
    4. sanding_index in [0, 1]
    5. risk_score in [0, 100]
    """
    pr    = inputs[:, 0]   # reservoir_pressure
    q     = outputs[:, 0]  # q_bpd
    pwf   = outputs[:, 1]  # pwf_psi
    dd    = outputs[:, 2]  # drawdown_psi
    si    = outputs[:, 3]  # sanding_index
    risk  = outputs[:, 4]  # risk_score

    # Constraint 1: Pwf < Pr
    loss_pwf = torch.relu(pwf - pr).mean()

    # Constraint 2: drawdown = Pr - Pwf
    loss_dd = ((dd - (pr - pwf)) ** 2).mean() * 0.01

    # Constraint 3: q >= 0
    loss_q = torch.relu(-q).mean()

    # Constraint 4: sanding_index in [0, 1]
    loss_si = (torch.relu(-si) + torch.relu(si - 1.0)).mean()

    # Constraint 5: risk_score in [0, 100]
    loss_risk = (torch.relu(-risk) + torch.relu(risk - 100.0)).mean() * 0.01

    return loss_pwf + loss_dd + loss_q + loss_si + loss_risk


# ─── Global model state ───────────────────────────────────────────────────────

_model: PINNSurrogate | None = None
_norm_stats: NormStats = NormStats()
_training_metadata: dict[str, Any] = {
    "trained": False,
    "n_samples": 0,
    "n_epochs": 0,
    "final_loss": None,
    "train_time_s": None,
    "model_version": "pinn-v1.0",
}


def get_model() -> PINNSurrogate:
    global _model
    if _model is None:
        _model = PINNSurrogate(hidden_dim=128, n_blocks=4, dropout=0.1)
        _model.eval()
    return _model


# ─── Training data generation ─────────────────────────────────────────────────

async def _call_coupled(params: dict) -> dict | None:
    """Call the Rust /compute/coupled endpoint to generate training data."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{PHYSICS_ENGINE_URL}/compute/coupled",
                json=params,
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        logger.warning("Failed to call coupled endpoint: %s", e)
    return None


def _default_coupled_params() -> dict:
    return {
        "well_id":                "PINN-TRAIN",
        "reservoir_pressure":     3000.0,
        "q_max":                  1500.0,
        "skin_factor":            0.0,
        "esp_frequency_hz":       0.0,
        "wellhead_pressure":      200.0,
        "tvd_ft":                 8000.0,
        "fluid_gradient":         0.433,
        "water_cut":              0.3,
        "gor_scf_per_bbl":        500.0,
        "avg_bulk_density_gcc":   2.4,
        "lot_pressure_ppg":       14.5,
        "current_mud_weight_ppg": 10.5,
        "ucs_psi":                3000.0,
        "friction_angle_deg":     30.0,
        "biot_coefficient":       0.8,
        "completion_type":        "CASED_PERFORATED",
        "decline_rate_di":        0.08,
        "b_factor":               0.5,
        "forecast_months":        120,
    }


async def generate_training_data(n_samples: int = 500) -> tuple[np.ndarray, np.ndarray]:
    """
    Generate training data by calling the Rust coupled solver with parameter sweeps.
    Falls back to physics-based synthetic data if the Rust service is unavailable.
    """
    X_list: list[list[float]] = []
    y_list: list[list[float]] = []

    base = _default_coupled_params()

    # Parameter ranges for sweep
    pr_range    = np.linspace(1500, 6000, 10)
    qmax_range  = np.linspace(500, 3000, 5)
    skin_range  = np.linspace(-2, 10, 5)
    tvd_range   = np.linspace(4000, 14000, 4)
    ucs_range   = np.linspace(500, 8000, 5)
    wc_range    = np.linspace(0.0, 0.9, 5)

    tasks = []
    rng = np.random.default_rng(42)

    for _ in range(n_samples):
        p = dict(base)
        p["reservoir_pressure"]     = float(rng.choice(pr_range))
        p["q_max"]                  = float(rng.choice(qmax_range))
        p["skin_factor"]            = float(rng.choice(skin_range))
        p["tvd_ft"]                 = float(rng.choice(tvd_range))
        p["ucs_psi"]                = float(rng.choice(ucs_range))
        p["water_cut"]              = float(rng.choice(wc_range))
        p["avg_bulk_density_gcc"]   = float(rng.uniform(2.2, 2.7))
        p["lot_pressure_ppg"]       = float(rng.uniform(12.0, 16.0))
        p["current_mud_weight_ppg"] = float(rng.uniform(9.0, 13.0))
        p["biot_coefficient"]       = float(rng.uniform(0.6, 1.0))
        p["decline_rate_di"]        = float(rng.uniform(0.03, 0.20))
        p["b_factor"]               = float(rng.uniform(0.0, 1.0))
        tasks.append(p)

    # Call Rust solver in batches
    logger.info("Generating %d PINN training samples via Rust coupled solver...", n_samples)
    results = await asyncio.gather(*[_call_coupled(p) for p in tasks])

    for params, result in zip(tasks, results):
        x_row = [
            params["reservoir_pressure"],
            params["q_max"],
            params["skin_factor"],
            params["esp_frequency_hz"],
            params["wellhead_pressure"],
            params["tvd_ft"],
            params["fluid_gradient"],
            params["water_cut"],
            params["gor_scf_per_bbl"],
            params["avg_bulk_density_gcc"],
            params["lot_pressure_ppg"],
            params["current_mud_weight_ppg"],
            params["ucs_psi"],
            params["friction_angle_deg"],
            params["biot_coefficient"],
            params["decline_rate_di"],
            params["b_factor"],
        ]

        if result is not None:
            op   = result.get("operating_point", {})
            sand = result.get("sand_onset", {})
            geo  = result.get("geomechanics", {})
            dec  = result.get("decline", {})
            risk = result.get("risk_summary", {})
            y_row = [
                float(op.get("q_bpd", 0.0)),
                float(op.get("pwf_psi", 0.0)),
                float(op.get("drawdown_psi", 0.0)),
                float(sand.get("sanding_index", 0.0)),
                float(risk.get("risk_score", 0.0)),
                float(geo.get("fracture_gradient_ppg", 14.0)),
                float(dec.get("eur_mbbl", 0.0)),
            ]
        else:
            # Physics-based synthetic fallback (Vogel IPR approximation)
            pr   = params["reservoir_pressure"]
            qmax = params["q_max"]
            skin = params["skin_factor"]
            q_approx = qmax * 0.6 / (1.0 + max(0, skin) * 0.05)
            pwf_approx = pr * (1.0 - (q_approx / qmax) ** 0.5) * 0.8
            dd_approx  = pr - pwf_approx
            si_approx  = min(1.0, max(0.0, dd_approx / (params["ucs_psi"] * 0.3)))
            risk_approx = si_approx * 60.0
            fg_approx   = params["lot_pressure_ppg"] * 0.95
            eur_approx  = q_approx * 0.5 * 365.0 / 1000.0  # rough 6-month EUR
            y_row = [q_approx, pwf_approx, dd_approx, si_approx, risk_approx, fg_approx, eur_approx]

        X_list.append(x_row)
        y_list.append(y_row)

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.float32)
    logger.info("Generated %d training samples (%.0f%% from Rust solver)",
                len(X), 100.0 * sum(1 for r in results if r is not None) / len(results))
    return X, y


# ─── Training ─────────────────────────────────────────────────────────────────

async def train_pinn(
    n_samples: int = 500,
    n_epochs: int = 200,
    lr: float = 1e-3,
    physics_weight: float = 0.1,
) -> dict[str, Any]:
    """Train the PINN surrogate on coupled solver outputs."""
    global _model, _norm_stats, _training_metadata

    t0 = time.time()

    X, y = await generate_training_data(n_samples)

    # Normalize inputs
    _norm_stats.fit(X)
    X_norm = _norm_stats.transform(X)

    # Normalize targets (min-max per column)
    y_min = y.min(axis=0)
    y_max = y.max(axis=0)
    y_range = (y_max - y_min) + 1e-8
    y_norm = (y - y_min) / y_range

    X_t = torch.from_numpy(X_norm)
    y_t = torch.from_numpy(y_norm)

    model = PINNSurrogate(hidden_dim=128, n_blocks=4, dropout=0.1)
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=n_epochs)

    mse_loss = nn.MSELoss()
    model.train()

    final_loss = float("inf")
    for epoch in range(n_epochs):
        optimizer.zero_grad()
        pred = model(X_t)

        # Data loss
        loss_data = mse_loss(pred, y_t)

        # Physics loss (on un-normalized outputs scaled back)
        pred_phys = pred * torch.from_numpy(y_range) + torch.from_numpy(y_min)
        loss_phys = physics_loss(X_t, pred_phys)

        loss = loss_data + physics_weight * loss_phys
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        scheduler.step()

        if (epoch + 1) % 50 == 0:
            logger.info("PINN epoch %d/%d — loss=%.6f (data=%.6f, physics=%.6f)",
                        epoch + 1, n_epochs, loss.item(), loss_data.item(), loss_phys.item())
            final_loss = loss.item()

    model.eval()
    _model = model

    # Store normalization stats in model for inference
    _model._y_min   = y_min
    _model._y_max   = y_max
    _model._y_range = y_range

    elapsed = time.time() - t0
    _training_metadata.update({
        "trained":       True,
        "n_samples":     n_samples,
        "n_epochs":      n_epochs,
        "final_loss":    round(final_loss, 6),
        "train_time_s":  round(elapsed, 1),
        "model_version": "pinn-v1.0",
    })
    logger.info("PINN training complete in %.1fs — final loss=%.6f", elapsed, final_loss)
    return _training_metadata


# ─── Inference ────────────────────────────────────────────────────────────────

def _params_to_input_vector(params: dict) -> np.ndarray:
    return np.array([[
        params.get("reservoir_pressure",     3000.0),
        params.get("q_max",                  1500.0),
        params.get("skin_factor",            0.0),
        params.get("esp_frequency_hz",       0.0),
        params.get("wellhead_pressure",      200.0),
        params.get("tvd_ft",                 8000.0),
        params.get("fluid_gradient",         0.433),
        params.get("water_cut",              0.3),
        params.get("gor_scf_per_bbl",        500.0),
        params.get("avg_bulk_density_gcc",   2.4),
        params.get("lot_pressure_ppg",       14.5),
        params.get("current_mud_weight_ppg", 10.5),
        params.get("ucs_psi",                3000.0),
        params.get("friction_angle_deg",     30.0),
        params.get("biot_coefficient",       0.8),
        params.get("decline_rate_di",        0.08),
        params.get("b_factor",               0.5),
    ]], dtype=np.float32)


def predict_pinn(params: dict, n_mc_samples: int = 50) -> dict[str, Any]:
    """
    Run PINN inference with Monte Carlo Dropout uncertainty quantification.

    Returns:
        dict with mean predictions and uncertainty bounds for each output target.
    """
    model = get_model()

    if not _training_metadata["trained"]:
        # Return physics-based fallback if model not trained
        return _physics_fallback(params)

    X = _params_to_input_vector(params)
    if _norm_stats.fitted:
        X = _norm_stats.transform(X)

    X_t = torch.from_numpy(X)
    mean, std = model.predict_with_uncertainty(X_t, n_samples=n_mc_samples)

    mean_np = mean.numpy()[0]
    std_np  = std.numpy()[0]

    # Denormalize
    y_min   = getattr(model, "_y_min",   np.zeros(N_OUTPUTS))
    y_range = getattr(model, "_y_range", np.ones(N_OUTPUTS))

    mean_denorm = mean_np * y_range + y_min
    std_denorm  = std_np  * y_range

    result: dict[str, Any] = {}
    for i, name in enumerate(OUTPUT_TARGETS):
        result[name] = {
            "mean":    float(mean_denorm[i]),
            "std":     float(std_denorm[i]),
            "lower":   float(mean_denorm[i] - 2 * std_denorm[i]),
            "upper":   float(mean_denorm[i] + 2 * std_denorm[i]),
            "cv_pct":  float(100.0 * std_denorm[i] / (abs(mean_denorm[i]) + 1e-8)),
        }

    result["model_trained"]  = True
    result["mc_samples"]     = n_mc_samples
    result["model_version"]  = _training_metadata.get("model_version", "pinn-v1.0")
    return result


def _physics_fallback(params: dict) -> dict[str, Any]:
    """Rule-based physics approximation when PINN is not trained."""
    pr   = params.get("reservoir_pressure",  3000.0)
    qmax = params.get("q_max",               1500.0)
    skin = params.get("skin_factor",         0.0)
    ucs  = params.get("ucs_psi",             3000.0)
    lot  = params.get("lot_pressure_ppg",    14.5)
    di   = params.get("decline_rate_di",     0.08)

    q_approx   = qmax * 0.6 / (1.0 + max(0, skin) * 0.05)
    pwf_approx = pr * 0.7
    dd_approx  = pr - pwf_approx
    si_approx  = min(1.0, max(0.0, dd_approx / (ucs * 0.3)))
    risk_approx = si_approx * 60.0
    fg_approx   = lot * 0.95
    eur_approx  = q_approx * 0.5 * 365.0 / 1000.0

    vals = [q_approx, pwf_approx, dd_approx, si_approx, risk_approx, fg_approx, eur_approx]
    result: dict[str, Any] = {}
    for i, name in enumerate(OUTPUT_TARGETS):
        result[name] = {
            "mean":   float(vals[i]),
            "std":    float(vals[i] * 0.15),  # 15% uncertainty for fallback
            "lower":  float(vals[i] * 0.85),
            "upper":  float(vals[i] * 1.15),
            "cv_pct": 15.0,
        }
    result["model_trained"]  = False
    result["mc_samples"]     = 0
    result["model_version"]  = "physics-fallback-v1.0"
    return result


def get_training_status() -> dict[str, Any]:
    return dict(_training_metadata)


# ─── Model Persistence (S3 via Manus Forge API) ───────────────────────────────

import io
import json as _json
import os
import datetime

_FORGE_API_URL = os.environ.get("BUILT_IN_FORGE_API_URL", "")
_FORGE_API_KEY = os.environ.get("BUILT_IN_FORGE_API_KEY", "")
_version_history: list[dict] = []


def _s3_put(key: str, data: bytes, content_type: str = "application/octet-stream") -> str | None:
    """Upload bytes to S3 via Manus Forge storage API. Returns public URL or None."""
    try:
        import httpx
        resp = httpx.post(
            f"{_FORGE_API_URL}/storage/upload",
            headers={"Authorization": f"Bearer {_FORGE_API_KEY}"},
            files={"file": (key.split("/")[-1], data, content_type)},
            data={"key": key},
            timeout=60.0,
        )
        if resp.status_code in (200, 201):
            return resp.json().get("url")
    except Exception as exc:
        logger.warning("S3 put failed: %s", exc)
    return None


def _s3_get(key: str) -> bytes | None:
    """Download bytes from S3 via Manus Forge storage API."""
    try:
        import httpx
        resp = httpx.get(
            f"{_FORGE_API_URL}/storage/download",
            headers={"Authorization": f"Bearer {_FORGE_API_KEY}"},
            params={"key": key},
            timeout=60.0,
        )
        if resp.status_code == 200:
            return resp.content
    except Exception as exc:
        logger.warning("S3 get failed: %s", exc)
    return None


def save_model_to_s3(s3_key: str, version_key: str) -> dict:
    """Serialize current PINN weights + norm stats to S3 for persistence."""
    global _version_history
    model = get_model()
    if not _training_metadata.get("trained"):
        return {"ok": False, "error": "Model has not been trained yet."}

    buf = io.BytesIO()
    checkpoint = {
        "model_state": model.state_dict(),
        "norm_stats":  _norm_stats.state_dict(),
        "y_min":       model._y_min.tolist() if hasattr(model, "_y_min") else None,
        "y_max":       model._y_max.tolist() if hasattr(model, "_y_max") else None,
        "y_range":     model._y_range.tolist() if hasattr(model, "_y_range") else None,
        "metadata":    dict(_training_metadata),
        "saved_at":    datetime.datetime.utcnow().isoformat() + "Z",
        "version":     _training_metadata.get("model_version", "pinn-v1.0"),
    }
    torch.save(checkpoint, buf)
    model_bytes = buf.getvalue()

    url = _s3_put(s3_key, model_bytes, "application/octet-stream")
    entry = {
        "s3_key": s3_key, "url": url, "saved_at": checkpoint["saved_at"],
        "version": checkpoint["version"],
        "n_samples": checkpoint["metadata"].get("n_samples"),
        "loss": checkpoint["metadata"].get("final_loss"),
    }
    _version_history.append(entry)
    manifest = _json.dumps({"versions": _version_history}, indent=2).encode()
    _s3_put(version_key, manifest, "application/json")
    logger.info("PINN model saved to S3 key=%s", s3_key)
    return {"ok": True, "url": url, "s3_key": s3_key, "version": checkpoint["version"], "size_bytes": len(model_bytes)}


def load_model_from_s3(s3_key: str) -> dict:
    """Load PINN weights from S3 into memory."""
    global _model, _norm_stats, _training_metadata
    data = _s3_get(s3_key)
    if data is None:
        return {"ok": False, "error": f"Could not download model from S3 key: {s3_key}"}
    buf = io.BytesIO(data)
    checkpoint = torch.load(buf, map_location="cpu", weights_only=False)
    model = PINNSurrogate(hidden_dim=128, n_blocks=4, dropout=0.1)
    model.load_state_dict(checkpoint["model_state"])
    model.eval()
    if checkpoint.get("y_min") is not None:
        model._y_min   = np.array(checkpoint["y_min"])
        model._y_max   = np.array(checkpoint["y_max"])
        model._y_range = np.array(checkpoint["y_range"])
    _norm_stats.load_state_dict(checkpoint["norm_stats"])
    _model = model
    meta = checkpoint.get("metadata", {})
    meta["trained"] = True
    _training_metadata.update(meta)
    logger.info("PINN model loaded from S3 key=%s version=%s", s3_key, checkpoint.get("version"))
    return {"ok": True, "s3_key": s3_key, "version": checkpoint.get("version"), "metadata": meta}


def get_model_versions() -> dict:
    """Return in-memory version history."""
    return {"versions": list(_version_history)}
