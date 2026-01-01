# services/sarvam_service.py (Extended version)
import os
import uuid
import tempfile
import subprocess
import aiofiles
import aiohttp
from pathlib import Path
from typing import Dict, Optional
from sarvamai import AsyncSarvamAI
from dotenv import load_dotenv
load_dotenv()

class SarvamService:
    def __init__(self):
        self.api_key = os.getenv("SARVAM_API_KEY")
        if not self.api_key:
            raise ValueError("SARVAM_API_KEY not found in environment variables")

        self.base_url = "https://api.sarvam.ai"
        self.endpoint = "/speech-to-text-translate"
        
        # Initialize AsyncSarvamAI client for advanced features
        self.async_client = AsyncSarvamAI(api_subscription_key=self.api_key)

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
        """Translate text using Sarvam AI API (placeholder using TTS -> STT)"""
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

    # ============================================================================
    # NEW METHODS FOR VAD AND DIARIZATION SUPPORT
    # ============================================================================

    def get_vad_streaming_client(self):
        """Get streaming client for VAD operations"""
        return self.async_client.speech_to_text_streaming

    def get_vad_translate_streaming_client(self):
        """Get streaming client for VAD translation operations"""
        return self.async_client.speech_to_text_translate_streaming

    def get_diarization_job_client(self):
        """Get job client for diarization operations"""
        return self.async_client.speech_to_text_job

    async def create_diarization_job(
        self,
        language_code: str = "en-IN",
        model: str = "saarika:v2.5",
        num_speakers: int = 2,
        with_timestamps: bool = True,
        with_diarization: bool = True
    ):
        """
        Create a diarization job using the AsyncSarvamAI client
        
        Args:
            language_code: Language code for processing
            model: Model to use for diarization
            num_speakers: Expected number of speakers
            with_timestamps: Include timestamps in output
            with_diarization: Enable speaker diarization
            
        Returns:
            Diarization job object
        """
        return await self.async_client.speech_to_text_job.create_job(
            language_code=language_code,
            model=model,
            with_timestamps=with_timestamps,
            with_diarization=with_diarization,
            num_speakers=num_speakers,
        )

    async def create_vad_stream(
        self,
        model: str = "saaras:v2.5",
        vad_signals: bool = True,
        use_translation: bool = False
    ):
        """
        Create a VAD streaming connection
        
        Args:
            model: Model to use for processing
            vad_signals: Enable VAD signals
            use_translation: Use translation streaming instead of regular STT
            
        Returns:
            Streaming connection context manager
        """
        stream_config = {
            "model": model,
            "vad_signals": vad_signals
        }
        
        if use_translation:
            return self.async_client.speech_to_text_translate_streaming.connect(**stream_config)
        else:
            return self.async_client.speech_to_text_streaming.connect(**stream_config)

    async def test_vad_connection(self) -> bool:
        """
        Test VAD streaming connection
        
        Returns:
            bool: True if connection successful
        """
        try:
            async with self.create_vad_stream() as ws:
                print("VAD connection test successful")
                return True
        except Exception as e:
            print(f"VAD connection test failed: {e}")
            return False

    async def test_diarization_connection(self) -> bool:
        """
        Test diarization job creation
        
        Returns:
            bool: True if job creation successful
        """
        try:
            job = await self.create_diarization_job()
            print(f"Diarization job creation test successful: {job}")
            return True
        except Exception as e:
            print(f"Diarization job creation test failed: {e}")
            return False

    def get_client_info(self) -> Dict[str, str]:
        """Get information about the Sarvam client configuration"""
        return {
            "api_key_configured": bool(self.api_key),
            "base_url": self.base_url,
            "endpoint": self.endpoint,
            "async_client_available": bool(self.async_client)
        }