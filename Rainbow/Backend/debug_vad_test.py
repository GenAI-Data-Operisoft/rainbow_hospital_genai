# debug_vad_test.py - Standalone test for VAD connection
import asyncio
import os
from sarvamai import AsyncSarvamAI
import base64
import tempfile
import time
from dotenv import load_dotenv 
load_dotenv()
async def test_vad_connection():
    """Debug test for VAD streaming connection"""
    
    api_key = os.getenv("SARVAM_API_KEY")
    if not api_key:
        print("❌ SARVAM_API_KEY not found")
        return False
    
    print(f"🔑 Using API key: {api_key[:10]}...")
    
    try:
        client = AsyncSarvamAI(api_subscription_key=api_key)
        print("✅ AsyncSarvamAI client created")
        
        # Test 1: Basic connection test
        print("\n🧪 Test 1: Basic VAD streaming connection")
        
        stream_config = {
            "model": "saaras:v2.5",
            "vad_signals": True
        }
        
        print(f"   Stream config: {stream_config}")
        
        # Create the connection context
        ws_context = client.speech_to_text_streaming.connect(**stream_config)
        print("✅ Connection context created")
        
        # Enter the context
        try:
            ws = await ws_context.__aenter__()
            print("✅ WebSocket connection established")
            
            # Test 2: Send a small audio chunk
            print("\n🧪 Test 2: Sending test audio")
            
            # Create minimal test audio (silence)
            test_audio = b'\x00' * 8000  # 0.5 seconds of silence at 16kHz
            audio_b64 = base64.b64encode(test_audio).decode('utf-8')
            
            print(f"   Test audio size: {len(test_audio)} bytes")
            print(f"   Base64 size: {len(audio_b64)} chars")
            
            # Send test audio
            await ws.transcribe(
                audio=audio_b64,
                encoding="audio/wav",
                sample_rate=16000
            )
            print("✅ Test audio sent successfully")
            
            # Test 3: Listen for events (with short timeout)
            print("\n🧪 Test 3: Listening for VAD events (5 second timeout)")
            
            event_count = 0
            try:
                async with asyncio.timeout(5):
                    async for message in ws:
                        event_count += 1
                        print(f"   Event {event_count}: {message}")
                        
                        if event_count >= 3:  # Stop after a few events
                            break
                            
            except asyncio.TimeoutError:
                print("   Timeout reached (this is expected)")
            
            print(f"✅ Received {event_count} events")
            
        finally:
            # Clean exit
            try:
                await ws_context.__aexit__(None, None, None)
                print("✅ Connection properly closed")
            except Exception as e:
                print(f"⚠️ Error during cleanup: {e}")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        print(f"   Traceback: {traceback.format_exc()}")
        return False

async def test_translate_vad():
    """Test VAD with translation"""
    
    api_key = os.getenv("SARVAM_API_KEY")
    if not api_key:
        print("❌ SARVAM_API_KEY not found")
        return False
    
    print("\n🧪 Test: VAD Translation Streaming")
    
    try:
        client = AsyncSarvamAI(api_subscription_key=api_key)
        
        stream_config = {
            "model": "saaras:v2.5",
            "vad_signals": True
        }
        
        # Use translate streaming
        ws_context = client.speech_to_text_translate_streaming.connect(**stream_config)
        
        try:
            ws = await ws_context.__aenter__()
            print("✅ Translation WebSocket connection established")
            
            # Test audio
            test_audio = b'\x00' * 8000
            audio_b64 = base64.b64encode(test_audio).decode('utf-8')
            
            await ws.translate(
                audio=audio_b64,
                encoding="audio/wav",
                sample_rate=16000
            )
            print("✅ Test audio sent to translation stream")
            
            # Listen briefly
            event_count = 0
            try:
                async with asyncio.timeout(5):
                    async for message in ws:
                        event_count += 1
                        print(f"   Translation Event {event_count}: {message}")
                        
                        if event_count >= 3:
                            break
                            
            except asyncio.TimeoutError:
                print("   Translation timeout (expected)")
            
            print(f"✅ Translation received {event_count} events")
            
        finally:
            await ws_context.__aexit__(None, None, None)
            print("✅ Translation connection closed")
        
        return True
        
    except Exception as e:
        print(f"❌ Translation test failed: {e}")
        import traceback
        print(f"   Traceback: {traceback.format_exc()}")
        return False

if __name__ == "__main__":
    print("🔍 VAD Connection Debug Test")
    print("=" * 50)
    
    # Run tests
    asyncio.run(test_vad_connection())
    print("\n" + "=" * 50)
    asyncio.run(test_translate_vad())
    
    print("\n✅ Debug tests completed")