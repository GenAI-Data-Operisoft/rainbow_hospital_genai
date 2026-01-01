# services/vad_service.py (Fixed Version)
import asyncio
import contextlib
import json
import base64
import time
from typing import Dict, Any, Callable, Optional
from sarvamai import AsyncSarvamAI
import os


class VADService:
    def __init__(self):
        self.api_key = os.getenv("SARVAM_API_KEY")
        if not self.api_key:
            raise ValueError("SARVAM_API_KEY not found in environment variables")
        
        self.client = AsyncSarvamAI(api_subscription_key=self.api_key)
        self.active_streams: Dict[str, Any] = {}

    async def start_vad_stream(
        self, 
        session_id: str,
        model: str = "saaras:v2.5",
        target_language: Optional[str] = None,
        event_callback: Optional[Callable] = None,
        timeout: int = 300
    ) -> bool:
        """
        Start VAD streaming for a session with improved connection handling
        """
        if session_id in self.active_streams:
            print(f"VAD stream already active for session: {session_id}")
            return False

        try:
            print(f"🔄 Creating VAD stream connection for session: {session_id}")
            print(f"   Model: {model}")
            print(f"   Target language: {target_language}")
            
            # Create streaming connection with proper configuration
            stream_config = {
                "model": model,
                "vad_signals": True
            }
            
            # FIXED: Use the correct streaming client based on target language
            if target_language:
                print(f"🌍 Using translate streaming for target: {target_language}")
                ws_context = self.client.speech_to_text_translate_streaming.connect(**stream_config)
            else:
                print(f"📝 Using regular STT streaming")
                ws_context = self.client.speech_to_text_streaming.connect(**stream_config)

            # FIXED: Properly enter the context manager
            ws = await ws_context.__aenter__()
            
            self.active_streams[session_id] = {
                "websocket": ws,
                "websocket_context": ws_context,  # Store context for proper cleanup
                "target_language": target_language,
                "event_callback": event_callback,
                "timeout": timeout,
                "is_processing": False,
                "start_time": time.time(),
                "listener_task": None,
                "connection_active": True
            }

            # FIXED: Start listening for VAD events in a proper task
            listener_task = asyncio.create_task(self._listen_vad_events(session_id))
            self.active_streams[session_id]["listener_task"] = listener_task
            
            print(f"✅ VAD stream started successfully for session: {session_id}")
            return True

        except Exception as e:
            print(f"❌ Failed to start VAD stream for {session_id}: {e}")
            # Clean up any partial state
            if session_id in self.active_streams:
                del self.active_streams[session_id]
            return False

    async def send_audio_chunk(
        self, 
        session_id: str, 
        audio_data: bytes, 
        encoding: str = "audio/wav", 
        sample_rate: int = 16000
    ) -> bool:
        """
        Send audio chunk to VAD stream with better error handling
        """
        if session_id not in self.active_streams:
            print(f"❌ No active VAD stream for session: {session_id}")
            return False

        stream_info = self.active_streams[session_id]
        
        if not stream_info.get("connection_active", False):
            print(f"❌ VAD connection not active for session: {session_id}")
            return False
        
        if stream_info["is_processing"]:
            # Don't queue too many requests
            return False

        try:
            # FIXED: Better audio data validation
            if not audio_data or len(audio_data) == 0:
                return False
                
            # Encode audio data to base64
            audio_b64 = base64.b64encode(audio_data).decode("utf-8")
            
            # Get the websocket connection
            ws = stream_info["websocket"]
            target_language = stream_info["target_language"]
            
            # Set processing flag
            stream_info["is_processing"] = True
            
            try:
                # FIXED: Send audio with proper method based on stream type
                if target_language:
                    await ws.translate(
                        audio=audio_b64, 
                        encoding=encoding, 
                        sample_rate=sample_rate
                    )
                    #print(f"📤 Audio sent to VAD translate stream: {session_id}")
                else:
                    await ws.transcribe(
                        audio=audio_b64, 
                        encoding=encoding, 
                        sample_rate=sample_rate
                    )
                    #print(f"📤 Audio sent to VAD STT stream: {session_id}")
                
                return True
                
            finally:
                # Always reset processing flag
                stream_info["is_processing"] = False

        except Exception as e:
            print(f"❌ Failed to send audio to VAD stream {session_id}: {e}")
            # Mark connection as inactive on error
            stream_info["connection_active"] = False
            stream_info["is_processing"] = False
            return False

    async def _listen_vad_events(self, session_id: str):
        """
        Listen for VAD events with improved error handling and reconnection
        """
        if session_id not in self.active_streams:
            print(f"❌ Session {session_id} not found for VAD event listening")
            return

        stream_info = self.active_streams[session_id]
        ws = stream_info["websocket"]
        callback = stream_info["event_callback"]
        timeout = stream_info["timeout"]

        print(f"🎧 Starting VAD event listener for session: {session_id}")

        try:
            # FIXED: More robust event listening with timeout handling
            with contextlib.suppress(asyncio.TimeoutError):
                async with asyncio.timeout(timeout):
                    async for message in ws:
                        if not stream_info.get("connection_active", False):
                            print(f"🛑 VAD connection marked inactive, stopping listener: {session_id}")
                            break
                            
                        print(f"🎙️ VAD event received for {session_id}: {message}")
                        
                        # Parse message if it's a string
                        if isinstance(message, str):
                            try:
                                message = json.loads(message)
                            except json.JSONDecodeError:
                                print(f"⚠️ Invalid JSON in VAD message: {message}")
                                continue
                        
                        # Call the event callback if provided
                        if callback:
                            try:
                                await callback(session_id, message)
                            except Exception as e:
                                print(f"❌ VAD event callback error for {session_id}: {e}")

        except asyncio.CancelledError:
            print(f"🛑 VAD event listener cancelled for session: {session_id}")
        except Exception as e:
            print(f"❌ VAD event listener error for {session_id}: {e}")
        finally:
            # Mark connection as inactive when listener ends
            if session_id in self.active_streams:
                self.active_streams[session_id]["connection_active"] = False
            print(f"🏁 VAD event listener ended for session: {session_id}")

    async def stop_vad_stream(self, session_id: str) -> bool:
        """
        Stop VAD streaming with proper cleanup
        """
        if session_id not in self.active_streams:
            print(f"⚠️ No active VAD stream to stop for session: {session_id}")
            return False

        try:
            stream_info = self.active_streams[session_id]
            
            # Mark as inactive first
            stream_info["connection_active"] = False
            
            # Cancel the listener task if it exists
            if stream_info.get("listener_task"):
                try:
                    stream_info["listener_task"].cancel()
                    await asyncio.sleep(0.1)  # Give time for cancellation
                except Exception as e:
                    print(f"⚠️ Error cancelling listener task: {e}")
            
            # FIXED: Properly exit the context manager
            ws_context = stream_info.get("websocket_context")
            if ws_context:
                try:
                    await ws_context.__aexit__(None, None, None)
                    print(f"✅ VAD WebSocket context properly closed for: {session_id}")
                except Exception as e:
                    print(f"⚠️ Error closing WebSocket context: {e}")
            
            # Remove from active streams
            del self.active_streams[session_id]
            
            print(f"✅ VAD stream stopped for session: {session_id}")
            return True

        except Exception as e:
            print(f"❌ Failed to stop VAD stream for {session_id}: {e}")
            # Force remove from active streams even on error
            if session_id in self.active_streams:
                del self.active_streams[session_id]
            return False

    async def stop_all_streams(self):
        """Stop all active VAD streams"""
        sessions = list(self.active_streams.keys())
        for session_id in sessions:
            await self.stop_vad_stream(session_id)
        
        print("🛑 All VAD streams stopped")

    def get_active_sessions(self) -> list:
        """Get list of sessions with active VAD streams"""
        return list(self.active_streams.keys())

    def is_stream_active(self, session_id: str) -> bool:
        """Check if VAD stream is active for a session"""
        if session_id not in self.active_streams:
            return False
        return self.active_streams[session_id].get("connection_active", False)

    async def get_stream_stats(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get statistics for a VAD stream"""
        if session_id not in self.active_streams:
            return None

        stream_info = self.active_streams[session_id]
        return {
            "session_id": session_id,
            "target_language": stream_info["target_language"],
            "start_time": stream_info["start_time"],
            "duration": time.time() - stream_info["start_time"],
            "is_processing": stream_info["is_processing"],
            "connection_active": stream_info.get("connection_active", False)
        }

    async def test_vad_connection(self, model: str = "saaras:v2.5") -> bool:
        """Test VAD connection with a simple stream setup"""
        test_session_id = "test_connection"
        
        try:
            print(f"🧪 Testing VAD connection with model: {model}")
            
            # Try to create a connection
            success = await self.start_vad_stream(
                session_id=test_session_id,
                model=model,
                timeout=10
            )
            
            if success:
                print("✅ VAD connection test successful")
                # Clean up test connection
                await self.stop_vad_stream(test_session_id)
                return True
            else:
                print("❌ VAD connection test failed")
                return False
                
        except Exception as e:
            print(f"❌ VAD connection test error: {e}")
            # Clean up on error
            if test_session_id in self.active_streams:
                await self.stop_vad_stream(test_session_id)
            return False