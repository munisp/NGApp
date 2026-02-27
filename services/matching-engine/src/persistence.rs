//! Persistence layer for the NEXCOM matching engine.
//! Provides periodic state snapshots to disk (JSON) and optional Redis integration.
//! Ensures engine state survives restarts.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tracing::{error, info, warn};

/// Snapshot of critical engine state for persistence.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineSnapshot {
    pub timestamp: String,
    pub version: String,
    pub node_id: String,
    pub audit_sequence: u64,
    pub clearing_members: usize,
    pub active_futures: usize,
    pub active_options: usize,
    pub warehouse_count: usize,
    pub surveillance_alerts: usize,
}

/// Manages state persistence to disk and optionally Redis.
pub struct PersistenceManager {
    data_dir: PathBuf,
    redis_url: Option<String>,
    running: Arc<AtomicBool>,
}

impl PersistenceManager {
    /// Create a new persistence manager.
    pub fn new(data_dir: &str, redis_url: Option<String>) -> Self {
        let path = PathBuf::from(data_dir);
        if !path.exists() {
            fs::create_dir_all(&path).unwrap_or_else(|e| {
                warn!("Could not create data dir {}: {}", data_dir, e);
            });
        }

        Self {
            data_dir: path,
            redis_url,
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Save an engine snapshot to disk as JSON.
    pub fn save_snapshot(&self, snapshot: &EngineSnapshot) -> Result<(), String> {
        let filename = format!("snapshot-{}.json", snapshot.timestamp.replace(':', "-"));
        let path = self.data_dir.join(&filename);
        let latest_path = self.data_dir.join("latest-snapshot.json");

        let json = serde_json::to_string_pretty(snapshot)
            .map_err(|e| format!("Failed to serialize snapshot: {}", e))?;

        fs::write(&path, &json)
            .map_err(|e| format!("Failed to write snapshot to {:?}: {}", path, e))?;

        // Also write as latest
        fs::write(&latest_path, &json)
            .map_err(|e| format!("Failed to write latest snapshot: {}", e))?;

        info!("Saved engine snapshot to {:?}", path);

        // If Redis URL is configured, also push to Redis
        if let Some(ref url) = self.redis_url {
            self.save_to_redis(url, snapshot);
        }

        Ok(())
    }

    /// Load the latest snapshot from disk.
    pub fn load_latest_snapshot(&self) -> Option<EngineSnapshot> {
        let latest_path = self.data_dir.join("latest-snapshot.json");
        if !latest_path.exists() {
            info!("No previous snapshot found at {:?}", latest_path);
            return None;
        }

        match fs::read_to_string(&latest_path) {
            Ok(json) => match serde_json::from_str::<EngineSnapshot>(&json) {
                Ok(snapshot) => {
                    info!(
                        "Loaded snapshot from {:?} (timestamp={})",
                        latest_path, snapshot.timestamp
                    );
                    Some(snapshot)
                }
                Err(e) => {
                    error!("Failed to parse snapshot: {}", e);
                    None
                }
            },
            Err(e) => {
                error!("Failed to read snapshot file: {}", e);
                None
            }
        }
    }

    /// List all available snapshots.
    pub fn list_snapshots(&self) -> Vec<String> {
        let mut snapshots = Vec::new();
        if let Ok(entries) = fs::read_dir(&self.data_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with("snapshot-") && name.ends_with(".json") {
                    snapshots.push(name);
                }
            }
        }
        snapshots.sort();
        snapshots
    }

    /// Clean up old snapshots, keeping only the N most recent.
    pub fn cleanup_old_snapshots(&self, keep: usize) {
        let mut snapshots = self.list_snapshots();
        if snapshots.len() <= keep {
            return;
        }
        snapshots.sort();
        let to_remove = snapshots.len() - keep;
        for name in snapshots.iter().take(to_remove) {
            let path = self.data_dir.join(name);
            if let Err(e) = fs::remove_file(&path) {
                warn!("Failed to remove old snapshot {:?}: {}", path, e);
            } else {
                info!("Removed old snapshot: {}", name);
            }
        }
    }

    /// Check if the persistence manager is running periodic snapshots.
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }

    /// Stop periodic snapshots.
    pub fn stop(&self) {
        self.running.store(false, Ordering::Relaxed);
    }

    /// Save snapshot to Redis (best-effort, logs errors).
    fn save_to_redis(&self, url: &str, snapshot: &EngineSnapshot) {
        let json = match serde_json::to_string(snapshot) {
            Ok(j) => j,
            Err(e) => {
                warn!("Failed to serialize for Redis: {}", e);
                return;
            }
        };

        // Use a simple TCP connection to SET the key (minimal Redis protocol)
        // In production, use the redis crate. Here we keep it zero-dependency.
        let addr = url
            .strip_prefix("redis://")
            .unwrap_or(url)
            .trim_end_matches('/');

        match std::net::TcpStream::connect_timeout(
            &addr.parse().unwrap_or_else(|_| "127.0.0.1:6379".parse().unwrap()),
            std::time::Duration::from_secs(2),
        ) {
            Ok(mut stream) => {
                use std::io::Write;
                let cmd = format!(
                    "*3\r\n$3\r\nSET\r\n$24\r\nnexcom:engine:snapshot\r\n${}\r\n{}\r\n",
                    json.len(),
                    json
                );
                if let Err(e) = stream.write_all(cmd.as_bytes()) {
                    warn!("Failed to write to Redis at {}: {}", addr, e);
                } else {
                    info!("Saved snapshot to Redis at {}", addr);
                }
            }
            Err(e) => {
                warn!("Could not connect to Redis at {}: {} (snapshot saved to disk only)", addr, e);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn test_snapshot() -> EngineSnapshot {
        EngineSnapshot {
            timestamp: "2026-02-27T06-00-00Z".to_string(),
            version: "0.1.0".to_string(),
            node_id: "test-node".to_string(),
            audit_sequence: 42,
            clearing_members: 3,
            active_futures: 86,
            active_options: 12,
            warehouse_count: 9,
            surveillance_alerts: 0,
        }
    }

    #[test]
    fn test_save_and_load_snapshot() {
        let dir = env::temp_dir().join("nexcom-test-persistence");
        let _ = fs::remove_dir_all(&dir);
        let mgr = PersistenceManager::new(dir.to_str().unwrap(), None);

        let snapshot = test_snapshot();
        mgr.save_snapshot(&snapshot).unwrap();

        let loaded = mgr.load_latest_snapshot().unwrap();
        assert_eq!(loaded.node_id, "test-node");
        assert_eq!(loaded.audit_sequence, 42);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_list_and_cleanup_snapshots() {
        let dir = env::temp_dir().join("nexcom-test-cleanup");
        let _ = fs::remove_dir_all(&dir);
        let mgr = PersistenceManager::new(dir.to_str().unwrap(), None);

        for i in 0..5 {
            let mut s = test_snapshot();
            s.timestamp = format!("2026-02-27T0{}-00-00Z", i);
            mgr.save_snapshot(&s).unwrap();
        }

        assert_eq!(mgr.list_snapshots().len(), 5);
        mgr.cleanup_old_snapshots(2);
        assert_eq!(mgr.list_snapshots().len(), 2);

        let _ = fs::remove_dir_all(&dir);
    }
}
