# services/realtime_service.py (Modified with VAD and Diarization)
import asyncio
import json
import base64
import uuid
import time
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any
import websockets
from websockets.server import WebSocketServerProtocol
import aiofiles

from services.sarvam_service import SarvamService
from services.vad_service import VADService
from services.diarization_service import DiarizationService
from services.aws_bedrock_service import AWSBedrockService
from services.s3_storage_service import S3StorageService
from services.growth_data_extraction_service import GrowthDataExtractionService
from utils.audio_utils import create_wav_buffer
from utils.language_utils import LanguageUtils
from utils.speaker_utils import identify_speaker


class RealTimeTranscriptionService:
    def __init__(self):
        self.sarvam_service = SarvamService()
        self.vad_service = VADService()
        self.diarization_service = DiarizationService()
        self.aws_bedrock_service = AWSBedrockService()
        self.s3_storage_service = S3StorageService()
        self.growth_extraction_service = GrowthDataExtractionService()
        self.active_sessions: Dict[str, Dict[str, Any]] = {}
        self.script_patterns = LanguageUtils.script_patterns

        # English words in Telugu script for transliteration detection
        self.english_in_telugu = LanguageUtils.english_in_telugu

        # Test S3 connection on startup
        asyncio.create_task(self._test_s3_connection())

    def sanitize_for_log(self, input_text: str, max_length: int = 200) -> str:
        """Sanitize input for logging to prevent log injection"""
        if not isinstance(input_text, str):
            return str(input_text)
        return input_text.replace('\r', ' ').replace('\n', ' ').replace('\t', ' ')[:max_length]

    def serialize_datetime_objects(self, obj):
        """Recursively convert datetime objects to ISO format strings for JSON serialization"""
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, dict):
            return {key: self.serialize_datetime_objects(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self.serialize_datetime_objects(item) for item in obj]
        else:
            return obj

    async def initialize_websocket_server(self, host: str, port: int):
        """Initialize WebSocket server for real-time audio streaming"""
        async def connection_handler(websocket: WebSocketServerProtocol):
            print('🔗 New WebSocket connection established')
            session_id = None

            try:
                async for message in websocket:
                    data = json.loads(message)
                    session_id = data.get('session_id', session_id)
                    await self.handle_websocket_message(websocket, message)
            except websockets.exceptions.ConnectionClosed:
                print('🔌 WebSocket connection closed')
                if session_id:
                    await self._cleanup_session(session_id)
            except Exception as e:
                print(f'WebSocket error: {e}')
                if session_id:
                    await self._cleanup_session(session_id)

        server = await websockets.serve(connection_handler, host, port)
        print(f'WebSocket server started on ws://{host}:{port}')
        return server

    async def _cleanup_session(self, session_id: str):
        """Clean up session resources"""
        try:
            # Stop VAD stream if active
            if self.vad_service.is_stream_active(session_id):
                await self.vad_service.stop_vad_stream(session_id)
            
            # Remove from active sessions
            if session_id in self.active_sessions:
                del self.active_sessions[session_id]
                
            print(f'🧹 Session cleanup completed: {session_id}')
        except Exception as e:
            print(f'Session cleanup error: {e}')

    async def update_session_transcript(self, websocket: WebSocketServerProtocol, data: Dict):
        """Update session transcript buffer with edited content"""
        session_id = data.get('session_id')
        updated_transcript = data.get('transcript')

        print(f'🔄 UPDATE_TRANSCRIPT REQUEST: Session={session_id}')
        print(f'📄 Transcript length: {len(updated_transcript) if updated_transcript else 0}')
        print(f'📝 Transcript preview: "{self.sanitize_for_log(updated_transcript or "", 200)}"')

        if not session_id or session_id not in self.active_sessions:
            print(f'❌ Invalid session for update: {session_id}')
            print(f'🔍 Active sessions: {list(self.active_sessions.keys())}')
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Invalid session'
            }))
            return

        session = self.active_sessions[session_id]

        if updated_transcript is not None:
            # Store the old transcript for comparison
            old_transcript = session.get('transcript_buffer', '')
            
            # Update the session's transcript buffer
            session['transcript_buffer'] = updated_transcript.strip()
            
            print(f'✅ TRANSCRIPT UPDATED IN SESSION:')
            print(f'   Old length: {len(old_transcript)}')
            print(f'   New length: {len(session["transcript_buffer"])}')
            print(f'   Old preview: "{self.sanitize_for_log(old_transcript, 100)}"')
            print(f'   New preview: "{self.sanitize_for_log(session["transcript_buffer"], 100)}"')
            
            await websocket.send(json.dumps({
                'type': 'transcript_updated',
                'session_id': session_id,
                'message': 'Transcript updated successfully',
                'transcript_length': len(session['transcript_buffer'])
            }))
        else:
            print('❌ No transcript provided in update request')
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'No transcript provided'
            }))


    async def handle_websocket_message(self, websocket: WebSocketServerProtocol, message: str):
        """Handle different types of WebSocket messages, including feedback."""
        try:
            data = json.loads(message)
            message_type = data.get('type')
            session_id = data.get('session_id')

            # print(f'🔍 RECEIVED MESSAGE: Type={message_type}, Session={session_id}')

            if message_type == 'start_session':
                await self.start_real_time_session(websocket, data)
            elif message_type == 'audio_stream':
                await self.process_real_time_audio(websocket, data)
            elif message_type == 'end_session':
                await self.end_real_time_session(websocket, data)
            elif message_type == 'generate_prescription':
                await self.generate_prescription(websocket, data)
            elif message_type == 'update_transcript':
                await self.update_session_transcript(websocket, data)
            elif message_type == 'submit_feedback':
                # === UPDATED FEEDBACK HANDLER WITH CSV STORAGE ===
                await self.handle_feedback_with_csv_storage(websocket, data)
            else:
                await websocket.send(json.dumps({
                    'type': 'error',
                    'message': 'Unknown message type'
                }))

        except json.JSONDecodeError:
            print(f'Invalid JSON received: {message}')
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Invalid message format'
            }))
        except Exception as e:
            print(f'WebSocket message error: {e}')
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Message processing failed'
            }))


    async def handle_feedback_with_csv_storage(self, websocket: WebSocketServerProtocol, data: Dict):
        """Handle submit_feedback messages and store in both session and CSV."""
        session_id = data.get("session_id")
        feedback_type = data.get("feedback_type")
        feedback_text = data.get("feedback_text")
        panel = data.get("panel", "unknown")

        # Check session validity first
        if not session_id or session_id not in self.active_sessions:
            await websocket.send(json.dumps({
                "type": "error",
                "message": "Invalid session for feedback"
            }))
            return

        session = self.active_sessions[session_id]
        
        # Get username from session (stored during start_real_time_session)
        user_id = session.get('username') or data.get("username") or data.get("user_id")

        # Debug logging for received data
        print(f"🔍 Raw feedback data received:")
        print(f"   session_id: {session_id}")
        print(f"   user_id from session: {session.get('username')}")
        print(f"   user_id final: {user_id}")
        print(f"   feedback_type: {feedback_type}")
        print(f"   feedback_text: {repr(feedback_text)}")
        print(f"   panel: {panel}")

        # Normalize feedback_text
        if feedback_text is None:
            feedback_text = ""
        else:
            feedback_text = str(feedback_text).strip()
            
        print(f"   normalized feedback_text: {repr(feedback_text)}")

        # Parse timestamp safely
        timestamp = data.get("timestamp")
        try:
            ts = datetime.fromtimestamp(float(timestamp) / 1000) if timestamp else datetime.now()
        except Exception as e:
            print(f'⚠️ Invalid timestamp received: {timestamp}, using now. Error: {e}')
            ts = datetime.now()

        # Store feedback in session buffer with a flag to track CSV storage
        if "feedback" not in session:
            session["feedback"] = []

        feedback_entry = {
            "user_id": user_id,
            "type": feedback_type,
            "text": feedback_text,
            "Panel": panel,
            "timestamp": ts.isoformat(),
            "csv_stored": False  # Flag to track if already stored in CSV
        }
        
        session["feedback"].append(feedback_entry)

        print(f"📥 Feedback received: Session={session_id}, User={user_id}, Type={feedback_type}, Text=\"{feedback_text}\", Panel={panel}")
        
        # Store feedback in CSV on S3 immediately
        try:
            feedback_data = {
                'session_id': session_id,
                'user_id': user_id,
                'feedback_type': feedback_type,
                'feedback_text': feedback_text,
                'panel': panel,
                'timestamp': ts
            }
            
            # Debug the data being sent to CSV storage
            print(f"🔍 Data being sent to CSV storage:")
            print(f"   feedback_data: {feedback_data}")
            
            # Store feedback to CSV in S3
            csv_success = await self.s3_storage_service.store_feedback_to_csv(feedback_data)
            
            if csv_success:
                # Mark as stored in CSV to prevent duplicate storage
                feedback_entry["csv_stored"] = True
                print(f"✅ Feedback stored to CSV successfully for session: {session_id}")
                
                await websocket.send(json.dumps({
                    "type": "feedback_received",
                    "session_id": session_id,
                    "message": "Feedback stored successfully in session and CSV",
                    "csv_stored": True
                }))
            else:
                print(f"⚠️ Feedback stored in session but CSV storage failed for session: {session_id}")
                await websocket.send(json.dumps({
                    "type": "feedback_received",
                    "session_id": session_id,
                    "message": "Feedback stored in session (CSV storage failed)",
                    "csv_stored": False
                }))
                
        except Exception as e:
            print(f"❌ Error storing feedback to CSV for session {session_id}: {e}")
            import traceback
            traceback.print_exc()
            await websocket.send(json.dumps({
                "type": "feedback_received",
                "session_id": session_id,
                "message": "Feedback stored in session (CSV storage error)",
                "csv_stored": False,
                "csv_error": str(e)
            }))


    async def start_real_time_session(self, websocket: WebSocketServerProtocol, data: Dict):
        """Start a new real-time transcription session with VAD"""
        session_id = f"realtime_{int(time.time())}_{uuid.uuid4().hex[:8]}"

        # Extract configuration from session start data
        preferred_language = data.get('preferred_language')
        processing_mode = data.get('processing_mode', 'translate')
        code_switching_mode = data.get('code_switching_mode', False)
        doctor_known_languages = data.get('doctor_known_languages')
        doctor_profile = data.get('doctor_profile')
        context = data.get('context', 'Generic')
        username = data.get('username')

        session = {
            'id': session_id,
            'websocket': websocket,
            'start_time': datetime.now(),
            'audio_buffer': [],  # For accumulating full conversation
            'current_chunk': [],  # For current VAD chunk
            'transcript_buffer': '',
            'speakers': set(),
            'detected_language': None,
            'preferred_language': preferred_language,
            'processing_mode': processing_mode,
            'username': username,
            'code_switching_mode': code_switching_mode,
            'doctor_known_languages': doctor_known_languages,
            'doctor_profile': doctor_profile,
            'language_confidence': {preferred_language: 5} if preferred_language else {},
            'medical_categories': {
                'SYMPTOMS': [],
                'OBJECTIVE': [],
                'ASSESSMENT': [],
                'VITALS': [],
                'PLAN': [],
                'NOTES': [],
                'FEATURES': [],
                'HISTORY': [],
                'CLINICAL_ALERTS': []
            },
            'context': context,
            'vad_active': False,
            'speech_in_progress': False
        }

        self.active_sessions[session_id] = session

        # Start VAD stream
        vad_started = await self.vad_service.start_vad_stream(
            session_id=session_id,
            model="saaras:v2.5",
            target_language=preferred_language if processing_mode == 'translate' else None,
            event_callback=self._handle_vad_event,
            timeout=300  # 5 minutes timeout
        )

        if not vad_started:
            print(f'❌ Failed to start VAD stream for session: {session_id}')
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Failed to start VAD stream'
            }))
            return

        session['vad_active'] = True

        await websocket.send(json.dumps({
            'type': 'session_started',
            'session_id': session_id,
            'message': 'Real-time transcription session with VAD started',
            'vad_enabled': True
        }))
        # Log the username and context
        print(f'✅ username found : {username}')
        print(f'🎤 Started VAD-enabled session: {session_id} with contexts: {context}')

    async def _handle_vad_event(self, session_id: str, event):
        """Handle VAD events from the streaming service"""
        if session_id not in self.active_sessions:
            return

        session = self.active_sessions[session_id]
        websocket = session['websocket']

        try:
            # Handle the Sarvam API response object structure
            if hasattr(event, 'type'):
                event_type = event.type
            else:
                event_type = 'unknown'

            print(f'🎙️ VAD Event [{session_id}]: {event_type}')

            if event_type == 'events':
                # Handle VAD signal events
                if hasattr(event, 'data') and hasattr(event.data, 'signal_type'):
                    signal_type = event.data.signal_type
                    
                    if signal_type == 'START_SPEECH':
                        session['speech_in_progress'] = True
                        await websocket.send(json.dumps({
                            'type': 'vad_event',
                            'session_id': session_id,
                            'event': 'speech_start',
                            'timestamp': datetime.now().isoformat(),
                            'occurred_at': getattr(event.data, 'occured_at', None)
                        }))
                        print(f'🎤 Speech started for session: {session_id}')

                    elif signal_type == 'END_SPEECH':
                        session['speech_in_progress'] = False
                        
                        # Process accumulated chunk when speech ends
                        if session['current_chunk']:
                            await self._process_vad_chunk(session_id)
                        
                        await websocket.send(json.dumps({
                            'type': 'vad_event',
                            'session_id': session_id,
                            'event': 'speech_end',
                            'timestamp': datetime.now().isoformat(),
                            'occurred_at': getattr(event.data, 'occured_at', None)
                        }))
                        print(f'🔇 Speech ended for session: {session_id}')

            elif event_type == 'data':
                # Handle transcription/translation data
                if hasattr(event, 'data') and hasattr(event.data, 'transcript'):
                    transcript = event.data.transcript.strip()
                    language_code = getattr(event.data, 'language_code', 'unknown')
                    
                    if transcript:
                        print(f'📝 VAD Transcript [{language_code}]: {transcript}')
                        await self._handle_vad_transcript(session_id, transcript, event.data)

        except Exception as e:
            print(f'VAD event handling error for {session_id}: {e}')
            import traceback
            traceback.print_exc()

    async def _handle_vad_transcript(self, session_id: str, transcript: str, event_data):
        """Handle transcript from VAD stream"""
        session = self.active_sessions[session_id]
        websocket = session['websocket']

        # Update transcript buffer
        session['transcript_buffer'] += f" {transcript}"

        # Extract language code from the event data
        language_code = getattr(event_data, 'language_code', 'unknown')
        
        # Language detection and processing
        detected_language = self.detect_actual_language(transcript)
        if not detected_language:
            detected_language = language_code
            
        self.update_language_detection(session, detected_language)

        # Speaker identification
        speaker_info = await identify_speaker(transcript) if asyncio.iscoroutinefunction(identify_speaker) else identify_speaker(transcript)

        # Extract additional metrics if available
        metrics = getattr(event_data, 'metrics', None)
        processing_latency = getattr(metrics, 'processing_latency', None) if metrics else None
        audio_duration = getattr(metrics, 'audio_duration', None) if metrics else None

        # Send real-time update to client
        response = {
            'type': 'transcription_update',
            'session_id': session_id,
            'transcript': transcript,
            'language': detected_language,
            'processing_mode': session['processing_mode'],
            'was_translated': session['processing_mode'] == 'translate',
            'timestamp': datetime.now().isoformat(),
            'source': 'vad_stream'
        }

        if speaker_info:
            response['speaker'] = speaker_info.get('speaker')

        # Add metrics if available
        if processing_latency:
            response['processing_latency'] = processing_latency
        if audio_duration:
            response['audio_duration'] = audio_duration

        await websocket.send(json.dumps(response))

        mode_label = '🌍 VAD Translated' if session['processing_mode'] == 'translate' else '📝 VAD Transcribed'
        print(f'{mode_label} [{detected_language}]: {self.sanitize_for_log(transcript)}')
        
        if processing_latency:
            print(f'   Processing latency: {processing_latency:.3f}s')
        if audio_duration:
            print(f'   Audio duration: {audio_duration:.2f}s')

    async def _process_vad_chunk(self, session_id: str):
        """Process accumulated audio chunk from VAD"""
        session = self.active_sessions[session_id]
        
        if not session['current_chunk']:
            return

        print(f'🔄 Processing VAD chunk for session: {session_id}')
        
        # Add current chunk to full conversation buffer
        chunk_data = b''.join(session['current_chunk'])
        session['audio_buffer'].append(chunk_data)
        
        # Clear current chunk for next speech segment
        session['current_chunk'] = []
        
        print(f'📊 Audio accumulated: {len(session["audio_buffer"])} chunks, ~{sum(len(chunk) for chunk in session["audio_buffer"]) / (16000 * 2):.2f}s')

    async def process_real_time_audio(self, websocket: WebSocketServerProtocol, data: Dict):
        """Process real-time audio stream and send to VAD"""
        session_id = data.get('session_id')
        audio_data = data.get('audio_data')

        if not session_id or session_id not in self.active_sessions:
            print(f"Invalid session: {session_id}")
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Invalid session'
            }))
            return

        session = self.active_sessions[session_id]

        if not session.get('vad_active'):
            print(f"VAD not active for session: {session_id}")
            return

        try:
            # Convert base64 audio data to bytes
            audio_buffer = base64.b64decode(audio_data)

            # Validate audio data size
            if len(audio_buffer) % 2 != 0:
                print('⚠️ Invalid audio data size, skipping chunk')
                return

            # Add to current chunk (for VAD processing)
            session['current_chunk'].append(audio_buffer)
            
            # ✅ REMOVED: session['audio_buffer'].append(audio_buffer)
            # Audio will be added to audio_buffer in _process_vad_chunk instead

            # Send audio chunk to VAD stream
            success = await self.vad_service.send_audio_chunk(
                session_id=session_id,
                audio_data=audio_buffer,
                encoding="audio/wav",
                sample_rate=16000
            )

            if not success:
                print(f'⚠️ Failed to send audio to VAD stream: {session_id}')

        except Exception as e:
            print(f'Real-time audio processing error: {e}')
            await session['websocket'].send(json.dumps({
                'type': 'error',
                'message': 'Audio processing failed'
            }))


    def update_language_detection(self, session: Dict, detected_language: str):
        """Update language detection based on transcription results"""
        if not detected_language:
            return

        # Track language confidence
        if detected_language not in session['language_confidence']:
            session['language_confidence'][detected_language] = 0

        # If this is the same as our current detected language, give it extra weight
        if session['detected_language'] == detected_language:
            session['language_confidence'][detected_language] += 2
        else:
            session['language_confidence'][detected_language] += 1

        # Determine primary language (most frequent)
        primary_language = max(session['language_confidence'].items(), key=lambda x: x[1])[0]

        # Only switch languages if the new language has significantly more confidence
        current_confidence = session['language_confidence'].get(session['detected_language'], 0)
        new_confidence = session['language_confidence'].get(primary_language, 0)

        # For translate mode, be more aggressive about switching
        switch_threshold = current_confidence + 1 if session['processing_mode'] == 'translate' else current_confidence + 3

        if not session['detected_language'] or new_confidence > switch_threshold:
            if session['detected_language'] != primary_language:
                print(f'🌐 Language locked/switched: {session["detected_language"] or "none"} → {primary_language} (confidence: {new_confidence})')
                session['detected_language'] = primary_language
        else:
            # Log but don't switch - maintaining language consistency
            if session['detected_language'] != detected_language:
                print(f'🔒 Language switching suppressed: Keeping {session["detected_language"]} ({current_confidence}) over {detected_language} ({session["language_confidence"].get(detected_language, 0)})')

    def detect_actual_language(self, text: str) -> str:
        """Wrapper to language utils detection"""
        return LanguageUtils.detect_actual_language(text)

    async def build_prescription_payload(self, session: Dict, context: str) -> Dict:
        """Generate summary + categories and return structured payload and stats."""
        try:
            # Generate final medical summary with proper context
            summary_result = await self.aws_bedrock_service.generate_medical_summary(
                session,
                context=context
            )
            final_summary = summary_result.get("output", "Summary unavailable")
            summary_stats = summary_result.get("stats", {})

        except Exception as e:
            print(f'❌ Medical summary generation failed: {e}')
            final_summary = (
                f"Medical Summary Generation Failed\n\n"
                f"Transcript: {session.get('transcript_buffer', '').strip()}\n\n"
                f"Note: AWS Bedrock encountered an error."
            )
            summary_stats = {}

        # Invoke medical categories extraction
        try:
            print(f'🔍 DEBUG: Starting medical categories generation...')
            
            categories_result = await self.aws_bedrock_service.generate_medical_categories(
                session, context=context, summary=final_summary
            )
            
            final_categories = categories_result.get("output", "categories unavailable")
            print(f'🔍 DEBUG: Raw final_categories: {final_categories}')

            # Parse JSON if backend returned as stringified JSON
            if isinstance(final_categories, str):
                cleaned_categories = re.sub(r"^```json\s*|\s*```$", "", final_categories.strip())
                
                try:
                    parsed_json = json.loads(cleaned_categories)
                    print(f'🔍 DEBUG: Successfully parsed JSON: {parsed_json}')
                    
                    if isinstance(parsed_json, dict):
                        if "Medical Categories" in parsed_json:
                            final_categories_parsed = parsed_json["Medical Categories"]
                            print(f"🔧 FIXED: Extracted nested categories from \"Medical Categories\" key")
                        elif "medical_categories" in parsed_json:
                            final_categories_parsed = parsed_json["medical_categories"] 
                            print(f"🔧 FIXED: Extracted nested categories from \"medical_categories\" key")
                        else:
                            final_categories_parsed = parsed_json
                            print(f"🔧 FIXED: Using parsed JSON as-is (no wrapper found)")
                    else:
                        final_categories_parsed = parsed_json
                        
                except json.JSONDecodeError as json_error:
                    print(f'❌ JSON parsing failed: {json_error}')
                    final_categories_parsed = {
                        'SYMPTOMS': [], 'OBJECTIVE': [], 'ASSESSMENT': [], 'VITALS': [],
                        'PLAN': [], 'NOTES': [], 'FEATURES': [], 'HISTORY': [], 'CLINICAL_ALERTS': []
                    }
                    print(f'🔧 FALLBACK: Using empty structure due to parse failure')
            else:
                final_categories_parsed = final_categories

            if isinstance(final_categories_parsed, dict):
                expected_keys = ['SYMPTOMS','OBJECTIVE','ASSESSMENT','VITALS','PLAN','NOTES','FEATURES','HISTORY','CLINICAL_ALERTS']
                for key in expected_keys:
                    if key not in final_categories_parsed:
                        final_categories_parsed[key] = []
                        
                print(f'🔍 VALIDATION: Final structure keys: {list(final_categories_parsed.keys())}')
            
            categories_stats = categories_result.get("stats", {})
            print(f'✅ Medical categories processed successfully!')

        except Exception as e:
            print(f'❌ Medical categories generation failed: {e}')
            final_categories_parsed = {
                'SYMPTOMS': [], 'OBJECTIVE': [], 'ASSESSMENT': [], 'VITALS': [],
                'PLAN': [], 'NOTES': [], 'FEATURES': [], 'HISTORY': [], 'CLINICAL_ALERTS': []
            }
            categories_stats = {}

        # Evaluation step
        evaluation_result = None
        evaluation_stats = {}
        
        try:
            print(f'🔍 Starting evaluation of generated medical content...')
            
            categories_for_evaluation = (
                json.dumps(final_categories_parsed, indent=2) 
                if isinstance(final_categories_parsed, dict) 
                else str(final_categories_parsed)
            )
            
            evaluation_result = await self.aws_bedrock_service.evaluate_medical_output(
                session=session,
                context=context,
                categories=categories_for_evaluation,
                prescription=final_summary
            )
            
            evaluation_output = evaluation_result.get("output", "{}")
            evaluation_stats = evaluation_result.get("stats", {})
            
            try:
                evaluation_json = json.loads(evaluation_output)

                print(f'✅ Evaluation completed. Full JSON output:')
                print(json.dumps(evaluation_json, indent=2))

                evaluation_result["parsed_evaluation"] = evaluation_json

                try:
                    evaluation_data = {
                        'session_id': session.get('id', 'unknown'),
                        'user_id': session.get('username', 'unknown'),
                        'context': context,
                        'ai_model': self.aws_bedrock_service.model_name,
                        'evaluation_result': evaluation_result,
                        'evaluation_stats': evaluation_stats,
                        'timestamp': datetime.now()
                    }
                    
                    print(f"🔍 DEBUG: Evaluation data being sent to S3:")
                    print(f"   user_id (from session username): {session.get('username', 'unknown')}")
                    
                    s3_success = await self.s3_storage_service.store_evaluation_to_s3(evaluation_data)
                    if s3_success:
                        print(f"✅ Evaluation stored to S3 successfully")
                    else:
                        print(f"⚠️ Failed to store evaluation to S3")
                        
                except Exception as s3_error:
                    print(f"❌ Error storing evaluation to S3: {s3_error}")
                
            except json.JSONDecodeError as e:
                print(f'⚠️ Evaluation response is not valid JSON: {e}')
                evaluation_result["evaluation_parse_error"] = str(e)
                
        except Exception as e:
            print(f'❌ Evaluation failed: {e}')
            evaluation_result = {
                "output": f"Evaluation failed: {str(e)}",
                "stats": {},
                "error": str(e)
            }

        print(f'🔍 DEBUG: Final categories structure for payload:')
        print(json.dumps(final_categories_parsed, indent=2))

        payload = {
            "medical_summary": final_summary,
            "medical_categories": final_categories_parsed,
            "full_transcript": session.get('transcript_buffer', '').strip(),
            "summary_stats": summary_stats,
            "categories_stats": categories_stats,
            "context": context,
            "ai_model": self.aws_bedrock_service.model_name,
            "evaluation_result": evaluation_result
        }
        
        return payload

    async def build_prescription_payload_progressive(self, session: Dict, context: str, websocket: WebSocketServerProtocol, session_id: str):
        """
        Generate summary, categories, and evaluation SEQUENTIALLY and send each result
        to frontend immediately via separate WebSocket messages.
        """
        
        # ============================================================================
        # STEP 1: GENERATE MEDICAL SUMMARY
        # ============================================================================
        try:
            print(f'🔍 [STEP 1/3] Starting medical summary generation...')
            
            summary_result = await self.aws_bedrock_service.generate_medical_summary(
                session,
                context=context
            )
            final_summary = summary_result.get("output", "Summary unavailable")
            summary_stats = summary_result.get("stats", {})
            
            # Send summary immediately to frontend
            await websocket.send(json.dumps({
                'type': 'summary_generated',
                'session_id': session_id,
                'data': {
                    'medical_summary': final_summary,
                    'summary_stats': summary_stats,
                    'context': context,
                    'ai_model': self.aws_bedrock_service.model_name
                }
            }))
            
            print(f'✅ [STEP 1/3] Medical summary sent to frontend')
            
        except Exception as e:
            print(f'❌ [STEP 1/3] Medical summary generation failed: {e}')
            final_summary = (
                f"Medical Summary Generation Failed\n\n"
                f"Transcript: {session.get('transcript_buffer', '').strip()}\n\n"
                f"Note: AWS Bedrock encountered an error."
            )
            summary_stats = {}
            
            # Send error to frontend
            await websocket.send(json.dumps({
                'type': 'summary_generated',
                'session_id': session_id,
                'data': {
                    'medical_summary': final_summary,
                    'summary_stats': summary_stats,
                    'error': str(e)
                }
            }))

        # ============================================================================
        # STEP 2: GENERATE MEDICAL CATEGORIES
        # ============================================================================
        try:
            print(f'🔍 [STEP 2/3] Starting medical categories generation...')
            
            categories_result = await self.aws_bedrock_service.generate_medical_categories(
                session, context=context, summary=final_summary
            )
            
            final_categories = categories_result.get("output", "categories unavailable")
            print(f'🔍 DEBUG: Raw final_categories: {final_categories}')

            # Parse JSON if backend returned as stringified JSON
            if isinstance(final_categories, str):
                cleaned_categories = re.sub(r"^```json\s*|\s*```$", "", final_categories.strip())
                
                try:
                    parsed_json = json.loads(cleaned_categories)
                    print(f'🔍 DEBUG: Successfully parsed JSON: {parsed_json}')
                    
                    if isinstance(parsed_json, dict):
                        if "Medical Categories" in parsed_json:
                            final_categories_parsed = parsed_json["Medical Categories"]
                            print(f"🔧 FIXED: Extracted nested categories from \"Medical Categories\" key")
                        elif "medical_categories" in parsed_json:
                            final_categories_parsed = parsed_json["medical_categories"] 
                            print(f"🔧 FIXED: Extracted nested categories from \"medical_categories\" key")
                        else:
                            final_categories_parsed = parsed_json
                            print(f"🔧 FIXED: Using parsed JSON as-is (no wrapper found)")
                    else:
                        final_categories_parsed = parsed_json
                        
                except json.JSONDecodeError as json_error:
                    print(f'❌ JSON parsing failed: {json_error}')
                    final_categories_parsed = {
                        'SYMPTOMS': [], 'OBJECTIVE': [], 'ASSESSMENT': [], 'VITALS': [],
                        'PLAN': [], 'NOTES': [], 'FEATURES': [], 'HISTORY': [], 'CLINICAL_ALERTS': []
                    }
                    print(f'🔧 FALLBACK: Using empty structure due to parse failure')
            else:
                final_categories_parsed = final_categories

            # Ensure all expected keys exist
            if isinstance(final_categories_parsed, dict):
                expected_keys = ['SYMPTOMS','OBJECTIVE','ASSESSMENT','VITALS','PLAN','NOTES','FEATURES','HISTORY','CLINICAL_ALERTS']
                for key in expected_keys:
                    if key not in final_categories_parsed:
                        final_categories_parsed[key] = []
                        
                print(f'🔍 VALIDATION: Final structure keys: {list(final_categories_parsed.keys())}')
            
            categories_stats = categories_result.get("stats", {})
            
            # Send categories immediately to frontend
            await websocket.send(json.dumps({
                'type': 'categories_generated',
                'session_id': session_id,
                'data': {
                    'medical_categories': final_categories_parsed,
                    'categories_stats': categories_stats
                }
            }))
            
            print(f'✅ [STEP 2/3] Medical categories sent to frontend')

        except Exception as e:
            print(f'❌ [STEP 2/3] Medical categories generation failed: {e}')
            final_categories_parsed = {
                'SYMPTOMS': [], 'OBJECTIVE': [], 'ASSESSMENT': [], 'VITALS': [],
                'PLAN': [], 'NOTES': [], 'FEATURES': [], 'HISTORY': [], 'CLINICAL_ALERTS': []
            }
            categories_stats = {}
            
            # Send error to frontend
            await websocket.send(json.dumps({
                'type': 'categories_generated',
                'session_id': session_id,
                'data': {
                    'medical_categories': final_categories_parsed,
                    'categories_stats': categories_stats,
                    'error': str(e)
                }
            }))

        # ============================================================================
        # STEP 3: GENERATE EVALUATION RESULT
        # ============================================================================
        try:
            print(f'🔍 [STEP 3/3] Starting evaluation of generated medical content...')
            
            categories_for_evaluation = (
                json.dumps(final_categories_parsed, indent=2) 
                if isinstance(final_categories_parsed, dict) 
                else str(final_categories_parsed)
            )
            
            evaluation_result = await self.aws_bedrock_service.evaluate_medical_output(
                session=session,
                context=context,
                categories=categories_for_evaluation,
                prescription=final_summary
            )
            
            evaluation_output = evaluation_result.get("output", "{}")
            evaluation_stats = evaluation_result.get("stats", {})
            
            try:
                evaluation_json = json.loads(evaluation_output)

                print(f'✅ [STEP 3/3] Evaluation completed. Full JSON output:')
                print(json.dumps(evaluation_json, indent=2))

                evaluation_result["parsed_evaluation"] = evaluation_json

                # Store evaluation to S3
                try:
                    evaluation_data = {
                        'session_id': session.get('id', 'unknown'),
                        'user_id': session.get('username', 'unknown'),
                        'context': context,
                        'ai_model': "claude-haiku3",
                        'evaluation_result': evaluation_result,
                        'evaluation_stats': evaluation_stats,
                        'timestamp': datetime.now()
                    }
                    
                    print(f"🔍 DEBUG: Evaluation data being sent to S3:")
                    print(f"   user_id (from session username): {session.get('username', 'unknown')}")
                    
                    s3_success = await self.s3_storage_service.store_evaluation_to_s3(evaluation_data)
                    if s3_success:
                        print(f"✅ Evaluation stored to S3 successfully")
                    else:
                        print(f"⚠️ Failed to store evaluation to S3")
                        
                except Exception as s3_error:
                    print(f"❌ Error storing evaluation to S3: {s3_error}")
                
            except json.JSONDecodeError as e:
                print(f'⚠️ Evaluation response is not valid JSON: {e}')
                evaluation_result["evaluation_parse_error"] = str(e)
            
            # Send evaluation immediately to frontend
            await websocket.send(json.dumps({
                'type': 'evaluation_generated',
                'session_id': session_id,
                'data': {
                    'evaluation_result': evaluation_result,
                    'evaluation_stats': evaluation_stats
                }
            }))
            
            print(f'✅ [STEP 3/3] Evaluation result sent to frontend')
                
        except Exception as e:
            print(f'❌ [STEP 3/3] Evaluation failed: {e}')
            evaluation_result = {
                "output": f"Evaluation failed: {str(e)}",
                "stats": {},
                "error": str(e)
            }
            evaluation_stats = {}
            
            # Send error to frontend
            await websocket.send(json.dumps({
                'type': 'evaluation_generated',
                'session_id': session_id,
                'data': {
                    'evaluation_result': evaluation_result,
                    'evaluation_stats': evaluation_stats,
                    'error': str(e)
                }
            }))

        print(f'✅ All 3 steps completed and sent to frontend progressively')
        
        # ============================================================================
        # STEP 4: EXTRACT GROWTH DATA (NEW)
        # ============================================================================
        growth_data = None
        try:
            print(f'📊 [STEP 4/4] Starting growth data extraction...')
            
            growth_data = await self.growth_extraction_service.extract_growth_data(
                transcript=session.get('transcript_buffer', ''),
                context=context
            )
            
            # Send growth data to frontend if we have meaningful data
            if growth_data and growth_data.get('age') and (growth_data.get('weight') or growth_data.get('height')):
                await websocket.send(json.dumps({
                    'type': 'growth_data_extracted',
                    'session_id': session_id,
                    'data': growth_data
                }))
                
                # Store in session for later use
                session['growth_data'] = growth_data
                
                print(f'✅ [STEP 4/4] Growth data extracted and sent to frontend')
                print(f'   - Name: {growth_data.get("name")}')
                print(f'   - Age: {growth_data.get("age")} months')
                print(f'   - Weight: {growth_data.get("weight")} kg')
                print(f'   - Height: {growth_data.get("height")} cm')
                print(f'   - Gender: {growth_data.get("gender")}')
                print(f'   - Confidence: {growth_data.get("confidence")}')
            else:
                print(f'ℹ️ [STEP 4/4] No sufficient growth data found in transcript')
                
        except Exception as e:
            print(f'❌ [STEP 4/4] Growth data extraction failed: {e}')
            import traceback
            traceback.print_exc()
            # Don't fail the whole process, just log the error

        print(f'✅ All 4 steps completed (including growth data extraction)')
        
        # Return combined payload for legacy compatibility (if needed for S3 storage)
        return {
            "medical_summary": final_summary,
            "medical_categories": final_categories_parsed,
            "full_transcript": session.get('transcript_buffer', '').strip(),
            "summary_stats": summary_stats,
            "categories_stats": categories_stats,
            "context": context,
            "ai_model": self.aws_bedrock_service.model_name,
            "growth_data": growth_data,
            "evaluation_result": evaluation_result
        }

    async def generate_prescription(self, websocket: WebSocketServerProtocol, data: Dict):
        """Generate prescription progressively with 3 separate messages."""
        session_id = data.get('session_id')
        updated_transcript = data.get('transcript')
        context = data.get('context') or 'Generic'
        ai_model = data.get('ai_model')

        print(f'🏥 GENERATE_PRESCRIPTION REQUEST:')
        print(f'   Session ID: {session_id}')
        print(f'   Context: {context}')
        print(f'   AI Model: {ai_model}')
        print(f'   Updated transcript provided: {updated_transcript is not None}')
        if updated_transcript:
            print(f'   Transcript length: {len(updated_transcript)}')
            print(f'   Transcript preview: "{self.sanitize_for_log(updated_transcript, 200)}"')

        if not session_id or session_id not in self.active_sessions:
            print(f'❌ Invalid session for prescription: {session_id}')
            print(f'🔍 Active sessions: {list(self.active_sessions.keys())}')
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Invalid session'
            }))
            return

        session = self.active_sessions[session_id]

        # Log current session transcript before update
        current_transcript = session.get('transcript_buffer', '')
        print(f'📄 CURRENT SESSION TRANSCRIPT:')
        print(f'   Length: {len(current_transcript)}')
        print(f'   Preview: "{self.sanitize_for_log(current_transcript, 200)}"')

        # Update transcript if provided
        if updated_transcript is not None:
            old_transcript = session.get('transcript_buffer', '')
            session['transcript_buffer'] = updated_transcript.strip()
            
            print(f'📝 TRANSCRIPT UPDATED FOR PRESCRIPTION:')
            print(f'   Changed: {old_transcript != session["transcript_buffer"]}')
            print(f'   Old length: {len(old_transcript)}')
            print(f'   New length: {len(session["transcript_buffer"])}')
            print(f'   New content: "{self.sanitize_for_log(session["transcript_buffer"], 300)}"')

        # Switch model if requested
        if ai_model:
            try:
                self.aws_bedrock_service.set_model(ai_model)
                print(f"📌 Model selected: {ai_model}")
            except ValueError as e:
                print(f"⚠️ Invalid model requested: {e}")

        try:
            # Final check before processing
            final_transcript = session.get('transcript_buffer', '')
            print(f'🔬 PROCESSING WITH FINAL TRANSCRIPT:')
            print(f'   Length: {len(final_transcript)}')
            print(f'   Content: "{self.sanitize_for_log(final_transcript, 400)}"')
            
            # ✅ Use progressive generation with named parameters
            await self.build_prescription_payload_progressive(
                session=session,
                context=context,
                websocket=websocket,
                session_id=session_id
            )

            print(f'✅ Progressive prescription generation completed for session: {session_id}')

        except Exception as e:
            print(f'❌ Prescription generation failed: {e}')
            import traceback
            traceback.print_exc()
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Prescription generation failed',
                'error': str(e)
            }))


    async def _test_s3_connection(self):
        """Test S3 connection on service startup"""
        try:
            success = await self.s3_storage_service.check_bucket_access()
            if success:
                print("S3 storage service ready")
            else:
                print("Warning: S3 storage service unavailable - session data will only be saved locally")
        except Exception as e:
            print(f"S3 connection test failed: {e}")

    async def end_real_time_session(self, websocket: WebSocketServerProtocol, data: Dict):
        """End real-time session immediately and process cleanup in background"""
        session_id = data.get('session_id')
        ai_model = data.get('ai_model')
        user_sub = data.get('user_id')
        username = data.get('username')
        print(f'🏁 Username is to be saved: {username}')
        user_sub = username or data.get('user_id')  # Use username as user_sub
        print(f'🏁 Username to be saved2: {username}')
        print(f'👤 User_sub: {user_sub}')
        if not session_id or session_id not in self.active_sessions:
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Invalid session'
            }))
            return

        session = self.active_sessions[session_id]
        context = data.get('context') or session.get('context', 'Generic')
        
        try:
            print(f'🔚 Ending session: {session_id}')

            # Step 1: Stop VAD stream immediately
            if session.get('vad_active'):
                await self.vad_service.stop_vad_stream(session_id)
                session['vad_active'] = False
                print(f'✅ VAD stream stopped for session: {session_id}')

            # Step 2: Mark session as "ending" to prevent new audio processing
            session['ending'] = True
            
            # Step 3: Calculate session duration
            duration = (datetime.now() - session['start_time']).total_seconds()
            
            # Step 4: Send immediate response to frontend
            immediate_response = {
                'type': 'session_ended',
                'data': {
                    'session_id': session_id,
                    'duration': duration,
                    'started_at': session['start_time'].isoformat(),
                    'ended_at': datetime.now().isoformat(),
                    'message': 'Session ended successfully. Processing data in background...',
                    'background_processing': True
                }
            }
            
            await websocket.send(json.dumps(immediate_response))
            print(f'✅ Immediate session_ended response sent to frontend')

            # Step 5: Create a deep copy of session data for background processing
            # This prevents issues if user starts a new session immediately
            session_data_copy = {
                'session_id': session_id,
                'user_sub': user_sub,
                'username': username,
                'audio_buffer': session.get('audio_buffer', []).copy(),
                'transcript_buffer': session.get('transcript_buffer', ''),
                'start_time': session['start_time'],
                'end_time': datetime.now(),
                'context': context,
                'processing_mode': session.get('processing_mode'),
                'preferred_language': session.get('preferred_language'),
                'detected_language': session.get('detected_language'),
                'ai_model': ai_model or self.aws_bedrock_service.model_name,
                'feedback': session.get('feedback', []).copy() if session.get('feedback') else []
            }
            
            # Step 6: Remove session from active sessions immediately
            # This allows user to start a new session right away
            del self.active_sessions[session_id]
            print(f'✅ Session removed from active sessions: {session_id}')
            
            # Step 7: Launch background processing task (fire and forget)
            asyncio.create_task(
                self._process_session_background(session_data_copy)
            )
            print(f'🚀 Background processing task launched for session: {session_id}')

        except Exception as e:
            print(f'❌ End session error: {e}')
            import traceback
            traceback.print_exc()
            
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Failed to end session'
            }))


    async def process_real_time_audio(self, websocket: WebSocketServerProtocol, data: Dict):
        """Process real-time audio stream and send to VAD"""
        session_id = data.get('session_id')
        audio_data = data.get('audio_data')

        if not session_id or session_id not in self.active_sessions:
            print(f"Invalid session: {session_id}")
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Invalid session'
            }))
            return

        session = self.active_sessions[session_id]
        
        # Check if session is ending - reject new audio
        if session.get('ending', False):
            print(f"⚠️ Session {session_id} is ending, ignoring audio chunk")
            return

        if not session.get('vad_active'):
            print(f"VAD not active for session: {session_id}")
            return

        try:
            # Convert base64 audio data to bytes
            audio_buffer = base64.b64decode(audio_data)

            # Validate audio data size
            if len(audio_buffer) % 2 != 0:
                print('⚠️ Invalid audio data size, skipping chunk')
                return

            # Add to current chunk (for VAD processing)
            session['current_chunk'].append(audio_buffer)

            # Send audio chunk to VAD stream
            success = await self.vad_service.send_audio_chunk(
                session_id=session_id,
                audio_data=audio_buffer,
                encoding="audio/wav",
                sample_rate=16000
            )

            if not success:
                print(f'⚠️ Failed to send audio to VAD stream: {session_id}')

        except Exception as e:
            print(f'Real-time audio processing error: {e}')
            await session['websocket'].send(json.dumps({
                'type': 'error',
                'message': 'Audio processing failed'
            }))

    async def _process_session_background(self, session_data: Dict):
        """Process session data in background after immediate session end response"""
        session_id = session_data['session_id']
        user_sub = session_data['user_sub']
        username = session_data['username']
        
        try:
            print(f'🔄 [BACKGROUND] Starting background processing for session: {session_id}')
            
            # Step 1: Audio Diarization Processing 🎙️
            diarization_results = None
            audio_file_path = None
            
            if session_data['audio_buffer']:
                print(f'🎙️ [BACKGROUND] Starting diarization processing...')
                try:
                    # Save full conversation audio
                    audio_file_path = await self.diarization_service.save_conversation_audio(
                        session_id=session_id,
                        audio_chunks=session_data['audio_buffer'],
                        sample_rate=16000,
                        channels=1
                    )

                    if audio_file_path:
                        # Process diarization
                        diarization_results = await self.diarization_service.process_diarization(
                            audio_file_path=audio_file_path,
                            num_speakers=2,
                            model="saarika:v2.5"
                        )
                        print(f'✅ [BACKGROUND] Diarization completed successfully')
                    else:
                        print(f'⚠️ [BACKGROUND] Failed to save conversation audio')
                        
                except Exception as e:
                    print(f'❌ [BACKGROUND] Diarization processing failed: {e}')
            else:
                print(f'ℹ️ [BACKGROUND] No audio data for diarization')

            # Step 2: Generate Prescription 💊
            prescription_payload = None
            try:
                print(f'💊 [BACKGROUND] Generating prescription payload...')
                
                # ✅ Create a proper session dict with all required fields
                temp_session = {
                    'id': session_data['session_id'],  # Required for evaluation storage
                    'transcript_buffer': session_data['transcript_buffer'],
                    'username': session_data.get('username'),  # Required for evaluation storage
                    'context': session_data['context']
                }
                
                prescription_payload = await self.build_prescription_payload(
                    temp_session, 
                    session_data['context']
                )
                
                print(f'✅ [BACKGROUND] Prescription payload generated successfully')
                print(f'   - Medical summary length: {len(prescription_payload.get("medical_summary", ""))}')
                print(f'   - Has categories: {bool(prescription_payload.get("medical_categories"))}')
                
            except Exception as e:
                print(f'❌ [BACKGROUND] Prescription generation failed: {e}')
                import traceback
                traceback.print_exc()

            # Step 3: Feedback Check & Retry 📝
            feedback_count = 0
            csv_failed_count = 0
            
            if session_data.get('feedback'):
                feedback_count = len(session_data['feedback'])
                csv_failed_count = len([f for f in session_data['feedback'] if not f.get('csv_stored', False)])
                
                if csv_failed_count > 0:
                    print(f"⚠️ [BACKGROUND] {csv_failed_count} feedback entries failed CSV storage during session")
                    # Retry failed feedback storage
                    for feedback in session_data['feedback']:
                        if not feedback.get('csv_stored', False):
                            try:
                                feedback_data = {
                                    'session_id': session_id,
                                    'user_id': session_data.get('username'),
                                    'feedback_type': feedback.get('type'),
                                    'feedback_text': feedback.get('text'),
                                    'panel': feedback.get('Panel'),
                                    'timestamp': datetime.fromisoformat(feedback.get('timestamp'))
                                }
                                csv_success = await self.s3_storage_service.store_feedback_to_csv(feedback_data)
                                if csv_success:
                                    print(f"✅ [BACKGROUND] Retry: Feedback stored to CSV")
                            except Exception as retry_error:
                                print(f"❌ [BACKGROUND] Retry failed for feedback: {retry_error}")

            # Step 4: Upload Everything to S3 ☁️
            s3_upload_results = None
            if user_sub:
                try:
                    print(f'☁️ [BACKGROUND] Uploading session data to S3 for user: {user_sub}')
                    
                    # Prepare session metadata
                    session_metadata = {
                        "session_id": session_id,
                        "user_sub": user_sub,
                        "start_time": session_data['start_time'].isoformat(),
                        "end_time": session_data['end_time'].isoformat(),
                        "duration": (session_data['end_time'] - session_data['start_time']).total_seconds(),
                        "context": session_data['context'],
                        "processing_mode": session_data.get('processing_mode'),
                        "preferred_language": session_data.get('preferred_language'),
                        "detected_language": session_data.get('detected_language'),
                        "ai_model": session_data['ai_model'],
                        "vad_enabled": True,
                        "audio_chunks_count": len(session_data.get('audio_buffer', [])),
                        "transcript_length": len(session_data.get('transcript_buffer', '')),
                        "feedback_count": feedback_count,
                        "feedback_csv_failed_count": csv_failed_count,
                        "has_prescription": prescription_payload is not None
                    }
                    
                    # Add prescription stats if available
                    if prescription_payload:
                        session_metadata['summary_stats'] = prescription_payload.get('summary_stats', {})
                        session_metadata['categories_stats'] = prescription_payload.get('categories_stats', {})
                    
                    # Add diarization stats if available
                    if diarization_results and 'statistics' in diarization_results:
                        session_metadata['diarization_stats'] = diarization_results['statistics']
                    
                    # Upload to S3
                    s3_upload_results = await self.s3_storage_service.upload_session_data(
                        user_sub=user_sub,
                        session_id=session_id,
                        audio_file_path=audio_file_path,
                        transcript=session_data.get('transcript_buffer', ''),
                        diarization_results=diarization_results,
                        medical_prescription=prescription_payload.get('medical_summary', '') if prescription_payload else "",
                        session_metadata=session_metadata
                    )
                    
                    print(f'✅ [BACKGROUND] S3 upload completed: {s3_upload_results["success"]}')
                    
                    # Log prescription storage status
                    if prescription_payload:
                        print(f'📊 [BACKGROUND] Prescription included in S3 upload')
                        print(f'   - Medical summary length: {len(prescription_payload.get("medical_summary", ""))}')
                        print(f'   - Categories present: {list(prescription_payload.get("medical_categories", {}).keys())}')
                    else:
                        print(f'⚠️ [BACKGROUND] No prescription generated - check logs above for errors')
                    
                except Exception as e:
                    print(f'❌ [BACKGROUND] S3 upload failed: {e}')
                    import traceback
                    traceback.print_exc()
            else:
                print(f'ℹ️ [BACKGROUND] No user_sub provided, skipping S3 upload')

            # Step 5: Cleanup temporary files 🗑️
            if audio_file_path and os.path.exists(audio_file_path):
                try:
                    os.remove(audio_file_path)
                    print(f'🗑️ [BACKGROUND] Temporary audio file cleaned up: {audio_file_path}')
                except Exception as cleanup_error:
                    print(f'⚠️ [BACKGROUND] Failed to cleanup audio file: {cleanup_error}')

            print(f'✅ [BACKGROUND] Background processing completed for session: {session_id}')
            
        except Exception as e:
            print(f'❌ [BACKGROUND] Background processing error for session {session_id}: {e}')
            import traceback
            traceback.print_exc()

    # ============================================================================
    # UTILITY METHODS
    # ============================================================================

    def is_authorized_language(self, transcript: str, detected_language: str, doctor_known_languages: List[str]) -> bool:
        """Check if language and content are authorized based on doctor's profile"""
        if not doctor_known_languages:
            return True

        # Check if detected language is in doctor's known languages
        if detected_language not in doctor_known_languages:
            print(f'❌ Language {detected_language} not in doctor\'s profile {doctor_known_languages}')
            return False

        # For Telugu, check for transliterated English
        if detected_language == 'te-IN' and LanguageUtils.contains_english_transliteration(transcript):
            print('🚫 Contains English transliteration, not authorized')
            return False

        return True

    def contains_english_transliteration(self, transcript: str) -> bool:
        """Check if content contains English transliterated into Telugu script"""
        # Count how many English transliterations we find
        count = 0
        for word in self.english_in_telugu:
            if word in transcript:
                count += 1

        # If we find 2 or more English words in Telugu script, it's likely transliterated
        return count >= 2

    async def get_session_status(self, session_id: str) -> Dict[str, Any]:
        """Get current status of a session"""
        if session_id not in self.active_sessions:
            return {'error': 'Session not found'}
        
        session = self.active_sessions[session_id]
        vad_stats = await self.vad_service.get_stream_stats(session_id)
        
        return {
            'session_id': session_id,
            'start_time': session['start_time'].isoformat(),
            'duration': (datetime.now() - session['start_time']).total_seconds(),
            'vad_active': session.get('vad_active', False),
            'speech_in_progress': session.get('speech_in_progress', False),
            'transcript_length': len(session.get('transcript_buffer', '')),
            'audio_chunks_count': len(session.get('audio_buffer', [])),
            'detected_language': session.get('detected_language'),
            'processing_mode': session.get('processing_mode'),
            'context': session.get('context'),
            'vad_stats': vad_stats
        }

    async def list_active_sessions(self) -> List[str]:
        """Get list of all active sessions"""
        return list(self.active_sessions.keys())

    async def force_stop_session(self, session_id: str) -> bool:
        """Force stop a session (admin/debug function)"""
        if session_id not in self.active_sessions:
            return False
        
        try:
            await self._cleanup_session(session_id)
            return True
        except Exception as e:
            print(f'Force stop session error: {e}')
            return False

    async def shutdown(self):
        """Shutdown service and cleanup all resources"""
        print('🛑 Shutting down RealTimeTranscriptionService...')
        
        # Stop all VAD streams
        await self.vad_service.stop_all_streams()
        
        # Clear all sessions
        self.active_sessions.clear()
        
        print('✅ RealTimeTranscriptionService shutdown complete')