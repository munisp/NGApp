"""Revenue Attribution & ROI Tracking Service.

Multi-touch attribution models for campaign-to-conversion tracking.
Supports first-touch, last-touch, and linear attribution models.
"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Optional
from dataclasses import dataclass, field
from fastapi import FastAPI, APIRouter, Query

router = APIRouter(prefix="/api/v1/attribution", tags=["Revenue Attribution"])


class AttributionModel(str, Enum):
    FIRST_TOUCH = "first_touch"
    LAST_TOUCH = "last_touch"
    LINEAR = "linear"
    TIME_DECAY = "time_decay"
    POSITION_BASED = "position_based"


@dataclass
class TouchPoint:
    channel: str
    campaign_id: str
    timestamp: datetime
    action: str  # impression, click, conversion


@dataclass
class ConversionEvent:
    customer_id: str
    product: str
    revenue: float
    timestamp: datetime
    touchpoints: list[TouchPoint] = field(default_factory=list)


@dataclass
class CampaignROI:
    campaign_id: str
    name: str
    spend: float
    revenue: float
    roi_pct: float
    conversions: int
    avg_conversion_value: float
    channels: list[str]
    first_touch_channel: str
    last_touch_channel: str
    avg_time_to_convert_days: float
    attribution: dict  # model -> percentage


@dataclass
class ChannelAttribution:
    channel: str
    revenue: float
    conversions: int
    spend: float
    roi_pct: float
    revenue_share: float


@dataclass
class ProductAttribution:
    product: str
    conversions: int
    revenue: float
    avg_value: float
    revenue_share: float


# Pre-computed attribution data matching CRM UI
CAMPAIGN_ROI_DATA = [
    CampaignROI(
        campaign_id="CMP-001",
        name="Agent → Savings Account Upsell",
        spend=340_000, revenue=12_600_000, roi_pct=3605.9,
        conversions=354, avg_conversion_value=35_600,
        channels=["sms", "whatsapp"],
        first_touch_channel="sms", last_touch_channel="whatsapp",
        avg_time_to_convert_days=3.2,
        attribution={"first_touch": 42, "last_touch": 58, "linear": 50}
    ),
    CampaignROI(
        campaign_id="CMP-002",
        name="Remittance FX Account Cross-Sell",
        spend=280_000, revenue=9_760_000, roi_pct=3385.7,
        conversions=178, avg_conversion_value=54_830,
        channels=["whatsapp", "telegram"],
        first_touch_channel="telegram", last_touch_channel="whatsapp",
        avg_time_to_convert_days=5.1,
        attribution={"first_touch": 35, "last_touch": 65, "linear": 50}
    ),
    CampaignROI(
        campaign_id="CMP-003",
        name="Premium Insurance Upsell",
        spend=420_000, revenue=4_680_000, roi_pct=1014.3,
        conversions=92, avg_conversion_value=50_870,
        channels=["email", "voice"],
        first_touch_channel="email", last_touch_channel="voice",
        avg_time_to_convert_days=8.4,
        attribution={"first_touch": 55, "last_touch": 45, "linear": 50}
    ),
    CampaignROI(
        campaign_id="CMP-004",
        name="Dormant Account Reactivation",
        spend=180_000, revenue=2_160_000, roi_pct=1100.0,
        conversions=210, avg_conversion_value=10_290,
        channels=["sms", "whatsapp", "voice"],
        first_touch_channel="sms", last_touch_channel="voice",
        avg_time_to_convert_days=12.5,
        attribution={"first_touch": 30, "last_touch": 45, "linear": 33}
    ),
    CampaignROI(
        campaign_id="CMP-005",
        name="Business Loan Pre-Qualification",
        spend=560_000, revenue=29_200_000, roi_pct=5114.3,
        conversions=68, avg_conversion_value=429_410,
        channels=["whatsapp", "voice"],
        first_touch_channel="whatsapp", last_touch_channel="voice",
        avg_time_to_convert_days=15.8,
        attribution={"first_touch": 40, "last_touch": 60, "linear": 50}
    ),
]

CHANNEL_ATTRIBUTION_DATA = [
    ChannelAttribution("whatsapp", 24_800_000, 520, 480_000, 5066.7, 35.5),
    ChannelAttribution("sms", 12_400_000, 380, 320_000, 3775.0, 17.7),
    ChannelAttribution("voice", 18_200_000, 210, 620_000, 2835.5, 26.0),
    ChannelAttribution("telegram", 8_900_000, 145, 180_000, 4844.4, 12.7),
    ChannelAttribution("email", 5_600_000, 92, 140_000, 3900.0, 8.0),
]

PRODUCT_ATTRIBUTION_DATA = [
    ProductAttribution("Savings Account", 354, 12_600_000, 35_600, 19.3),
    ProductAttribution("Business Loan", 68, 29_200_000, 429_410, 44.7),
    ProductAttribution("FX Account", 178, 9_760_000, 54_830, 14.9),
    ProductAttribution("Insurance", 92, 4_680_000, 50_870, 7.2),
    ProductAttribution("Fixed Deposit", 142, 8_520_000, 60_000, 13.0),
]


def calculate_attribution(touchpoints: list[TouchPoint], model: AttributionModel) -> dict[str, float]:
    """Calculate attribution weights for each touchpoint based on the model."""
    if not touchpoints:
        return {}

    n = len(touchpoints)
    weights: dict[str, float] = {}

    for tp in touchpoints:
        key = f"{tp.channel}:{tp.campaign_id}"
        if key not in weights:
            weights[key] = 0.0

    if model == AttributionModel.FIRST_TOUCH:
        first_key = f"{touchpoints[0].channel}:{touchpoints[0].campaign_id}"
        weights[first_key] = 1.0

    elif model == AttributionModel.LAST_TOUCH:
        last_key = f"{touchpoints[-1].channel}:{touchpoints[-1].campaign_id}"
        weights[last_key] = 1.0

    elif model == AttributionModel.LINEAR:
        equal_weight = 1.0 / n
        for tp in touchpoints:
            key = f"{tp.channel}:{tp.campaign_id}"
            weights[key] += equal_weight

    elif model == AttributionModel.TIME_DECAY:
        half_life = 7.0  # days
        total_weight = 0.0
        raw_weights = []
        reference_time = touchpoints[-1].timestamp
        for tp in touchpoints:
            days_before = (reference_time - tp.timestamp).total_seconds() / 86400
            weight = 2 ** (-days_before / half_life)
            raw_weights.append(weight)
            total_weight += weight
        for i, tp in enumerate(touchpoints):
            key = f"{tp.channel}:{tp.campaign_id}"
            weights[key] += raw_weights[i] / total_weight

    elif model == AttributionModel.POSITION_BASED:
        # 40% first, 40% last, 20% distributed among middle
        if n == 1:
            key = f"{touchpoints[0].channel}:{touchpoints[0].campaign_id}"
            weights[key] = 1.0
        elif n == 2:
            weights[f"{touchpoints[0].channel}:{touchpoints[0].campaign_id}"] = 0.5
            weights[f"{touchpoints[-1].channel}:{touchpoints[-1].campaign_id}"] += 0.5
        else:
            weights[f"{touchpoints[0].channel}:{touchpoints[0].campaign_id}"] = 0.4
            weights[f"{touchpoints[-1].channel}:{touchpoints[-1].campaign_id}"] += 0.4
            middle_weight = 0.2 / (n - 2)
            for tp in touchpoints[1:-1]:
                key = f"{tp.channel}:{tp.campaign_id}"
                weights[key] += middle_weight

    return weights


@router.get("/campaigns")
async def get_campaign_roi(model: AttributionModel = Query(default=AttributionModel.LAST_TOUCH)):
    """Get campaign ROI data with attribution."""
    total_revenue = sum(c.revenue for c in CAMPAIGN_ROI_DATA)
    total_spend = sum(c.spend for c in CAMPAIGN_ROI_DATA)
    total_conversions = sum(c.conversions for c in CAMPAIGN_ROI_DATA)

    return {
        "campaigns": [
            {
                "campaign_id": c.campaign_id,
                "name": c.name,
                "spend": c.spend,
                "revenue": c.revenue,
                "roi_pct": c.roi_pct,
                "conversions": c.conversions,
                "avg_conversion_value": c.avg_conversion_value,
                "channels": c.channels,
                "touchpoints": {
                    "first": c.first_touch_channel,
                    "last": c.last_touch_channel,
                },
                "time_to_convert": f"{c.avg_time_to_convert_days} days",
                "attribution_pct": c.attribution.get(model.value, 50),
            }
            for c in CAMPAIGN_ROI_DATA
        ],
        "summary": {
            "total_revenue": total_revenue,
            "total_spend": total_spend,
            "overall_roi_pct": round((total_revenue - total_spend) / total_spend * 100),
            "total_conversions": total_conversions,
            "avg_conversion_value": round(total_revenue / total_conversions),
        },
        "model": model.value,
    }


@router.get("/channels")
async def get_channel_attribution():
    """Get channel-level revenue attribution."""
    total_revenue = sum(c.revenue for c in CHANNEL_ATTRIBUTION_DATA)
    return {
        "channels": [
            {
                "channel": c.channel,
                "revenue": c.revenue,
                "conversions": c.conversions,
                "spend": c.spend,
                "roi_pct": c.roi_pct,
                "revenue_share": round(c.revenue / total_revenue * 100, 1),
            }
            for c in CHANNEL_ATTRIBUTION_DATA
        ],
        "total_revenue": total_revenue,
    }


@router.get("/products")
async def get_product_attribution():
    """Get product-level revenue attribution."""
    total_revenue = sum(p.revenue for p in PRODUCT_ATTRIBUTION_DATA)
    return {
        "products": [
            {
                "product": p.product,
                "conversions": p.conversions,
                "revenue": p.revenue,
                "avg_value": p.avg_value,
                "revenue_share": round(p.revenue / total_revenue * 100, 1),
            }
            for p in sorted(PRODUCT_ATTRIBUTION_DATA, key=lambda x: x.revenue, reverse=True)
        ],
        "total_revenue": total_revenue,
    }
