"""
WebRTC Signaling Server for P2P Verification

Provides real-time peer-to-peer verification for:
- Proof-of-Delivery live verification
- Buyer/Seller video confirmation
- Agent network verification
- Dispute evidence capture

Features:
- WebSocket-based signaling
- STUN/TURN server configuration
- Session management
- Frame capture and hashing
- Evidence persistence

Designed for Nigerian carrier NATs with TURN fallback.
"""

import os
import json
import logging
import asyncio
import hashlib
import uuid
from typing import Any, Dict, List, Optional, Set
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict

logger = logging.getLogger(__name__)

# Configuration
WEBRTC_ENABLED = os.getenv("WEBRTC_ENABLED", "true").lower() == "true"
STUN_SERVERS = os.getenv("STUN_SERVERS", "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302").split(",")
TURN_SERVER = os.getenv("TURN_SERVER", "")
TURN_USERNAME = os.getenv("TURN_USERNAME", "")
TURN_CREDENTIAL = os.getenv("TURN_CREDENTIAL", "")
SESSION_TIMEOUT_MINUTES = int(os.getenv("WEBRTC_SESSION_TIMEOUT", "30"))


class SessionState(str, Enum):
    """WebRTC session states"""
    CREATED = "created"
    WAITING = "waiting"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    VERIFYING = "verifying"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"


class ParticipantRole(str, Enum):
    """Participant roles in verification"""
    BUYER = "buyer"
    SELLER = "seller"
    AGENT = "agent"
    ARBITER = "arbiter"


@dataclass
class Participant:
    """WebRTC session participant"""
    id: str
    role: ParticipantRole
    user_id: str
    connected: bool = False
    connection_id: Optional[str] = None
    ice_candidates: List[Dict[str, Any]] = field(default_factory=list)
    sdp_offer: Optional[str] = None
    sdp_answer: Optional[str] = None
    joined_at: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "role": self.role.value,
            "user_id": self.user_id,
            "connected": self.connected,
            "joined_at": self.joined_at,
        }


@dataclass
class CapturedFrame:
    """Captured video frame for evidence"""
    id: str
    session_id: str
    participant_id: str
    timestamp: str
    frame_hash: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    stored: bool = False
    storage_url: Optional[str] = None


@dataclass
class VerificationSession:
    """WebRTC verification session"""
    id: str
    escrow_id: str
    verification_type: str  # "delivery", "dispute", "agent"
    state: SessionState
    participants: Dict[str, Participant] = field(default_factory=dict)
    captured_frames: List[CapturedFrame] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    expires_at: str = field(default_factory=lambda: (datetime.utcnow() + timedelta(minutes=SESSION_TIMEOUT_MINUTES)).isoformat())
    result: Optional[str] = None
    evidence_hash: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "escrow_id": self.escrow_id,
            "verification_type": self.verification_type,
            "state": self.state.value,
            "participants": {k: v.to_dict() for k, v in self.participants.items()},
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "expires_at": self.expires_at,
            "result": self.result,
            "frame_count": len(self.captured_frames),
        }


class WebRTCSignalingServer:
    """
    WebSocket-based signaling server for WebRTC connections.
    Handles SDP offer/answer exchange and ICE candidate relay.
    """
    
    def __init__(self):
        self.sessions: Dict[str, VerificationSession] = {}
        self.connections: Dict[str, Any] = {}  # connection_id -> websocket
        self.user_connections: Dict[str, Set[str]] = defaultdict(set)  # user_id -> connection_ids
        self.connection_sessions: Dict[str, str] = {}  # connection_id -> session_id
        self._cleanup_task: Optional[asyncio.Task] = None
    
    async def start(self):
        """Start the signaling server"""
        self._cleanup_task = asyncio.create_task(self._cleanup_expired_sessions())
        logger.info("WebRTC signaling server started")
    
    async def stop(self):
        """Stop the signaling server"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        logger.info("WebRTC signaling server stopped")
    
    def get_ice_servers(self) -> List[Dict[str, Any]]:
        """Get ICE server configuration"""
        servers = []
        
        # Add STUN servers
        for stun in STUN_SERVERS:
            if stun:
                servers.append({"urls": stun})
        
        # Add TURN server if configured
        if TURN_SERVER and TURN_USERNAME and TURN_CREDENTIAL:
            servers.append({
                "urls": TURN_SERVER,
                "username": TURN_USERNAME,
                "credential": TURN_CREDENTIAL,
            })
        
        return servers
    
    async def create_session(
        self,
        escrow_id: str,
        verification_type: str,
        initiator_user_id: str,
        initiator_role: ParticipantRole,
    ) -> VerificationSession:
        """Create a new verification session"""
        session_id = f"vs-{uuid.uuid4().hex[:12]}"
        
        session = VerificationSession(
            id=session_id,
            escrow_id=escrow_id,
            verification_type=verification_type,
            state=SessionState.CREATED,
        )
        
        # Add initiator as first participant
        participant = Participant(
            id=f"p-{uuid.uuid4().hex[:8]}",
            role=initiator_role,
            user_id=initiator_user_id,
        )
        session.participants[participant.id] = participant
        
        self.sessions[session_id] = session
        logger.info(f"Created verification session {session_id} for escrow {escrow_id}")
        
        return session
    
    async def join_session(
        self,
        session_id: str,
        user_id: str,
        role: ParticipantRole,
        connection_id: str,
    ) -> Optional[Participant]:
        """Join an existing session"""
        session = self.sessions.get(session_id)
        if not session:
            logger.warning(f"Session {session_id} not found")
            return None
        
        if session.state in [SessionState.COMPLETED, SessionState.FAILED, SessionState.EXPIRED]:
            logger.warning(f"Session {session_id} is not joinable (state: {session.state})")
            return None
        
        # Check if user already in session
        for p in session.participants.values():
            if p.user_id == user_id:
                p.connected = True
                p.connection_id = connection_id
                p.joined_at = datetime.utcnow().isoformat()
                self.connection_sessions[connection_id] = session_id
                return p
        
        # Add new participant
        participant = Participant(
            id=f"p-{uuid.uuid4().hex[:8]}",
            role=role,
            user_id=user_id,
            connected=True,
            connection_id=connection_id,
            joined_at=datetime.utcnow().isoformat(),
        )
        session.participants[participant.id] = participant
        self.connection_sessions[connection_id] = session_id
        
        # Update session state
        if session.state == SessionState.CREATED:
            session.state = SessionState.WAITING
        
        # Check if all required participants joined
        connected_count = sum(1 for p in session.participants.values() if p.connected)
        if connected_count >= 2:
            session.state = SessionState.CONNECTING
            session.started_at = datetime.utcnow().isoformat()
        
        logger.info(f"User {user_id} joined session {session_id} as {role.value}")
        return participant
    
    async def handle_offer(
        self,
        session_id: str,
        participant_id: str,
        sdp: str,
    ) -> bool:
        """Handle SDP offer from participant"""
        session = self.sessions.get(session_id)
        if not session:
            return False
        
        participant = session.participants.get(participant_id)
        if not participant:
            return False
        
        participant.sdp_offer = sdp
        
        # Relay offer to other participants
        await self._relay_to_others(session, participant_id, {
            "type": "offer",
            "from": participant_id,
            "sdp": sdp,
        })
        
        return True
    
    async def handle_answer(
        self,
        session_id: str,
        participant_id: str,
        sdp: str,
    ) -> bool:
        """Handle SDP answer from participant"""
        session = self.sessions.get(session_id)
        if not session:
            return False
        
        participant = session.participants.get(participant_id)
        if not participant:
            return False
        
        participant.sdp_answer = sdp
        
        # Relay answer to other participants
        await self._relay_to_others(session, participant_id, {
            "type": "answer",
            "from": participant_id,
            "sdp": sdp,
        })
        
        return True
    
    async def handle_ice_candidate(
        self,
        session_id: str,
        participant_id: str,
        candidate: Dict[str, Any],
    ) -> bool:
        """Handle ICE candidate from participant"""
        session = self.sessions.get(session_id)
        if not session:
            return False
        
        participant = session.participants.get(participant_id)
        if not participant:
            return False
        
        participant.ice_candidates.append(candidate)
        
        # Relay candidate to other participants
        await self._relay_to_others(session, participant_id, {
            "type": "ice-candidate",
            "from": participant_id,
            "candidate": candidate,
        })
        
        return True
    
    async def handle_connected(
        self,
        session_id: str,
        participant_id: str,
    ) -> bool:
        """Handle peer connection established"""
        session = self.sessions.get(session_id)
        if not session:
            return False
        
        # Check if all participants connected
        all_connected = all(
            p.connected and (p.sdp_offer or p.sdp_answer)
            for p in session.participants.values()
        )
        
        if all_connected:
            session.state = SessionState.CONNECTED
            await self._broadcast_to_session(session, {
                "type": "session-connected",
                "session_id": session_id,
            })
        
        return True
    
    async def capture_frame(
        self,
        session_id: str,
        participant_id: str,
        frame_data: bytes,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[CapturedFrame]:
        """Capture and hash a video frame for evidence"""
        session = self.sessions.get(session_id)
        if not session:
            return None
        
        if session.state not in [SessionState.CONNECTED, SessionState.VERIFYING]:
            return None
        
        session.state = SessionState.VERIFYING
        
        # Hash the frame data
        frame_hash = hashlib.sha256(frame_data).hexdigest()
        
        frame = CapturedFrame(
            id=f"f-{uuid.uuid4().hex[:8]}",
            session_id=session_id,
            participant_id=participant_id,
            timestamp=datetime.utcnow().isoformat(),
            frame_hash=frame_hash,
            metadata=metadata or {},
        )
        
        session.captured_frames.append(frame)
        
        logger.info(f"Captured frame {frame.id} for session {session_id}")
        return frame
    
    async def complete_verification(
        self,
        session_id: str,
        result: str,
    ) -> Optional[VerificationSession]:
        """Complete the verification session"""
        session = self.sessions.get(session_id)
        if not session:
            return None
        
        session.state = SessionState.COMPLETED
        session.completed_at = datetime.utcnow().isoformat()
        session.result = result
        
        # Create evidence hash from all captured frames
        if session.captured_frames:
            evidence_data = json.dumps([
                {"id": f.id, "hash": f.frame_hash, "timestamp": f.timestamp}
                for f in session.captured_frames
            ], sort_keys=True)
            session.evidence_hash = hashlib.sha256(evidence_data.encode()).hexdigest()
        
        # Notify all participants
        await self._broadcast_to_session(session, {
            "type": "verification-complete",
            "session_id": session_id,
            "result": result,
            "evidence_hash": session.evidence_hash,
        })
        
        logger.info(f"Verification session {session_id} completed with result: {result}")
        return session
    
    async def fail_verification(
        self,
        session_id: str,
        reason: str,
    ) -> Optional[VerificationSession]:
        """Fail the verification session"""
        session = self.sessions.get(session_id)
        if not session:
            return None
        
        session.state = SessionState.FAILED
        session.completed_at = datetime.utcnow().isoformat()
        session.result = f"failed: {reason}"
        
        await self._broadcast_to_session(session, {
            "type": "verification-failed",
            "session_id": session_id,
            "reason": reason,
        })
        
        logger.info(f"Verification session {session_id} failed: {reason}")
        return session
    
    async def disconnect(self, connection_id: str):
        """Handle participant disconnect"""
        session_id = self.connection_sessions.pop(connection_id, None)
        if not session_id:
            return
        
        session = self.sessions.get(session_id)
        if not session:
            return
        
        # Find and update participant
        for participant in session.participants.values():
            if participant.connection_id == connection_id:
                participant.connected = False
                participant.connection_id = None
                
                # Notify others
                await self._relay_to_others(session, participant.id, {
                    "type": "participant-disconnected",
                    "participant_id": participant.id,
                })
                break
    
    async def get_session(self, session_id: str) -> Optional[VerificationSession]:
        """Get session by ID"""
        return self.sessions.get(session_id)
    
    async def get_sessions_for_escrow(self, escrow_id: str) -> List[VerificationSession]:
        """Get all sessions for an escrow"""
        return [s for s in self.sessions.values() if s.escrow_id == escrow_id]
    
    async def _relay_to_others(
        self,
        session: VerificationSession,
        sender_id: str,
        message: Dict[str, Any],
    ):
        """Relay message to other participants in session"""
        for participant in session.participants.values():
            if participant.id != sender_id and participant.connected and participant.connection_id:
                await self._send_to_connection(participant.connection_id, message)
    
    async def _broadcast_to_session(
        self,
        session: VerificationSession,
        message: Dict[str, Any],
    ):
        """Broadcast message to all participants in session"""
        for participant in session.participants.values():
            if participant.connected and participant.connection_id:
                await self._send_to_connection(participant.connection_id, message)
    
    async def _send_to_connection(self, connection_id: str, message: Dict[str, Any]):
        """Send message to a specific connection"""
        websocket = self.connections.get(connection_id)
        if websocket:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to connection {connection_id}: {e}")
    
    async def _cleanup_expired_sessions(self):
        """Periodically cleanup expired sessions"""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                
                now = datetime.utcnow()
                expired = []
                
                for session_id, session in self.sessions.items():
                    if session.state in [SessionState.COMPLETED, SessionState.FAILED]:
                        # Keep completed sessions for 1 hour
                        if session.completed_at:
                            completed = datetime.fromisoformat(session.completed_at)
                            if (now - completed).total_seconds() > 3600:
                                expired.append(session_id)
                    elif datetime.fromisoformat(session.expires_at) < now:
                        session.state = SessionState.EXPIRED
                        await self._broadcast_to_session(session, {
                            "type": "session-expired",
                            "session_id": session_id,
                        })
                        expired.append(session_id)
                
                for session_id in expired:
                    del self.sessions[session_id]
                    logger.info(f"Cleaned up session {session_id}")
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in session cleanup: {e}")


# Global signaling server instance
signaling_server = WebRTCSignalingServer()


# =============================================================================
# FASTAPI WEBSOCKET INTEGRATION
# =============================================================================

async def create_webrtc_router():
    """
    Create FastAPI router for WebRTC signaling.
    
    Usage:
        from webrtc_signaling import create_webrtc_router
        
        webrtc_router = await create_webrtc_router()
        app.include_router(webrtc_router, prefix="/api/v1/webrtc")
    """
    from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
    from fastapi.responses import JSONResponse
    
    router = APIRouter(tags=["WebRTC"])
    
    @router.get("/ice-servers")
    async def get_ice_servers():
        """Get ICE server configuration"""
        return {"servers": signaling_server.get_ice_servers()}
    
    @router.post("/sessions")
    async def create_session(
        escrow_id: str,
        verification_type: str,
        initiator_user_id: str,
        initiator_role: str,
    ):
        """Create a new verification session"""
        try:
            role = ParticipantRole(initiator_role)
        except ValueError:
            raise HTTPException(400, f"Invalid role: {initiator_role}")
        
        session = await signaling_server.create_session(
            escrow_id=escrow_id,
            verification_type=verification_type,
            initiator_user_id=initiator_user_id,
            initiator_role=role,
        )
        
        return session.to_dict()
    
    @router.get("/sessions/{session_id}")
    async def get_session(session_id: str):
        """Get session details"""
        session = await signaling_server.get_session(session_id)
        if not session:
            raise HTTPException(404, "Session not found")
        return session.to_dict()
    
    @router.post("/sessions/{session_id}/complete")
    async def complete_session(session_id: str, result: str):
        """Complete a verification session"""
        session = await signaling_server.complete_verification(session_id, result)
        if not session:
            raise HTTPException(404, "Session not found")
        return session.to_dict()
    
    @router.websocket("/ws/{session_id}")
    async def websocket_endpoint(websocket: WebSocket, session_id: str):
        """WebSocket endpoint for signaling"""
        await websocket.accept()
        
        connection_id = f"conn-{uuid.uuid4().hex[:8]}"
        signaling_server.connections[connection_id] = websocket
        
        try:
            # Send connection info
            await websocket.send_json({
                "type": "connected",
                "connection_id": connection_id,
                "ice_servers": signaling_server.get_ice_servers(),
            })
            
            while True:
                data = await websocket.receive_json()
                message_type = data.get("type")
                
                if message_type == "join":
                    user_id = data.get("user_id")
                    role = ParticipantRole(data.get("role", "buyer"))
                    participant = await signaling_server.join_session(
                        session_id, user_id, role, connection_id
                    )
                    if participant:
                        await websocket.send_json({
                            "type": "joined",
                            "participant": participant.to_dict(),
                            "session": (await signaling_server.get_session(session_id)).to_dict(),
                        })
                
                elif message_type == "offer":
                    await signaling_server.handle_offer(
                        session_id, data.get("participant_id"), data.get("sdp")
                    )
                
                elif message_type == "answer":
                    await signaling_server.handle_answer(
                        session_id, data.get("participant_id"), data.get("sdp")
                    )
                
                elif message_type == "ice-candidate":
                    await signaling_server.handle_ice_candidate(
                        session_id, data.get("participant_id"), data.get("candidate")
                    )
                
                elif message_type == "connected":
                    await signaling_server.handle_connected(
                        session_id, data.get("participant_id")
                    )
                
                elif message_type == "capture-frame":
                    # Frame data would be sent separately via data channel
                    pass
                
        except WebSocketDisconnect:
            await signaling_server.disconnect(connection_id)
        except Exception as e:
            logger.error(f"WebSocket error: {e}")
            await signaling_server.disconnect(connection_id)
        finally:
            signaling_server.connections.pop(connection_id, None)
    
    return router


async def webrtc_health() -> Dict[str, Any]:
    """Get WebRTC health status"""
    return {
        "enabled": WEBRTC_ENABLED,
        "active_sessions": len(signaling_server.sessions),
        "active_connections": len(signaling_server.connections),
        "stun_servers": STUN_SERVERS,
        "turn_configured": bool(TURN_SERVER),
    }
