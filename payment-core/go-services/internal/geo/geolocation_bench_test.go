package geo

import (
	"fmt"
	"testing"
	"time"
)

// BenchmarkGeoServiceLookup measures GeoService cache hit performance
func BenchmarkGeoServiceLookup(b *testing.B) {
	config := DefaultGeoConfig()
	svc := NewGeoService(config)

	// Pre-populate cache with lookups
	for i := 0; i < 100; i++ {
		ip := fmt.Sprintf("10.0.%d.%d", i/256, i%256)
		_, _ = svc.Lookup(ip)
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			ip := fmt.Sprintf("10.0.%d.%d", i/256, i%256)
			_, _ = svc.Lookup(ip)
			i++
			if i >= 100 {
				i = 0
			}
		}
	})
}

// BenchmarkGeoServiceCacheMiss measures cache miss path
func BenchmarkGeoServiceCacheMiss(b *testing.B) {
	config := DefaultGeoConfig()
	svc := NewGeoService(config)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ip := fmt.Sprintf("192.168.%d.%d", (i/256)%256, i%256)
		_, _ = svc.Lookup(ip)
	}
}

// BenchmarkGeoServiceIsHighRisk measures risk assessment speed
func BenchmarkGeoServiceIsHighRisk(b *testing.B) {
	config := DefaultGeoConfig()
	svc := NewGeoService(config)

	// Pre-warm
	_, _ = svc.Lookup("105.112.45.67")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		svc.IsHighRisk("105.112.45.67")
	}
}

// BenchmarkVelocityCheck measures impossible travel detection
func BenchmarkVelocityCheck(b *testing.B) {
	config := DefaultGeoConfig()
	svc := NewGeoService(config)

	// Pre-warm both IPs
	_, _ = svc.Lookup("105.112.45.67")
	_, _ = svc.Lookup("78.47.100.200")

	lastLogin := time.Now().Add(-30 * time.Minute)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		svc.VelocityCheck("78.47.100.200", "105.112.45.67", lastLogin)
	}
}

// BenchmarkBatchLookup measures concurrent batch performance
func BenchmarkBatchLookup(b *testing.B) {
	config := DefaultGeoConfig()
	svc := NewGeoService(config)

	ips := make([]string, 100)
	for i := range ips {
		ips[i] = fmt.Sprintf("172.16.%d.%d", i/256, i%256)
	}

	// Pre-warm
	svc.BatchLookup(ips)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		svc.BatchLookup(ips)
	}
}

// BenchmarkGeolocationServiceCacheLookup measures the HTTP-based service cache
func BenchmarkGeolocationServiceCacheLookup(b *testing.B) {
	svc := NewGeolocationService()
	svc.SetCacheTTL(24 * time.Hour)

	// Pre-populate cache via GetCachedGeolocation won't work directly,
	// so we use the internal cache map (same package)
	svc.mu.Lock()
	for i := 0; i < 10000; i++ {
		ip := fmt.Sprintf("10.%d.%d.%d", i/65536, (i/256)%256, i%256)
		svc.cache[ip] = &cachedGeo{
			data: &GeolocationData{
				IP:        ip,
				Country:   "NG",
				City:      "Lagos",
				Region:    "Lagos",
				Latitude:  "6.5244",
				Longitude: "3.3792",
			},
			timestamp: time.Now(),
		}
	}
	svc.mu.Unlock()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			ip := fmt.Sprintf("10.%d.%d.%d", i/65536, (i/256)%256, i%256)
			svc.GetCachedGeolocation(ip)
			i++
			if i >= 10000 {
				i = 0
			}
		}
	})
}

// BenchmarkGeolocationServiceConcurrentReads measures cache under concurrent pressure
func BenchmarkGeolocationServiceConcurrentReads(b *testing.B) {
	svc := NewGeolocationService()
	svc.SetCacheTTL(24 * time.Hour)

	// Pre-populate
	svc.mu.Lock()
	for i := 0; i < 1000; i++ {
		ip := fmt.Sprintf("172.16.%d.%d", i/256, i%256)
		svc.cache[ip] = &cachedGeo{
			data: &GeolocationData{
				IP:      ip,
				Country: "NG",
				City:    "Lagos",
			},
			timestamp: time.Now(),
		}
	}
	svc.mu.Unlock()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			ip := fmt.Sprintf("172.16.%d.%d", i/256, i%256)
			svc.GetCachedGeolocation(ip)
			i++
			if i >= 1000 {
				i = 0
			}
		}
	})
}
