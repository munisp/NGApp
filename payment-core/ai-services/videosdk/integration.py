#!/usr/bin/env python3
"""
VideoSDK Integration Service for Banking AI Telephony
Handles voice calls, recording, transcription, and real-time communication
Integrates with AI Agent Engine for intelligent conversation handling
"""

import asyncio
import json
import logging
import os
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
import aiohttp
import aioredis
import websockets
import jwt
from urllib.parse import urlencode
import base64
import hmac
import hashlib
from concurrent.futures import ThreadPoolExecutor
import threading

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CallStatus(Enum):
    PENDING = "pending"
    DIALING = "dialing"
    RINGING = "ringing"
    CONNECTED = "connected"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class CallDirection(Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"

@dataclass
class CallSession:
    session_id: str
    call_id: str
    room_id: str
    participant_id: str
    customer_phone: str
    agent_id: str
    call_direction: CallDirection
    status: CallStatus = CallStatus.PENDING
    start_time: datetime = field(default_factory=datetime.now)
    end_time: Optional[datetime] = None
    duration: int = 0  # in seconds
    recording_url: Optional[str] = None
    transcript_url: Optional[str] = None
    websocket_url: Optional[str] = None
    token: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

class VideoSDKIntegration:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # VideoSDK configuration
        self.api_key = os.getenv("VIDEOSDK_API_KEY")
        self.api_secret = os.getenv("VIDEOSDK_API_SECRET")
        self.base_url = os.getenv("VIDEOSDK_BASE_URL", "https://api.videosdk.live")
        self.webhook_url = os.getenv("VIDEOSDK_WEBHOOK_URL")
        
        if not self.api_key or not self.api_secret:
            raise ValueError("VideoSDK API key and secret must be provided")
        
        # HTTP client for API calls
        self.http_session = None
        
        # Redis for session management
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.redis_client = None
        
        # Active call sessions
        self.active_sessions: Dict[str, CallSession] = {}
        
        # WebSocket connections for real-time updates
        self.websocket_connections: Dict[str, websockets.WebSocketServerProtocol] = {}
        
        # Event handlers
        self.event_handlers: Dict[str, List[Callable]] = {
            "call_started": [],
            "call_connected": [],
            "call_ended": [],
            "call_failed": [],
            "recording_started": [],
            "recording_stopped": [],
            "participant_joined": [],
            "participant_left": [],
            "audio_received": [],
            "transcription_received": []
        }
        
        # Thread pool for concurrent operations
        self.executor = ThreadPoolExecutor(max_workers=20)
        
        # AI Agent Engine integration
        self.ai_agent_engine = None
        
    async def initialize(self):
        """Initialize the VideoSDK integration service"""
        self.logger.info("Initializing VideoSDK Integration Service")
        
        # Initialize HTTP session
        self.http_session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={
                "Authorization": f"Bearer {self._generate_jwt_token()}",
                "Content-Type": "application/json"
            }
        )
        
        # Initialize Redis connection
        self.redis_client = aioredis.from_url(self.redis_url, encoding="utf-8", decode_responses=True)
        
        # Test VideoSDK API connection
        await self._test_api_connection()
        
        self.logger.info("VideoSDK Integration Service initialized successfully")
    
    def _generate_jwt_token(self, expiry_hours: int = 24) -> str:
        """Generate JWT token for VideoSDK API authentication"""
        payload = {
            "iss": self.api_key,
            "exp": int(time.time()) + (expiry_hours * 3600),
            "iat": int(time.time()),
            "permissions": ["allow_join", "allow_mod", "allow_recording"]
        }
        
        token = jwt.encode(payload, self.api_secret, algorithm="HS256")
        return token
    
    async def _test_api_connection(self):
        """Test connection to VideoSDK API"""
        try:
            async with self.http_session.get(f"{self.base_url}/v2/rooms") as response:
                if response.status == 200:
                    self.logger.info("VideoSDK API connection successful")
                else:
                    self.logger.error(f"VideoSDK API connection failed: {response.status}")
                    raise Exception(f"API connection failed with status {response.status}")
        except Exception as e:
            self.logger.error(f"Failed to connect to VideoSDK API: {e}")
            raise
    
    async def create_room(self, room_config: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create a new VideoSDK room for voice calls"""
        try:
            config = room_config or {}
            default_config = {
                "region": "sg001",  # Singapore region for better latency to Nigeria
                "customRoomId": f"banking-call-{uuid.uuid4()}",
                "webhook": {
                    "endPoint": self.webhook_url,
                    "events": [
                        "room-created",
                        "room-ended", 
                        "participant-joined",
                        "participant-left",
                        "recording-started",
                        "recording-stopped",
                        "transcription-text"
                    ]
                },
                "autoCloseConfig": {
                    "type": "EVERYONE_LEFT",
                    "duration": 30  # Close room 30 seconds after everyone leaves
                },
                "recordingConfig": {
                    "enabled": True,
                    "autoStart": True,
                    "config": {
                        "layout": {
                            "type": "GRID",
                            "priority": "SPEAKER",
                            "gridSize": 2
                        },
                        "theme": "LIGHT",
                        "mode": "video-and-audio",
                        "quality": "high",
                        "orientation": "landscape"
                    }
                }
            }
            
            # Merge with provided config
            final_config = {**default_config, **config}
            
            async with self.http_session.post(
                f"{self.base_url}/v2/rooms",
                json=final_config
            ) as response:
                if response.status == 201:
                    room_data = await response.json()
                    self.logger.info(f"Created room: {room_data['roomId']}")
                    return room_data
                else:
                    error_text = await response.text()
                    self.logger.error(f"Failed to create room: {response.status} - {error_text}")
                    raise Exception(f"Failed to create room: {response.status}")
                    
        except Exception as e:
            self.logger.error(f"Error creating room: {e}")
            raise
    
    async def initiate_outbound_call(self, customer_phone: str, agent_id: str, 
                                   call_config: Dict[str, Any] = None) -> CallSession:
        """Initiate an outbound call to a customer"""
        try:
            # Create room for the call
            room_data = await self.create_room(call_config)
            room_id = room_data["roomId"]
            
            # Generate session ID
            session_id = str(uuid.uuid4())
            call_id = f"outbound-{int(time.time())}-{session_id[:8]}"
            
            # Create call session
            session = CallSession(
                session_id=session_id,
                call_id=call_id,
                room_id=room_id,
                participant_id=f"agent-{agent_id}",
                customer_phone=customer_phone,
                agent_id=agent_id,
                call_direction=CallDirection.OUTBOUND,
                status=CallStatus.DIALING,
                token=self._generate_jwt_token(),
                metadata={
                    "room_data": room_data,
                    "call_config": call_config or {}
                }
            )
            
            # Store session
            self.active_sessions[session_id] = session
            await self._cache_session(session)
            
            # Initiate the actual call using VideoSDK telephony
            await self._start_telephony_call(session)
            
            self.logger.info(f"Initiated outbound call {call_id} to {customer_phone}")
            
            # Trigger event handlers
            await self._trigger_event("call_started", session)
            
            return session
            
        except Exception as e:
            self.logger.error(f"Error initiating outbound call: {e}")
            raise
    
    async def handle_inbound_call(self, customer_phone: str, videosdk_session_data: Dict[str, Any]) -> CallSession:
        """Handle an incoming call from a customer"""
        try:
            # Extract session information from VideoSDK
            room_id = videosdk_session_data.get("roomId")
            participant_id = videosdk_session_data.get("participantId")
            
            if not room_id:
                # Create new room if not provided
                room_data = await self.create_room()
                room_id = room_data["roomId"]
            
            # Generate session ID
            session_id = str(uuid.uuid4())
            call_id = f"inbound-{int(time.time())}-{session_id[:8]}"
            
            # Create call session
            session = CallSession(
                session_id=session_id,
                call_id=call_id,
                room_id=room_id,
                participant_id=participant_id or f"customer-{customer_phone}",
                customer_phone=customer_phone,
                agent_id="ai-agent",  # Will be assigned to AI agent initially
                call_direction=CallDirection.INBOUND,
                status=CallStatus.CONNECTED,  # Inbound calls are already connected
                token=self._generate_jwt_token(),
                metadata={
                    "videosdk_session": videosdk_session_data
                }
            )
            
            # Store session
            self.active_sessions[session_id] = session
            await self._cache_session(session)
            
            self.logger.info(f"Handling inbound call {call_id} from {customer_phone}")
            
            # Trigger event handlers
            await self._trigger_event("call_connected", session)
            
            return session
            
        except Exception as e:
            self.logger.error(f"Error handling inbound call: {e}")
            raise
    
    async def _start_telephony_call(self, session: CallSession):
        """Start telephony call using VideoSDK"""
        try:
            # Configure telephony settings
            telephony_config = {
                "phoneNumber": session.customer_phone,
                "roomId": session.room_id,
                "participantId": session.participant_id,
                "config": {
                    "dialTimeout": 30,  # 30 seconds dial timeout
                    "recordCall": True,
                    "transcribeCall": True,
                    "language": "en-NG",  # Nigerian English
                    "webhook": {
                        "url": self.webhook_url,
                        "events": ["call-started", "call-ended", "call-failed"]
                    }
                }
            }
            
            # Make API call to start telephony
            async with self.http_session.post(
                f"{self.base_url}/v2/rooms/{session.room_id}/telephony/dial",
                json=telephony_config
            ) as response:
                if response.status == 200:
                    telephony_data = await response.json()
                    session.metadata["telephony_data"] = telephony_data
                    self.logger.info(f"Started telephony call for session {session.session_id}")
                else:
                    error_text = await response.text()
                    self.logger.error(f"Failed to start telephony call: {response.status} - {error_text}")
                    session.status = CallStatus.FAILED
                    raise Exception(f"Failed to start telephony call: {response.status}")
                    
        except Exception as e:
            self.logger.error(f"Error starting telephony call: {e}")
            session.status = CallStatus.FAILED
            raise
    
    async def end_call(self, session_id: str, reason: str = "completed") -> Dict[str, Any]:
        """End a call session"""
        try:
            if session_id not in self.active_sessions:
                raise ValueError(f"Session {session_id} not found")
            
            session = self.active_sessions[session_id]
            
            # End the room
            async with self.http_session.post(
                f"{self.base_url}/v2/rooms/{session.room_id}/end"
            ) as response:
                if response.status != 200:
                    self.logger.warning(f"Failed to end room {session.room_id}: {response.status}")
            
            # Update session status
            session.status = CallStatus.COMPLETED if reason == "completed" else CallStatus.FAILED
            session.end_time = datetime.now()
            session.duration = int((session.end_time - session.start_time).total_seconds())
            
            # Get call summary
            summary = await self._generate_call_summary(session)
            
            # Cache final session data
            await self._cache_session(session, ttl=86400)  # 24 hours
            
            # Remove from active sessions
            del self.active_sessions[session_id]
            
            # Trigger event handlers
            await self._trigger_event("call_ended", session)
            
            self.logger.info(f"Ended call session {session_id} with reason: {reason}")
            
            return summary
            
        except Exception as e:
            self.logger.error(f"Error ending call: {e}")
            raise
    
    async def _generate_call_summary(self, session: CallSession) -> Dict[str, Any]:
        """Generate call summary"""
        return {
            "session_id": session.session_id,
            "call_id": session.call_id,
            "customer_phone": session.customer_phone,
            "agent_id": session.agent_id,
            "direction": session.call_direction.value,
            "status": session.status.value,
            "start_time": session.start_time.isoformat(),
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "duration": session.duration,
            "recording_url": session.recording_url,
            "transcript_url": session.transcript_url,
            "room_id": session.room_id,
            "metadata": session.metadata
        }
    
    async def _cache_session(self, session: CallSession, ttl: int = 3600):
        """Cache session data in Redis"""
        try:
            session_data = {
                "session_id": session.session_id,
                "call_id": session.call_id,
                "room_id": session.room_id,
                "participant_id": session.participant_id,
                "customer_phone": session.customer_phone,
                "agent_id": session.agent_id,
                "call_direction": session.call_direction.value,
                "status": session.status.value,
                "start_time": session.start_time.isoformat(),
                "end_time": session.end_time.isoformat() if session.end_time else None,
                "duration": session.duration,
                "recording_url": session.recording_url,
                "transcript_url": session.transcript_url,
                "token": session.token,
                "metadata": session.metadata
            }
            
            await self.redis_client.setex(
                f"videosdk_session:{session.session_id}",
                ttl,
                json.dumps(session_data)
            )
            
        except Exception as e:
            self.logger.error(f"Error caching session: {e}")
    
    async def get_session(self, session_id: str) -> Optional[CallSession]:
        """Get session from active sessions or cache"""
        # Check active sessions first
        if session_id in self.active_sessions:
            return self.active_sessions[session_id]
        
        # Check Redis cache
        try:
            cached_data = await self.redis_client.get(f"videosdk_session:{session_id}")
            if cached_data:
                session_data = json.loads(cached_data)
                
                # Reconstruct session object
                session = CallSession(
                    session_id=session_data["session_id"],
                    call_id=session_data["call_id"],
                    room_id=session_data["room_id"],
                    participant_id=session_data["participant_id"],
                    customer_phone=session_data["customer_phone"],
                    agent_id=session_data["agent_id"],
                    call_direction=CallDirection(session_data["call_direction"]),
                    status=CallStatus(session_data["status"]),
                    start_time=datetime.fromisoformat(session_data["start_time"]),
                    end_time=datetime.fromisoformat(session_data["end_time"]) if session_data["end_time"] else None,
                    duration=session_data["duration"],
                    recording_url=session_data["recording_url"],
                    transcript_url=session_data["transcript_url"],
                    token=session_data["token"],
                    metadata=session_data["metadata"]
                )
                
                return session
                
        except Exception as e:
            self.logger.error(f"Error getting session from cache: {e}")
        
        return None
    
    async def handle_webhook(self, webhook_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle webhooks from VideoSDK"""
        try:
            event_type = webhook_data.get("event")
            room_id = webhook_data.get("roomId")
            
            if not event_type or not room_id:
                self.logger.warning("Invalid webhook data received")
                return {"status": "error", "message": "Invalid webhook data"}
            
            # Find session by room_id
            session = None
            for sess in self.active_sessions.values():
                if sess.room_id == room_id:
                    session = sess
                    break
            
            if not session:
                self.logger.warning(f"Session not found for room {room_id}")
                return {"status": "error", "message": "Session not found"}
            
            # Process different event types
            if event_type == "participant-joined":
                await self._handle_participant_joined(session, webhook_data)
            
            elif event_type == "participant-left":
                await self._handle_participant_left(session, webhook_data)
            
            elif event_type == "recording-started":
                await self._handle_recording_started(session, webhook_data)
            
            elif event_type == "recording-stopped":
                await self._handle_recording_stopped(session, webhook_data)
            
            elif event_type == "transcription-text":
                await self._handle_transcription_received(session, webhook_data)
            
            elif event_type == "room-ended":
                await self._handle_room_ended(session, webhook_data)
            
            else:
                self.logger.info(f"Unhandled webhook event: {event_type}")
            
            return {"status": "success", "message": "Webhook processed"}
            
        except Exception as e:
            self.logger.error(f"Error handling webhook: {e}")
            return {"status": "error", "message": str(e)}
    
    async def _handle_participant_joined(self, session: CallSession, webhook_data: Dict[str, Any]):
        """Handle participant joined event"""
        participant_id = webhook_data.get("participantId")
        self.logger.info(f"Participant {participant_id} joined session {session.session_id}")
        
        # Update session status if customer joined
        if session.status == CallStatus.DIALING:
            session.status = CallStatus.CONNECTED
        
        # Trigger event handlers
        await self._trigger_event("participant_joined", session, webhook_data)
    
    async def _handle_participant_left(self, session: CallSession, webhook_data: Dict[str, Any]):
        """Handle participant left event"""
        participant_id = webhook_data.get("participantId")
        self.logger.info(f"Participant {participant_id} left session {session.session_id}")
        
        # Trigger event handlers
        await self._trigger_event("participant_left", session, webhook_data)
    
    async def _handle_recording_started(self, session: CallSession, webhook_data: Dict[str, Any]):
        """Handle recording started event"""
        recording_id = webhook_data.get("recordingId")
        self.logger.info(f"Recording started for session {session.session_id}: {recording_id}")
        
        session.metadata["recording_id"] = recording_id
        
        # Trigger event handlers
        await self._trigger_event("recording_started", session, webhook_data)
    
    async def _handle_recording_stopped(self, session: CallSession, webhook_data: Dict[str, Any]):
        """Handle recording stopped event"""
        recording_url = webhook_data.get("recordingUrl")
        if recording_url:
            session.recording_url = recording_url
            self.logger.info(f"Recording available for session {session.session_id}: {recording_url}")
        
        # Trigger event handlers
        await self._trigger_event("recording_stopped", session, webhook_data)
    
    async def _handle_transcription_received(self, session: CallSession, webhook_data: Dict[str, Any]):
        """Handle transcription text received"""
        transcript_text = webhook_data.get("text")
        participant_id = webhook_data.get("participantId")
        timestamp = webhook_data.get("timestamp")
        
        if transcript_text:
            # Store transcription in session metadata
            if "transcriptions" not in session.metadata:
                session.metadata["transcriptions"] = []
            
            session.metadata["transcriptions"].append({
                "participant_id": participant_id,
                "text": transcript_text,
                "timestamp": timestamp
            })
            
            self.logger.info(f"Transcription received for session {session.session_id}: {transcript_text[:100]}...")
            
            # If AI agent engine is available, process the transcription
            if self.ai_agent_engine and participant_id != session.agent_id:
                # This is customer speech, process with AI
                try:
                    conversation_id = session.metadata.get("conversation_id")
                    if conversation_id:
                        response = await self.ai_agent_engine.process_text_input(conversation_id, transcript_text)
                        
                        if response["success"]:
                            # Send AI response back to the call
                            await self._send_audio_to_call(session, response["response_audio"])
                        
                except Exception as e:
                    self.logger.error(f"Error processing transcription with AI: {e}")
        
        # Trigger event handlers
        await self._trigger_event("transcription_received", session, webhook_data)
    
    async def _handle_room_ended(self, session: CallSession, webhook_data: Dict[str, Any]):
        """Handle room ended event"""
        self.logger.info(f"Room ended for session {session.session_id}")
        
        # Update session status
        session.status = CallStatus.COMPLETED
        session.end_time = datetime.now()
        session.duration = int((session.end_time - session.start_time).total_seconds())
        
        # Trigger event handlers
        await self._trigger_event("call_ended", session, webhook_data)
    
    async def _send_audio_to_call(self, session: CallSession, audio_data: bytes):
        """Send audio data to the call session"""
        try:
            # This would use VideoSDK's audio streaming API
            # For now, we'll log that audio would be sent
            self.logger.info(f"Sending audio response to session {session.session_id} ({len(audio_data)} bytes)")
            
            # In a real implementation, this would stream audio to the call
            # using VideoSDK's real-time audio streaming capabilities
            
        except Exception as e:
            self.logger.error(f"Error sending audio to call: {e}")
    
    async def _trigger_event(self, event_type: str, session: CallSession, webhook_data: Dict[str, Any] = None):
        """Trigger event handlers"""
        if event_type in self.event_handlers:
            for handler in self.event_handlers[event_type]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(session, webhook_data)
                    else:
                        handler(session, webhook_data)
                except Exception as e:
                    self.logger.error(f"Error in event handler {handler.__name__}: {e}")
    
    def add_event_handler(self, event_type: str, handler: Callable):
        """Add event handler for specific event type"""
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []
        
        self.event_handlers[event_type].append(handler)
        self.logger.info(f"Added event handler for {event_type}")
    
    def remove_event_handler(self, event_type: str, handler: Callable):
        """Remove event handler"""
        if event_type in self.event_handlers and handler in self.event_handlers[event_type]:
            self.event_handlers[event_type].remove(handler)
            self.logger.info(f"Removed event handler for {event_type}")
    
    async def get_active_sessions(self) -> List[Dict[str, Any]]:
        """Get list of active call sessions"""
        active_list = []
        
        for session in self.active_sessions.values():
            active_list.append({
                "session_id": session.session_id,
                "call_id": session.call_id,
                "customer_phone": session.customer_phone,
                "agent_id": session.agent_id,
                "direction": session.call_direction.value,
                "status": session.status.value,
                "duration": int((datetime.now() - session.start_time).total_seconds()),
                "room_id": session.room_id
            })
        
        return active_list
    
    async def get_call_analytics(self, start_date: str = None, end_date: str = None) -> Dict[str, Any]:
        """Get call analytics and statistics"""
        try:
            # This would query the database for call statistics
            # For now, return mock analytics based on active sessions
            
            total_calls = len(self.active_sessions)
            connected_calls = sum(1 for s in self.active_sessions.values() if s.status == CallStatus.CONNECTED)
            failed_calls = sum(1 for s in self.active_sessions.values() if s.status == CallStatus.FAILED)
            
            analytics = {
                "summary": {
                    "total_calls": total_calls,
                    "connected_calls": connected_calls,
                    "failed_calls": failed_calls,
                    "success_rate": (connected_calls / total_calls * 100) if total_calls > 0 else 0
                },
                "active_sessions": len(self.active_sessions),
                "call_distribution": {
                    "inbound": sum(1 for s in self.active_sessions.values() if s.call_direction == CallDirection.INBOUND),
                    "outbound": sum(1 for s in self.active_sessions.values() if s.call_direction == CallDirection.OUTBOUND)
                }
            }
            
            return analytics
            
        except Exception as e:
            self.logger.error(f"Error getting call analytics: {e}")
            return {"error": str(e)}
    
    async def cleanup(self):
        """Cleanup resources"""
        self.logger.info("Cleaning up VideoSDK Integration Service")
        
        # End all active sessions
        for session_id in list(self.active_sessions.keys()):
            try:
                await self.end_call(session_id, "cleanup")
            except Exception as e:
                self.logger.error(f"Error ending session {session_id} during cleanup: {e}")
        
        # Close HTTP session
        if self.http_session:
            await self.http_session.close()
        
        # Close Redis connection
        if self.redis_client:
            await self.redis_client.close()
        
        # Shutdown thread pool
        self.executor.shutdown(wait=True)
        
        self.logger.info("VideoSDK Integration Service cleanup complete")

# WebSocket server for real-time updates
class VideoSDKWebSocketServer:
    def __init__(self, videosdk_integration: VideoSDKIntegration):
        self.videosdk = videosdk_integration
        self.logger = logging.getLogger(__name__)
        self.connections: Dict[str, websockets.WebSocketServerProtocol] = {}
    
    async def handle_connection(self, websocket, path):
        """Handle WebSocket connection"""
        connection_id = str(uuid.uuid4())
        self.connections[connection_id] = websocket
        
        self.logger.info(f"WebSocket connection established: {connection_id}")
        
        try:
            # Send current active sessions
            active_sessions = await self.videosdk.get_active_sessions()
            await websocket.send(json.dumps({
                "type": "active_sessions",
                "data": active_sessions
            }))
            
            # Keep connection alive
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self._handle_message(connection_id, data)
                except json.JSONDecodeError:
                    await websocket.send(json.dumps({
                        "type": "error",
                        "message": "Invalid JSON"
                    }))
                    
        except websockets.exceptions.ConnectionClosed:
            self.logger.info(f"WebSocket connection closed: {connection_id}")
        except Exception as e:
            self.logger.error(f"WebSocket error: {e}")
        finally:
            if connection_id in self.connections:
                del self.connections[connection_id]
    
    async def _handle_message(self, connection_id: str, data: Dict[str, Any]):
        """Handle WebSocket message"""
        message_type = data.get("type")
        websocket = self.connections[connection_id]
        
        if message_type == "get_session":
            session_id = data.get("session_id")
            session = await self.videosdk.get_session(session_id)
            
            if session:
                await websocket.send(json.dumps({
                    "type": "session_data",
                    "data": await self.videosdk._generate_call_summary(session)
                }))
            else:
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": "Session not found"
                }))
        
        elif message_type == "get_analytics":
            analytics = await self.videosdk.get_call_analytics()
            await websocket.send(json.dumps({
                "type": "analytics",
                "data": analytics
            }))
    
    async def broadcast_update(self, update_type: str, data: Any):
        """Broadcast update to all connected clients"""
        if not self.connections:
            return
        
        message = json.dumps({
            "type": update_type,
            "data": data,
            "timestamp": datetime.now().isoformat()
        })
        
        # Send to all connections
        disconnected = []
        for connection_id, websocket in self.connections.items():
            try:
                await websocket.send(message)
            except websockets.exceptions.ConnectionClosed:
                disconnected.append(connection_id)
            except Exception as e:
                self.logger.error(f"Error broadcasting to {connection_id}: {e}")
                disconnected.append(connection_id)
        
        # Remove disconnected connections
        for connection_id in disconnected:
            del self.connections[connection_id]

# Example usage and testing
async def main():
    """Main function for testing VideoSDK integration"""
    videosdk = VideoSDKIntegration()
    await videosdk.initialize()
    
    # Test outbound call
    session = await videosdk.initiate_outbound_call(
        customer_phone="+2348012345678",
        agent_id="ai-agent-001"
    )
    
    print(f"Started outbound call: {session.call_id}")
    print(f"Room ID: {session.room_id}")
    print(f"Session ID: {session.session_id}")
    
    # Simulate some time passing
    await asyncio.sleep(2)
    
    # Get session info
    retrieved_session = await videosdk.get_session(session.session_id)
    print(f"Retrieved session: {retrieved_session.call_id if retrieved_session else 'Not found'}")
    
    # Get active sessions
    active_sessions = await videosdk.get_active_sessions()
    print(f"Active sessions: {len(active_sessions)}")
    
    # Get analytics
    analytics = await videosdk.get_call_analytics()
    print(f"Analytics: {json.dumps(analytics, indent=2)}")
    
    # End call
    summary = await videosdk.end_call(session.session_id)
    print(f"Call ended. Summary: {json.dumps(summary, indent=2)}")
    
    # Cleanup
    await videosdk.cleanup()

if __name__ == "__main__":
    asyncio.run(main())

