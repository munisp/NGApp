package middleware

import (
	"testing"
	"time"
)

func TestRateLimiter_AllowBurst(t *testing.T) {
	rl := NewRateLimiter(10, 5, time.Second)

	for i := 0; i < 5; i++ {
		allowed, _, _ := rl.allow("client1")
		if !allowed {
			t.Errorf("request %d should be allowed within burst", i)
		}
	}

	allowed, _, _ := rl.allow("client1")
	if allowed {
		t.Error("request beyond burst should be denied")
	}
}

func TestRateLimiter_DifferentKeys(t *testing.T) {
	rl := NewRateLimiter(10, 2, time.Second)

	rl.allow("client1")
	rl.allow("client1")

	allowed, _, _ := rl.allow("client2")
	if !allowed {
		t.Error("different client should have its own limit")
	}
}

func TestRateLimiter_WindowReset(t *testing.T) {
	rl := NewRateLimiter(10, 1, 100*time.Millisecond)

	rl.allow("client1")
	allowed, _, _ := rl.allow("client1")
	if allowed {
		t.Error("should be denied after burst")
	}

	time.Sleep(150 * time.Millisecond)

	allowed, _, _ = rl.allow("client1")
	if !allowed {
		t.Error("should be allowed after window reset")
	}
}
