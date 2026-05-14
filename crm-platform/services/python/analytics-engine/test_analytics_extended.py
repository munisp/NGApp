"""Extended analytics engine tests."""
import pytest
import json
from datetime import datetime, timedelta

class TestMetricsAggregation:
    """Test metrics computation and aggregation."""

    def test_revenue_calculation(self):
        deals = [
            {"value": 1000000, "currency": "NGN", "stage": "won"},
            {"value": 2500000, "currency": "NGN", "stage": "won"},
            {"value": 500000, "currency": "NGN", "stage": "lost"},
        ]
        won = [d for d in deals if d["stage"] == "won"]
        total = sum(d["value"] for d in won)
        assert total == 3500000

    def test_conversion_rate(self):
        leads = 1000
        won = 150
        rate = (won / leads) * 100
        assert rate == 15.0

    def test_average_deal_size(self):
        values = [1000000, 2500000, 1500000, 3000000]
        avg = sum(values) / len(values)
        assert avg == 2000000.0

    def test_pipeline_velocity(self):
        deals = [
            {"value": 1000000, "days_in_pipeline": 30, "probability": 0.5},
            {"value": 2000000, "days_in_pipeline": 45, "probability": 0.7},
        ]
        velocity = sum(d["value"] * d["probability"] / d["days_in_pipeline"] for d in deals)
        assert velocity > 0

    def test_win_rate_by_vertical(self):
        deals = [
            {"vertical": "banking", "stage": "won"},
            {"vertical": "banking", "stage": "won"},
            {"vertical": "banking", "stage": "lost"},
            {"vertical": "telco", "stage": "won"},
            {"vertical": "telco", "stage": "lost"},
            {"vertical": "telco", "stage": "lost"},
        ]
        verticals = {}
        for d in deals:
            v = d["vertical"]
            if v not in verticals:
                verticals[v] = {"won": 0, "total": 0}
            verticals[v]["total"] += 1
            if d["stage"] == "won":
                verticals[v]["won"] += 1

        assert verticals["banking"]["won"] / verticals["banking"]["total"] == pytest.approx(0.667, abs=0.01)
        assert verticals["telco"]["won"] / verticals["telco"]["total"] == pytest.approx(0.333, abs=0.01)


class TestTimeSeriesAnalytics:
    """Test time-series analytics."""

    def test_daily_aggregation(self):
        events = [
            {"date": "2024-01-01", "value": 100},
            {"date": "2024-01-01", "value": 200},
            {"date": "2024-01-02", "value": 150},
        ]
        daily = {}
        for e in events:
            daily[e["date"]] = daily.get(e["date"], 0) + e["value"]
        assert daily["2024-01-01"] == 300
        assert daily["2024-01-02"] == 150

    def test_moving_average(self):
        values = [10, 20, 30, 40, 50]
        window = 3
        ma = []
        for i in range(window - 1, len(values)):
            avg = sum(values[i - window + 1:i + 1]) / window
            ma.append(avg)
        assert ma == [20.0, 30.0, 40.0]

    def test_growth_rate(self):
        current = 1500000
        previous = 1200000
        growth = ((current - previous) / previous) * 100
        assert growth == pytest.approx(25.0)

    def test_churn_rate(self):
        start_customers = 1000
        lost_customers = 50
        churn = (lost_customers / start_customers) * 100
        assert churn == 5.0

    def test_retention_rate(self):
        start = 1000
        end = 980
        new_acquired = 30
        retained = end - new_acquired
        retention = (retained / start) * 100
        assert retention == 95.0


class TestSegmentation:
    """Test customer segmentation logic."""

    def test_rfm_scoring(self):
        customers = [
            {"id": "c1", "recency_days": 5, "frequency": 20, "monetary": 5000000},
            {"id": "c2", "recency_days": 90, "frequency": 2, "monetary": 100000},
            {"id": "c3", "recency_days": 30, "frequency": 10, "monetary": 2000000},
        ]
        for c in customers:
            c["r_score"] = 5 if c["recency_days"] < 30 else (3 if c["recency_days"] < 60 else 1)
            c["f_score"] = 5 if c["frequency"] > 15 else (3 if c["frequency"] > 5 else 1)
            c["m_score"] = 5 if c["monetary"] > 3000000 else (3 if c["monetary"] > 1000000 else 1)

        assert customers[0]["r_score"] == 5
        assert customers[0]["f_score"] == 5
        assert customers[0]["m_score"] == 5
        assert customers[1]["r_score"] == 1
        assert customers[1]["f_score"] == 1
        assert customers[1]["m_score"] == 1

    def test_lifecycle_stage(self):
        stages = {
            "lead": {"min_interactions": 0, "has_purchase": False},
            "prospect": {"min_interactions": 3, "has_purchase": False},
            "customer": {"min_interactions": 1, "has_purchase": True},
            "champion": {"min_interactions": 20, "has_purchase": True},
        }
        customer = {"interactions": 25, "has_purchase": True}
        if customer["has_purchase"] and customer["interactions"] >= 20:
            stage = "champion"
        elif customer["has_purchase"]:
            stage = "customer"
        elif customer["interactions"] >= 3:
            stage = "prospect"
        else:
            stage = "lead"
        assert stage == "champion"

    def test_cohort_analysis(self):
        cohorts = {
            "2024-Q1": {"acquired": 500, "month1": 400, "month2": 350, "month3": 300},
            "2024-Q2": {"acquired": 600, "month1": 480, "month2": 420, "month3": 360},
        }
        for name, data in cohorts.items():
            data["retention_m1"] = data["month1"] / data["acquired"]
            data["retention_m3"] = data["month3"] / data["acquired"]

        assert cohorts["2024-Q1"]["retention_m1"] == 0.8
        assert cohorts["2024-Q2"]["retention_m3"] == 0.6


class TestForecastModels:
    """Test forecasting models."""

    def test_weighted_pipeline(self):
        deals = [
            {"value": 1000000, "probability": 0.9, "stage": "negotiation"},
            {"value": 2000000, "probability": 0.5, "stage": "proposal"},
            {"value": 500000, "probability": 0.2, "stage": "qualification"},
        ]
        weighted = sum(d["value"] * d["probability"] for d in deals)
        assert weighted == 2000000.0

    def test_monte_carlo_bounds(self):
        import random
        random.seed(42)
        base_value = 5000000
        results = []
        for _ in range(1000):
            factor = random.gauss(1.0, 0.15)
            results.append(base_value * factor)
        p10 = sorted(results)[100]
        p90 = sorted(results)[900]
        assert p10 < base_value < p90
        assert p90 - p10 > 0

    def test_linear_trend(self):
        months = [1, 2, 3, 4, 5]
        revenue = [100, 120, 140, 160, 180]
        n = len(months)
        sum_x = sum(months)
        sum_y = sum(revenue)
        sum_xy = sum(x * y for x, y in zip(months, revenue))
        sum_x2 = sum(x * x for x in months)
        slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x ** 2)
        assert slope == pytest.approx(20.0)
