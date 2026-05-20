import { Kafka, Producer, Consumer, logLevel } from "kafkajs";

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092").split(
  ","
);
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || "pos54link-platform";

let kafka: Kafka | null = null;
let producer: Producer | null = null;

export function getKafka(): Kafka {
  if (!kafka) {
    kafka = new Kafka({
      clientId: KAFKA_CLIENT_ID,
      brokers: KAFKA_BROKERS,
      logLevel: logLevel.WARN,
      retry: { initialRetryTime: 300, retries: 5 },
    });
  }
  return kafka;
}

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = getKafka().producer({ idempotent: true });
    await producer.connect();
  }
  return producer;
}

export async function publishEvent(
  topic: string,
  key: string,
  value: unknown
): Promise<void> {
  const p = await getProducer();
  await p.send({
    topic,
    messages: [
      { key, value: JSON.stringify(value), timestamp: Date.now().toString() },
    ],
  });
}

export function createConsumer(groupId: string): Consumer {
  return getKafka().consumer({ groupId });
}

export async function kafkaHealthCheck(): Promise<{
  status: string;
  brokers: string[];
}> {
  try {
    const admin = getKafka().admin();
    await admin.connect();
    const cluster = await admin.describeCluster();
    await admin.disconnect();
    return {
      status: "healthy",
      brokers: cluster.brokers.map(b => `${b.host}:${b.port}`),
    };
  } catch {
    return { status: "unhealthy", brokers: [] };
  }
}

export async function closeKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
