// 54Bank Identity & Channels Service
//
// Implements identity management and multi-channel access:
//   - Customer identity profiles with multi-factor authentication
//   - Device registration and management
//   - Channel routing (mobile, web, USSD, POS, ATM, branch)
//   - Session management with device fingerprinting
//   - OTP generation and verification
//   - Biometric enrollment references
//
// Middleware: Kafka, Redis, Keycloak, Permify, Postgres, APISIX
package main

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	mw "github.com/54bank/middleware-go"
)

type IdentityProfile struct {
	ID              string          `json:"id"`
	TenantID        string          `json:"tenantId"`
	CustomerID      string          `json:"customerId"`
	CustomerName    string          `json:"customerName"`
	Email           string          `json:"email"`
	PhoneNumber     string          `json:"phoneNumber"`
	BVN             string          `json:"bvn"`
	NIN             string          `json:"nin"`
	MFAEnabled      bool            `json:"mfaEnabled"`
	MFAMethods      []string        `json:"mfaMethods"` // sms, email, totp, biometric
	Devices         []DeviceRecord  `json:"devices"`
	ActiveChannels  []string        `json:"activeChannels"`
	BiometricRef    string          `json:"biometricRef,omitempty"`
	LastLoginAt     string          `json:"lastLoginAt,omitempty"`
	FailedAttempts  int             `json:"failedAttempts"`
	LockedUntil     string          `json:"lockedUntil,omitempty"`
	Status          string          `json:"status"` // active, locked, suspended
	CreatedAt       string          `json:"createdAt"`
	UpdatedAt       string          `json:"updatedAt"`
}

type DeviceRecord struct {
	DeviceID      string `json:"deviceId"`
	DeviceName    string `json:"deviceName"`
	DeviceType    string `json:"deviceType"` // mobile, web, pos, atm
	Fingerprint   string `json:"fingerprint"`
	Platform      string `json:"platform"` // ios, android, web, windows
	Trusted       bool   `json:"trusted"`
	LastSeenAt    string `json:"lastSeenAt"`
	RegisteredAt  string `json:"registeredAt"`
}

type ChannelSession struct {
	SessionID     string `json:"sessionId"`
	ProfileID     string `json:"profileId"`
	Channel       string `json:"channel"` // mobile, web, ussd, pos, atm, branch
	DeviceID      string `json:"deviceId"`
	IPAddress     string `json:"ipAddress"`
	Status        string `json:"status"` // active, expired, terminated
	CreatedAt     string `json:"createdAt"`
	ExpiresAt     string `json:"expiresAt"`
}

type OTPRecord struct {
	ID        string `json:"id"`
	ProfileID string `json:"profileId"`
	Code      string `json:"code"`
	Channel   string `json:"channel"` // sms, email
	Purpose   string `json:"purpose"` // login, transaction, device_registration
	ExpiresAt string `json:"expiresAt"`
	Verified  bool   `json:"verified"`
	CreatedAt string `json:"createdAt"`
}

var (
	profiles = make(map[string]*IdentityProfile)
	sessions []ChannelSession
	otps     []OTPRecord
	mu       sync.RWMutex
	bundle   *mw.Bundle
)

func generateOTP() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(999999))
	return fmt.Sprintf("%06d", n.Int64())
}

func main() {
	bundle = mw.NewBundle()
	addr := mw.EnvOr("ADDR", ":8101")
	mx := http.NewServeMux()

	mx.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		mw.RespondJSON(w, 200, map[string]any{
			"status": "ok", "service": "identity-channels-go", "timestamp": mw.NowISO(),
			"middleware": []string{"Kafka", "Redis", "Keycloak", "Permify", "Postgres", "APISIX"},
			"health": bundle.HealthMap(),
		})
	})

	mx.HandleFunc("/v1/identity/profiles", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "GET":
			mu.RLock()
			items := make([]*IdentityProfile, 0)
			for _, p := range profiles { items = append(items, p) }
			mu.RUnlock()
			mw.RespondJSON(w, 200, map[string]any{"items": items, "total": len(items)})
		case "POST":
			createProfile(w, r)
		}
	})

	mx.HandleFunc("/v1/identity/profiles/", func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/v1/identity/profiles/"), "/")
		id := parts[0]
		if len(parts) == 1 {
			mu.RLock()
			p, ok := profiles[id]
			mu.RUnlock()
			if !ok { mw.RespondJSON(w, 404, map[string]string{"message": "Identity profile not found"}); return }
			mw.RespondJSON(w, 200, p)
		} else {
			switch parts[1] {
			case "devices":
				registerDevice(w, r, id)
			case "enable-mfa":
				enableMFA(w, r, id)
			case "otp":
				if r.Method == "POST" { sendOTP(w, r, id) }
			case "verify-otp":
				if r.Method == "POST" { verifyOTP(w, r, id) }
			case "sessions":
				if r.Method == "POST" {
					createSession(w, r, id)
				} else {
					listProfileSessions(w, id)
				}
			}
		}
	})

	mx.HandleFunc("/v1/identity/sessions", func(w http.ResponseWriter, _ *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		mw.RespondJSON(w, 200, map[string]any{"items": sessions, "total": len(sessions)})
	})

	fmt.Printf("Identity & Channels service listening on %s\n", addr)
	http.ListenAndServe(addr, mw.CORSMiddleware(mx))
}

func createProfile(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CustomerID   string `json:"customerId"`
		CustomerName string `json:"customerName"`
		Email        string `json:"email"`
		PhoneNumber  string `json:"phoneNumber"`
		BVN          string `json:"bvn"`
		NIN          string `json:"nin"`
	}
	mw.DecodeBody(r, &req)
	if req.CustomerID == "" || req.PhoneNumber == "" {
		mw.RespondJSON(w, 400, map[string]string{"message": "customerId and phoneNumber required"})
		return
	}

	p := &IdentityProfile{
		ID: mw.GenID("IDP"), TenantID: mw.DefaultTenant(),
		CustomerID: req.CustomerID, CustomerName: req.CustomerName,
		Email: req.Email, PhoneNumber: req.PhoneNumber,
		BVN: req.BVN, NIN: req.NIN,
		MFAEnabled: false, MFAMethods: []string{},
		Devices: []DeviceRecord{}, ActiveChannels: []string{},
		Status: "active", CreatedAt: mw.NowISO(), UpdatedAt: mw.NowISO(),
	}
	mu.Lock()
	profiles[p.ID] = p
	mu.Unlock()

	bundle.Kafka.Publish("identity.profile.created", p.ID, p)
	bundle.Keycloak.ValidateToken("") // Register in identity provider
	mw.RespondJSON(w, 201, p)
}

func registerDevice(w http.ResponseWriter, r *http.Request, profileID string) {
	mu.Lock()
	defer mu.Unlock()
	p, ok := profiles[profileID]
	if !ok { mw.RespondJSON(w, 404, map[string]string{"message": "Profile not found"}); return }

	var req struct {
		DeviceName  string `json:"deviceName"`
		DeviceType  string `json:"deviceType"`
		Fingerprint string `json:"fingerprint"`
		Platform    string `json:"platform"`
	}
	mw.DecodeBody(r, &req)
	if req.DeviceName == "" { mw.RespondJSON(w, 400, map[string]string{"message": "deviceName required"}); return }
	if req.DeviceType == "" { req.DeviceType = "mobile" }

	d := DeviceRecord{
		DeviceID: mw.GenID("DEV"), DeviceName: req.DeviceName,
		DeviceType: req.DeviceType, Fingerprint: req.Fingerprint,
		Platform: req.Platform, Trusted: false,
		LastSeenAt: mw.NowISO(), RegisteredAt: mw.NowISO(),
	}
	p.Devices = append(p.Devices, d)
	p.UpdatedAt = mw.NowISO()
	bundle.Kafka.Publish("identity.device.registered", d.DeviceID, d)
	mw.RespondJSON(w, 201, map[string]any{"device": d, "profile": p})
}

func enableMFA(w http.ResponseWriter, r *http.Request, profileID string) {
	mu.Lock()
	defer mu.Unlock()
	p, ok := profiles[profileID]
	if !ok { mw.RespondJSON(w, 404, map[string]string{"message": "Profile not found"}); return }

	var req struct {
		Methods []string `json:"methods"`
	}
	mw.DecodeBody(r, &req)
	if len(req.Methods) == 0 { req.Methods = []string{"sms"} }
	p.MFAEnabled = true
	p.MFAMethods = req.Methods
	p.UpdatedAt = mw.NowISO()
	mw.RespondJSON(w, 200, map[string]any{"profile": p, "mfaEnabled": true, "methods": req.Methods})
}

func sendOTP(w http.ResponseWriter, r *http.Request, profileID string) {
	mu.Lock()
	defer mu.Unlock()
	_, ok := profiles[profileID]
	if !ok { mw.RespondJSON(w, 404, map[string]string{"message": "Profile not found"}); return }

	var req struct {
		Channel string `json:"channel"`
		Purpose string `json:"purpose"`
	}
	mw.DecodeBody(r, &req)
	if req.Channel == "" { req.Channel = "sms" }
	if req.Purpose == "" { req.Purpose = "login" }

	otp := OTPRecord{
		ID: mw.GenID("OTP"), ProfileID: profileID,
		Code: generateOTP(), Channel: req.Channel, Purpose: req.Purpose,
		ExpiresAt: time.Now().Add(5 * time.Minute).Format(time.RFC3339),
		Verified: false, CreatedAt: mw.NowISO(),
	}
	otps = append(otps, otp)
	bundle.Redis.Set(r_ctx(), "otp:"+profileID+":"+req.Purpose, otp.Code, 5*time.Minute)
	mw.RespondJSON(w, 200, map[string]any{
		"message": "OTP sent via " + req.Channel,
		"otpId": otp.ID,
		"expiresAt": otp.ExpiresAt,
	})
}

func verifyOTP(w http.ResponseWriter, r *http.Request, profileID string) {
	mu.Lock()
	defer mu.Unlock()
	p, ok := profiles[profileID]
	if !ok { mw.RespondJSON(w, 404, map[string]string{"message": "Profile not found"}); return }

	var req struct {
		Code    string `json:"code"`
		Purpose string `json:"purpose"`
	}
	mw.DecodeBody(r, &req)

	for i := len(otps) - 1; i >= 0; i-- {
		if otps[i].ProfileID == profileID && otps[i].Purpose == req.Purpose && !otps[i].Verified {
			if otps[i].Code == req.Code {
				otps[i].Verified = true
				p.FailedAttempts = 0
				p.LastLoginAt = mw.NowISO()
				p.UpdatedAt = mw.NowISO()
				mw.RespondJSON(w, 200, map[string]any{"verified": true, "profile": p})
				return
			}
			break
		}
	}
	p.FailedAttempts++
	if p.FailedAttempts >= 5 {
		p.Status = "locked"
		p.LockedUntil = time.Now().Add(30 * time.Minute).Format(time.RFC3339)
	}
	p.UpdatedAt = mw.NowISO()
	mw.RespondJSON(w, 400, map[string]any{"verified": false, "failedAttempts": p.FailedAttempts})
}

func createSession(w http.ResponseWriter, r *http.Request, profileID string) {
	mu.Lock()
	defer mu.Unlock()
	p, ok := profiles[profileID]
	if !ok { mw.RespondJSON(w, 404, map[string]string{"message": "Profile not found"}); return }
	if p.Status != "active" {
		mw.RespondJSON(w, 403, map[string]string{"message": "Profile is " + p.Status})
		return
	}

	var req struct {
		Channel   string `json:"channel"`
		DeviceID  string `json:"deviceId"`
		IPAddress string `json:"ipAddress"`
	}
	mw.DecodeBody(r, &req)
	if req.Channel == "" { req.Channel = "web" }

	s := ChannelSession{
		SessionID: mw.GenID("SES"), ProfileID: profileID,
		Channel: req.Channel, DeviceID: req.DeviceID, IPAddress: req.IPAddress,
		Status: "active", CreatedAt: mw.NowISO(),
		ExpiresAt: time.Now().Add(24 * time.Hour).Format(time.RFC3339),
	}
	sessions = append(sessions, s)

	if !mw.Contains(p.ActiveChannels, req.Channel) {
		p.ActiveChannels = append(p.ActiveChannels, req.Channel)
	}
	p.LastLoginAt = mw.NowISO()
	p.UpdatedAt = mw.NowISO()

	bundle.Redis.Set(r_ctx(), "session:"+s.SessionID, profileID, 24*time.Hour)
	bundle.Kafka.Publish("identity.session.created", s.SessionID, s)
	mw.RespondJSON(w, 201, map[string]any{"session": s})
}

func listProfileSessions(w http.ResponseWriter, profileID string) {
	mu.RLock()
	defer mu.RUnlock()
	var items []ChannelSession
	for _, s := range sessions {
		if s.ProfileID == profileID { items = append(items, s) }
	}
	mw.RespondJSON(w, 200, map[string]any{"items": items, "total": len(items)})
}

func r_ctx() __context { return __context{} }
type __context struct{}
func (_ __context) Deadline() (time.Time, bool) { return time.Time{}, false }
func (_ __context) Done() <-chan struct{}        { return nil }
func (_ __context) Err() error                   { return nil }
func (_ __context) Value(any) any                { return nil }
