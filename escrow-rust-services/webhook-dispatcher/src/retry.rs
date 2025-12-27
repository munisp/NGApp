//! Retry policy with exponential backoff and jitter

use chrono::{DateTime, Duration, Utc};
use rand::Rng;

pub struct RetryPolicy {
    pub base_delay_secs: i64,
    pub max_delay_secs: i64,
    pub jitter_factor: f64,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            base_delay_secs: 60,
            max_delay_secs: 3600,
            jitter_factor: 0.2,
        }
    }
}

impl RetryPolicy {
    pub fn next_retry_time(&self, attempt: i32) -> DateTime<Utc> {
        let delay = self.calculate_delay(attempt);
        Utc::now() + Duration::seconds(delay)
    }

    fn calculate_delay(&self, attempt: i32) -> i64 {
        let exponential_delay = self.base_delay_secs * 2_i64.pow(attempt as u32 - 1);
        let capped_delay = exponential_delay.min(self.max_delay_secs);
        
        let jitter_range = (capped_delay as f64 * self.jitter_factor) as i64;
        let jitter = if jitter_range > 0 {
            rand::thread_rng().gen_range(-jitter_range..=jitter_range)
        } else {
            0
        };
        
        (capped_delay + jitter).max(1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exponential_backoff() {
        let policy = RetryPolicy {
            base_delay_secs: 60,
            max_delay_secs: 3600,
            jitter_factor: 0.0,
        };

        assert_eq!(policy.calculate_delay(1), 60);
        assert_eq!(policy.calculate_delay(2), 120);
        assert_eq!(policy.calculate_delay(3), 240);
        assert_eq!(policy.calculate_delay(4), 480);
        assert_eq!(policy.calculate_delay(5), 960);
        assert_eq!(policy.calculate_delay(6), 1920);
        assert_eq!(policy.calculate_delay(7), 3600);
    }

    #[test]
    fn test_max_delay_cap() {
        let policy = RetryPolicy {
            base_delay_secs: 60,
            max_delay_secs: 300,
            jitter_factor: 0.0,
        };

        assert_eq!(policy.calculate_delay(10), 300);
    }
}
