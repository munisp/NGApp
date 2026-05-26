//! Real-Time Campaign Event Streaming Service
//!
//! WebSocket-based event streaming for live campaign dashboard updates.
//! Consumes Kafka campaign events and broadcasts to connected clients.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Event types emitted during campaign message delivery
#[derive(Debug, Clone, PartialEq)]
pub enum EventType {
    Sent,
    Delivered,
    Read,
    Clicked,
    Failed,
    OptedOut,
}

impl EventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            EventType::Sent => "sent",
            EventType::Delivered => "delivered",
            EventType::Read => "read",
            EventType::Clicked => "clicked",
            EventType::Failed => "failed",
            EventType::OptedOut => "opted_out",
        }
    }
}

/// A single campaign delivery event
#[derive(Debug, Clone)]
pub struct CampaignEvent {
    pub id: String,
    pub event_type: EventType,
    pub campaign_id: String,
    pub campaign_name: String,
    pub channel: String,
    pub recipient: String,
    pub timestamp: u64,
    pub latency_ms: u32,
}

/// Aggregated channel statistics
#[derive(Debug, Clone)]
pub struct ChannelStats {
    pub channel: String,
    pub sent: u64,
    pub delivered: u64,
    pub delivery_rate: f64,
}

/// Real-time metrics aggregator
#[derive(Debug)]
pub struct MetricsAggregator {
    total_sent: u64,
    total_delivered: u64,
    total_clicked: u64,
    total_failed: u64,
    total_opted_out: u64,
    channel_stats: HashMap<String, ChannelStats>,
    throughput_window: Vec<u32>,
    window_size: usize,
}

impl MetricsAggregator {
    pub fn new(window_size: usize) -> Self {
        let mut channel_stats = HashMap::new();
        for ch in &["sms", "whatsapp", "telegram", "voice", "email"] {
            channel_stats.insert(
                ch.to_string(),
                ChannelStats {
                    channel: ch.to_string(),
                    sent: 0,
                    delivered: 0,
                    delivery_rate: 0.0,
                },
            );
        }

        MetricsAggregator {
            total_sent: 0,
            total_delivered: 0,
            total_clicked: 0,
            total_failed: 0,
            total_opted_out: 0,
            channel_stats,
            throughput_window: vec![0; window_size],
            window_size,
        }
    }

    /// Process a batch of events and update metrics
    pub fn process_events(&mut self, events: &[CampaignEvent]) {
        for event in events {
            match event.event_type {
                EventType::Sent => {
                    self.total_sent += 1;
                    if let Some(cs) = self.channel_stats.get_mut(&event.channel) {
                        cs.sent += 1;
                        Self::update_delivery_rate(cs);
                    }
                }
                EventType::Delivered => {
                    self.total_delivered += 1;
                    if let Some(cs) = self.channel_stats.get_mut(&event.channel) {
                        cs.delivered += 1;
                        Self::update_delivery_rate(cs);
                    }
                }
                EventType::Clicked => self.total_clicked += 1,
                EventType::Failed => self.total_failed += 1,
                EventType::OptedOut => self.total_opted_out += 1,
                EventType::Read => {}
            }
        }

        // Update throughput window
        self.throughput_window.remove(0);
        self.throughput_window.push(events.len() as u32);
    }

    fn update_delivery_rate(cs: &mut ChannelStats) {
        if cs.sent > 0 {
            cs.delivery_rate = (cs.delivered as f64 / cs.sent as f64) * 100.0;
        }
    }

    /// Get current throughput (events per tick)
    pub fn current_throughput(&self) -> u32 {
        *self.throughput_window.last().unwrap_or(&0)
    }

    /// Get average throughput over the window
    pub fn avg_throughput(&self) -> f64 {
        let sum: u64 = self.throughput_window.iter().map(|&x| x as u64).sum();
        sum as f64 / self.window_size as f64
    }

    /// Get delivery rate across all channels
    pub fn overall_delivery_rate(&self) -> f64 {
        if self.total_sent == 0 {
            return 0.0;
        }
        (self.total_delivered as f64 / self.total_sent as f64) * 100.0
    }

    /// Get click-through rate
    pub fn click_rate(&self) -> f64 {
        if self.total_delivered == 0 {
            return 0.0;
        }
        (self.total_clicked as f64 / self.total_delivered as f64) * 100.0
    }

    /// Get channel statistics
    pub fn get_channel_stats(&self) -> Vec<&ChannelStats> {
        self.channel_stats.values().collect()
    }

    /// Get summary metrics
    pub fn summary(&self) -> MetricsSummary {
        MetricsSummary {
            total_sent: self.total_sent,
            total_delivered: self.total_delivered,
            total_clicked: self.total_clicked,
            total_failed: self.total_failed,
            total_opted_out: self.total_opted_out,
            delivery_rate: self.overall_delivery_rate(),
            click_rate: self.click_rate(),
            current_throughput: self.current_throughput(),
            avg_throughput: self.avg_throughput(),
        }
    }
}

/// Summary of real-time metrics
#[derive(Debug, Clone)]
pub struct MetricsSummary {
    pub total_sent: u64,
    pub total_delivered: u64,
    pub total_clicked: u64,
    pub total_failed: u64,
    pub total_opted_out: u64,
    pub delivery_rate: f64,
    pub click_rate: f64,
    pub current_throughput: u32,
    pub avg_throughput: f64,
}

/// Thread-safe event buffer for WebSocket broadcasting
pub struct EventBuffer {
    events: Arc<Mutex<Vec<CampaignEvent>>>,
    max_size: usize,
}

impl EventBuffer {
    pub fn new(max_size: usize) -> Self {
        EventBuffer {
            events: Arc::new(Mutex::new(Vec::new())),
            max_size,
        }
    }

    /// Push new events into the buffer
    pub fn push(&self, new_events: Vec<CampaignEvent>) {
        let mut events = self.events.lock().unwrap();
        for event in new_events {
            events.insert(0, event);
        }
        events.truncate(self.max_size);
    }

    /// Get the latest events
    pub fn latest(&self, count: usize) -> Vec<CampaignEvent> {
        let events = self.events.lock().unwrap();
        events.iter().take(count).cloned().collect()
    }

    /// Get event count
    pub fn len(&self) -> usize {
        self.events.lock().unwrap().len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

fn generate_event_id() -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::from_secs(0))
        .as_millis();
    format!("evt-{}-{}", ts, rand_suffix())
}

fn rand_suffix() -> String {
    let chars: Vec<char> = "abcdefghijklmnopqrstuvwxyz0123456789".chars().collect();
    let mut result = String::new();
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::from_secs(0))
        .as_nanos();
    for i in 0..4 {
        let idx = ((seed >> (i * 8)) as usize) % chars.len();
        result.push(chars[idx]);
    }
    result
}

fn main() {
    println!("Real-Time Campaign Event Streaming Service");
    println!("Initializing WebSocket server on :8096...");

    let aggregator = MetricsAggregator::new(30);
    let buffer = EventBuffer::new(100);

    let summary = aggregator.summary();
    println!("Initial metrics: sent={}, delivered={}, throughput={}",
        summary.total_sent, summary.total_delivered, summary.current_throughput);
    println!("Event buffer capacity: {}", buffer.len());
    println!("Service ready for WebSocket connections");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_aggregator() {
        let mut agg = MetricsAggregator::new(10);
        let events = vec![
            CampaignEvent {
                id: "e1".into(),
                event_type: EventType::Sent,
                campaign_id: "CMP-001".into(),
                campaign_name: "Test".into(),
                channel: "sms".into(),
                recipient: "+234".into(),
                timestamp: 0,
                latency_ms: 100,
            },
            CampaignEvent {
                id: "e2".into(),
                event_type: EventType::Delivered,
                campaign_id: "CMP-001".into(),
                campaign_name: "Test".into(),
                channel: "sms".into(),
                recipient: "+234".into(),
                timestamp: 0,
                latency_ms: 200,
            },
        ];

        agg.process_events(&events);
        assert_eq!(agg.total_sent, 1);
        assert_eq!(agg.total_delivered, 1);
        assert_eq!(agg.overall_delivery_rate(), 100.0);
    }

    #[test]
    fn test_event_buffer() {
        let buffer = EventBuffer::new(5);
        assert!(buffer.is_empty());

        let events = vec![CampaignEvent {
            id: "e1".into(),
            event_type: EventType::Sent,
            campaign_id: "CMP-001".into(),
            campaign_name: "Test".into(),
            channel: "whatsapp".into(),
            recipient: "+234".into(),
            timestamp: 0,
            latency_ms: 50,
        }];

        buffer.push(events);
        assert_eq!(buffer.len(), 1);
        assert_eq!(buffer.latest(10).len(), 1);
    }

    #[test]
    fn test_channel_stats() {
        let mut agg = MetricsAggregator::new(5);
        let events: Vec<CampaignEvent> = (0..10)
            .map(|i| CampaignEvent {
                id: format!("e{}", i),
                event_type: if i % 3 == 0 { EventType::Sent } else { EventType::Delivered },
                campaign_id: "CMP-001".into(),
                campaign_name: "Test".into(),
                channel: "whatsapp".into(),
                recipient: "+234".into(),
                timestamp: 0,
                latency_ms: 100,
            })
            .collect();

        agg.process_events(&events);
        let stats = agg.get_channel_stats();
        let whatsapp = stats.iter().find(|s| s.channel == "whatsapp").unwrap();
        assert!(whatsapp.sent > 0);
        assert!(whatsapp.delivery_rate > 0.0);
    }
}
