import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomIntBetween, randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

/**
 * WebSocket Resilience Test
 * Validates behavior under degraded network conditions:
 * - Connection drops and reconnection
 * - Message delivery under high latency
 * - Offline queue flushing
 * - Bandwidth throttling simulation
 */

const wsConnectLatency = new Trend('ws_connect_latency_ms', true);
const wsMessageLatency = new Trend('ws_message_latency_ms', true);
const wsReconnections = new Counter('ws_reconnections');
const wsMessageLoss = new Rate('ws_message_loss_rate');
const wsQueueDepth = new Trend('ws_queue_depth');

const WS_URL = __ENV.WS_URL || 'ws://localhost:5000/ws';

export const options = {
  scenarios: {
    // Normal conditions — baseline
    normal: {
      executor: 'constant-vus',
      vus: 50,
      duration: '1m',
      exec: 'normalConnection',
    },
    // High latency simulation (rural Africa)
    high_latency: {
      executor: 'constant-vus',
      vus: 30,
      duration: '1m',
      startTime: '1m30s',
      exec: 'highLatencyConnection',
    },
    // Intermittent connectivity
    intermittent: {
      executor: 'constant-vus',
      vus: 20,
      duration: '2m',
      startTime: '3m',
      exec: 'intermittentConnection',
    },
    // Mass reconnection storm (e.g., network restoration)
    reconnection_storm: {
      executor: 'shared-iterations',
      vus: 200,
      iterations: 200,
      startTime: '5m30s',
      maxDuration: '30s',
      exec: 'reconnectionStorm',
    },
  },
  thresholds: {
    'ws_connect_latency_ms': ['p(50)<100', 'p(95)<500'],
    'ws_message_latency_ms': ['p(50)<50', 'p(95)<200'],
    'ws_message_loss_rate': ['rate<0.01'], // Less than 1% message loss
    'ws_reconnections': ['count<1000'],
  },
};

export function normalConnection() {
  const start = Date.now();
  const url = `${WS_URL}?client_id=normal-${randomString(8)}&bandwidth=high`;

  const res = ws.connect(url, {}, function (socket) {
    wsConnectLatency.add(Date.now() - start);

    let messagesReceived = 0;
    let messagesSent = 0;

    socket.on('open', () => {
      // Subscribe to transaction updates
      socket.send(JSON.stringify({
        type: 'subscribe',
        channels: ['transactions', 'settlements', 'alerts'],
        client_id: `normal-${randomString(8)}`,
      }));
    });

    socket.on('message', (msg) => {
      messagesReceived++;
      try {
        const data = JSON.parse(msg);
        if (data.type === 'pong') {
          wsMessageLatency.add(Date.now() - data.timestamp);
        }
      } catch (e) { /* binary message */ }
    });

    // Send periodic pings to measure latency
    socket.setInterval(() => {
      messagesSent++;
      socket.send(JSON.stringify({
        type: 'ping',
        timestamp: Date.now(),
        seq: messagesSent,
      }));
    }, 100); // Every 100ms

    // Run for 10 seconds
    socket.setTimeout(() => {
      wsMessageLoss.add(messagesReceived < messagesSent * 0.9 ? 1 : 0);
      socket.close();
    }, 10000);
  });

  check(res, { 'ws connected': (r) => r && r.status === 101 });
}

export function highLatencyConnection() {
  // Simulate high-latency connection (200-500ms RTT typical for rural Africa)
  const start = Date.now();
  const url = `${WS_URL}?client_id=slow-${randomString(8)}&simulate_latency=300`;

  const res = ws.connect(url, {}, function (socket) {
    wsConnectLatency.add(Date.now() - start);

    let queuedMessages = 0;

    socket.on('open', () => {
      socket.send(JSON.stringify({
        type: 'subscribe',
        channels: ['transactions'],
        bandwidth_mode: 'low',
      }));
    });

    socket.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        if (data.queue_depth !== undefined) {
          wsQueueDepth.add(data.queue_depth);
        }
      } catch (e) { /* ignore */ }
    });

    // Simulate slow sending (batch messages)
    socket.setInterval(() => {
      queuedMessages++;
      if (queuedMessages >= 5) {
        // Flush batch
        socket.send(JSON.stringify({
          type: 'batch',
          messages: Array.from({ length: queuedMessages }, (_, i) => ({
            type: 'ack',
            seq: i,
            timestamp: Date.now(),
          })),
        }));
        queuedMessages = 0;
      }
    }, 500); // Slow interval for low bandwidth

    socket.setTimeout(() => { socket.close(); }, 15000);
  });

  check(res, { 'slow ws connected': (r) => r && r.status === 101 });
  sleep(1);
}

export function intermittentConnection() {
  // Simulate connection that drops every 2-5 seconds
  let reconnectCount = 0;

  for (let attempt = 0; attempt < 5; attempt++) {
    const start = Date.now();
    const url = `${WS_URL}?client_id=intermittent-${randomString(8)}&reconnect=${reconnectCount}`;

    const res = ws.connect(url, {}, function (socket) {
      wsConnectLatency.add(Date.now() - start);

      if (reconnectCount > 0) {
        wsReconnections.add(1);
        // Send queued messages from "offline" period
        socket.send(JSON.stringify({
          type: 'flush_queue',
          queued_since: Date.now() - randomIntBetween(2000, 5000),
          messages: randomIntBetween(3, 20),
        }));
      }

      socket.on('message', (msg) => {
        try {
          const data = JSON.parse(msg);
          if (data.type === 'queue_flush_ack') {
            check(data, {
              'queue flushed successfully': (d) => d.status === 'ok',
              'no messages lost': (d) => d.lost === 0,
            });
          }
        } catch (e) { /* ignore */ }
      });

      // Disconnect after random interval (simulating network drop)
      const disconnectAfter = randomIntBetween(2000, 5000);
      socket.setTimeout(() => { socket.close(); }, disconnectAfter);
    });

    reconnectCount++;
    // Simulate offline period
    sleep(randomIntBetween(1, 3));
  }
}

export function reconnectionStorm() {
  // All 200 VUs connect simultaneously (simulates network restoration)
  const start = Date.now();
  const url = `${WS_URL}?client_id=storm-${randomString(8)}&storm=true`;

  const res = ws.connect(url, {}, function (socket) {
    wsConnectLatency.add(Date.now() - start);
    wsReconnections.add(1);

    socket.on('open', () => {
      // Immediately request state sync
      socket.send(JSON.stringify({
        type: 'state_sync',
        last_seen_seq: randomIntBetween(1000, 50000),
        client_id: `storm-${randomString(8)}`,
      }));
    });

    socket.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        check(data, {
          'state sync response': (d) => d.type === 'state_sync_response' || d.type === 'pong',
        });
      } catch (e) { /* ignore */ }
    });

    socket.setTimeout(() => { socket.close(); }, 5000);
  });

  check(res, {
    'storm connection accepted': (r) => r && r.status === 101,
    'connect latency < 1s': () => (Date.now() - start) < 1000,
  });
}
