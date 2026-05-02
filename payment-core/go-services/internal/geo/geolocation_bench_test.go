package geo

import (
	"fmt"
	"testing"
	"time"
)

// BenchmarkCacheLookup measures geo cache hit performance
func BenchmarkCacheLookup(b *testing.B) {
	svc := NewGeolocationService()
	svc.SetCacheTTL(24 * time.Hour)

	// Pre-populate cache with 10K IPs
	for i := 0; i < 10000; i++ {
		ip := fmt.Sprintf("10.%d.%d.%d", i/65536, (i/256)%256, i%256)
		svc.cacheResult(ip, &GeolocationData{
			IP:        ip,
			Country:   "NG",
			City:      "Lagos",
			Region:    "Lagos",
			Latitude:  "6.5244",
			Longitude: "3.3792",
		})
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			ip := fmt.Sprintf("10.%d.%d.%d", i/65536, (i/256)%256, i%256)
			svc.lookupCache(ip)
			i++
			if i >= 10000 {
				i = 0
			}
		}
	})
}

// BenchmarkCacheMiss measures cache miss path (no external call)
func BenchmarkCacheMiss(b *testing.B) {
	svc := NewGeolocationService()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		svc.lookupCache(fmt.Sprintf("192.168.%d.%d", i/256, i%256))
	}
}

// BenchmarkRiskScoring measures IP risk assessment speed
func BenchmarkRiskScoring(b *testing.B) {
	svc := NewGeolocationService()

	geo := &GeolocationData{
		IP:        "105.112.45.67",
		Country:   "NG",
		City:      "Lagos",
		Region:    "Lagos",
		Latitude:  "6.5244",
		Longitude: "3.3792",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		svc.CalculateRiskScore(geo, "NG")
	}
}

// BenchmarkVelocityCheck measures impossible travel detection
func BenchmarkVelocityCheck(b *testing.B) {
	svc := NewGeolocationService()

	// Pre-populate with previous locations
	for i := 0; i < 100; i++ {
		svc.RecordAccess("user-1", &GeolocationData{
			IP:        fmt.Sprintf("105.112.%d.%d", i/256, i%256),
			Country:   "NG",
			City:      "Lagos",
			Latitude:  "6.5244",
			Longitude: "3.3792",
		})
	}

	newGeo := &GeolocationData{
		IP:        "78.47.100.200",
		Country:   "DE",
		City:      "Berlin",
		Latitude:  "52.5200",
		Longitude: "13.4050",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		svc.CheckImpossibleTravel("user-1", newGeo)
	}
}

// BenchmarkConcurrentReads measures cache under concurrent pressure
func BenchmarkConcurrentReads(b *testing.B) {
	svc := NewGeolocationService()
	svc.SetCacheTTL(24 * time.Hour)

	// Pre-populate
	for i := 0; i < 1000; i++ {
		ip := fmt.Sprintf("172.16.%d.%d", i/256, i%256)
		svc.cacheResult(ip, &GeolocationData{
			IP:      ip,
			Country: "NG",
			City:    "Lagos",
		})
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			ip := fmt.Sprintf("172.16.%d.%d", i/256, i%256)
			svc.lookupCache(ip)
			i++
			if i >= 1000 {
				i = 0
			}
		}
	})
}
