pub struct RateLimiter {
    limit: u64,
    window_sec: u64,
    remaining: u64,
}

impl RateLimiter {
    pub fn new(limit: u64, window: u64) -> Self {
        RateLimiter { limit, window_sec: window, remaining: limit }
    }
    pub fn limit(&self) -> u64 { self.limit }
    pub fn remaining(&self) -> u64 { self.remaining }
    pub fn window_sec(&self) -> u64 { self.window_sec }

    pub fn allow(&mut self) -> bool {
        if self.remaining > 0 {
            self.remaining -= 1;
            true
        } else {
            false
        }
    }
}
