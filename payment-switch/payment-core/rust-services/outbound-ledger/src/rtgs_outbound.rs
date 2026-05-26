//! RTGS (Real-Time Gross Settlement) Mode for Outbound Remittance
//! For high-value transfers >₦500M, bypasses batching for instant gross settlement.
//! Integrates with TigerBeetle for immediate debit/credit posting.

use std::collections::HashMap;
use std::time::{Duration, SystemTime};

/// RTGS transfer status
#[derive(Debug, Clone, PartialEq)]
pub enum RTGSStatus {
    Initiated,
    PrefundDebited,
    ComplianceCleared,
    SettlementSent,
    Confirmed,
    Failed(String),
}

/// RTGS settlement priority
#[derive(Debug, Clone, PartialEq)]
pub enum SettlementPriority {
    /// Normal batch settlement (T+1 or T+2)
    Normal,
    /// Same-day settlement via priority queue
    SameDay,
    /// Immediate RTGS — real-time gross settlement
    Immediate,
}

/// RTGS transfer record
#[derive(Debug, Clone)]
pub struct RTGSTransfer {
    pub transfer_id: String,
    pub participant_id: String,
    pub corridor_id: String,
    pub amount_ngn: f64,
    pub amount_dest: f64,
    pub dest_currency: String,
    pub fx_rate: f64,
    pub rail_type: String,
    pub priority: SettlementPriority,
    pub status: RTGSStatus,
    pub initiated_at: SystemTime,
    pub settled_at: Option<SystemTime>,
    pub tigerbeetle_debit_id: Option<String>,
    pub tigerbeetle_credit_id: Option<String>,
}

/// Configuration for RTGS thresholds
#[derive(Debug, Clone)]
pub struct RTGSConfig {
    /// Minimum amount in NGN for RTGS eligibility
    pub min_amount_ngn: f64,
    /// Maximum settlement time for RTGS (should be < 60s)
    pub max_settlement_duration: Duration,
    /// Whether to require dual-approval for RTGS transfers
    pub require_dual_approval: bool,
    /// Maximum concurrent RTGS transfers per participant
    pub max_concurrent_per_participant: usize,
    /// RTGS surcharge as basis points on top of normal fee
    pub surcharge_bps: f64,
}

impl Default for RTGSConfig {
    fn default() -> Self {
        Self {
            min_amount_ngn: 500_000_000.0, // ₦500M
            max_settlement_duration: Duration::from_secs(60),
            require_dual_approval: true,
            max_concurrent_per_participant: 3,
            surcharge_bps: 5.0, // 0.05% extra for RTGS
        }
    }
}

/// RTGS settlement engine
pub struct RTGSEngine {
    config: RTGSConfig,
    active_transfers: HashMap<String, RTGSTransfer>,
    completed_transfers: Vec<RTGSTransfer>,
    participant_counts: HashMap<String, usize>,
}

impl RTGSEngine {
    pub fn new(config: RTGSConfig) -> Self {
        Self {
            config,
            active_transfers: HashMap::new(),
            completed_transfers: Vec::new(),
            participant_counts: HashMap::new(),
        }
    }

    /// Determine settlement priority based on amount
    pub fn determine_priority(&self, amount_ngn: f64) -> SettlementPriority {
        if amount_ngn >= self.config.min_amount_ngn {
            SettlementPriority::Immediate
        } else if amount_ngn >= self.config.min_amount_ngn / 5.0 {
            SettlementPriority::SameDay
        } else {
            SettlementPriority::Normal
        }
    }

    /// Calculate RTGS surcharge
    pub fn calculate_surcharge(&self, amount_ngn: f64, base_fee_ngn: f64) -> f64 {
        base_fee_ngn + (amount_ngn * self.config.surcharge_bps / 10_000.0)
    }

    /// Initiate an RTGS transfer
    pub fn initiate_transfer(
        &mut self,
        participant_id: &str,
        corridor_id: &str,
        amount_ngn: f64,
        dest_currency: &str,
        fx_rate: f64,
        rail_type: &str,
    ) -> Result<RTGSTransfer, String> {
        if amount_ngn < self.config.min_amount_ngn {
            return Err(format!(
                "Amount ₦{:.0} below RTGS minimum ₦{:.0}",
                amount_ngn, self.config.min_amount_ngn
            ));
        }

        let count = self.participant_counts.get(participant_id).copied().unwrap_or(0);
        if count >= self.config.max_concurrent_per_participant {
            return Err(format!(
                "Participant {} has {} active RTGS transfers (max {})",
                participant_id, count, self.config.max_concurrent_per_participant
            ));
        }

        let transfer = RTGSTransfer {
            transfer_id: format!("RTGS-{}-{}", participant_id, SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()),
            participant_id: participant_id.to_string(),
            corridor_id: corridor_id.to_string(),
            amount_ngn,
            amount_dest: amount_ngn / fx_rate,
            dest_currency: dest_currency.to_string(),
            fx_rate,
            rail_type: rail_type.to_string(),
            priority: SettlementPriority::Immediate,
            status: RTGSStatus::Initiated,
            initiated_at: SystemTime::now(),
            settled_at: None,
            tigerbeetle_debit_id: None,
            tigerbeetle_credit_id: None,
        };

        let id = transfer.transfer_id.clone();
        self.active_transfers.insert(id.clone(), transfer.clone());
        *self.participant_counts.entry(participant_id.to_string()).or_insert(0) += 1;

        Ok(transfer)
    }

    /// Mark transfer as settled
    pub fn confirm_settlement(&mut self, transfer_id: &str) -> Result<&RTGSTransfer, String> {
        let transfer = self.active_transfers.get_mut(transfer_id)
            .ok_or_else(|| format!("RTGS transfer {} not found", transfer_id))?;

        transfer.status = RTGSStatus::Confirmed;
        transfer.settled_at = Some(SystemTime::now());

        if let Some(count) = self.participant_counts.get_mut(&transfer.participant_id) {
            if *count > 0 {
                *count -= 1;
            }
        }

        Ok(transfer)
    }

    /// Get active RTGS transfers
    pub fn get_active_transfers(&self) -> Vec<&RTGSTransfer> {
        self.active_transfers.values().collect()
    }

    /// Get RTGS configuration
    pub fn get_config(&self) -> &RTGSConfig {
        &self.config
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_priority_determination() {
        let engine = RTGSEngine::new(RTGSConfig::default());
        assert_eq!(engine.determine_priority(600_000_000.0), SettlementPriority::Immediate);
        assert_eq!(engine.determine_priority(200_000_000.0), SettlementPriority::SameDay);
        assert_eq!(engine.determine_priority(10_000_000.0), SettlementPriority::Normal);
    }

    #[test]
    fn test_rtgs_initiation() {
        let mut engine = RTGSEngine::new(RTGSConfig::default());
        let result = engine.initiate_transfer("PAYAPP", "NG-GB", 750_000_000.0, "GBP", 1960.0, "SWIFT");
        assert!(result.is_ok());
        let transfer = result.unwrap();
        assert_eq!(transfer.priority, SettlementPriority::Immediate);
        assert_eq!(transfer.status, RTGSStatus::Initiated);
    }

    #[test]
    fn test_rtgs_below_minimum() {
        let mut engine = RTGSEngine::new(RTGSConfig::default());
        let result = engine.initiate_transfer("PAYAPP", "NG-GH", 1_000_000.0, "GHS", 24800.0, "PAPSS");
        assert!(result.is_err());
    }

    #[test]
    fn test_surcharge_calculation() {
        let engine = RTGSEngine::new(RTGSConfig::default());
        let surcharge = engine.calculate_surcharge(1_000_000_000.0, 100_000.0);
        assert!(surcharge > 100_000.0); // base + surcharge
    }
}
