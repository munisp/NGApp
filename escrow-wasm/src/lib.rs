use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use lazy_static::lazy_static;
use regex::Regex;
use std::collections::HashMap;

#[cfg(feature = "console_error_panic_hook")]
pub use console_error_panic_hook::set_once as set_panic_hook;

#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// =============================================================================
// OCR PREPROCESSING MODULE
// High-performance image preprocessing for DeepSeek-OCR
// =============================================================================

#[wasm_bindgen]
pub struct ImageProcessor {
    width: u32,
    height: u32,
}

#[wasm_bindgen]
impl ImageProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> ImageProcessor {
        ImageProcessor { width, height }
    }

    /// Convert RGBA image data to grayscale
    /// Uses luminance formula: 0.299*R + 0.587*G + 0.114*B
    #[wasm_bindgen]
    pub fn to_grayscale(&self, data: &[u8]) -> Vec<u8> {
        let mut result = Vec::with_capacity(data.len());
        for chunk in data.chunks(4) {
            if chunk.len() >= 3 {
                let gray = (0.299 * chunk[0] as f32 
                          + 0.587 * chunk[1] as f32 
                          + 0.114 * chunk[2] as f32) as u8;
                result.push(gray);
                result.push(gray);
                result.push(gray);
                result.push(if chunk.len() > 3 { chunk[3] } else { 255 });
            }
        }
        result
    }

    /// Enhance contrast using histogram stretching
    #[wasm_bindgen]
    pub fn enhance_contrast(&self, data: &[u8], factor: f32) -> Vec<u8> {
        let mut result = Vec::with_capacity(data.len());
        let mid = 128.0;
        
        for chunk in data.chunks(4) {
            for (i, &pixel) in chunk.iter().enumerate() {
                if i < 3 {
                    let adjusted = mid + (pixel as f32 - mid) * factor;
                    result.push(adjusted.max(0.0).min(255.0) as u8);
                } else {
                    result.push(pixel);
                }
            }
        }
        result
    }

    /// Apply adaptive thresholding for text extraction
    #[wasm_bindgen]
    pub fn adaptive_threshold(&self, data: &[u8], block_size: u32, c: i32) -> Vec<u8> {
        let mut result = vec![0u8; data.len()];
        let half_block = (block_size / 2) as i32;
        
        for y in 0..self.height {
            for x in 0..self.width {
                let idx = ((y * self.width + x) * 4) as usize;
                if idx + 3 >= data.len() {
                    continue;
                }
                
                // Calculate local mean
                let mut sum = 0u32;
                let mut count = 0u32;
                
                for dy in -half_block..=half_block {
                    for dx in -half_block..=half_block {
                        let ny = y as i32 + dy;
                        let nx = x as i32 + dx;
                        
                        if ny >= 0 && ny < self.height as i32 && nx >= 0 && nx < self.width as i32 {
                            let nidx = ((ny as u32 * self.width + nx as u32) * 4) as usize;
                            if nidx < data.len() {
                                sum += data[nidx] as u32;
                                count += 1;
                            }
                        }
                    }
                }
                
                let mean = if count > 0 { (sum / count) as i32 } else { 128 };
                let threshold = mean - c;
                let pixel = data[idx] as i32;
                
                let value = if pixel > threshold { 255u8 } else { 0u8 };
                result[idx] = value;
                result[idx + 1] = value;
                result[idx + 2] = value;
                result[idx + 3] = data[idx + 3];
            }
        }
        result
    }

    /// Reduce noise using median filter
    #[wasm_bindgen]
    pub fn median_filter(&self, data: &[u8], kernel_size: u32) -> Vec<u8> {
        let mut result = vec![0u8; data.len()];
        let half = (kernel_size / 2) as i32;
        
        for y in 0..self.height {
            for x in 0..self.width {
                let idx = ((y * self.width + x) * 4) as usize;
                
                for channel in 0..3 {
                    let mut values: Vec<u8> = Vec::new();
                    
                    for dy in -half..=half {
                        for dx in -half..=half {
                            let ny = y as i32 + dy;
                            let nx = x as i32 + dx;
                            
                            if ny >= 0 && ny < self.height as i32 && nx >= 0 && nx < self.width as i32 {
                                let nidx = ((ny as u32 * self.width + nx as u32) * 4 + channel) as usize;
                                if nidx < data.len() {
                                    values.push(data[nidx]);
                                }
                            }
                        }
                    }
                    
                    values.sort();
                    result[idx + channel as usize] = values.get(values.len() / 2).copied().unwrap_or(0);
                }
                
                if idx + 3 < data.len() {
                    result[idx + 3] = data[idx + 3];
                }
            }
        }
        result
    }
}

// =============================================================================
// NIGERIAN COMMERCE DETECTION MODULE
// Enhanced price patterns and seller signal detection
// =============================================================================

lazy_static! {
    // Nigerian Naira patterns (enhanced)
    static ref NGN_PATTERNS: Vec<Regex> = vec![
        // Standard formats
        Regex::new(r"(?i)₦\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)").unwrap(),
        Regex::new(r"(?i)NGN\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)").unwrap(),
        Regex::new(r"(?i)N\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)").unwrap(),
        Regex::new(r"(?i)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*naira").unwrap(),
        // K suffix patterns (50k = 50,000)
        Regex::new(r"(?i)₦\s*(\d+(?:\.\d+)?)\s*k\b").unwrap(),
        Regex::new(r"(?i)(\d+(?:\.\d+)?)\s*k\s*naira").unwrap(),
        Regex::new(r"(?i)(\d+(?:\.\d+)?)\s*k\b").unwrap(),
        // M suffix patterns (1.5m = 1,500,000)
        Regex::new(r"(?i)₦\s*(\d+(?:\.\d+)?)\s*m\b").unwrap(),
        Regex::new(r"(?i)(\d+(?:\.\d+)?)\s*m\s*naira").unwrap(),
    ];
    
    // Ghanaian Cedi patterns
    static ref GHS_PATTERNS: Vec<Regex> = vec![
        Regex::new(r"(?i)GH[₵¢]\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)").unwrap(),
        Regex::new(r"(?i)GHS\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)").unwrap(),
        Regex::new(r"(?i)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*cedis?").unwrap(),
        Regex::new(r"(?i)(\d+(?:\.\d+)?)\s*k\s*cedis?").unwrap(),
    ];
    
    // Kenyan Shilling patterns
    static ref KES_PATTERNS: Vec<Regex> = vec![
        Regex::new(r"(?i)KES\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)").unwrap(),
        Regex::new(r"(?i)Ksh\.?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)").unwrap(),
        Regex::new(r"(?i)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*shillings?").unwrap(),
        Regex::new(r"(?i)(\d+(?:\.\d+)?)\s*k\s*shillings?").unwrap(),
    ];
    
    // South African Rand patterns
    static ref ZAR_PATTERNS: Vec<Regex> = vec![
        Regex::new(r"(?i)R\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)").unwrap(),
        Regex::new(r"(?i)ZAR\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)").unwrap(),
        Regex::new(r"(?i)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*rand").unwrap(),
    ];
    
    // USD patterns (for cross-border)
    static ref USD_PATTERNS: Vec<Regex> = vec![
        Regex::new(r"(?i)\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)").unwrap(),
        Regex::new(r"(?i)USD\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)").unwrap(),
        Regex::new(r"(?i)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*dollars?").unwrap(),
    ];
    
    // Nigerian seller signals
    static ref SELLER_SIGNALS: Vec<Regex> = vec![
        // Contact patterns
        Regex::new(r"(?i)DM\s*(for|to)\s*(price|order|buy|purchase|enquir)").unwrap(),
        Regex::new(r"(?i)WhatsApp\s*:?\s*(\+?234|\d{10,11})").unwrap(),
        Regex::new(r"(?i)call\s*:?\s*(\+?234|\d{10,11})").unwrap(),
        Regex::new(r"(?i)link\s*in\s*bio").unwrap(),
        // Availability patterns
        Regex::new(r"(?i)available\s*(now|in\s*stock|for\s*sale)").unwrap(),
        Regex::new(r"(?i)in\s*stock").unwrap(),
        Regex::new(r"(?i)limited\s*(stock|quantity|offer)").unwrap(),
        // Delivery patterns
        Regex::new(r"(?i)delivery\s*(available|nationwide|lagos|abuja)").unwrap(),
        Regex::new(r"(?i)we\s*deliver").unwrap(),
        Regex::new(r"(?i)nationwide\s*delivery").unwrap(),
        // Payment patterns
        Regex::new(r"(?i)pay\s*on\s*delivery").unwrap(),
        Regex::new(r"(?i)bank\s*transfer").unwrap(),
        Regex::new(r"(?i)opay|palmpay|kuda").unwrap(),
    ];
    
    // Buyer intent signals
    static ref BUYER_SIGNALS: Vec<Regex> = vec![
        Regex::new(r"(?i)how\s*much").unwrap(),
        Regex::new(r"(?i)price\s*\??").unwrap(),
        Regex::new(r"(?i)interested").unwrap(),
        Regex::new(r"(?i)still\s*available").unwrap(),
        Regex::new(r"(?i)can\s*i\s*(get|buy|order)").unwrap(),
        Regex::new(r"(?i)do\s*you\s*(deliver|ship)").unwrap(),
        Regex::new(r"(?i)location\s*\??").unwrap(),
        Regex::new(r"(?i)where\s*(are\s*you|is\s*your\s*shop)").unwrap(),
    ];
    
    // Nigerian locations
    static ref NIGERIAN_LOCATIONS: Vec<&'static str> = vec![
        "lagos", "abuja", "port harcourt", "ibadan", "kano", "kaduna",
        "benin city", "enugu", "warri", "calabar", "owerri", "uyo",
        "abeokuta", "ilorin", "jos", "akure", "onitsha", "aba",
        "lekki", "ikeja", "vi", "victoria island", "yaba", "surulere",
        "ajah", "ikorodu", "festac", "oshodi", "mushin", "apapa",
    ];
}

#[derive(Serialize, Deserialize)]
pub struct PriceDetection {
    pub amount: f64,
    pub currency: String,
    pub original_text: String,
    pub confidence: f32,
    pub normalized: String,
}

#[derive(Serialize, Deserialize)]
pub struct CommerceSignals {
    pub is_commerce: bool,
    pub confidence: f32,
    pub prices: Vec<PriceDetection>,
    pub seller_signals: Vec<String>,
    pub buyer_signals: Vec<String>,
    pub locations: Vec<String>,
    pub contact_info: Vec<String>,
    pub currency_detected: String,
}

#[wasm_bindgen]
pub struct CommerceDetector {
    min_confidence: f32,
}

#[wasm_bindgen]
impl CommerceDetector {
    #[wasm_bindgen(constructor)]
    pub fn new(min_confidence: f32) -> CommerceDetector {
        CommerceDetector { min_confidence }
    }

    /// Detect commerce signals in text
    #[wasm_bindgen]
    pub fn detect(&self, text: &str) -> JsValue {
        let text_lower = text.to_lowercase();
        
        // Detect prices
        let mut prices = Vec::new();
        let mut primary_currency = "NGN".to_string();
        
        // Nigerian Naira
        for pattern in NGN_PATTERNS.iter() {
            for cap in pattern.captures_iter(text) {
                if let Some(amount_str) = cap.get(1) {
                    if let Some(price) = self.parse_price(amount_str.as_str(), "NGN") {
                        prices.push(price);
                    }
                }
            }
        }
        
        // Ghanaian Cedi
        for pattern in GHS_PATTERNS.iter() {
            for cap in pattern.captures_iter(text) {
                if let Some(amount_str) = cap.get(1) {
                    if let Some(price) = self.parse_price(amount_str.as_str(), "GHS") {
                        prices.push(price);
                        if prices.len() == 1 {
                            primary_currency = "GHS".to_string();
                        }
                    }
                }
            }
        }
        
        // Kenyan Shilling
        for pattern in KES_PATTERNS.iter() {
            for cap in pattern.captures_iter(text) {
                if let Some(amount_str) = cap.get(1) {
                    if let Some(price) = self.parse_price(amount_str.as_str(), "KES") {
                        prices.push(price);
                        if prices.len() == 1 {
                            primary_currency = "KES".to_string();
                        }
                    }
                }
            }
        }
        
        // South African Rand
        for pattern in ZAR_PATTERNS.iter() {
            for cap in pattern.captures_iter(text) {
                if let Some(amount_str) = cap.get(1) {
                    if let Some(price) = self.parse_price(amount_str.as_str(), "ZAR") {
                        prices.push(price);
                        if prices.len() == 1 {
                            primary_currency = "ZAR".to_string();
                        }
                    }
                }
            }
        }
        
        // USD
        for pattern in USD_PATTERNS.iter() {
            for cap in pattern.captures_iter(text) {
                if let Some(amount_str) = cap.get(1) {
                    if let Some(price) = self.parse_price(amount_str.as_str(), "USD") {
                        prices.push(price);
                        if prices.len() == 1 {
                            primary_currency = "USD".to_string();
                        }
                    }
                }
            }
        }
        
        // Detect seller signals
        let mut seller_signals = Vec::new();
        for pattern in SELLER_SIGNALS.iter() {
            if pattern.is_match(&text_lower) {
                if let Some(m) = pattern.find(&text_lower) {
                    seller_signals.push(m.as_str().to_string());
                }
            }
        }
        
        // Detect buyer signals
        let mut buyer_signals = Vec::new();
        for pattern in BUYER_SIGNALS.iter() {
            if pattern.is_match(&text_lower) {
                if let Some(m) = pattern.find(&text_lower) {
                    buyer_signals.push(m.as_str().to_string());
                }
            }
        }
        
        // Detect locations
        let mut locations = Vec::new();
        for location in NIGERIAN_LOCATIONS.iter() {
            if text_lower.contains(location) {
                locations.push(location.to_string());
            }
        }
        
        // Extract contact info
        let contact_info = self.extract_contacts(text);
        
        // Calculate confidence
        let mut confidence = 0.0f32;
        
        // Price detection adds significant confidence
        if !prices.is_empty() {
            confidence += 0.4;
        }
        
        // Seller signals
        confidence += (seller_signals.len() as f32 * 0.15).min(0.3);
        
        // Location detection
        if !locations.is_empty() {
            confidence += 0.1;
        }
        
        // Contact info
        if !contact_info.is_empty() {
            confidence += 0.15;
        }
        
        // Buyer signals (indicates active commerce)
        if !buyer_signals.is_empty() {
            confidence += 0.05;
        }
        
        let signals = CommerceSignals {
            is_commerce: confidence >= self.min_confidence,
            confidence,
            prices,
            seller_signals,
            buyer_signals,
            locations,
            contact_info,
            currency_detected: primary_currency,
        };
        
        serde_wasm_bindgen::to_value(&signals).unwrap_or(JsValue::NULL)
    }
    
    fn parse_price(&self, amount_str: &str, currency: &str) -> Option<PriceDetection> {
        let cleaned = amount_str.replace(",", "").replace(" ", "");
        let text_lower = cleaned.to_lowercase();
        
        // Handle K suffix (thousands)
        let (amount, multiplier) = if text_lower.ends_with('k') {
            (text_lower.trim_end_matches('k'), 1000.0)
        } else if text_lower.ends_with('m') {
            (text_lower.trim_end_matches('m'), 1_000_000.0)
        } else {
            (text_lower.as_str(), 1.0)
        };
        
        if let Ok(value) = amount.parse::<f64>() {
            let final_amount = value * multiplier;
            
            // Validate reasonable price range
            let (min, max) = match currency {
                "NGN" => (100.0, 100_000_000.0),
                "GHS" => (1.0, 1_000_000.0),
                "KES" => (10.0, 10_000_000.0),
                "ZAR" => (1.0, 10_000_000.0),
                "USD" => (0.1, 1_000_000.0),
                _ => (0.0, f64::MAX),
            };
            
            if final_amount >= min && final_amount <= max {
                let symbol = match currency {
                    "NGN" => "₦",
                    "GHS" => "GH₵",
                    "KES" => "KES",
                    "ZAR" => "R",
                    "USD" => "$",
                    _ => "",
                };
                
                return Some(PriceDetection {
                    amount: final_amount,
                    currency: currency.to_string(),
                    original_text: amount_str.to_string(),
                    confidence: 0.9,
                    normalized: format!("{}{:.2}", symbol, final_amount),
                });
            }
        }
        None
    }
    
    fn extract_contacts(&self, text: &str) -> Vec<String> {
        let mut contacts = Vec::new();
        
        // Nigerian phone numbers
        let phone_pattern = Regex::new(r"(?:\+?234|0)[789]\d{9}").unwrap();
        for cap in phone_pattern.find_iter(text) {
            contacts.push(cap.as_str().to_string());
        }
        
        // WhatsApp links
        let wa_pattern = Regex::new(r"wa\.me/\d+").unwrap();
        for cap in wa_pattern.find_iter(text) {
            contacts.push(cap.as_str().to_string());
        }
        
        contacts
    }
}

// =============================================================================
// RISK SCORING MODULE
// Client-side risk assessment for transactions
// =============================================================================

#[derive(Serialize, Deserialize)]
pub struct RiskAssessment {
    pub score: f32,
    pub level: String,
    pub factors: Vec<RiskFactor>,
    pub recommendation: String,
}

#[derive(Serialize, Deserialize)]
pub struct RiskFactor {
    pub name: String,
    pub weight: f32,
    pub value: f32,
    pub description: String,
}

#[wasm_bindgen]
pub struct RiskScorer {
    weights: HashMap<String, f32>,
}

#[wasm_bindgen]
impl RiskScorer {
    #[wasm_bindgen(constructor)]
    pub fn new() -> RiskScorer {
        let mut weights = HashMap::new();
        weights.insert("amount".to_string(), 0.25);
        weights.insert("seller_history".to_string(), 0.20);
        weights.insert("buyer_history".to_string(), 0.15);
        weights.insert("velocity".to_string(), 0.15);
        weights.insert("device".to_string(), 0.10);
        weights.insert("location".to_string(), 0.10);
        weights.insert("time".to_string(), 0.05);
        
        RiskScorer { weights }
    }

    /// Calculate risk score for a transaction
    #[wasm_bindgen]
    pub fn calculate_risk(&self, transaction_json: &str) -> JsValue {
        let transaction: serde_json::Value = match serde_json::from_str(transaction_json) {
            Ok(v) => v,
            Err(_) => return JsValue::NULL,
        };
        
        let mut factors = Vec::new();
        let mut total_score = 0.0f32;
        
        // Amount risk
        if let Some(amount) = transaction.get("amount").and_then(|v| v.as_f64()) {
            let amount_risk = self.calculate_amount_risk(amount);
            let weight = self.weights.get("amount").unwrap_or(&0.25);
            total_score += amount_risk * weight;
            factors.push(RiskFactor {
                name: "Transaction Amount".to_string(),
                weight: *weight,
                value: amount_risk,
                description: self.get_amount_description(amount),
            });
        }
        
        // Seller history risk
        if let Some(seller_txns) = transaction.get("seller_transaction_count").and_then(|v| v.as_i64()) {
            let seller_risk = self.calculate_history_risk(seller_txns as i32);
            let weight = self.weights.get("seller_history").unwrap_or(&0.20);
            total_score += seller_risk * weight;
            factors.push(RiskFactor {
                name: "Seller History".to_string(),
                weight: *weight,
                value: seller_risk,
                description: format!("{} previous transactions", seller_txns),
            });
        }
        
        // Buyer history risk
        if let Some(buyer_txns) = transaction.get("buyer_transaction_count").and_then(|v| v.as_i64()) {
            let buyer_risk = self.calculate_history_risk(buyer_txns as i32);
            let weight = self.weights.get("buyer_history").unwrap_or(&0.15);
            total_score += buyer_risk * weight;
            factors.push(RiskFactor {
                name: "Buyer History".to_string(),
                weight: *weight,
                value: buyer_risk,
                description: format!("{} previous transactions", buyer_txns),
            });
        }
        
        // Velocity risk (transactions per hour)
        if let Some(velocity) = transaction.get("transactions_per_hour").and_then(|v| v.as_f64()) {
            let velocity_risk = self.calculate_velocity_risk(velocity as f32);
            let weight = self.weights.get("velocity").unwrap_or(&0.15);
            total_score += velocity_risk * weight;
            factors.push(RiskFactor {
                name: "Transaction Velocity".to_string(),
                weight: *weight,
                value: velocity_risk,
                description: format!("{:.1} transactions/hour", velocity),
            });
        }
        
        // Device risk
        if let Some(is_new_device) = transaction.get("is_new_device").and_then(|v| v.as_bool()) {
            let device_risk = if is_new_device { 0.7 } else { 0.1 };
            let weight = self.weights.get("device").unwrap_or(&0.10);
            total_score += device_risk * weight;
            factors.push(RiskFactor {
                name: "Device".to_string(),
                weight: *weight,
                value: device_risk,
                description: if is_new_device { "New device" } else { "Known device" }.to_string(),
            });
        }
        
        // Location risk
        if let Some(is_unusual_location) = transaction.get("is_unusual_location").and_then(|v| v.as_bool()) {
            let location_risk = if is_unusual_location { 0.6 } else { 0.1 };
            let weight = self.weights.get("location").unwrap_or(&0.10);
            total_score += location_risk * weight;
            factors.push(RiskFactor {
                name: "Location".to_string(),
                weight: *weight,
                value: location_risk,
                description: if is_unusual_location { "Unusual location" } else { "Normal location" }.to_string(),
            });
        }
        
        // Time risk (unusual hours)
        if let Some(hour) = transaction.get("hour_of_day").and_then(|v| v.as_i64()) {
            let time_risk = self.calculate_time_risk(hour as i32);
            let weight = self.weights.get("time").unwrap_or(&0.05);
            total_score += time_risk * weight;
            factors.push(RiskFactor {
                name: "Time of Day".to_string(),
                weight: *weight,
                value: time_risk,
                description: format!("{}:00", hour),
            });
        }
        
        // Determine risk level
        let (level, recommendation) = if total_score < 0.3 {
            ("LOW", "Transaction can proceed normally")
        } else if total_score < 0.5 {
            ("MEDIUM", "Additional verification recommended")
        } else if total_score < 0.7 {
            ("HIGH", "Manual review required before proceeding")
        } else {
            ("CRITICAL", "Transaction should be blocked pending investigation")
        };
        
        let assessment = RiskAssessment {
            score: total_score,
            level: level.to_string(),
            factors,
            recommendation: recommendation.to_string(),
        };
        
        serde_wasm_bindgen::to_value(&assessment).unwrap_or(JsValue::NULL)
    }
    
    fn calculate_amount_risk(&self, amount: f64) -> f32 {
        // Risk increases with amount (NGN)
        if amount < 10_000.0 {
            0.1
        } else if amount < 50_000.0 {
            0.2
        } else if amount < 200_000.0 {
            0.4
        } else if amount < 500_000.0 {
            0.6
        } else if amount < 1_000_000.0 {
            0.8
        } else {
            0.95
        }
    }
    
    fn get_amount_description(&self, amount: f64) -> String {
        if amount < 50_000.0 {
            "Low value transaction".to_string()
        } else if amount < 500_000.0 {
            "Medium value transaction".to_string()
        } else {
            "High value transaction".to_string()
        }
    }
    
    fn calculate_history_risk(&self, transaction_count: i32) -> f32 {
        // Lower risk for users with more history
        if transaction_count == 0 {
            0.9
        } else if transaction_count < 3 {
            0.6
        } else if transaction_count < 10 {
            0.3
        } else if transaction_count < 50 {
            0.15
        } else {
            0.05
        }
    }
    
    fn calculate_velocity_risk(&self, txns_per_hour: f32) -> f32 {
        if txns_per_hour < 1.0 {
            0.1
        } else if txns_per_hour < 3.0 {
            0.3
        } else if txns_per_hour < 5.0 {
            0.6
        } else {
            0.9
        }
    }
    
    fn calculate_time_risk(&self, hour: i32) -> f32 {
        // Higher risk for transactions between 1am-5am
        if hour >= 1 && hour <= 5 {
            0.7
        } else if hour >= 22 || hour == 0 {
            0.4
        } else {
            0.1
        }
    }
}

// =============================================================================
// CRYPTOGRAPHIC UTILITIES
// Escrow ID generation and signature verification
// =============================================================================

#[wasm_bindgen]
pub fn generate_escrow_id(seller_id: &str, buyer_id: &str, timestamp: u64) -> String {
    let input = format!("{}:{}:{}", seller_id, buyer_id, timestamp);
    let hash = simple_hash(&input);
    format!("ESC-{:08X}", hash)
}

#[wasm_bindgen]
pub fn generate_rma_number(return_id: &str, timestamp: u64) -> String {
    let input = format!("{}:{}", return_id, timestamp);
    let hash = simple_hash(&input);
    format!("RMA-{:08X}", hash)
}

fn simple_hash(input: &str) -> u32 {
    let mut hash: u32 = 5381;
    for byte in input.bytes() {
        hash = hash.wrapping_mul(33).wrapping_add(byte as u32);
    }
    hash
}

// =============================================================================
// CURRENCY CONVERSION UTILITIES
// Cross-border exchange rate calculations
// =============================================================================

#[derive(Serialize, Deserialize)]
pub struct ExchangeResult {
    pub from_amount: f64,
    pub from_currency: String,
    pub to_amount: f64,
    pub to_currency: String,
    pub rate: f64,
    pub fee_percent: f64,
    pub fee_amount: f64,
    pub total_cost: f64,
}

#[wasm_bindgen]
pub struct CurrencyConverter {
    rates: HashMap<String, f64>,
    fees: HashMap<String, f64>,
}

#[wasm_bindgen]
impl CurrencyConverter {
    #[wasm_bindgen(constructor)]
    pub fn new() -> CurrencyConverter {
        let mut rates = HashMap::new();
        // Base rates to NGN (approximate, should be updated from API)
        rates.insert("NGN".to_string(), 1.0);
        rates.insert("GHS".to_string(), 130.0);  // 1 GHS = ~130 NGN
        rates.insert("KES".to_string(), 12.0);   // 1 KES = ~12 NGN
        rates.insert("ZAR".to_string(), 85.0);   // 1 ZAR = ~85 NGN
        rates.insert("USD".to_string(), 1550.0); // 1 USD = ~1550 NGN
        
        let mut fees = HashMap::new();
        fees.insert("NGN-NGN".to_string(), 0.0);
        fees.insert("NGN-GHS".to_string(), 2.5);
        fees.insert("NGN-KES".to_string(), 2.5);
        fees.insert("NGN-ZAR".to_string(), 2.5);
        fees.insert("NGN-USD".to_string(), 3.0);
        fees.insert("GHS-NGN".to_string(), 2.5);
        fees.insert("KES-NGN".to_string(), 2.5);
        fees.insert("ZAR-NGN".to_string(), 2.5);
        fees.insert("USD-NGN".to_string(), 3.0);
        
        CurrencyConverter { rates, fees }
    }

    /// Update exchange rate
    #[wasm_bindgen]
    pub fn update_rate(&mut self, currency: &str, rate_to_ngn: f64) {
        self.rates.insert(currency.to_string(), rate_to_ngn);
    }

    /// Convert between currencies
    #[wasm_bindgen]
    pub fn convert(&self, amount: f64, from: &str, to: &str) -> JsValue {
        let from_rate = self.rates.get(from).unwrap_or(&1.0);
        let to_rate = self.rates.get(to).unwrap_or(&1.0);
        
        // Convert to NGN first, then to target currency
        let ngn_amount = amount * from_rate;
        let to_amount = ngn_amount / to_rate;
        
        // Calculate fee
        let fee_key = format!("{}-{}", from, to);
        let fee_percent = self.fees.get(&fee_key).unwrap_or(&2.5);
        let fee_amount = to_amount * (fee_percent / 100.0);
        
        let result = ExchangeResult {
            from_amount: amount,
            from_currency: from.to_string(),
            to_amount: to_amount - fee_amount,
            to_currency: to.to_string(),
            rate: from_rate / to_rate,
            fee_percent: *fee_percent,
            fee_amount,
            total_cost: amount,
        };
        
        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
    }
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_price_detection() {
        let detector = CommerceDetector::new(0.5);
        
        // Test Nigerian price patterns
        let text = "iPhone 15 Pro Max available for ₦1,500,000. DM to order. Delivery nationwide.";
        let result = detector.detect(text);
        assert!(!result.is_null());
    }

    #[test]
    fn test_k_suffix() {
        let detector = CommerceDetector::new(0.5);
        
        let text = "Selling for 50k naira. WhatsApp: 08012345678";
        let result = detector.detect(text);
        assert!(!result.is_null());
    }

    #[test]
    fn test_risk_scoring() {
        let scorer = RiskScorer::new();
        
        let transaction = r#"{
            "amount": 100000,
            "seller_transaction_count": 5,
            "buyer_transaction_count": 2,
            "transactions_per_hour": 1,
            "is_new_device": false,
            "is_unusual_location": false,
            "hour_of_day": 14
        }"#;
        
        let result = scorer.calculate_risk(transaction);
        assert!(!result.is_null());
    }

    #[test]
    fn test_currency_conversion() {
        let converter = CurrencyConverter::new();
        
        let result = converter.convert(100.0, "USD", "NGN");
        assert!(!result.is_null());
    }

    #[test]
    fn test_escrow_id_generation() {
        let id = generate_escrow_id("seller123", "buyer456", 1702800000);
        assert!(id.starts_with("ESC-"));
    }
}
