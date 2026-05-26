"""
Decline Curve Forecaster — Real Arps Hyperbolic Curve Fitting
=============================================================
Fits Arps decline parameters (qi, Di, b) to historical production data
using scipy.optimize.curve_fit for non-linear least squares regression.

Arps Equations:
  Exponential (b=0): q(t) = qi * exp(-Di * t)
  Hyperbolic (0<b<1): q(t) = qi / (1 + b * Di * t)^(1/b)
  Harmonic (b=1):     q(t) = qi / (1 + Di * t)

EUR Calculation: Integral of the decline curve from t=0 to economic limit.
"""

import logging
import time
from typing import List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


def arps_hyperbolic(t: np.ndarray, qi: float, di: float, b: float) -> np.ndarray:
    """Arps hyperbolic decline: q(t) = qi / (1 + b*Di*t)^(1/b)."""
    b = max(b, 1e-6)  # Avoid division by zero
    return qi / np.power(1 + b * di * t, 1.0 / b)


def arps_exponential(t: np.ndarray, qi: float, di: float) -> np.ndarray:
    """Arps exponential decline: q(t) = qi * exp(-Di*t)."""
    return qi * np.exp(-di * t)


class DeclineCurveForecaster:
    """
    Fits Arps decline curves to production history and forecasts future rates.
    Uses scipy non-linear least squares for parameter estimation.
    """

    def __init__(self):
        self._last_fit = None

    def fit(self, production_history: List[float], time_months: Optional[List[float]] = None) -> dict:
        """
        Fit Arps decline parameters to production history.

        Args:
            production_history: Monthly production rates (BPD or BOPD)
            time_months: Time axis in months (defaults to 1, 2, 3, ...)

        Returns:
            dict with qi, di, b, r_squared, eur_mbbl
        """
        from scipy.optimize import curve_fit
        from scipy.stats import pearsonr

        t0 = time.time()
        y = np.array(production_history, dtype=np.float64)
        n = len(y)

        if n < 3:
            raise ValueError("Need at least 3 data points for curve fitting")

        if time_months is not None:
            t = np.array(time_months, dtype=np.float64)
        else:
            t = np.arange(1, n + 1, dtype=np.float64)

        # Initial guesses
        qi_guess = float(y[0]) if y[0] > 0 else float(np.max(y))
        di_guess = 0.05
        b_guess = 0.5

        # Try hyperbolic fit first
        try:
            popt_hyp, pcov_hyp = curve_fit(
                arps_hyperbolic, t, y,
                p0=[qi_guess, di_guess, b_guess],
                bounds=([0, 0, 0], [qi_guess * 3, 1.0, 2.0]),
                maxfev=5000,
            )
            y_pred_hyp = arps_hyperbolic(t, *popt_hyp)
            ss_res_hyp = np.sum((y - y_pred_hyp) ** 2)
            ss_tot = np.sum((y - np.mean(y)) ** 2)
            r2_hyp = 1 - ss_res_hyp / (ss_tot + 1e-10)
        except (RuntimeError, ValueError):
            popt_hyp = [qi_guess, di_guess, b_guess]
            r2_hyp = -1

        # Try exponential fit
        try:
            popt_exp, pcov_exp = curve_fit(
                arps_exponential, t, y,
                p0=[qi_guess, di_guess],
                bounds=([0, 0], [qi_guess * 3, 1.0]),
                maxfev=5000,
            )
            y_pred_exp = arps_exponential(t, *popt_exp)
            ss_res_exp = np.sum((y - y_pred_exp) ** 2)
            ss_tot = np.sum((y - np.mean(y)) ** 2)
            r2_exp = 1 - ss_res_exp / (ss_tot + 1e-10)
        except (RuntimeError, ValueError):
            popt_exp = [qi_guess, di_guess]
            r2_exp = -1

        # Select best model
        if r2_hyp >= r2_exp:
            qi, di, b = popt_hyp
            r_squared = r2_hyp
            model_type = "hyperbolic"
        else:
            qi, di = popt_exp
            b = 0.0
            r_squared = r2_exp
            model_type = "exponential"

        # Compute EUR (estimated ultimate recovery)
        # Integrate decline curve to economic limit (10 BPD)
        econ_limit = 10.0
        forecast_months = 600  # 50 years max
        t_forecast = np.arange(1, forecast_months + 1, dtype=np.float64)
        if b > 0.01:
            q_forecast = arps_hyperbolic(t_forecast, qi, di, b)
        else:
            q_forecast = arps_exponential(t_forecast, qi, di)

        # Find economic limit
        above_limit = q_forecast >= econ_limit
        if np.any(above_limit):
            economic_life_months = int(np.max(np.where(above_limit))) + 1
        else:
            economic_life_months = 0

        # EUR = sum of monthly production (rate * 30 days / 1000 for MBBL)
        eur_mbbl = float(np.sum(q_forecast[:economic_life_months] * 30) / 1000)

        elapsed = time.time() - t0

        self._last_fit = {
            "qi": round(float(qi), 2),
            "di": round(float(di), 6),
            "b": round(float(b), 4),
            "r_squared": round(float(r_squared), 4),
            "eur_mbbl": round(eur_mbbl, 1),
            "model_type": model_type,
            "economic_life_months": economic_life_months,
            "fit_time_ms": round(elapsed * 1000, 1),
        }
        return self._last_fit

    def forecast(
        self,
        well_id: str,
        production_history: List[float],
        forecast_months: int = 120,
    ) -> dict:
        """
        Fit decline curve and generate probabilistic forecast.

        Returns P10/P50/P90 forecasts using Monte Carlo parameter perturbation.
        """
        fit_result = self.fit(production_history)
        qi = fit_result["qi"]
        di = fit_result["di"]
        b = fit_result["b"]

        t_forecast = np.arange(1, forecast_months + 1, dtype=np.float64)

        # P50 (best estimate)
        if b > 0.01:
            p50 = arps_hyperbolic(t_forecast, qi, di, b)
        else:
            p50 = arps_exponential(t_forecast, qi, di)

        # Monte Carlo for P10/P90 (perturb parameters)
        rng = np.random.default_rng(42)
        n_mc = 100
        all_forecasts = np.zeros((n_mc, forecast_months))
        for i in range(n_mc):
            qi_mc = qi * rng.lognormal(0, 0.1)
            di_mc = di * rng.lognormal(0, 0.15)
            b_mc = max(0, min(2, b + rng.normal(0, 0.1)))
            if b_mc > 0.01:
                all_forecasts[i] = arps_hyperbolic(t_forecast, qi_mc, di_mc, b_mc)
            else:
                all_forecasts[i] = arps_exponential(t_forecast, qi_mc, di_mc)

        p10 = np.percentile(all_forecasts, 10, axis=0)
        p90 = np.percentile(all_forecasts, 90, axis=0)

        forecast_data = []
        for m in range(forecast_months):
            forecast_data.append({
                "month": m + 1,
                "p10_bpd": round(float(p10[m]), 1),
                "p50_bpd": round(float(p50[m]), 1),
                "p90_bpd": round(float(p90[m]), 1),
            })

        # EUR from P50
        eur_p50 = sum(f["p50_bpd"] * 30 for f in forecast_data) / 1000
        eur_p10 = sum(f["p10_bpd"] * 30 for f in forecast_data) / 1000
        eur_p90 = sum(f["p90_bpd"] * 30 for f in forecast_data) / 1000

        return {
            "well_id": well_id,
            "model": fit_result["model_type"],
            "parameters": {"qi": qi, "di": di, "b": b},
            "r_squared": fit_result["r_squared"],
            "forecast_months": forecast_months,
            "current_rate_bpd": production_history[-1] if production_history else 0,
            "eur_p10_mbbl": round(eur_p10, 1),
            "eur_p50_mbbl": round(eur_p50, 1),
            "eur_p90_mbbl": round(eur_p90, 1),
            "economic_life_months": fit_result["economic_life_months"],
            "forecast": forecast_data,
        }
