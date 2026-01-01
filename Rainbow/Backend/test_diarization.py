import os
import sys
import json
import glob
import shutil
import asyncio
import tempfile
import subprocess
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pprint import pprint

# Load environment variables
load_dotenv()

try:
    from sarvamai import AsyncSarvamAI
except ImportError:
    print("❌ Error: sarvamai package not installed")
    print("Please install it with: pip install sarvamai")
    sys.exit(1)


class SimpleDiarizationTester:
    def __init__(self):
        self.api_key = os.getenv("SARVAM_API_KEY")
        if not self.api_key:
            print("❌ Error: SARVAM_API_KEY not found in environment variables")
            print("Please set SARVAM_API_KEY in your .env file")
            sys.exit(1)

        self.client = AsyncSarvamAI(api_subscription_key=self.api_key)
        self.output_dir = "/home/ubuntu/rainbow/rainbow/uploads/Output Diarization"
        
        
        # Timing variables
        self.timing_stats = {}

    def format_duration(self, seconds):
        """Format duration in a human-readable format"""
        if seconds < 60:
            return f"{seconds:.2f} seconds"
        elif seconds < 3600:
            minutes = int(seconds // 60)
            remaining_seconds = seconds % 60
            return f"{minutes}m {remaining_seconds:.2f}s"
        else:
            hours = int(seconds // 3600)
            minutes = int((seconds % 3600) // 60)
            remaining_seconds = seconds % 60
            return f"{hours}h {minutes}m {remaining_seconds:.2f}s"

    def convert_to_wav(self, file_path: str) -> str:
        """Convert input file to 16kHz mono WAV if needed"""
        if not shutil.which("ffmpeg"):
            print("❌ Error: ffmpeg not found. Please install ffmpeg")
            sys.exit(1)

        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        temp_file.close()

        print(f"🔄 Converting {file_path} to WAV format...")
        conversion_start = time.time()
        
        cmd = [
            "ffmpeg", "-y", "-i", file_path,
            "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
            temp_file.name
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        conversion_time = time.time() - conversion_start
        self.timing_stats['conversion_time'] = conversion_time
        
        if result.returncode != 0:
            print(f"❌ Error converting file: {result.stderr}")
            sys.exit(1)

        print(f"✅ File converted successfully in {self.format_duration(conversion_time)}")
        return temp_file.name

    async def test_diarization(self, audio_file_path: str, model: str = "saarika:v2.5", num_speakers: int = 2):
        """Test speaker diarization on the given audio file"""

        if not os.path.exists(audio_file_path):
            print(f"❌ Error: File {audio_file_path} not found")
            return

        # Start overall timing
        total_start_time = time.time()
        self.timing_stats['start_time'] = datetime.now()
        
        print(f"🎤 Testing speaker diarization on: {audio_file_path}")
        print(f"📊 Expected number of speakers: {num_speakers}")
        print(f"⏰ Started at: {self.timing_stats['start_time'].strftime('%Y-%m-%d %H:%M:%S')}")
        print("-" * 60)

        # Convert to WAV if needed
        converted_file = self.convert_to_wav(audio_file_path)

        try:
            # Create diarization job
            print("📡 Creating diarization job...")
            job_creation_start = time.time()
            job = await self.client.speech_to_text_job.create_job(
                language_code="en-IN",
                model=model,
                with_timestamps=True,
                with_diarization=True,
                num_speakers=num_speakers,
            )
            job_creation_time = time.time() - job_creation_start
            self.timing_stats['job_creation_time'] = job_creation_time
            print(f"✅ Job created in {self.format_duration(job_creation_time)}")

            # Upload file
            print("📤 Uploading audio file...")
            upload_start = time.time()
            await job.upload_files([converted_file])
            upload_time = time.time() - upload_start
            self.timing_stats['upload_time'] = upload_time
            print(f"✅ File uploaded in {self.format_duration(upload_time)}")

            # Start job
            print("🚀 Starting transcription job...")
            job_start_time = time.time()
            await job.start()
            
            # Wait for completion
            print("⏳ Waiting for job to complete...")
            processing_start = time.time()
            final_status = await job.wait_until_complete()
            processing_time = time.time() - processing_start
            total_job_time = time.time() - job_start_time
            
            self.timing_stats['processing_time'] = processing_time
            self.timing_stats['total_job_time'] = total_job_time
            
            print(f"✅ Job completed with status: {final_status}")
            print(f"⏱️  Processing took: {self.format_duration(processing_time)}")

            # Check if failed
            if await job.is_failed():
                error = await job.get_error()
                print(f"❌ Job failed: {error}")
                return

            # Download results
            print("📥 Downloading results...")
            download_start = time.time()
            os.makedirs(self.output_dir, exist_ok=True)
            await job.download_outputs(output_dir=self.output_dir)
            download_time = time.time() - download_start
            self.timing_stats['download_time'] = download_time
            print(f"✅ Results downloaded in {self.format_duration(download_time)}")

            # Process results
            processing_results_start = time.time()
            self.process_results()
            processing_results_time = time.time() - processing_results_start
            self.timing_stats['results_processing_time'] = processing_results_time

        except Exception as e:
            print(f"❌ Error during diarization: {e}")
            import traceback
            traceback.print_exc()
        finally:
            # Calculate total time
            total_time = time.time() - total_start_time
            self.timing_stats['total_time'] = total_time
            self.timing_stats['end_time'] = datetime.now()
            
            # Print timing summary
            self.print_timing_summary()
            
            # Cleanup converted file
            try:
                os.unlink(converted_file)
            except:
                pass

    def print_timing_summary(self):
        """Print a comprehensive timing summary"""
        print("\n" + "=" * 60)
        print("⏰ TIMING SUMMARY")
        print("=" * 60)
        
        if 'start_time' in self.timing_stats and 'end_time' in self.timing_stats:
            print(f"🕐 Started:           {self.timing_stats['start_time'].strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"🕐 Finished:          {self.timing_stats['end_time'].strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"🕐 Total Duration:    {self.format_duration(self.timing_stats['total_time'])}")
            print()
        
        print("📊 BREAKDOWN:")
        breakdown_items = [
            ('conversion_time', '🔄 File Conversion:'),
            ('job_creation_time', '📡 Job Creation:'),
            ('upload_time', '📤 File Upload:'),
            ('processing_time', '⚙️  API Processing:'),
            ('download_time', '📥 Download Results:'),
            ('results_processing_time', '📋 Results Processing:')
        ]
        
        for key, label in breakdown_items:
            if key in self.timing_stats:
                time_str = self.format_duration(self.timing_stats[key])
                percentage = (self.timing_stats[key] / self.timing_stats['total_time']) * 100
                print(f"{label:<20} {time_str:>12} ({percentage:5.1f}%)")
        
        print("-" * 60)
        
        # Performance insights
        if 'processing_time' in self.timing_stats and 'total_time' in self.timing_stats:
            api_percentage = (self.timing_stats['processing_time'] / self.timing_stats['total_time']) * 100
            print(f"📈 API processing was {api_percentage:.1f}% of total time")
            
            if api_percentage < 50:
                print("💡 Most time was spent on file operations - consider optimizing file handling")
            else:
                print("💡 Most time was spent on API processing - this is normal for complex audio")

    def get_audio_duration(self, file_path):
        """Get audio file duration using ffprobe"""
        try:
            cmd = [
                "ffprobe", "-v", "quiet", "-show_entries", 
                "format=duration", "-of", "csv=p=0", file_path
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                return float(result.stdout.strip())
        except:
            pass
        return None

    def process_results(self):
        """Process and display the diarization results with detailed debugging"""

        # Find JSON result files
        json_files = glob.glob(os.path.join(self.output_dir, "*.json"))

        if not json_files:
            print("❌ No result files found")
            return

        print(f"📋 Found {len(json_files)} result file(s)")

        for json_file in json_files:
            print(f"\n📄 Processing: {json_file}")
            print("=" * 60)

            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # DEBUG: Print the full JSON structure (with more detail for diarized_transcript)
            print("🔍 DEBUG: Full JSON structure:")
            print("-" * 40)
            # Show full structure for diarized_transcript entries
            debug_data = data.copy()
            if 'diarized_transcript' in debug_data and 'entries' in debug_data['diarized_transcript']:
                entries = debug_data['diarized_transcript']['entries']
                if entries:
                    print("Sample diarized_transcript entries:")
                    for i, entry in enumerate(entries[:3]):  # Show first 3 entries
                        print(f"  Entry {i}: {entry}")
                    if len(entries) > 3:
                        print(f"  ... and {len(entries) - 3} more entries")
                    # Replace with summary for main print
                    debug_data['diarized_transcript']['entries'] = f"[{len(entries)} entries - see above]"
            
            pprint(debug_data, depth=3, width=80)
            print("-" * 40)

            # Get transcript
            full_transcript = data.get('transcript', '')
            print(f"✅ Found transcript using key: 'transcript'")

            # Look for diarization data in the proper structure
            segments = None
            if 'diarized_transcript' in data and 'entries' in data['diarized_transcript']:
                segments = data['diarized_transcript']['entries']
                print(f"✅ Found diarized segments in 'diarized_transcript.entries'")
                print(f"   Segments type: {type(segments)}, Length: {len(segments) if isinstance(segments, list) else 'N/A'}")
            
            # Also get timing data from timestamps section
            timestamps = data.get('timestamps', {})
            words = timestamps.get('words', [])
            start_times = timestamps.get('start_time_seconds', [])
            end_times = timestamps.get('end_time_seconds', [])

            print(f"\n📝 Full Transcript:")
            print(f"   {full_transcript or 'Not found'}")
            print()

            if segments and isinstance(segments, list) and len(segments) > 0 and isinstance(segments[0], dict):
                print(f"🗣️  Diarized Segments ({len(segments)} segments):")
                print("-" * 40)

                # Handle the actual diarization format
                for i, segment in enumerate(segments, 1):
                    speaker = segment.get('speaker_id', 'Unknown')
                    start_time = segment.get('start_time_seconds', 0)
                    end_time = segment.get('end_time_seconds', 0)
                    text = segment.get('transcript', '')

                    print(f"  {i:2d}. {speaker} [{start_time:6.2f}s - {end_time:6.2f}s]")
                    print(f"      \"{text}\"")
                    print()

                # Summary statistics for diarized segments
                speakers = set()
                total_duration = 0
                
                for seg in segments:
                    if isinstance(seg, dict):
                        speaker = seg.get('speaker_id')
                        if speaker:
                            speakers.add(str(speaker))
                        
                        end_time = seg.get('end_time_seconds', 0)
                        total_duration = max(total_duration, float(end_time))

                print("📊 Diarization Summary:")
                print(f"   • Total speakers detected: {len(speakers)}")
                print(f"   • Speaker IDs: {', '.join(sorted(speakers))}")
                print(f"   • Total duration: {total_duration:.2f} seconds")
                print(f"   • Total segments: {len(segments)}")
                
                # Calculate processing speed metrics
                if 'processing_time' in self.timing_stats and total_duration > 0:
                    speed_ratio = total_duration / self.timing_stats['processing_time']
                    print(f"   • Processing speed: {speed_ratio:.2f}x realtime")
                    if speed_ratio >= 1.0:
                        print("   ✅ Faster than realtime processing!")
                    else:
                        print(f"   ⏳ Slower than realtime ({1/speed_ratio:.2f}x slower)")
                
                # Create a formatted output file
                self.create_formatted_output(segments, full_transcript, json_file)

            else:
                print("⚠️  Diarized segments are not in the expected format")
                if segments:
                    print(f"   Segments type: {type(segments)}")
                    if hasattr(segments, '__len__'):
                        print(f"   Length: {len(segments)}")
                    print(f"   First item type: {type(segments[0]) if len(segments) > 0 else 'Empty'}")
                
            # Also show the word-level timestamps (non-diarized) as fallback
            if words and start_times and end_times:
                print(f"\n🔤 Word-level Timestamps ({len(words)} segments):")
                print("-" * 40)
                
                for i, (word, start, end) in enumerate(zip(words, start_times, end_times), 1):
                    print(f"  {i:2d}. [{start:6.2f}s - {end:6.2f}s] \"{word}\"")
                
                print(f"\n📊 Word-level Summary:")
                print(f"   • Total word segments: {len(words)}")
                print(f"   • Total duration: {max(end_times):.2f} seconds")
                print("   • Note: These are word-level segments, not speaker-separated")

            # Show all top-level keys for debugging
            print(f"\n🔑 Available top-level keys in JSON:")
            for key in data.keys():
                value_type = type(data[key]).__name__
                if isinstance(data[key], (list, dict)):
                    length = len(data[key])
                    print(f"   • {key}: {value_type} (length: {length})")
                else:
                    print(f"   • {key}: {value_type}")

    def create_formatted_output(self, segments, full_transcript, original_file):
        """Create a nicely formatted output file with diarization results"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = os.path.splitext(os.path.basename(original_file))[0]
        
        # Create multiple output formats
        formats = {
            'txt': self.create_text_format,
            'json': self.create_json_format,
            'srt': self.create_srt_format
        }
        
        for ext, formatter in formats.items():
            output_file = os.path.join(self.output_dir, f"{base_name}_diarized_{timestamp}.{ext}")
            try:
                content = formatter(segments, full_transcript)
                with open(output_file, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"📄 Created {ext.upper()} output: {output_file}")
            except Exception as e:
                print(f"❌ Error creating {ext.upper()} file: {e}")

    def create_text_format(self, segments, full_transcript):
        """Create a human-readable text format"""
        content = []
        content.append("=" * 60)
        content.append("SPEAKER DIARIZATION RESULTS")
        content.append("=" * 60)
        content.append("")
        
        # Add timing information
        if self.timing_stats:
            content.append("PROCESSING SUMMARY:")
            content.append("-" * 30)
            if 'start_time' in self.timing_stats:
                content.append(f"Processed at: {self.timing_stats['start_time'].strftime('%Y-%m-%d %H:%M:%S')}")
            if 'total_time' in self.timing_stats:
                content.append(f"Total processing time: {self.format_duration(self.timing_stats['total_time'])}")
            if 'processing_time' in self.timing_stats:
                content.append(f"API processing time: {self.format_duration(self.timing_stats['processing_time'])}")
            content.append("")
        
        # Get speakers and stats
        speakers = set(seg.get('speaker_id', 'Unknown') for seg in segments)
        total_duration = max(seg.get('end_time_seconds', 0) for seg in segments)
        
        content.append(f"Total Duration: {total_duration:.2f} seconds")
        content.append(f"Speakers Detected: {len(speakers)} ({', '.join(sorted(speakers))})")
        content.append(f"Total Segments: {len(segments)}")
        
        # Add processing speed if available
        if 'processing_time' in self.timing_stats and total_duration > 0:
            speed_ratio = total_duration / self.timing_stats['processing_time']
            content.append(f"Processing Speed: {speed_ratio:.2f}x realtime")
        
        content.append("")
        content.append("-" * 60)
        content.append("FULL TRANSCRIPT:")
        content.append("-" * 60)
        content.append(full_transcript)
        content.append("")
        content.append("-" * 60)
        content.append("SPEAKER-SEPARATED TRANSCRIPT:")
        content.append("-" * 60)
        content.append("")
        
        for i, segment in enumerate(segments, 1):
            speaker = segment.get('speaker_id', 'Unknown')
            start_time = segment.get('start_time_seconds', 0)
            end_time = segment.get('end_time_seconds', 0)
            text = segment.get('transcript', '')
            
            content.append(f"[{i:02d}] {speaker} ({start_time:.2f}s - {end_time:.2f}s):")
            content.append(f"    {text}")
            content.append("")
        
        return "\n".join(content)

    def create_json_format(self, segments, full_transcript):
        """Create a structured JSON format"""
        speakers = list(set(seg.get('speaker_id', 'Unknown') for seg in segments))
        total_duration = max(seg.get('end_time_seconds', 0) for seg in segments)
        
        # Add timing stats to metadata
        metadata = {
            "total_duration_seconds": total_duration,
            "total_speakers": len(speakers),
            "speakers": sorted(speakers),
            "total_segments": len(segments),
            "created_at": datetime.now().isoformat()
        }
        
        # Add processing timing if available
        if self.timing_stats:
            metadata["processing_stats"] = {
                "total_processing_time": self.timing_stats.get('total_time'),
                "api_processing_time": self.timing_stats.get('processing_time'),
                "conversion_time": self.timing_stats.get('conversion_time'),
                "upload_time": self.timing_stats.get('upload_time'),
                "download_time": self.timing_stats.get('download_time')
            }
            
            if 'processing_time' in self.timing_stats and total_duration > 0:
                metadata["processing_stats"]["realtime_factor"] = total_duration / self.timing_stats['processing_time']
        
        output = {
            "metadata": metadata,
            "full_transcript": full_transcript,
            "diarized_segments": [
                {
                    "segment_id": i,
                    "speaker_id": seg.get('speaker_id', 'Unknown'),
                    "start_time_seconds": seg.get('start_time_seconds', 0),
                    "end_time_seconds": seg.get('end_time_seconds', 0),
                    "duration_seconds": seg.get('end_time_seconds', 0) - seg.get('start_time_seconds', 0),
                    "transcript": seg.get('transcript', '')
                }
                for i, seg in enumerate(segments, 1)
            ]
        }
        
        return json.dumps(output, indent=2, ensure_ascii=False)

    def create_srt_format(self, segments, full_transcript):
        """Create SRT subtitle format"""
        content = []
        
        for i, segment in enumerate(segments, 1):
            start_time = segment.get('start_time_seconds', 0)
            end_time = segment.get('end_time_seconds', 0)
            text = segment.get('transcript', '')
            speaker = segment.get('speaker_id', 'Unknown')
            
            # Convert seconds to SRT time format (HH:MM:SS,mmm)
            start_srt = self.seconds_to_srt_time(start_time)
            end_srt = self.seconds_to_srt_time(end_time)
            
            content.append(str(i))
            content.append(f"{start_srt} --> {end_srt}")
            content.append(f"[{speaker}] {text}")
            content.append("")
        
        return "\n".join(content)

    def seconds_to_srt_time(self, seconds):
        """Convert seconds to SRT time format"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds - int(seconds)) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    def cleanup(self):
        """Clean up output directory"""
        if os.path.exists(self.output_dir):
            shutil.rmtree(self.output_dir)
            print(f"🧹 Cleaned up output directory: {self.output_dir}")


async def main():
    if len(sys.argv) < 2:
        print("Usage: python test_diarization.py <audio_file_path> [num_speakers]")
        print("Example: python test_diarization.py meeting.mp3 3")
        sys.exit(1)

    audio_file = sys.argv[1]
    num_speakers = int(sys.argv[2]) if len(sys.argv) > 2 else 2

    tester = SimpleDiarizationTester()

    try:
        await tester.test_diarization(audio_file, num_speakers=num_speakers)
    except KeyboardInterrupt:
        print("\n🛑 Test interrupted by user")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        try:
            keep_results = input("\n🤔 Keep result files? (y/n): ").lower().strip()
            if keep_results not in ['y', 'yes']:
                tester.cleanup()
            else:
                print(f"📁 Results saved in: {tester.output_dir}")
        except KeyboardInterrupt:
            tester.cleanup()


if __name__ == "__main__":
    asyncio.run(main())