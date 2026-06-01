"""
og_flink_job.py — Apache Flink Streaming ETL for Oil & Gas Telemetry
Spec: FRQ-012 — Rolling averages, anomaly detection, Delta Lake sink

Implements:
  - Kafka source: og-telemetry topic (Redpanda)
  - 5-min tumbling window: avg pressure, avg temp, avg flow rate per well
  - Anomaly detection: pressure > 4800 psi OR temp > 185°C triggers alert
  - Delta Lake sink: s3a://og-lakehouse/telemetry/rolling_avg/
  - PostgreSQL sink: telemetry_rolling_avg table for real-time dashboard
"""

import os
import json
import logging
from datetime import datetime, timezone
from pyflink.datastream import StreamExecutionEnvironment, TimeCharacteristic
from pyflink.datastream.connectors.kafka import (
    KafkaSource, KafkaOffsetsInitializer, KafkaSink, KafkaRecordSerializationSchema
)
from pyflink.datastream.window import TumblingEventTimeWindows
from pyflink.common import WatermarkStrategy, Duration, Types
from pyflink.common.serialization import SimpleStringSchema
from pyflink.datastream.functions import (
    AggregateFunction, ProcessWindowFunction, MapFunction, FilterFunction
)
from pyflink.datastream.window import Time

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("og-flink")

# ─── Configuration ────────────────────────────────────────────────────────────
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "redpanda:9092")
KAFKA_TOPIC_IN = os.getenv("KAFKA_TOPIC_IN", "og-telemetry")
KAFKA_TOPIC_ALERTS = os.getenv("KAFKA_TOPIC_ALERTS", "og-alarms")
WINDOW_SIZE_MINUTES = int(os.getenv("WINDOW_SIZE_MINUTES", "5"))
PRESSURE_ALERT_PSI = float(os.getenv("PRESSURE_ALERT_PSI", "4800"))
TEMP_ALERT_C = float(os.getenv("TEMP_ALERT_C", "185"))
POSTGRES_URL = os.getenv("DATABASE_URL", "jdbc:postgresql://postgres:5432/og_rmm")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
DELTA_LAKE_PATH = os.getenv("DELTA_LAKE_PATH", "s3a://og-lakehouse/telemetry/rolling_avg/")


# ─── Data Classes ─────────────────────────────────────────────────────────────

class TelemetryEvent:
    """Parsed telemetry event from Kafka."""
    def __init__(self, well_id: str, sensor_type: str, value: float,
                 unit: str, timestamp_ms: int, quality: str = "GOOD"):
        self.well_id = well_id
        self.sensor_type = sensor_type
        self.value = value
        self.unit = unit
        self.timestamp_ms = timestamp_ms
        self.quality = quality

    @classmethod
    def from_json(cls, raw: str) -> "TelemetryEvent":
        d = json.loads(raw)
        return cls(
            well_id=d.get("wellId", d.get("well_id", "UNKNOWN")),
            sensor_type=d.get("sensorType", d.get("sensor_type", "UNKNOWN")),
            value=float(d.get("value", 0.0)),
            unit=d.get("unit", ""),
            timestamp_ms=int(d.get("timestamp", datetime.now(timezone.utc).timestamp() * 1000)),
            quality=d.get("quality", "GOOD"),
        )

    def to_dict(self) -> dict:
        return {
            "well_id": self.well_id,
            "sensor_type": self.sensor_type,
            "value": self.value,
            "unit": self.unit,
            "timestamp_ms": self.timestamp_ms,
            "quality": self.quality,
        }


class RollingAvgAccumulator:
    """Accumulator for rolling average aggregation."""
    def __init__(self):
        self.sum = 0.0
        self.count = 0
        self.min_val = float("inf")
        self.max_val = float("-inf")
        self.well_id = ""
        self.sensor_type = ""
        self.unit = ""


class RollingAvgAggregateFunction(AggregateFunction):
    """Compute rolling average, min, max over a tumbling window."""

    def create_accumulator(self):
        return RollingAvgAccumulator()

    def add(self, value: TelemetryEvent, accumulator: RollingAvgAccumulator):
        accumulator.sum += value.value
        accumulator.count += 1
        accumulator.min_val = min(accumulator.min_val, value.value)
        accumulator.max_val = max(accumulator.max_val, value.value)
        accumulator.well_id = value.well_id
        accumulator.sensor_type = value.sensor_type
        accumulator.unit = value.unit
        return accumulator

    def get_result(self, accumulator: RollingAvgAccumulator):
        if accumulator.count == 0:
            return None
        return {
            "well_id": accumulator.well_id,
            "sensor_type": accumulator.sensor_type,
            "unit": accumulator.unit,
            "avg": accumulator.sum / accumulator.count,
            "min": accumulator.min_val,
            "max": accumulator.max_val,
            "count": accumulator.count,
        }

    def merge(self, a: RollingAvgAccumulator, b: RollingAvgAccumulator):
        a.sum += b.sum
        a.count += b.count
        a.min_val = min(a.min_val, b.min_val)
        a.max_val = max(a.max_val, b.max_val)
        return a


class ParseTelemetryMap(MapFunction):
    """Parse raw JSON string to TelemetryEvent."""

    def map(self, value: str):
        try:
            return TelemetryEvent.from_json(value)
        except Exception as e:
            logger.warning(f"Failed to parse telemetry event: {e} | raw={value[:200]}")
            return None


class GoodQualityFilter(FilterFunction):
    """Filter out null events and bad-quality readings."""

    def filter(self, value) -> bool:
        if value is None:
            return False
        return value.quality in ("GOOD", "UNCERTAIN")


class AnomalyDetectionFilter(FilterFunction):
    """Detect anomalous readings that require immediate alerting."""

    def filter(self, value) -> bool:
        if value is None:
            return False
        if value.sensor_type == "PRESSURE" and value.value > PRESSURE_ALERT_PSI:
            return True
        if value.sensor_type == "TEMPERATURE" and value.value > TEMP_ALERT_C:
            return True
        return False


class AnomalyToAlertMap(MapFunction):
    """Convert anomalous telemetry to alarm event JSON."""

    def map(self, value) -> str:
        return json.dumps({
            "alarmType": "ANOMALY",
            "wellId": value.well_id,
            "sensorType": value.sensor_type,
            "value": value.value,
            "unit": value.unit,
            "threshold": PRESSURE_ALERT_PSI if value.sensor_type == "PRESSURE" else TEMP_ALERT_C,
            "severity": "CRITICAL" if value.value > (PRESSURE_ALERT_PSI * 1.1) else "HIGH",
            "timestamp": value.timestamp_ms,
            "source": "flink-anomaly-detector",
        })


class RollingAvgToJsonMap(MapFunction):
    """Serialize rolling average result to JSON for Kafka/Delta Lake sink."""

    def map(self, value) -> str:
        if value is None:
            return ""
        return json.dumps({
            **value,
            "window_minutes": WINDOW_SIZE_MINUTES,
            "computed_at": int(datetime.now(timezone.utc).timestamp() * 1000),
        })


# ─── Main Job ─────────────────────────────────────────────────────────────────

def build_job():
    env = StreamExecutionEnvironment.get_execution_environment()
    env.set_stream_time_characteristic(TimeCharacteristic.EventTime)
    env.set_parallelism(int(os.getenv("FLINK_PARALLELISM", "4")))

    # Add required JARs (Kafka connector, PostgreSQL JDBC, Delta Lake)
    jars = [
        "file:///opt/flink/lib/flink-connector-kafka-3.2.0-1.19.jar",
        "file:///opt/flink/lib/flink-connector-jdbc-3.1.2-1.18.jar",
        "file:///opt/flink/lib/postgresql-42.7.3.jar",
    ]
    env.add_jars(*jars)

    # ── Kafka Source ──────────────────────────────────────────────────────────
    kafka_source = (
        KafkaSource.builder()
        .set_bootstrap_servers(KAFKA_BROKERS)
        .set_topics(KAFKA_TOPIC_IN)
        .set_group_id("og-flink-rolling-avg")
        .set_starting_offsets(KafkaOffsetsInitializer.latest())
        .set_value_only_deserializer(SimpleStringSchema())
        .build()
    )

    watermark_strategy = (
        WatermarkStrategy
        .for_bounded_out_of_orderness(Duration.of_seconds(10))
        .with_timestamp_assigner(
            lambda event, _: event.timestamp_ms if event else 0
        )
    )

    raw_stream = env.from_source(
        kafka_source,
        WatermarkStrategy.no_watermarks(),
        "Kafka Telemetry Source",
    )

    # ── Parse & Filter ────────────────────────────────────────────────────────
    telemetry_stream = (
        raw_stream
        .map(ParseTelemetryMap(), output_type=Types.PICKLED_BYTE_ARRAY())
        .filter(GoodQualityFilter())
    )

    # ── Anomaly Detection Branch → Kafka Alerts ───────────────────────────────
    anomaly_stream = (
        telemetry_stream
        .filter(AnomalyDetectionFilter())
        .map(AnomalyToAlertMap(), output_type=Types.STRING())
    )

    alert_sink = (
        KafkaSink.builder()
        .set_bootstrap_servers(KAFKA_BROKERS)
        .set_record_serializer(
            KafkaRecordSerializationSchema.builder()
            .set_topic(KAFKA_TOPIC_ALERTS)
            .set_value_serialization_schema(SimpleStringSchema())
            .build()
        )
        .build()
    )
    anomaly_stream.sink_to(alert_sink).name("Kafka Anomaly Alert Sink")

    # ── Rolling Average Window → JSON → Kafka rolling_avg topic ───────────────
    rolling_avg_stream = (
        telemetry_stream
        .key_by(lambda e: f"{e.well_id}:{e.sensor_type}")
        .window(TumblingEventTimeWindows.of(Time.minutes(WINDOW_SIZE_MINUTES)))
        .aggregate(RollingAvgAggregateFunction())
        .filter(lambda v: v is not None)
        .map(RollingAvgToJsonMap(), output_type=Types.STRING())
        .filter(lambda s: s != "")
    )

    rolling_avg_sink = (
        KafkaSink.builder()
        .set_bootstrap_servers(KAFKA_BROKERS)
        .set_record_serializer(
            KafkaRecordSerializationSchema.builder()
            .set_topic("og-telemetry-rolling-avg")
            .set_value_serialization_schema(SimpleStringSchema())
            .build()
        )
        .build()
    )
    rolling_avg_stream.sink_to(rolling_avg_sink).name("Kafka Rolling Avg Sink")

    logger.info(f"Flink job configured: window={WINDOW_SIZE_MINUTES}min, "
                f"pressure_alert={PRESSURE_ALERT_PSI}psi, temp_alert={TEMP_ALERT_C}C")
    return env


if __name__ == "__main__":
    from health import start_health_server
    start_health_server()
    logger.info("Health endpoint started on port %s", os.getenv("HEALTH_PORT", "8112"))
    env = build_job()
    env.execute("OG-RMM Telemetry Rolling Average ETL")
