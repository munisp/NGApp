#!/usr/bin/env python3
"""54Bank Video KYC — Remote video verification sessions
Agent assignment, WebRTC signaling, recording, liveness integration, verdict capture.
DeepFace integration: real-time facial attribute analysis (emotion, engagement, stress)
during video KYC sessions for agent decision support.
Middleware: Kafka, Postgres, Redis, Temporal, Permify, OpenSearch
"""
import os, json, logging, uuid
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone, timedelta

logging.basicConfig(level=logging.INFO, format="[video-kyc-py] %(levelname)s %(message)s")
PORT = int(os.environ.get("PORT", "9462"))
LIVENESS_INFERENCE_URL = os.environ.get("LIVENESS_INFERENCE_URL", "http://localhost:8230")

sessions = []
agents = [
    {"id": "AGT-001", "name": "Adaeze Okonkwo", "status": "available", "queue": 0, "rating": 4.8, "sessions_today": 3},
    {"id": "AGT-002", "name": "Babatunde Ojo", "status": "available", "queue": 0, "rating": 4.6, "sessions_today": 5},
    {"id": "AGT-003", "name": "Chioma Eze", "status": "busy", "queue": 2, "rating": 4.9, "sessions_today": 7},
]
stats = {"total_sessions": 0, "completed": 0, "approved": 0, "rejected": 0, "dropped": 0,
    "avg_duration_min": 8.5, "agent_utilization": 0.65, "queue_wait_avg_sec": 45}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        p = urlparse(self.path).path.rstrip("/")
        if p in ("/healthz", "/health"):
            self._j(200, {"service": "video-kyc-py", "status": "healthy", "version": "2.0.0",
                "domain": "Video KYC — Remote Verification",
                "capabilities": ["webrtc_signaling", "agent_assignment", "session_recording",
                    "liveness_integration", "document_capture", "verdict_workflow",
                    "queue_management", "agent_dashboard", "quality_monitoring",
                    "deepface_emotion_tracking", "engagement_scoring",
                    "stress_detection", "facial_attribute_analysis"],
                "middleware": {"kafka": "video-kyc.sessions, video-kyc.verdicts, video-kyc.recordings",
                    "postgres": "video_kyc_sessions, video_kyc_verdicts, video_kyc_recordings",
                    "redis": "webrtc_signaling, agent_availability, session_state",
                    "temporal": "VideoKYCSessionWorkflow",
                    "permify": "video-kyc:conduct, video-kyc:review",
                    "opensearch": "video-kyc-2026"}})
        elif p == "/v1/video-kyc/sessions":
            self._j(200, {"sessions": sessions, "total": len(sessions)})
        elif p == "/v1/video-kyc/agents":
            self._j(200, {"agents": agents, "available": sum(1 for a in agents if a["status"] == "available")})
        elif p == "/v1/video-kyc/queue":
            queued = [s for s in sessions if s["status"] == "queued"]
            self._j(200, {"queue": queued, "total": len(queued), "est_wait_sec": len(queued) * 45})
        elif p == "/v1/video-kyc/stats": self._j(200, stats)
        elif p.startswith("/v1/video-kyc/sessions/"):
            sid = p.split("/")[-1]
            s = next((x for x in sessions if x["id"] == sid), None)
            self._j(200, s) if s else self._j(404, {"error": f"Not found: {sid}"})
        else: self._j(404, {"error": "Not found"})

    def do_POST(self):
        p = urlparse(self.path).path.rstrip("/")
        cl = int(self.headers.get("Content-Length", 0))
        b = json.loads(self.rfile.read(cl)) if cl > 0 else {}
        if p == "/v1/video-kyc/sessions": self._create_session(b)
        elif p.endswith("/join-agent"): self._join_agent(p.split("/")[-2], b)
        elif p.endswith("/capture-document"): self._capture_doc(p.split("/")[-2], b)
        elif p.endswith("/trigger-liveness"): self._trigger_live(p.split("/")[-2], b)
        elif p.endswith("/verdict"): self._verdict(p.split("/")[-2], b)
        elif p.endswith("/end"): self._end_session(p.split("/")[-2], b)
        elif p.endswith("/analyze-frame"): self._analyze_frame(p.split("/")[-2], b)
        elif p.endswith("/engagement-report"): self._engagement_report(p.split("/")[-2], b)
        else: self._j(404, {"error": "Not found"})

    def _create_session(self, b):
        sid = f"VKYC-{uuid.uuid4().hex[:8].upper()}"; now = datetime.now(timezone.utc)
        avail = [a for a in agents if a["status"] == "available"]
        agent = min(avail, key=lambda a: a["queue"]) if avail else None
        s = {"id": sid, "applicationId": b.get("applicationId", ""), "customerId": b.get("customerId", ""),
            "status": "queued" if not agent else "agent_assigned",
            "agent": {"id": agent["id"], "name": agent["name"]} if agent else None,
            "webrtcOffer": None, "webrtcAnswer": None, "iceServers": [
                {"urls": "stun:stun.54bank.ng:3478"},
                {"urls": "turn:turn.54bank.ng:3478", "username": "vkyc", "credential": "ephemeral"}],
            "documentsCapture": [], "livenessResult": None, "verdict": None,
            "recordingUrl": None, "duration_sec": 0,
            "createdAt": now.isoformat(), "expiresAt": (now + timedelta(minutes=30)).isoformat()}
        if agent: agent["status"] = "busy"; agent["queue"] += 1
        sessions.append(s); stats["total_sessions"] += 1
        self._j(201, {"created": True, "session": s})

    def _join_agent(self, sid, b):
        s = next((x for x in sessions if x["id"] == sid), None)
        if not s: self._j(404, {"error": f"Not found: {sid}"}); return
        s["webrtcOffer"] = b.get("sdpOffer"); s["status"] = "in_progress"
        self._j(200, {"joined": True, "sdpAnswer": "v=0\r\no=- 0 0 IN IP4 0.0.0.0\r\ns=VideoKYC\r\n"})

    def _capture_doc(self, sid, b):
        s = next((x for x in sessions if x["id"] == sid), None)
        if not s: self._j(404, {"error": f"Not found: {sid}"}); return
        doc = {"type": b.get("documentType", "national_id"), "capturedAt": datetime.now(timezone.utc).isoformat(),
            "ocrPending": True, "quality": b.get("quality", 0.85)}
        s["documentsCapture"].append(doc)
        self._j(200, {"captured": True, "document": doc, "ocr_routing": "paddleocr_v4"})

    def _trigger_live(self, sid, b):
        s = next((x for x in sessions if x["id"] == sid), None)
        if not s: self._j(404, {"error": f"Not found: {sid}"}); return
        s["livenessResult"] = {"triggered": True, "sessionId": f"LIV-{uuid.uuid4().hex[:6].upper()}",
            "methods": ["passive_3d", "blink_challenge"]}
        self._j(200, s["livenessResult"])

    def _verdict(self, sid, b):
        s = next((x for x in sessions if x["id"] == sid), None)
        if not s: self._j(404, {"error": f"Not found: {sid}"}); return
        v = b.get("verdict", "approved"); s["verdict"] = {"result": v, "reason": b.get("reason", ""),
            "agentNotes": b.get("notes", ""), "issuedAt": datetime.now(timezone.utc).isoformat()}
        s["status"] = "verdict_issued"
        if v == "approved": stats["approved"] += 1
        else: stats["rejected"] += 1
        self._j(200, {"verdict_issued": True, "session": s})

    def _end_session(self, sid, b):
        s = next((x for x in sessions if x["id"] == sid), None)
        if not s: self._j(404, {"error": f"Not found: {sid}"}); return
        s["status"] = "completed"; stats["completed"] += 1
        if s.get("agent"):
            ag = next((a for a in agents if a["id"] == s["agent"]["id"]), None)
            if ag: ag["status"] = "available"; ag["queue"] = max(0, ag["queue"] - 1)
        self._j(200, {"ended": True, "session": s})

    def _analyze_frame(self, sid, b):
        """Analyze a video KYC frame using DeepFace facial attributes.
        Returns emotion, engagement score, stress indicators for agent dashboard.
        Calls liveness-inference-py /v1/face/analyze which uses DeepFace.
        """
        s = next((x for x in sessions if x["id"] == sid), None)
        if not s: self._j(404, {"error": f"Not found: {sid}"}); return

        image_data = b.get("image", "")
        frame_num = b.get("frameNumber", 0)

        # Call liveness-inference-py DeepFace facial analysis
        try:
            import urllib.request
            req_data = json.dumps({"image": image_data, "customerId": s.get("customerId", "")}).encode()
            req = urllib.request.Request(f"{LIVENESS_INFERENCE_URL}/v1/face/analyze",
                data=req_data, headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=5) as resp:
                analysis = json.loads(resp.read())
        except Exception:
            # Fallback analysis when inference service unavailable
            analysis = {
                "age": 30, "dominant_gender": "unknown",
                "dominant_emotion": "neutral", "emotion": {"neutral": 0.8, "happy": 0.1, "sad": 0.05, "angry": 0.03, "fear": 0.02},
                "engine": "fallback"
            }

        # Calculate engagement and stress scores from emotion distribution
        emotions = analysis.get("emotion", {})
        positive_emotions = emotions.get("happy", 0) + emotions.get("surprise", 0)
        negative_emotions = emotions.get("angry", 0) + emotions.get("fear", 0) + emotions.get("sad", 0) + emotions.get("disgust", 0)
        neutral = emotions.get("neutral", 0)

        engagement_score = min((positive_emotions + neutral * 0.5) / 100 + 0.3, 1.0)
        stress_score = min(negative_emotions / 100 + 0.05, 1.0)
        cooperation_score = min(engagement_score * 0.6 + (1 - stress_score) * 0.4, 1.0)

        # Agent decision support indicators
        alerts = []
        if stress_score > 0.5: alerts.append("high_stress_detected")
        if emotions.get("fear", 0) > 30: alerts.append("fear_indicator")
        if engagement_score < 0.3: alerts.append("low_engagement")
        if analysis.get("dominant_emotion") == "angry": alerts.append("frustration_detected")

        frame_analysis = {
            "session_id": sid,
            "frame_number": frame_num,
            "facial_attributes": analysis,
            "engagement_score": round(engagement_score, 3),
            "stress_score": round(stress_score, 3),
            "cooperation_score": round(cooperation_score, 3),
            "dominant_emotion": analysis.get("dominant_emotion", "neutral"),
            "age_estimate": analysis.get("age", 0),
            "gender_estimate": analysis.get("dominant_gender", "unknown"),
            "agent_alerts": alerts,
            "engine": analysis.get("engine", "deepface"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # Store frame analysis on session
        if "frame_analyses" not in s: s["frame_analyses"] = []
        s["frame_analyses"].append(frame_analysis)
        # Keep only last 30 frames
        if len(s["frame_analyses"]) > 30: s["frame_analyses"] = s["frame_analyses"][-30:]

        self._j(200, frame_analysis)

    def _engagement_report(self, sid, b):
        """Generate engagement report for a video KYC session.
        Aggregates frame-by-frame emotion/engagement/stress data.
        """
        s = next((x for x in sessions if x["id"] == sid), None)
        if not s: self._j(404, {"error": f"Not found: {sid}"}); return

        frames = s.get("frame_analyses", [])
        if not frames:
            self._j(200, {"session_id": sid, "error": "no_frames_analyzed",
                "note": "Call /analyze-frame during the session to collect data"})
            return

        # Aggregate metrics
        avg_engagement = sum(f["engagement_score"] for f in frames) / len(frames)
        avg_stress = sum(f["stress_score"] for f in frames) / len(frames)
        avg_cooperation = sum(f["cooperation_score"] for f in frames) / len(frames)

        # Emotion distribution across session
        emotion_counts = {}
        for f in frames:
            em = f.get("dominant_emotion", "neutral")
            emotion_counts[em] = emotion_counts.get(em, 0) + 1
        total_frames = len(frames)
        emotion_pct = {k: round(v / total_frames * 100, 1) for k, v in emotion_counts.items()}

        # Alert summary
        all_alerts = []
        for f in frames:
            all_alerts.extend(f.get("agent_alerts", []))
        alert_counts = {}
        for a in all_alerts: alert_counts[a] = alert_counts.get(a, 0) + 1

        # Overall assessment
        if avg_engagement > 0.7 and avg_stress < 0.2:
            assessment = "cooperative_and_relaxed"
        elif avg_stress > 0.5:
            assessment = "elevated_stress_throughout"
        elif avg_engagement < 0.3:
            assessment = "disengaged_or_distracted"
        else:
            assessment = "normal_interaction"

        self._j(200, {
            "session_id": sid,
            "total_frames_analyzed": total_frames,
            "avg_engagement_score": round(avg_engagement, 3),
            "avg_stress_score": round(avg_stress, 3),
            "avg_cooperation_score": round(avg_cooperation, 3),
            "emotion_distribution_pct": emotion_pct,
            "alert_summary": alert_counts,
            "overall_assessment": assessment,
            "recommendation": "proceed" if assessment in ("cooperative_and_relaxed", "normal_interaction") else "review_required",
            "powered_by": "deepface_facial_analysis",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    def _j(self, code, data):
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())
    def log_message(self, f, *a): pass

if __name__ == "__main__":
    logging.info(f"Video KYC v3.0 (DeepFace-enhanced) on :{PORT}")
    logging.info(f"Inference service: {LIVENESS_INFERENCE_URL}")
    logging.info("DeepFace features: emotion tracking, engagement scoring, stress detection")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
