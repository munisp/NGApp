use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Anti-spoofing classification result
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpoofDetectionResult {
    pub is_spoof: bool,
    pub spoof_type: SpoofType,
    pub confidence: f64,
    pub attack_scores: AttackScores,
    pub recommendation: String,
    pub processing_ms: u64,
}

/// Types of spoofing attacks detected
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SpoofType {
    None,
    PrintedPhoto,
    ScreenReplay,
    PaperMask,
    ThreeDMask,
    Deepfake,
    HighQualityPhoto,
    Unknown,
}

/// Individual attack detection scores
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AttackScores {
    pub printed_photo: f64,
    pub screen_replay: f64,
    pub paper_mask: f64,
    pub three_d_mask: f64,
    pub deepfake: f64,
    pub high_quality_photo: f64,
}

/// Anti-spoofing engine with multiple detection modules
pub struct AntiSpoofingEngine {
    texture_analyzer: TextureAnalyzer,
    frequency_analyzer: FrequencyAnalyzer,
    depth_estimator: DepthEstimator,
    motion_analyzer: MotionAnalyzer,
    deepfake_detector: DeepfakeDetector,
    color_analyzer: ColorAnalyzer,
}

impl AntiSpoofingEngine {
    pub fn new() -> Self {
        Self {
            texture_analyzer: TextureAnalyzer::new(),
            frequency_analyzer: FrequencyAnalyzer::new(),
            depth_estimator: DepthEstimator::new(),
            motion_analyzer: MotionAnalyzer::new(),
            deepfake_detector: DeepfakeDetector::new(),
            color_analyzer: ColorAnalyzer::new(),
        }
    }

    /// Analyze a single image for spoofing
    pub fn analyze_single(&self, image_data: &[u8]) -> SpoofDetectionResult {
        let start = std::time::Instant::now();

        let texture_score = self.texture_analyzer.analyze(image_data);
        let frequency_score = self.frequency_analyzer.analyze(image_data);
        let depth_score = self.depth_estimator.estimate_single(image_data);
        let color_score = self.color_analyzer.analyze(image_data);
        let deepfake_score = self.deepfake_detector.analyze_single(image_data);

        let attack_scores = AttackScores {
            printed_photo: self.score_printed_photo(&texture_score, &frequency_score, &depth_score),
            screen_replay: self.score_screen_replay(&texture_score, &frequency_score, &color_score),
            paper_mask: self.score_paper_mask(&texture_score, &depth_score, &color_score),
            three_d_mask: self.score_3d_mask(&depth_score, &color_score, &texture_score),
            deepfake: deepfake_score.artifact_score,
            high_quality_photo: self.score_hq_photo(&texture_score, &depth_score, &frequency_score),
        };

        let (is_spoof, spoof_type, confidence) = self.classify(&attack_scores);

        let recommendation = match spoof_type {
            SpoofType::None => "Authentication may proceed".to_string(),
            SpoofType::PrintedPhoto => "Reject: printed photo attack detected".to_string(),
            SpoofType::ScreenReplay => "Reject: screen replay attack detected".to_string(),
            SpoofType::PaperMask => "Reject: paper mask attack detected".to_string(),
            SpoofType::ThreeDMask => "Reject: 3D mask attack detected, request active liveness".to_string(),
            SpoofType::Deepfake => "Reject: deepfake detected, escalate to manual review".to_string(),
            SpoofType::HighQualityPhoto => "Reject: high-quality photo attack, request active liveness".to_string(),
            SpoofType::Unknown => "Uncertain: request additional verification".to_string(),
        };

        SpoofDetectionResult {
            is_spoof,
            spoof_type,
            confidence,
            attack_scores,
            recommendation,
            processing_ms: start.elapsed().as_millis() as u64,
        }
    }

    /// Analyze video frames for spoofing
    pub fn analyze_video(&self, frames: &[Vec<u8>]) -> SpoofDetectionResult {
        let start = std::time::Instant::now();

        // Single-frame analysis on first frame
        let single_result = if let Some(first) = frames.first() {
            self.analyze_single(first)
        } else {
            return SpoofDetectionResult {
                is_spoof: true,
                spoof_type: SpoofType::Unknown,
                confidence: 0.0,
                attack_scores: AttackScores {
                    printed_photo: 0.0, screen_replay: 0.0, paper_mask: 0.0,
                    three_d_mask: 0.0, deepfake: 0.0, high_quality_photo: 0.0,
                },
                recommendation: "No frames provided".to_string(),
                processing_ms: 0,
            };
        };

        // Multi-frame temporal analysis
        let motion_score = self.motion_analyzer.analyze_sequence(frames);
        let temporal_deepfake = self.deepfake_detector.analyze_temporal(frames);

        let mut attack_scores = single_result.attack_scores.clone();

        // Adjust scores with temporal information
        // Static attack (photo/print): no real motion
        if motion_score.total_motion < 0.002 {
            attack_scores.printed_photo = (attack_scores.printed_photo + 0.3).min(1.0);
            attack_scores.high_quality_photo = (attack_scores.high_quality_photo + 0.3).min(1.0);
        }

        // Screen replay: periodic frame artifacts
        if motion_score.periodic_artifacts > 0.5 {
            attack_scores.screen_replay = (attack_scores.screen_replay + 0.25).min(1.0);
        }

        // Deepfake: temporal inconsistency
        attack_scores.deepfake = (attack_scores.deepfake * 0.5 + temporal_deepfake * 0.5).min(1.0);

        // 3D mask: motion present but abnormal pattern
        if motion_score.total_motion > 0.01 && motion_score.naturalness < 0.4 {
            attack_scores.three_d_mask = (attack_scores.three_d_mask + 0.2).min(1.0);
        }

        let (is_spoof, spoof_type, confidence) = self.classify(&attack_scores);

        let recommendation = if is_spoof {
            format!("Reject: {:?} attack detected (confidence: {:.1}%)", spoof_type, confidence * 100.0)
        } else {
            "Authentication may proceed".to_string()
        };

        SpoofDetectionResult {
            is_spoof,
            spoof_type,
            confidence,
            attack_scores,
            recommendation,
            processing_ms: start.elapsed().as_millis() as u64,
        }
    }

    fn classify(&self, scores: &AttackScores) -> (bool, SpoofType, f64) {
        let threshold = 0.6;
        let attacks = [
            (scores.printed_photo, SpoofType::PrintedPhoto),
            (scores.screen_replay, SpoofType::ScreenReplay),
            (scores.paper_mask, SpoofType::PaperMask),
            (scores.three_d_mask, SpoofType::ThreeDMask),
            (scores.deepfake, SpoofType::Deepfake),
            (scores.high_quality_photo, SpoofType::HighQualityPhoto),
        ];

        let mut max_score = 0.0_f64;
        let mut max_type = SpoofType::None;

        for (score, attack_type) in &attacks {
            if *score > max_score {
                max_score = *score;
                max_type = attack_type.clone();
            }
        }

        if max_score >= threshold {
            (true, max_type, max_score)
        } else {
            (false, SpoofType::None, 1.0 - max_score)
        }
    }

    fn score_printed_photo(&self, tex: &TextureScore, freq: &FrequencyScore, depth: &DepthScore) -> f64 {
        // Printed photos: flat depth, paper texture (low LBP entropy), JPEG artifacts
        let flat_penalty = if depth.depth_variance < 0.1 { 0.3 } else { 0.0 };
        let texture_penalty = if tex.lbp_entropy < 0.5 { 0.25 } else { 0.0 };
        let freq_penalty = if freq.high_freq_ratio < 0.2 { 0.2 } else { 0.0 };

        (flat_penalty + texture_penalty + freq_penalty + (1.0 - tex.naturalness) * 0.25).min(1.0)
    }

    fn score_screen_replay(&self, tex: &TextureScore, freq: &FrequencyScore, color: &ColorScore) -> f64 {
        // Screen replay: moiré patterns, pixel grid in frequency, color shift
        let moire_penalty = freq.moire_energy * 0.4;
        let pixel_grid = if freq.high_freq_ratio > 0.7 { 0.3 } else { 0.0 };
        let color_shift = if color.color_temperature_deviation > 0.3 { 0.2 } else { 0.0 };

        (moire_penalty + pixel_grid + color_shift + (1.0 - tex.naturalness) * 0.1).min(1.0)
    }

    fn score_paper_mask(&self, tex: &TextureScore, depth: &DepthScore, color: &ColorScore) -> f64 {
        // Paper mask: flat but with some 3D curvature, unnatural texture, wrong skin color
        let depth_penalty = if depth.depth_variance < 0.15 && depth.depth_variance > 0.03 { 0.25 } else { 0.0 };
        let texture_penalty = if tex.uniformity > 0.7 { 0.3 } else { 0.0 };
        let color_penalty = if color.skin_likelihood < 0.4 { 0.25 } else { 0.0 };

        (depth_penalty + texture_penalty + color_penalty + (1.0 - tex.naturalness) * 0.2).min(1.0)
    }

    fn score_3d_mask(&self, depth: &DepthScore, color: &ColorScore, tex: &TextureScore) -> f64 {
        // 3D masks: proper depth but abnormal material properties
        let material_penalty = if tex.lbp_entropy > 0.9 { 0.2 } else { 0.0 }; // too uniform = synthetic material
        let color_penalty = if color.skin_likelihood < 0.5 { 0.2 } else { 0.0 };
        let specular_penalty = if tex.specular_anomaly > 0.5 { 0.25 } else { 0.0 };

        (material_penalty + color_penalty + specular_penalty + (1.0 - color.subsurface_scatter) * 0.35).min(1.0)
    }

    fn score_hq_photo(&self, tex: &TextureScore, depth: &DepthScore, freq: &FrequencyScore) -> f64 {
        // High-quality photo: good texture but flat depth, no motion
        let flat_penalty = if depth.depth_variance < 0.08 { 0.35 } else { 0.0 };
        let sharpness = if freq.sharpness > 0.8 { 0.15 } else { 0.0 }; // too sharp for real capture
        let noise_pattern = if tex.noise_uniformity > 0.8 { 0.2 } else { 0.0 };

        (flat_penalty + sharpness + noise_pattern + (1.0 - tex.naturalness) * 0.3).min(1.0)
    }
}

// --- Texture Analyzer ---

struct TextureAnalyzer;

#[derive(Debug)]
struct TextureScore {
    lbp_entropy: f64,
    naturalness: f64,
    uniformity: f64,
    specular_anomaly: f64,
    noise_uniformity: f64,
}

impl TextureAnalyzer {
    fn new() -> Self { Self }

    fn analyze(&self, data: &[u8]) -> TextureScore {
        if data.len() < 256 {
            return TextureScore { lbp_entropy: 0.5, naturalness: 0.5, uniformity: 0.5, specular_anomaly: 0.0, noise_uniformity: 0.5 };
        }

        let width = (data.len() as f64).sqrt() as usize;
        if width < 3 {
            return TextureScore { lbp_entropy: 0.5, naturalness: 0.5, uniformity: 0.5, specular_anomaly: 0.0, noise_uniformity: 0.5 };
        }

        // LBP histogram
        let mut lbp_hist = [0u32; 256];
        let mut total = 0u32;
        let offsets: [(isize, isize); 8] = [(-1, -1), (-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1)];

        for row in 1..data.len() / width - 1 {
            for col in 1..width - 1 {
                let idx = row * width + col;
                let center = data[idx];
                let mut lbp: u8 = 0;
                for (bit, (dy, dx)) in offsets.iter().enumerate() {
                    let ni = (row as isize + dy) as usize * width + (col as isize + dx) as usize;
                    if ni < data.len() && data[ni] >= center {
                        lbp |= 1 << bit;
                    }
                }
                lbp_hist[lbp as usize] += 1;
                total += 1;
            }
        }

        let lbp_entropy = if total > 0 {
            let mut entropy = 0.0;
            for &count in &lbp_hist {
                if count > 0 {
                    let p = count as f64 / total as f64;
                    entropy -= p * p.log2();
                }
            }
            entropy / 8.0
        } else { 0.5 };

        // Noise uniformity: variance of local noise
        let mut noise_vals = Vec::new();
        for i in (width + 1)..data.len().saturating_sub(width + 1) {
            if i % width > 0 && i % width < width - 1 {
                let local_mean = (data[i - 1] as f64 + data[i + 1] as f64 + data[i.wrapping_sub(width)] as f64 + data[i + width] as f64) / 4.0;
                noise_vals.push((data[i] as f64 - local_mean).abs());
            }
            if noise_vals.len() > 10000 { break; }
        }

        let noise_uniformity = if noise_vals.len() > 10 {
            let mean: f64 = noise_vals.iter().sum::<f64>() / noise_vals.len() as f64;
            let var: f64 = noise_vals.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / noise_vals.len() as f64;
            1.0 - (var / 100.0).min(1.0)
        } else { 0.5 };

        // Specular anomaly
        let highlight_count = data.iter().filter(|&&b| b > 245).count();
        let highlight_ratio = highlight_count as f64 / data.len() as f64;
        let specular_anomaly = if highlight_ratio > 0.03 { highlight_ratio * 10.0 } else { 0.0 };

        // Naturalness: real skin has specific LBP entropy range
        let naturalness = if lbp_entropy >= 0.55 && lbp_entropy <= 0.85 {
            0.7 + (1.0 - ((lbp_entropy - 0.70).abs() / 0.15)) * 0.3
        } else {
            (0.5 - (lbp_entropy - 0.70).abs() * 2.0).max(0.0)
        };

        // Uniformity
        let non_zero_bins = lbp_hist.iter().filter(|&&c| c > 0).count();
        let uniformity = 1.0 - (non_zero_bins as f64 / 256.0);

        TextureScore { lbp_entropy, naturalness, uniformity, specular_anomaly: specular_anomaly.min(1.0), noise_uniformity }
    }
}

// --- Frequency Analyzer ---

struct FrequencyAnalyzer;

#[derive(Debug)]
struct FrequencyScore {
    high_freq_ratio: f64,
    moire_energy: f64,
    sharpness: f64,
}

impl FrequencyAnalyzer {
    fn new() -> Self { Self }

    fn analyze(&self, data: &[u8]) -> FrequencyScore {
        if data.len() < 64 {
            return FrequencyScore { high_freq_ratio: 0.5, moire_energy: 0.0, sharpness: 0.5 };
        }

        let width = (data.len() as f64).sqrt() as usize;

        // Compute gradient energy at different scales
        let mut low_energy = 0.0_f64;
        let mut high_energy = 0.0_f64;
        let mut moire_energy = 0.0_f64;
        let mut samples = 0usize;

        for row in 2..data.len() / width - 2 {
            for col in 2..width - 2 {
                let idx = row * width + col;
                if idx + width * 2 >= data.len() { break; }

                // First derivative (edges)
                let gx = (data[idx + 1] as f64) - (data[idx.wrapping_sub(1)] as f64);
                let gy = (data[idx + width] as f64) - (data[idx.wrapping_sub(width)] as f64);
                low_energy += gx.abs() + gy.abs();

                // Second derivative (fine detail / noise)
                let laplacian = data[idx.wrapping_sub(1)] as f64 + data[idx + 1] as f64
                    + data[idx.wrapping_sub(width)] as f64 + data[idx + width] as f64
                    - 4.0 * data[idx] as f64;
                high_energy += laplacian.abs();

                // Moiré: periodic oscillation in second derivative
                if col >= 4 {
                    let prev_lap = data[idx.wrapping_sub(3)] as f64 + data[idx.wrapping_sub(1)] as f64
                        + data[idx.wrapping_sub(width + 2)] as f64 + data[idx + width - 2] as f64
                        - 4.0 * data[idx.wrapping_sub(2)] as f64;
                    if (laplacian > 0.0) != (prev_lap > 0.0) {
                        moire_energy += laplacian.abs();
                    }
                }

                samples += 1;
            }
            if samples > 50000 { break; }
        }

        let total_energy = low_energy + high_energy;
        let high_freq_ratio = if total_energy > 0.0 { high_energy / total_energy } else { 0.5 };
        let moire_ratio = if high_energy > 0.0 { (moire_energy / high_energy).min(1.0) } else { 0.0 };
        let sharpness = if samples > 0 { (high_energy / samples as f64 / 50.0).min(1.0) } else { 0.5 };

        FrequencyScore { high_freq_ratio, moire_energy: moire_ratio, sharpness }
    }
}

// --- Depth Estimator ---

struct DepthEstimator;

#[derive(Debug)]
struct DepthScore {
    depth_variance: f64,
}

impl DepthEstimator {
    fn new() -> Self { Self }

    fn estimate_single(&self, data: &[u8]) -> DepthScore {
        if data.len() < 1024 {
            return DepthScore { depth_variance: 0.1 };
        }

        let width = (data.len() as f64).sqrt() as usize;
        let block_size = width / 8;
        if block_size < 4 {
            return DepthScore { depth_variance: 0.1 };
        }

        // Compute gradient magnitude per block (proxy for depth variation)
        let mut block_gradients = Vec::new();
        let height = data.len() / width;

        for by in 0..8 {
            for bx in 0..8 {
                let mut grad_sum = 0.0;
                let mut count = 0;
                for y in (by * block_size + 1)..((by + 1) * block_size).min(height - 1) {
                    for x in (bx * block_size + 1)..((bx + 1) * block_size).min(width - 1) {
                        let idx = y * width + x;
                        if idx + width < data.len() {
                            let gx = (data[idx + 1] as f64 - data[idx.wrapping_sub(1)] as f64).abs();
                            let gy = (data[idx + width] as f64 - data[idx.wrapping_sub(width)] as f64).abs();
                            grad_sum += (gx * gx + gy * gy).sqrt();
                            count += 1;
                        }
                    }
                }
                if count > 0 {
                    block_gradients.push(grad_sum / count as f64);
                }
            }
        }

        if block_gradients.is_empty() {
            return DepthScore { depth_variance: 0.1 };
        }

        let mean: f64 = block_gradients.iter().sum::<f64>() / block_gradients.len() as f64;
        let variance: f64 = block_gradients.iter().map(|g| (g - mean).powi(2)).sum::<f64>() / block_gradients.len() as f64;

        // Normalize variance to 0-1 range
        let depth_variance = (variance / 500.0).min(1.0);

        DepthScore { depth_variance }
    }
}

// --- Motion Analyzer ---

struct MotionAnalyzer;

struct MotionScore {
    total_motion: f64,
    periodic_artifacts: f64,
    naturalness: f64,
}

impl MotionAnalyzer {
    fn new() -> Self { Self }

    fn analyze_sequence(&self, frames: &[Vec<u8>]) -> MotionScore {
        if frames.len() < 2 {
            return MotionScore { total_motion: 0.0, periodic_artifacts: 0.0, naturalness: 0.0 };
        }

        let mut diffs = Vec::new();
        for i in 1..frames.len() {
            let diff = self.frame_diff(&frames[i - 1], &frames[i]);
            diffs.push(diff);
        }

        let total_motion: f64 = diffs.iter().sum::<f64>() / diffs.len() as f64;

        // Check for periodic artifacts (screen refresh rate patterns)
        let periodic_artifacts = if diffs.len() >= 4 {
            let mut autocorr = 0.0;
            let mean = total_motion;
            for i in 2..diffs.len() {
                autocorr += (diffs[i] - mean) * (diffs[i - 2] - mean);
            }
            (autocorr.abs() / diffs.len() as f64).min(1.0)
        } else { 0.0 };

        // Naturalness: real motion has smooth, non-periodic characteristics
        let naturalness = if diffs.len() >= 3 {
            let mut jerk = 0.0;
            for i in 1..diffs.len() {
                jerk += (diffs[i] - diffs[i - 1]).abs();
            }
            let avg_jerk = jerk / (diffs.len() - 1) as f64;
            (1.0 - avg_jerk * 50.0).max(0.0).min(1.0)
        } else { 0.5 };

        MotionScore { total_motion, periodic_artifacts, naturalness }
    }

    fn frame_diff(&self, a: &[u8], b: &[u8]) -> f64 {
        let len = a.len().min(b.len());
        if len == 0 { return 0.0; }
        let mut diff_sum = 0.0;
        for i in 0..len {
            diff_sum += (a[i] as f64 - b[i] as f64).abs();
        }
        diff_sum / (len as f64 * 255.0)
    }
}

// --- Deepfake Detector ---

struct DeepfakeDetector;

impl DeepfakeDetector {
    fn new() -> Self { Self }

    fn analyze_single(&self, data: &[u8]) -> DeepfakeScore {
        if data.len() < 1024 {
            return DeepfakeScore { artifact_score: 0.3, boundary_score: 0.5 };
        }

        let width = (data.len() as f64).sqrt() as usize;

        // Detect GAN checkerboard upsampling artifacts
        let mut checkerboard_sum = 0.0;
        let mut boundary_anomaly = 0.0;
        let mut samples = 0usize;
        let mut edge_samples = 0usize;

        for row in 1..data.len() / width - 1 {
            for col in 1..width - 1 {
                let idx = row * width + col;
                if idx + width + 1 >= data.len() { break; }

                let a = data[idx] as f64;
                let b = data[idx + 1] as f64;
                let c = data[idx + width] as f64;
                let d = data[idx + width + 1] as f64;

                let cross = (a - d).abs() + (b - c).abs();
                let adj = (a - b).abs() + (a - c).abs();
                if adj > 1.0 {
                    checkerboard_sum += cross / adj;
                }
                samples += 1;

                // Boundary analysis at strong edges
                let gx = (data[idx + 1] as f64 - data[idx.wrapping_sub(1)] as f64).abs();
                let gy = (data[idx + width] as f64 - data[idx.wrapping_sub(width)] as f64).abs();
                if gx > 40.0 || gy > 40.0 {
                    let neighbors = [
                        idx.wrapping_sub(width + 1), idx.wrapping_sub(width), idx.wrapping_sub(width.wrapping_sub(1)),
                        idx.wrapping_sub(1), idx + 1,
                        idx + width - 1, idx + width, idx + width + 1,
                    ];
                    let mut edge_var = 0.0;
                    let mut valid = 0;
                    for &ni in &neighbors {
                        if ni < data.len() {
                            edge_var += (data[idx] as f64 - data[ni] as f64).powi(2);
                            valid += 1;
                        }
                    }
                    if valid > 0 {
                        boundary_anomaly += edge_var / valid as f64;
                        edge_samples += 1;
                    }
                }
            }
            if samples > 50000 { break; }
        }

        let avg_checkerboard = if samples > 0 { checkerboard_sum / samples as f64 } else { 1.0 };
        let avg_boundary = if edge_samples > 0 { boundary_anomaly / edge_samples as f64 } else { 0.0 };

        // Artifact score: high checkerboard ratio = likely GAN
        let artifact_score = if avg_checkerboard > 1.3 {
            ((avg_checkerboard - 1.0) * 0.8).min(1.0)
        } else {
            (1.0 - avg_checkerboard).max(0.0) * 0.3
        };

        let boundary_score = (avg_boundary / 3000.0).min(1.0);

        DeepfakeScore { artifact_score: (artifact_score + boundary_score * 0.3).min(1.0), boundary_score }
    }

    fn analyze_temporal(&self, frames: &[Vec<u8>]) -> f64 {
        if frames.len() < 3 {
            return 0.3;
        }

        // Look for temporal inconsistencies: sudden jumps in face region
        let mut inconsistencies = 0.0;
        let mut comparisons = 0;

        for i in 2..frames.len() {
            let diff_prev = frame_similarity(&frames[i - 2], &frames[i - 1]);
            let diff_curr = frame_similarity(&frames[i - 1], &frames[i]);

            // Real faces: smooth transition. Deepfakes: occasional temporal glitches
            let jump = (diff_curr - diff_prev).abs();
            if jump > 0.02 { // significant temporal discontinuity
                inconsistencies += jump;
            }
            comparisons += 1;
        }

        if comparisons == 0 { return 0.3; }

        (inconsistencies / comparisons as f64 * 20.0).min(1.0)
    }
}

#[derive(Debug)]
struct DeepfakeScore {
    artifact_score: f64,
    boundary_score: f64,
}

// --- Color Analyzer ---

struct ColorAnalyzer;

#[derive(Debug)]
struct ColorScore {
    skin_likelihood: f64,
    color_temperature_deviation: f64,
    subsurface_scatter: f64,
}

impl ColorAnalyzer {
    fn new() -> Self { Self }

    fn analyze(&self, data: &[u8]) -> ColorScore {
        if data.len() < 256 {
            return ColorScore { skin_likelihood: 0.5, color_temperature_deviation: 0.5, subsurface_scatter: 0.5 };
        }

        // Intensity histogram analysis
        let mut hist = [0u32; 256];
        for &b in data {
            hist[b as usize] += 1;
        }

        let total = data.len() as f64;
        let mean: f64 = data.iter().map(|&b| b as f64).sum::<f64>() / total;

        let variance: f64 = data.iter().map(|&b| (b as f64 - mean).powi(2)).sum::<f64>() / total;

        // Skin tone likelihood: real skin has mean ~100-180 and moderate variance
        let skin_likelihood = if mean >= 80.0 && mean <= 200.0 && variance >= 300.0 && variance <= 5000.0 {
            0.7 + (1.0 - ((mean - 140.0).abs() / 60.0)).max(0.0) * 0.3
        } else {
            0.2
        };

        // Color temperature deviation: printed/screen images have shifted color temps
        let high_end_ratio = hist[200..].iter().map(|&c| c as f64).sum::<f64>() / total;
        let low_end_ratio = hist[..50].iter().map(|&c| c as f64).sum::<f64>() / total;
        let color_temperature_deviation = (high_end_ratio - low_end_ratio).abs();

        // Subsurface scattering approximation: real skin has gradual intensity transitions
        let mut smooth_transitions = 0usize;
        let mut total_transitions = 0usize;
        for i in 1..data.len().min(10000) {
            let diff = (data[i] as i16 - data[i - 1] as i16).unsigned_abs();
            total_transitions += 1;
            if diff < 10 {
                smooth_transitions += 1;
            }
        }

        let subsurface_scatter = if total_transitions > 0 {
            smooth_transitions as f64 / total_transitions as f64
        } else { 0.5 };

        ColorScore { skin_likelihood, color_temperature_deviation, subsurface_scatter }
    }
}

fn frame_similarity(a: &[u8], b: &[u8]) -> f64 {
    let len = a.len().min(b.len());
    if len == 0 { return 0.0; }
    let mut diff = 0.0;
    for i in 0..len {
        diff += (a[i] as f64 - b[i] as f64).abs();
    }
    diff / (len as f64 * 255.0)
}

fn main() {
    let engine = AntiSpoofingEngine::new();

    // Example: analyze a test image
    let test_image = vec![128u8; 10000]; // grayscale placeholder
    let result = engine.analyze_single(&test_image);

    println!("{}", serde_json::to_string_pretty(&result).unwrap());

    // Example: video analysis
    let frames: Vec<Vec<u8>> = (0..10).map(|i| {
        (0..10000).map(|j| ((j + i * 7) % 256) as u8).collect()
    }).collect();

    let video_result = engine.analyze_video(&frames);
    println!("{}", serde_json::to_string_pretty(&video_result).unwrap());
}
