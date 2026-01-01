import asyncio
import json
import base64
import uuid
import time
import aiohttp
import os
import tempfile
import subprocess
from datetime import datetime
from typing import Dict, List, Set, Optional, Any
from pathlib import Path
import websockets
from websockets.server import WebSocketServerProtocol
import aiofiles
from dotenv import load_dotenv
from aiohttp import FormData

# Load environment variables
load_dotenv()

class SarvamService:
    def __init__(self):
        self.api_key = os.getenv("SARVAM_API_KEY")
        if not self.api_key:
            raise ValueError("SARVAM_API_KEY not found in environment variables")
        
        self.base_url = "https://api.sarvam.ai"
        self.endpoint = "/speech-to-text-translate"
    
    async def _convert_to_wav(self, file_path: str) -> str:
        """Convert input file to 16kHz mono WAV if needed"""
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        temp_file.close()
        
        cmd = [
            "ffmpeg", "-y", "-i", file_path,
            "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
            temp_file.name
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return temp_file.name

    async def transcribe_audio(self, audio_file_path: Path, options: Dict = None) -> Dict:
        """Transcribe audio using Sarvam AI API"""
        print(f"Transcribing audio file: {audio_file_path}")
        if options is None:
            options = {}
        
        # Convert to proper WAV format if needed
        converted_file = await self._convert_to_wav(str(audio_file_path))

        url = f"{self.base_url}{self.endpoint}"
        headers = {"api-subscription-key": self.api_key}
        
        # Read audio file
        async with aiofiles.open(converted_file, 'rb') as f:
            audio_data = await f.read()
        
        # Prepare form data using aiohttp.FormData
        form_data = aiohttp.FormData()
        form_data.add_field("model", options.get("model", "saaras:v2.5"))
        
        if "prompt" in options:
            form_data.add_field("prompt", options["prompt"])
        if "target_language" in options:
            form_data.add_field("target_language", options["target_language"])
        if "language" in options:
            form_data.add_field("language", options["language"])
        
        # Add the audio file
        form_data.add_field(
            "file", 
            audio_data, 
            filename=os.path.basename(converted_file),
            content_type="audio/wav"
        )
        
        print(f"Sending request to Sarvam API with model: {options.get('model', 'saaras:v2.5')}")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, data=form_data) as response:
                    if response.status == 200:
                        result = await response.json()
                        # Clean up temporary file
                        try:
                            os.unlink(converted_file)
                        except:
                            pass
                        return result
                    else:
                        error_text = await response.text()
                        raise Exception(f"Sarvam API Error {response.status}: {error_text}")
        except Exception as e:
            # Clean up temporary file on error too
            try:
                os.unlink(converted_file)
            except:
                pass
            raise e

    async def translate_text(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translate text using Sarvam AI API"""
        # Note: This is a placeholder as the provided API endpoint does text translation
        # You might need to use a different endpoint for text translation
        # For now, we'll use the speech endpoint with a very short audio of the text
        # This is not ideal but works as a temporary solution
        
        # Create a temporary audio file with the text (using system TTS)
        temp_dir = Path('uploads/temp')
        temp_dir.mkdir(parents=True, exist_ok=True)
        temp_file = temp_dir / f"translate_{uuid.uuid4().hex[:8]}.wav"
        
        # Use espeak to create audio from text (you might need to install it)
        try:
            subprocess.run([
                "espeak", "-w", str(temp_file), 
                "-v", f"{source_lang.split('-')[0]}", 
                text
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except:
            # Fallback: return the original text if TTS fails
            return text
        
        # Transcribe with translation
        result = await self.transcribe_audio(temp_file, {
            "target_language": target_lang
        })
        
        # Clean up
        try:
            os.unlink(temp_file)
        except:
            pass
        
        return result.get("transcript", text)

class AWSBedrockService:
    def __init__(self):
        # Placeholder for AWS Bedrock service
        pass
    
    async def generate_medical_summary(self, medical_categories: Dict) -> Dict:
        """Generate medical summary using AWS Bedrock"""
        # This is a placeholder implementation
        # In a real implementation, you would call AWS Bedrock API here
        return {
            "summary": "This is a placeholder medical summary. Implement AWS Bedrock integration for actual medical summarization.",
            "stats": {"categories_processed": len(medical_categories)}
        }

class RealTimeTranscriptionService:
    def __init__(self):
        self.sarvam_service = SarvamService()
        self.aws_bedrock_service = AWSBedrockService()
        self.active_sessions = {}
        self.script_patterns = {
            'en-IN': r'[a-zA-Z]',
            'hi-IN': r'[\u0900-\u097F]',
            'te-IN': r'[\u0C00-\u0C7F]',
            'ta-IN': r'[\u0B80-\u0BFF]',
            'kn-IN': r'[\u0C80-\u0CFF]',
            'ml-IN': r'[\u0D00-\u0D7F]',
            'bn-IN': r'[\u0980-\u09FF]',
            'gu-IN': r'[\u0A80-\u0AFF]',
            'mr-IN': r'[\u0900-\u097F]',
            'pa-IN': r'[\u0A00-\u0A7F]'
        }
        
        # English words in Telugu script for transliteration detection
        self.english_in_telugu = [
            'ఆల్', 'రైట్', 'లెట్', 'మీ', 'స్టార్ట్', 'కన్వర్సేషన్', 'అగైన్',
            'జస్ట్', 'గెట్టింగ్', 'రెస్పాన్స్', 'ప్రాపర్లీ', 'డిటెక్ట్',
            'ఇంగ్లీష్', 'ఐయామ్', 'కైండ్', 'ఆఫ్', 'టేకింగ్', 'సమ్', 'టైమ్స్',
            'డూయింగ్', 'గుడ్', 'జాబ్', 'కాకపోతే', 'ఐ', 'సీ', 'లైక్', 'ది',
            'అవుట్పుట్', 'ఈజ్', 'ఇన్పుట్', 'సిస్టమ్', 'ప్రాబ్లమ్', 'సల్యూషన్',
            'ఫిక్స్', 'ఇష్యూ', 'రిజల్ట్', 'టెస్ట్', 'చెక్', 'వర్క్', 'ఫైన్', 'ఓకే'
        ]

    def sanitize_for_log(self, input_text: str, max_length: int = 200) -> str:
        """Sanitize input for logging to prevent log injection"""
        if not isinstance(input_text, str):
            return str(input_text)
        return input_text.replace('\r', ' ').replace('\n', ' ').replace('\t', ' ')[:max_length]

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
                if session_id and session_id in self.active_sessions:
                    # Clean up session
                    del self.active_sessions[session_id]
            except Exception as e:
                print(f'WebSocket error: {e}')
                if session_id and session_id in self.active_sessions:
                    # Clean up session
                    del self.active_sessions[session_id]
        
        server = await websockets.serve(connection_handler, host, port)
        print(f'WebSocket server started on ws://{host}:{port}')
        return server

    async def handle_websocket_message(self, websocket: WebSocketServerProtocol, message: str):
        """Handle different types of WebSocket messages"""
        try:
            data = json.loads(message)
            message_type = data.get('type')
            
            if message_type == 'start_session':
                await self.start_real_time_session(websocket, data)
            elif message_type == 'audio_stream':
                await self.process_real_time_audio(websocket, data)
            elif message_type == 'end_session':
                await self.end_real_time_session(websocket, data)
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

    async def start_real_time_session(self, websocket: WebSocketServerProtocol, data: Dict):
        """Start a new real-time transcription session"""
        session_id = f"realtime_{int(time.time())}_{uuid.uuid4().hex[:8]}"
        
        # Extract configuration from session start data
        preferred_language = data.get('preferred_language')
        processing_mode = data.get('processing_mode', 'translate')
        code_switching_mode = data.get('code_switching_mode', False)
        doctor_known_languages = data.get('doctor_known_languages')
        doctor_profile = data.get('doctor_profile')
        
        session = {
            'id': session_id,
            'websocket': websocket,
            'start_time': datetime.now(),
            'audio_buffer': [],
            'transcript_buffer': '',
            'speakers': set(),
            'detected_language': None,
            'preferred_language': preferred_language,
            'processing_mode': processing_mode,
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
            'last_processed_time': time.time(),
            'is_processing': False
        }
        
        self.active_sessions[session_id] = session
        
        await websocket.send(json.dumps({
            'type': 'session_started',
            'session_id': session_id,
            'message': 'Real-time transcription session started'
        }))
        
        print(f'🎤 Started real-time session: {session_id}')

    async def process_real_time_audio(self, websocket: WebSocketServerProtocol, data: Dict):
        """Process real-time audio stream"""
        session_id = data.get('session_id')
        audio_data = data.get('audio_data')
        audio_format = data.get('format')
        
        # Debug log
        print(f"Received audio data for session {session_id}, format: {audio_format}, size: {len(audio_data) if audio_data else 0}")
        
        if not session_id or session_id not in self.active_sessions:
            print(f"Invalid session: {session_id}")
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Invalid session'
            }))
            return
        
        session = self.active_sessions[session_id]
        
        try:
            # Convert base64 audio data to bytes
            audio_buffer = base64.b64decode(audio_data)
            print(f"Decoded audio buffer size: {len(audio_buffer)} bytes")
            
            # Validate audio data size (should be even for 16-bit samples)
            if len(audio_buffer) % 2 != 0:
                print('⚠️ Invalid audio data size, skipping chunk')
                return
            
            session['audio_buffer'].append(audio_buffer)
            print(f'📊 Audio chunk received: {len(audio_buffer)} bytes, total buffer: {sum(len(buf) for buf in session["audio_buffer"])} bytes')
            
            # Process audio every 4 seconds or when buffer is large enough
            now = time.time()
            time_since_last_process = now - session['last_processed_time']
            total_buffer_size = sum(len(buf) for buf in session['audio_buffer'])
            
            if time_since_last_process >= 4 or total_buffer_size >= 150000:
                await self.process_accumulated_audio(session)
                session['last_processed_time'] = now
            
        except Exception as e:
            print(f'Real-time audio processing error: {e}')
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Audio processing failed'
            }))

    async def process_accumulated_audio(self, session: Dict):
        """Process accumulated audio buffer with intelligent language detection"""
        if not session['audio_buffer'] or session['is_processing']:
            return
        
        session['is_processing'] = True
        
        try:
            # Combine audio buffers
            combined_buffer = b''.join(session['audio_buffer'])
            session['audio_buffer'] = []  # Clear buffer
            
            # Skip if buffer is too small (less than 0.5 seconds of audio)
            if len(combined_buffer) < 8000:  # 16000Hz * 16-bit * 0.5s / 8
                print('⚠️ Skipping small audio buffer')
                return
                
            # Create temporary file for processing
            temp_dir = Path('uploads/audio')
            temp_dir.mkdir(parents=True, exist_ok=True)
            temp_file_path = temp_dir / f"realtime_{session['id']}_{int(time.time())}.wav"
            
            # Create proper WAV file with headers
            wav_buffer = self.create_wav_buffer(combined_buffer, 16000, 1)
            
            async with aiofiles.open(temp_file_path, 'wb') as f:
                await f.write(wav_buffer)
            
            # Process with intelligent language detection
            transcription_result = await self.intelligent_transcription(temp_file_path, session)
            
            if transcription_result and transcription_result.get('transcript', '').strip():
                # Force unauthorized content to authorized language instead of blocking
                if (session['doctor_known_languages'] and 
                    not self.is_authorized_language(
                        transcription_result['transcript'], 
                        transcription_result['language_code'], 
                        session['doctor_known_languages']
                    )):
                    print(f'🔄 FORCING: Unauthorized content to {session["doctor_known_languages"][0]}')
                    transcription_result['language_code'] = session['doctor_known_languages'][0]
                
                # Skip only if truly empty
                if not transcription_result['transcript'].strip():
                    print('⚠️ Skipping empty audio chunk (no speech detected)')
                    return
                
                # Update language tracking with actual detected language
                actual_language = self.detect_actual_language(transcription_result['transcript'])
                self.update_language_detection(session, actual_language)
                
                final_transcript = transcription_result['transcript']
                final_language_code = transcription_result['language_code']
                
                print(f'🔍 DEBUG: Processing mode: {session["processing_mode"]}, Preferred language: {session["preferred_language"]}')
                
                # Handle translation if in translate mode
                if session['processing_mode'] == 'translate' and session['preferred_language']:
                    print('🌍 ENTERING TRANSLATION LOGIC')
                    try:
                        # Use translation service
                        translated_text = await self.sarvam_service.translate_text(
                            transcription_result['transcript'],
                            actual_language,
                            session['preferred_language']
                        )
                        
                        if translated_text and translated_text.strip():
                            final_transcript = translated_text
                            final_language_code = session['preferred_language']
                            print(f'✅ Translation: "{self.sanitize_for_log(transcription_result["transcript"])}" → "{self.sanitize_for_log(translated_text)}"')
                        else:
                            final_transcript = transcription_result['transcript']
                            final_language_code = session['preferred_language']
                            print('⚠️ Translation failed, using original with target language label')
                    except Exception as e:
                        print(f'Translation error: {e}')
                        final_transcript = transcription_result['transcript']
                        final_language_code = session['preferred_language']
                
                # Update session data with final transcript
                session['transcript_buffer'] += f" {final_transcript}"
                
                # Real-time speaker identification only
                speaker_info = await self.identify_speaker(final_transcript)
                
                # Send real-time update to client
                response = {
                    'type': 'transcription_update',
                    'session_id': session['id'],
                    'transcript': final_transcript,
                    'language': final_language_code,
                    'processing_mode': session['processing_mode'],
                    'was_translated': session['processing_mode'] == 'translate' and final_transcript != transcription_result['transcript'],
                    'timestamp': datetime.now().isoformat()
                }
                
                if session['processing_mode'] == 'translate':
                    response['original_transcript'] = transcription_result['transcript']
                    response['original_language'] = transcription_result['language_code']
                    response['detected_language'] = session.get('detected_language') or self.detect_actual_language(transcription_result['transcript'])
                
                if session.get('detected_language'):
                    response['detected_languages'] = [session['detected_language']]
                
                if speaker_info:
                    response['speaker'] = speaker_info.get('speaker')
                
                await session['websocket'].send(json.dumps(response))
                
                mode_label = '🌍 Translated' if session['processing_mode'] == 'translate' else '📝 Transcribed'
                print(f'{mode_label} [{self.sanitize_for_log(final_language_code)}]: {self.sanitize_for_log(final_transcript)}')
                
                if session['processing_mode'] == 'translate' and final_transcript != transcription_result['transcript']:
                    print(f'   Original [{self.sanitize_for_log(transcription_result["language_code"])}]: {self.sanitize_for_log(transcription_result["transcript"])}')
            
            # Clean up temporary file
            try:
                os.unlink(temp_file_path)
            except Exception as e:
                print(f'Error deleting temp file: {e}')
                
        except Exception as e:
            print(f'Accumulated audio processing error: {e}')
            await session['websocket'].send(json.dumps({
                'type': 'error',
                'message': 'Transcription processing failed'
            }))
        finally:
            session['is_processing'] = False

    async def intelligent_transcription(self, audio_file_path: Path, session: Dict) -> Dict:
        """Intelligent transcription with code-switching support"""
        try:
            # CRITICAL: In translate mode, ALWAYS restrict to doctor's known languages
            if session['processing_mode'] == 'translate' and session['doctor_known_languages']:
                print(f'🌍 Translate mode with doctor profile: STRICT language restriction to {session["doctor_known_languages"]}')
                result = await self.try_doctor_languages_strict(audio_file_path, session)
                if result and result.get('transcript', '').strip():
                    print(f'✅ Restricted language transcription: [{result["language_code"]}] "{result["transcript"]}"')
                    return result
                
                # If no result from known languages, force with first known language
                print(f'🔄 No valid result, forcing transcription with {session["doctor_known_languages"][0]}')
                forced_result = await self.sarvam_service.transcribe_audio(audio_file_path, {
                    'language': session['doctor_known_languages'][0]
                })
                return forced_result
            
            # Fallback to auto-detection only if no doctor profile
            print('🌍 Translate mode: No doctor profile, using auto-detection')
            result = await self.sarvam_service.transcribe_audio(audio_file_path, {
                'language': 'auto'
            })
            return result
            
        except Exception as e:
            print(f'Intelligent transcription error: {e}')
            raise

    async def try_doctor_languages_strict(self, audio_file_path: Path, session: Dict) -> Dict:
        """Try doctor's known languages with STRICT restriction"""
        doctor_languages = session['doctor_known_languages']
        print(f'👨‍⚕️ STRICT mode - only trying doctor\'s languages: {doctor_languages}')
        
        # Try each of doctor's known languages in order
        for language in doctor_languages:
            print(f'🎯 Trying doctor language: {language}')
            try:
                result = await self.sarvam_service.transcribe_audio(audio_file_path, {
                    'language': language
                })
                
                if result.get('transcript', '').strip():
                    # Always accept transcript but force language code
                    result['language_code'] = language
                    print(f'✅ Doctor language accepted (forced): {language} - "{result["transcript"]}"')
                    return result
            except Exception as e:
                print(f'❌ Doctor language {language} failed: {e}')
                continue
        
        # Fallback just in case
        print(f'🔄 Fallback: Using first language {doctor_languages[0]}')
        fallback_result = await self.sarvam_service.transcribe_audio(audio_file_path, {
            'language': doctor_languages[0]
        })
        return fallback_result

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

    def is_authorized_language(self, transcript: str, detected_language: str, doctor_known_languages: List[str]) -> bool:
        """Check if language and content are authorized based on doctor's profile"""
        if not doctor_known_languages:
            return True
        
        # Check if detected language is in doctor's known languages
        if detected_language not in doctor_known_languages:
            print(f'❌ Language {detected_language} not in doctor\'s profile {doctor_known_languages}')
            return False
        
        # For Telugu, check for transliterated English
        if detected_language == 'te-IN' and self.contains_english_transliteration(transcript):
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

    async def identify_speaker(self, transcript: str) -> Dict:
        """Identify speaker from transcript content"""
        text = transcript.lower()
        
        # Patient indicators
        patient_indicators = ['pain', 'painful', 'hurt', 'feel', 'my hand', 'my head', 
                             'my stomach', 'i have', 'it hurts', 'i feel', 'help me',
                             'what should', 'when should', 'pulse']
        
        if any(indicator in text for indicator in patient_indicators):
            return {'speaker': 'PATIENT', 'confidence': 0.7}
        
        # Doctor indicators
        doctor_indicators = ['patient', 'medicine', 'prescription', 'diagnosis', 
                            'treatment', 'symptoms', 'blood pressure', 'fever', 
                            'tablet', 'injection', 'test', 'report', 'normal', 
                            'high', 'low', 'detects']
        
        if any(indicator in text for indicator in doctor_indicators):
            return {'speaker': 'DOCTOR', 'confidence': 0.8}
        
        # Default to SPEAKER for neutral content
        return {'speaker': 'SPEAKER', 'confidence': 0.3}

    def detect_actual_language(self, text: str) -> str:
        """Detect actual language from script content with Telugu preference"""
        if not text:
            return 'en-IN'
        
        # Count characters for each script
        script_counts = {}
        for lang, pattern in self.script_patterns.items():
            # This is a simplified version - in practice you'd use regex
            count = sum(1 for char in text if ord(char) in range(0x0C00, 0x0C7F)) if lang == 'te-IN' else 0
            script_counts[lang] = count
        
        # Find language with most characters
        max_count = 0
        detected_lang = 'en-IN'
        
        for lang, count in script_counts.items():
            if count > max_count:
                max_count = count
                detected_lang = lang
        
        return detected_lang if max_count > 0 else 'en-IN'

    def create_wav_buffer(self, audio_buffer: bytes, sample_rate: int, channels: int) -> bytes:
        """Create proper WAV file buffer with headers for PCM data"""
        length = len(audio_buffer)
        
        # WAV file header
        riff = b'RIFF'
        file_size = (36 + length).to_bytes(4, 'little')
        wave = b'WAVE'
        fmt = b'fmt '
        subchunk1_size = (16).to_bytes(4, 'little')
        audio_format = (1).to_bytes(2, 'little')  # PCM
        num_channels = channels.to_bytes(2, 'little')
        sample_rate_bytes = sample_rate.to_bytes(4, 'little')
        byte_rate = (sample_rate * channels * 2).to_bytes(4, 'little')
        block_align = (channels * 2).to_bytes(2, 'little')
        bits_per_sample = (16).to_bytes(2, 'little')
        data = b'data'
        subchunk2_size = length.to_bytes(4, 'little')
        
        # Combine all parts
        wav_buffer = (riff + file_size + wave + fmt + subchunk1_size + audio_format + 
                     num_channels + sample_rate_bytes + byte_rate + block_align + 
                     bits_per_sample + data + subchunk2_size + audio_buffer)
        
        return wav_buffer

    async def end_real_time_session(self, websocket: WebSocketServerProtocol, data: Dict):
        """End real-time session"""
        session_id = data.get('session_id')
        ai_model = data.get('ai_model')
        
        if not session_id or session_id not in self.active_sessions:
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Invalid session'
            }))
            return
        
        session = self.active_sessions[session_id]
        
        try:
            # Process any remaining audio
            if session['audio_buffer']:
                await self.process_accumulated_audio(session)
            
            # Set AI model if provided
            if ai_model:
                # self.aws_bedrock_service.set_model(ai_model)
                pass
            
            # Generate final medical summary
            try:
                summary_result = await self.aws_bedrock_service.generate_medical_summary(
                    session['medical_categories']
                )
                final_summary = summary_result.get('summary', summary_result)
                summary_stats = summary_result.get('stats')
            except Exception as e:
                print(f'Medical summary generation failed: {e}')
                final_summary = f"Medical Summary Generation Failed\n\nTranscript: {session['transcript_buffer']}\n\nNote: AWS Bedrock encountered an error. Please review the conversation manually."
                summary_stats = None
            
            session_summary = {
                'session_id': session_id,
                'duration': (datetime.now() - session['start_time']).total_seconds(),
                'full_transcript': session['transcript_buffer'].strip(),
                'medical_categories': session['medical_categories'],
                'medical_summary': final_summary,
                'summary_stats': summary_stats,
                'ai_model': ai_model,
                'ended_at': datetime.now().isoformat()
            }
            
            # Send final summary
            final_message = {
                'type': 'session_ended',
                'data': session_summary
            }
            
            print('📤 Sending session_ended message to frontend')
            await websocket.send(json.dumps(final_message))
            print('✅ session_ended message sent successfully')
            
            # Clean up session
            del self.active_sessions[session_id]
            
            print(f'🏁 Ended real-time session: {session_id}')
            
        except Exception as e:
            print(f'End session error: {e}')
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Failed to end session'
            }))

# Main entry point
async def main():
    service = RealTimeTranscriptionService()
    
    # Create uploads directory if it doesn't exist
    Path('uploads/audio').mkdir(parents=True, exist_ok=True)
    
    try:
        server = await service.initialize_websocket_server('0.0.0.0', 8765)
        print(f'WebSocket server started on ws://0.0.0.0:8765')
        
        # Keep the server running
        await asyncio.Future()  # Run forever
    except Exception as e:
        print(f"Failed to start server: {e}")
        # Clean up any resources if needed

if __name__ == '__main__':
    asyncio.run(main())