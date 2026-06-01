FROM flink:1.19-python3

# Install PyFlink and dependencies
COPY requirements.txt /opt/flink/requirements.txt
RUN pip3 install --no-cache-dir -r /opt/flink/requirements.txt

# Download required JARs
RUN wget -q -P /opt/flink/lib/ \
    https://repo1.maven.org/maven2/org/apache/flink/flink-connector-kafka/3.2.0-1.19/flink-connector-kafka-3.2.0-1.19.jar \
    https://repo1.maven.org/maven2/org/apache/flink/flink-connector-jdbc/3.1.2-1.18/flink-connector-jdbc-3.1.2-1.18.jar \
    https://repo1.maven.org/maven2/org/postgresql/postgresql/42.7.3/postgresql-42.7.3.jar

# Copy job source
COPY src/ /opt/flink/jobs/

WORKDIR /opt/flink

ENV KAFKA_BROKERS=redpanda:9092
ENV KAFKA_TOPIC_IN=og-telemetry
ENV KAFKA_TOPIC_ALERTS=og-alarms
ENV WINDOW_SIZE_MINUTES=5
ENV PRESSURE_ALERT_PSI=4800
ENV TEMP_ALERT_C=185
ENV FLINK_PARALLELISM=4

CMD ["python3", "/opt/flink/jobs/og_flink_job.py"]
