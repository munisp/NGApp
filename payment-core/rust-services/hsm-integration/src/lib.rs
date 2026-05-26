use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, PartialEq)]
pub enum KeyType {
    AES256,
    RSA4096,
    ECDSA_P384,
    HMAC_SHA256,
}

#[derive(Debug, Clone, PartialEq)]
pub enum KeyPurpose {
    DataEncryption,
    TransactionSigning,
    TokenGeneration,
    KeyWrapping,
    TLSCertificate,
    APIKeyGeneration,
}

#[derive(Debug, Clone)]
pub struct ManagedKey {
    pub id: String,
    pub alias: String,
    pub key_type: KeyType,
    pub purpose: KeyPurpose,
    pub created_at: u64,
    pub last_rotated: u64,
    pub rotation_interval_days: u32,
    pub version: u32,
    pub enabled: bool,
    pub hsm_backed: bool,
}

#[derive(Debug, Clone)]
pub struct EncryptionResult {
    pub ciphertext: Vec<u8>,
    pub key_id: String,
    pub key_version: u32,
    pub algorithm: String,
    pub iv: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct SignatureResult {
    pub signature: Vec<u8>,
    pub key_id: String,
    pub algorithm: String,
    pub timestamp: u64,
}

pub struct HSMManager {
    keys: Arc<RwLock<HashMap<String, ManagedKey>>>,
    rotation_schedule: Arc<RwLock<Vec<RotationEntry>>>,
    stats: Arc<RwLock<HSMStats>>,
}

#[derive(Debug, Clone)]
struct RotationEntry {
    key_id: String,
    next_rotation: u64,
}

#[derive(Debug, Default, Clone)]
pub struct HSMStats {
    pub total_keys: u32,
    pub encryptions_performed: u64,
    pub decryptions_performed: u64,
    pub signatures_generated: u64,
    pub key_rotations: u64,
    pub hsm_backed_keys: u32,
    pub software_keys: u32,
}

impl HSMManager {
    pub fn new() -> Self {
        let mgr = Self {
            keys: Arc::new(RwLock::new(HashMap::new())),
            rotation_schedule: Arc::new(RwLock::new(Vec::new())),
            stats: Arc::new(RwLock::new(HSMStats::default())),
        };
        mgr.init_payment_keys();
        mgr
    }

    fn init_payment_keys(&self) {
        let payment_keys = vec![
            ("tigerbeetle-encryption", "TigerBeetle Ledger Encryption", KeyType::AES256, KeyPurpose::DataEncryption, 90),
            ("postgres-tde", "PostgreSQL TDE Master Key", KeyType::AES256, KeyPurpose::DataEncryption, 365),
            ("redis-encryption", "Redis Data Encryption", KeyType::AES256, KeyPurpose::DataEncryption, 90),
            ("kafka-encryption", "Kafka Topic Encryption", KeyType::AES256, KeyPurpose::DataEncryption, 180),
            ("opensearch-encryption", "OpenSearch Index Encryption", KeyType::AES256, KeyPurpose::DataEncryption, 180),
            ("transaction-signing", "Transaction Signing Key", KeyType::ECDSA_P384, KeyPurpose::TransactionSigning, 30),
            ("api-token-signing", "API Token HMAC Key", KeyType::HMAC_SHA256, KeyPurpose::TokenGeneration, 90),
            ("card-tokenization", "Card PAN Tokenization Key", KeyType::AES256, KeyPurpose::TokenGeneration, 30),
            ("tls-root-ca", "TLS Root CA Key", KeyType::RSA4096, KeyPurpose::TLSCertificate, 365),
            ("mtls-service-signing", "mTLS Service Cert Signing", KeyType::ECDSA_P384, KeyPurpose::TLSCertificate, 90),
            ("kek-master", "Key Encryption Key (Master)", KeyType::AES256, KeyPurpose::KeyWrapping, 365),
            ("pci-card-vault", "PCI DSS Card Vault Key", KeyType::AES256, KeyPurpose::DataEncryption, 30),
        ];

        let now = now_epoch();
        let mut keys = self.keys.write().unwrap();
        let mut schedule = self.rotation_schedule.write().unwrap();

        for (id, alias, kt, purpose, rotation_days) in payment_keys {
            let key = ManagedKey {
                id: id.to_string(),
                alias: alias.to_string(),
                key_type: kt,
                purpose,
                created_at: now,
                last_rotated: now,
                rotation_interval_days: rotation_days,
                version: 1,
                enabled: true,
                hsm_backed: true,
            };
            keys.insert(id.to_string(), key);
            schedule.push(RotationEntry {
                key_id: id.to_string(),
                next_rotation: now + (rotation_days as u64 * 86400),
            });
        }

        let mut stats = self.stats.write().unwrap();
        stats.total_keys = keys.len() as u32;
        stats.hsm_backed_keys = keys.len() as u32;
    }

    pub fn encrypt(&self, key_id: &str, plaintext: &[u8]) -> Result<EncryptionResult, String> {
        let keys = self.keys.read().unwrap();
        let key = keys.get(key_id).ok_or_else(|| format!("Key not found: {}", key_id))?;
        if !key.enabled {
            return Err(format!("Key {} is disabled", key_id));
        }

        let iv = vec![0u8; 16]; // placeholder IV
        let ciphertext = plaintext.to_vec(); // placeholder encryption

        let mut stats = self.stats.write().unwrap();
        stats.encryptions_performed += 1;

        Ok(EncryptionResult {
            ciphertext,
            key_id: key_id.to_string(),
            key_version: key.version,
            algorithm: format!("{:?}", key.key_type),
            iv,
        })
    }

    pub fn sign(&self, key_id: &str, data: &[u8]) -> Result<SignatureResult, String> {
        let keys = self.keys.read().unwrap();
        let key = keys.get(key_id).ok_or_else(|| format!("Key not found: {}", key_id))?;
        if !key.enabled {
            return Err(format!("Key {} is disabled", key_id));
        }

        let signature = data.to_vec(); // placeholder signature

        let mut stats = self.stats.write().unwrap();
        stats.signatures_generated += 1;

        Ok(SignatureResult {
            signature,
            key_id: key_id.to_string(),
            algorithm: format!("{:?}", key.key_type),
            timestamp: now_epoch(),
        })
    }

    pub fn rotate_key(&self, key_id: &str) -> Result<u32, String> {
        let mut keys = self.keys.write().unwrap();
        let key = keys.get_mut(key_id).ok_or_else(|| format!("Key not found: {}", key_id))?;

        key.version += 1;
        key.last_rotated = now_epoch();

        let new_version = key.version;

        let mut stats = self.stats.write().unwrap();
        stats.key_rotations += 1;

        Ok(new_version)
    }

    pub fn get_keys_due_for_rotation(&self) -> Vec<String> {
        let now = now_epoch();
        let schedule = self.rotation_schedule.read().unwrap();
        schedule.iter()
            .filter(|e| e.next_rotation <= now)
            .map(|e| e.key_id.clone())
            .collect()
    }

    pub fn get_all_keys(&self) -> Vec<ManagedKey> {
        self.keys.read().unwrap().values().cloned().collect()
    }

    pub fn get_stats(&self) -> HSMStats {
        self.stats.read().unwrap().clone()
    }
}

fn now_epoch() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init_keys() {
        let hsm = HSMManager::new();
        let keys = hsm.get_all_keys();
        assert_eq!(keys.len(), 12);
    }

    #[test]
    fn test_encrypt() {
        let hsm = HSMManager::new();
        let result = hsm.encrypt("tigerbeetle-encryption", b"test data");
        assert!(result.is_ok());
    }

    #[test]
    fn test_sign() {
        let hsm = HSMManager::new();
        let result = hsm.sign("transaction-signing", b"transaction data");
        assert!(result.is_ok());
    }

    #[test]
    fn test_rotate_key() {
        let hsm = HSMManager::new();
        let version = hsm.rotate_key("api-token-signing").unwrap();
        assert_eq!(version, 2);
    }
}
