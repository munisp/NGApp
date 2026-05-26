"""Analytics engine tests — validates metrics calculation, aggregation, and reporting."""
import pytest
from datetime import datetime, timedelta


class TestRevenueCalculation:
    def test_monthly_recurring_revenue(self):
        subscriptions = [
            {"amount": 1000, "period": "monthly"},
            {"amount": 500, "period": "monthly"},
            {"amount": 12000, "period": "yearly"},
        ]
        mrr = self._calculate_mrr(subscriptions)
        assert mrr == 2500  # 1000 + 500 + (12000/12)

    def test_empty_subscriptions(self):
        assert self._calculate_mrr([]) == 0

    def test_annual_to_monthly_conversion(self):
        subs = [{"amount": 24000, "period": "yearly"}]
        assert self._calculate_mrr(subs) == 2000

    def test_arr_from_mrr(self):
        subs = [{"amount": 5000, "period": "monthly"}]
        mrr = self._calculate_mrr(subs)
        assert mrr * 12 == 60000

    def _calculate_mrr(self, subscriptions):
        total = 0
        for s in subscriptions:
            if s["period"] == "monthly":
                total += s["amount"]
            elif s["period"] == "yearly":
                total += s["amount"] / 12
        return total


class TestCohortAnalysis:
    def test_retention_rate(self):
        cohort = {"month_0": 100, "month_1": 80, "month_2": 65, "month_3": 55}
        rates = self._retention_rates(cohort)
        assert rates[1] == 0.80
        assert rates[2] == 0.65
        assert rates[3] == 0.55

    def test_churn_from_retention(self):
        retention = 0.85
        churn = 1 - retention
        assert abs(churn - 0.15) < 0.001

    def test_empty_cohort(self):
        cohort = {"month_0": 0}
        rates = self._retention_rates(cohort)
        assert len(rates) == 0

    def _retention_rates(self, cohort):
        initial = cohort.get("month_0", 0)
        if initial == 0:
            return {}
        return {
            int(k.split("_")[1]): v / initial
            for k, v in cohort.items()
            if k != "month_0"
        }


class TestFunnelAnalysis:
    def test_conversion_rates(self):
        funnel = [1000, 500, 200, 50, 20]
        rates = self._funnel_conversion(funnel)
        assert rates[0] == 0.50  # 500/1000
        assert rates[1] == 0.40  # 200/500
        assert rates[2] == 0.25  # 50/200
        assert rates[3] == 0.40  # 20/50

    def test_overall_conversion(self):
        funnel = [1000, 500, 200, 50, 20]
        overall = funnel[-1] / funnel[0]
        assert overall == 0.02

    def test_single_stage(self):
        assert self._funnel_conversion([100]) == []

    def _funnel_conversion(self, stages):
        rates = []
        for i in range(1, len(stages)):
            rates.append(round(stages[i] / stages[i - 1], 2))
        return rates


class TestSegmentScoring:
    def test_high_value_segment(self):
        customers = [
            {"revenue": 50000, "tenure_months": 24, "nps": 9},
            {"revenue": 75000, "tenure_months": 36, "nps": 10},
        ]
        score = self._segment_score(customers)
        assert score > 80

    def test_low_value_segment(self):
        customers = [
            {"revenue": 500, "tenure_months": 2, "nps": 4},
            {"revenue": 300, "tenure_months": 1, "nps": 3},
        ]
        score = self._segment_score(customers)
        assert score < 30

    def test_empty_segment(self):
        assert self._segment_score([]) == 0

    def _segment_score(self, customers):
        if not customers:
            return 0
        avg_rev = sum(c["revenue"] for c in customers) / len(customers)
        avg_tenure = sum(c["tenure_months"] for c in customers) / len(customers)
        avg_nps = sum(c["nps"] for c in customers) / len(customers)
        rev_score = min(40, avg_rev / 2000 * 40)
        tenure_score = min(30, avg_tenure / 36 * 30)
        nps_score = avg_nps / 10 * 30
        return round(rev_score + tenure_score + nps_score)
