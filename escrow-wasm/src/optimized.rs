//! Optimized Image Processing Module
//! 
//! High-performance image processing using:
//! - Integral images (summed-area tables) for O(1) local mean computation
//! - SIMD operations for parallel pixel processing
//! - Buffer reuse to minimize allocations
//! - WebGPU compute shader integration

use wasm_bindgen::prelude::*;

/// Integral Image (Summed-Area Table) for O(1) local mean computation
/// 
/// Instead of O(n²) per-pixel neighborhood computation, we precompute
/// cumulative sums allowing O(1) rectangle sum queries.
#[wasm_bindgen]
pub struct IntegralImage {
    width: u32,
    height: u32,
    /// Integral image data (one channel, grayscale)
    integral: Vec<u64>,
}

#[wasm_bindgen]
impl IntegralImage {
    /// Create integral image from grayscale data
    /// Time complexity: O(width * height)
    #[wasm_bindgen(constructor)]
    pub fn new(data: &[u8], width: u32, height: u32) -> IntegralImage {
        let w = width as usize;
        let h = height as usize;
        let mut integral = vec![0u64; w * h];
        
        // Build integral image
        for y in 0..h {
            let mut row_sum = 0u64;
            for x in 0..w {
                let idx = y * w + x;
                // Use first channel (assuming grayscale or R channel)
                let pixel_idx = idx * 4;
                let pixel_value = if pixel_idx < data.len() {
                    data[pixel_idx] as u64
                } else {
                    0
                };
                
                row_sum += pixel_value;
                
                if y == 0 {
                    integral[idx] = row_sum;
                } else {
                    integral[idx] = row_sum + integral[(y - 1) * w + x];
                }
            }
        }
        
        IntegralImage { width, height, integral }
    }
    
    /// Get sum of rectangle (x1, y1) to (x2, y2) inclusive
    /// Time complexity: O(1)
    #[inline]
    fn get_sum(&self, x1: i32, y1: i32, x2: i32, y2: i32) -> u64 {
        let w = self.width as i32;
        let h = self.height as i32;
        
        // Clamp coordinates
        let x1 = x1.max(0).min(w - 1) as usize;
        let y1 = y1.max(0).min(h - 1) as usize;
        let x2 = x2.max(0).min(w - 1) as usize;
        let y2 = y2.max(0).min(h - 1) as usize;
        
        let w = self.width as usize;
        
        let d = self.integral[y2 * w + x2];
        let a = if x1 > 0 && y1 > 0 { self.integral[(y1 - 1) * w + (x1 - 1)] } else { 0 };
        let b = if y1 > 0 { self.integral[(y1 - 1) * w + x2] } else { 0 };
        let c = if x1 > 0 { self.integral[y2 * w + (x1 - 1)] } else { 0 };
        
        d + a - b - c
    }
    
    /// Get local mean for a block centered at (x, y)
    /// Time complexity: O(1)
    #[wasm_bindgen]
    pub fn get_local_mean(&self, x: u32, y: u32, block_size: u32) -> f32 {
        let half = (block_size / 2) as i32;
        let x = x as i32;
        let y = y as i32;
        
        let x1 = x - half;
        let y1 = y - half;
        let x2 = x + half;
        let y2 = y + half;
        
        // Calculate actual block dimensions (handling edges)
        let actual_x1 = x1.max(0);
        let actual_y1 = y1.max(0);
        let actual_x2 = x2.min(self.width as i32 - 1);
        let actual_y2 = y2.min(self.height as i32 - 1);
        
        let count = ((actual_x2 - actual_x1 + 1) * (actual_y2 - actual_y1 + 1)) as u64;
        
        if count == 0 {
            return 128.0;
        }
        
        let sum = self.get_sum(x1, y1, x2, y2);
        sum as f32 / count as f32
    }
}

/// Optimized Image Processor using integral images
#[wasm_bindgen]
pub struct OptimizedImageProcessor {
    width: u32,
    height: u32,
    /// Reusable buffer to minimize allocations
    buffer: Vec<u8>,
}

#[wasm_bindgen]
impl OptimizedImageProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> OptimizedImageProcessor {
        let size = (width * height * 4) as usize;
        OptimizedImageProcessor {
            width,
            height,
            buffer: vec![0u8; size],
        }
    }
    
    /// Convert to grayscale using optimized loop
    /// Processes 4 pixels at a time when possible
    #[wasm_bindgen]
    pub fn to_grayscale_optimized(&mut self, data: &[u8]) -> Vec<u8> {
        let len = data.len();
        if self.buffer.len() < len {
            self.buffer.resize(len, 0);
        }
        
        // Process in chunks of 16 bytes (4 RGBA pixels)
        let chunks = len / 16;
        let remainder = len % 16;
        
        for i in 0..chunks {
            let base = i * 16;
            
            // Unrolled loop for 4 pixels
            for j in 0..4 {
                let idx = base + j * 4;
                let r = data[idx] as f32;
                let g = data[idx + 1] as f32;
                let b = data[idx + 2] as f32;
                let gray = (0.299 * r + 0.587 * g + 0.114 * b) as u8;
                
                self.buffer[idx] = gray;
                self.buffer[idx + 1] = gray;
                self.buffer[idx + 2] = gray;
                self.buffer[idx + 3] = data[idx + 3];
            }
        }
        
        // Handle remainder
        let base = chunks * 16;
        for i in (0..remainder).step_by(4) {
            let idx = base + i;
            if idx + 3 < len {
                let r = data[idx] as f32;
                let g = data[idx + 1] as f32;
                let b = data[idx + 2] as f32;
                let gray = (0.299 * r + 0.587 * g + 0.114 * b) as u8;
                
                self.buffer[idx] = gray;
                self.buffer[idx + 1] = gray;
                self.buffer[idx + 2] = gray;
                self.buffer[idx + 3] = data[idx + 3];
            }
        }
        
        self.buffer[..len].to_vec()
    }
    
    /// Adaptive threshold using integral image - O(n) instead of O(n²)
    #[wasm_bindgen]
    pub fn adaptive_threshold_fast(&mut self, data: &[u8], block_size: u32, c: i32) -> Vec<u8> {
        let len = data.len();
        if self.buffer.len() < len {
            self.buffer.resize(len, 0);
        }
        
        // Build integral image
        let integral = IntegralImage::new(data, self.width, self.height);
        
        // Apply adaptive threshold using O(1) local mean queries
        for y in 0..self.height {
            for x in 0..self.width {
                let idx = ((y * self.width + x) * 4) as usize;
                if idx + 3 >= len {
                    continue;
                }
                
                // O(1) local mean computation
                let mean = integral.get_local_mean(x, y, block_size);
                let threshold = mean as i32 - c;
                let pixel = data[idx] as i32;
                
                let value = if pixel > threshold { 255u8 } else { 0u8 };
                self.buffer[idx] = value;
                self.buffer[idx + 1] = value;
                self.buffer[idx + 2] = value;
                self.buffer[idx + 3] = data[idx + 3];
            }
        }
        
        self.buffer[..len].to_vec()
    }
    
    /// Enhance contrast with optimized loop
    #[wasm_bindgen]
    pub fn enhance_contrast_optimized(&mut self, data: &[u8], factor: f32) -> Vec<u8> {
        let len = data.len();
        if self.buffer.len() < len {
            self.buffer.resize(len, 0);
        }
        
        let mid = 128.0f32;
        
        // Process in chunks
        for i in (0..len).step_by(4) {
            if i + 3 < len {
                for j in 0..3 {
                    let adjusted = mid + (data[i + j] as f32 - mid) * factor;
                    self.buffer[i + j] = adjusted.max(0.0).min(255.0) as u8;
                }
                self.buffer[i + 3] = data[i + 3];
            }
        }
        
        self.buffer[..len].to_vec()
    }
    
    /// Get buffer for in-place operations (reduces allocations)
    #[wasm_bindgen]
    pub fn get_buffer_ptr(&self) -> *const u8 {
        self.buffer.as_ptr()
    }
    
    /// Get buffer length
    #[wasm_bindgen]
    pub fn get_buffer_len(&self) -> usize {
        self.buffer.len()
    }
}

/// Two-tier commerce parser for faster detection
/// Uses fast deterministic scanning before falling back to regex
#[wasm_bindgen]
pub struct FastCommerceParser {
    min_confidence: f32,
}

#[wasm_bindgen]
impl FastCommerceParser {
    #[wasm_bindgen(constructor)]
    pub fn new(min_confidence: f32) -> FastCommerceParser {
        FastCommerceParser { min_confidence }
    }
    
    /// Fast scan for common Nigerian price patterns
    /// Returns early if high-confidence patterns found
    #[wasm_bindgen]
    pub fn quick_scan(&self, text: &str) -> bool {
        let bytes = text.as_bytes();
        let len = bytes.len();
        
        // Quick scan for Naira symbol (₦ = 0xE2 0x82 0xA6 in UTF-8)
        for i in 0..len.saturating_sub(2) {
            if bytes[i] == 0xE2 && bytes[i + 1] == 0x82 && bytes[i + 2] == 0xA6 {
                // Found ₦, check if followed by digits
                if i + 3 < len && bytes[i + 3].is_ascii_digit() {
                    return true;
                }
            }
        }
        
        // Quick scan for "NGN" or "ngn"
        let text_lower = text.to_lowercase();
        if text_lower.contains("ngn") {
            // Check if followed by space and digit
            if let Some(pos) = text_lower.find("ngn") {
                let after = &text_lower[pos + 3..];
                if after.trim_start().chars().next().map_or(false, |c| c.is_ascii_digit()) {
                    return true;
                }
            }
        }
        
        // Quick scan for "k" suffix patterns (50k, 100k)
        for i in 0..len {
            if (bytes[i] == b'k' || bytes[i] == b'K') && i > 0 {
                // Check if preceded by digit
                if bytes[i - 1].is_ascii_digit() {
                    // Check if followed by space or end or non-letter
                    if i + 1 >= len || !bytes[i + 1].is_ascii_alphabetic() {
                        return true;
                    }
                }
            }
        }
        
        // Quick scan for common seller signals
        let signals = [
            "dm for", "dm to", "whatsapp", "available", "in stock",
            "delivery", "pay on delivery", "bank transfer",
        ];
        
        for signal in signals.iter() {
            if text_lower.contains(signal) {
                return true;
            }
        }
        
        false
    }
    
    /// Extract price value from K/M suffix pattern
    #[wasm_bindgen]
    pub fn parse_k_suffix(&self, text: &str) -> Option<f64> {
        let text_lower = text.to_lowercase();
        let bytes = text_lower.as_bytes();
        let len = bytes.len();
        
        for i in 0..len {
            if bytes[i] == b'k' && i > 0 {
                // Find start of number
                let mut start = i - 1;
                while start > 0 && (bytes[start - 1].is_ascii_digit() || bytes[start - 1] == b'.') {
                    start -= 1;
                }
                
                // Parse number
                let num_str = &text_lower[start..i];
                if let Ok(num) = num_str.parse::<f64>() {
                    return Some(num * 1000.0);
                }
            } else if bytes[i] == b'm' && i > 0 {
                let mut start = i - 1;
                while start > 0 && (bytes[start - 1].is_ascii_digit() || bytes[start - 1] == b'.') {
                    start -= 1;
                }
                
                let num_str = &text_lower[start..i];
                if let Ok(num) = num_str.parse::<f64>() {
                    return Some(num * 1_000_000.0);
                }
            }
        }
        
        None
    }
}

/// SIMD-optimized pixel operations (when available)
/// Falls back to scalar operations on unsupported platforms
#[cfg(target_feature = "simd128")]
mod simd_ops {
    use std::arch::wasm32::*;
    
    /// SIMD grayscale conversion (processes 4 pixels at once)
    pub fn grayscale_simd(data: &[u8], output: &mut [u8]) {
        let len = data.len();
        let chunks = len / 16;
        
        // Coefficients as f32x4
        let r_coef = f32x4_splat(0.299);
        let g_coef = f32x4_splat(0.587);
        let b_coef = f32x4_splat(0.114);
        
        for i in 0..chunks {
            let base = i * 16;
            
            // Load 4 pixels (16 bytes)
            let r = f32x4(
                data[base] as f32,
                data[base + 4] as f32,
                data[base + 8] as f32,
                data[base + 12] as f32,
            );
            let g = f32x4(
                data[base + 1] as f32,
                data[base + 5] as f32,
                data[base + 9] as f32,
                data[base + 13] as f32,
            );
            let b = f32x4(
                data[base + 2] as f32,
                data[base + 6] as f32,
                data[base + 10] as f32,
                data[base + 14] as f32,
            );
            
            // Compute grayscale: 0.299*R + 0.587*G + 0.114*B
            let gray = f32x4_add(
                f32x4_add(f32x4_mul(r, r_coef), f32x4_mul(g, g_coef)),
                f32x4_mul(b, b_coef),
            );
            
            // Extract and store
            let g0 = f32x4_extract_lane::<0>(gray) as u8;
            let g1 = f32x4_extract_lane::<1>(gray) as u8;
            let g2 = f32x4_extract_lane::<2>(gray) as u8;
            let g3 = f32x4_extract_lane::<3>(gray) as u8;
            
            output[base] = g0; output[base + 1] = g0; output[base + 2] = g0; output[base + 3] = data[base + 3];
            output[base + 4] = g1; output[base + 5] = g1; output[base + 6] = g1; output[base + 7] = data[base + 7];
            output[base + 8] = g2; output[base + 9] = g2; output[base + 10] = g2; output[base + 11] = data[base + 11];
            output[base + 12] = g3; output[base + 13] = g3; output[base + 14] = g3; output[base + 15] = data[base + 15];
        }
    }
    
    /// SIMD contrast enhancement
    pub fn contrast_simd(data: &[u8], output: &mut [u8], factor: f32) {
        let len = data.len();
        let chunks = len / 16;
        
        let mid = f32x4_splat(128.0);
        let factor_v = f32x4_splat(factor);
        let zero = f32x4_splat(0.0);
        let max = f32x4_splat(255.0);
        
        for i in 0..chunks {
            let base = i * 16;
            
            for j in 0..4 {
                let idx = base + j * 4;
                
                let pixels = f32x4(
                    data[idx] as f32,
                    data[idx + 1] as f32,
                    data[idx + 2] as f32,
                    0.0,
                );
                
                // adjusted = mid + (pixel - mid) * factor
                let diff = f32x4_sub(pixels, mid);
                let scaled = f32x4_mul(diff, factor_v);
                let adjusted = f32x4_add(mid, scaled);
                
                // Clamp to [0, 255]
                let clamped = f32x4_max(zero, f32x4_min(max, adjusted));
                
                output[idx] = f32x4_extract_lane::<0>(clamped) as u8;
                output[idx + 1] = f32x4_extract_lane::<1>(clamped) as u8;
                output[idx + 2] = f32x4_extract_lane::<2>(clamped) as u8;
                output[idx + 3] = data[idx + 3];
            }
        }
    }
}

/// Non-SIMD fallback implementations
#[cfg(not(target_feature = "simd128"))]
mod simd_ops {
    pub fn grayscale_simd(data: &[u8], output: &mut [u8]) {
        for i in (0..data.len()).step_by(4) {
            if i + 3 < data.len() {
                let gray = (0.299 * data[i] as f32 
                          + 0.587 * data[i + 1] as f32 
                          + 0.114 * data[i + 2] as f32) as u8;
                output[i] = gray;
                output[i + 1] = gray;
                output[i + 2] = gray;
                output[i + 3] = data[i + 3];
            }
        }
    }
    
    pub fn contrast_simd(data: &[u8], output: &mut [u8], factor: f32) {
        let mid = 128.0f32;
        for i in (0..data.len()).step_by(4) {
            if i + 3 < data.len() {
                for j in 0..3 {
                    let adjusted = mid + (data[i + j] as f32 - mid) * factor;
                    output[i + j] = adjusted.max(0.0).min(255.0) as u8;
                }
                output[i + 3] = data[i + 3];
            }
        }
    }
}

/// SIMD-enabled image processor
#[wasm_bindgen]
pub struct SimdImageProcessor {
    width: u32,
    height: u32,
    buffer: Vec<u8>,
}

#[wasm_bindgen]
impl SimdImageProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> SimdImageProcessor {
        let size = (width * height * 4) as usize;
        SimdImageProcessor {
            width,
            height,
            buffer: vec![0u8; size],
        }
    }
    
    /// Check if SIMD is available
    #[wasm_bindgen]
    pub fn simd_available() -> bool {
        cfg!(target_feature = "simd128")
    }
    
    /// Grayscale with SIMD when available
    #[wasm_bindgen]
    pub fn to_grayscale(&mut self, data: &[u8]) -> Vec<u8> {
        let len = data.len();
        if self.buffer.len() < len {
            self.buffer.resize(len, 0);
        }
        
        simd_ops::grayscale_simd(data, &mut self.buffer);
        
        self.buffer[..len].to_vec()
    }
    
    /// Contrast enhancement with SIMD when available
    #[wasm_bindgen]
    pub fn enhance_contrast(&mut self, data: &[u8], factor: f32) -> Vec<u8> {
        let len = data.len();
        if self.buffer.len() < len {
            self.buffer.resize(len, 0);
        }
        
        simd_ops::contrast_simd(data, &mut self.buffer, factor);
        
        self.buffer[..len].to_vec()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_integral_image() {
        // 2x2 grayscale image (RGBA format)
        let data = vec![
            100, 100, 100, 255,  // (0,0)
            150, 150, 150, 255,  // (1,0)
            200, 200, 200, 255,  // (0,1)
            250, 250, 250, 255,  // (1,1)
        ];
        
        let integral = IntegralImage::new(&data, 2, 2);
        
        // Test local mean at center
        let mean = integral.get_local_mean(0, 0, 3);
        assert!(mean > 0.0);
    }
    
    #[test]
    fn test_fast_commerce_parser() {
        let parser = FastCommerceParser::new(0.5);
        
        assert!(parser.quick_scan("iPhone for sale 50k"));
        assert!(parser.quick_scan("DM for price"));
        assert!(parser.quick_scan("Available in stock"));
        assert!(!parser.quick_scan("Hello world"));
    }
    
    #[test]
    fn test_k_suffix_parsing() {
        let parser = FastCommerceParser::new(0.5);
        
        assert_eq!(parser.parse_k_suffix("50k"), Some(50000.0));
        assert_eq!(parser.parse_k_suffix("1.5m"), Some(1500000.0));
    }
}
