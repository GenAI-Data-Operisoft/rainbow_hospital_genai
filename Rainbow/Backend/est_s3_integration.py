# test_s3_integration.py - Test S3 storage service
import asyncio
import os
import tempfile
from datetime import datetime
from services.s3_storage_service import S3StorageService
from dotenv import load_dotenv
load_dotenv()  # Load environment variables from .env file

async def test_s3_integration():
    """Test S3 storage service integration"""
    
    print("Testing S3 Storage Service Integration")
    print("=" * 50)
    
    try:
        # Initialize S3 service
        s3_service = S3StorageService()
        
        # Test 1: Check bucket access
        print("\nTest 1: Checking bucket access...")
        bucket_access = await s3_service.check_bucket_access()
        
        if not bucket_access:
            print("Bucket access failed - check credentials and bucket name")
            return False
        
        # Test 2: Upload sample session data
        print("\nTest 2: Uploading sample session data...")
        
        # Create sample data
        test_user_sub = "operisoft"
        test_session_id = "test_session_123"
        
        # Create temporary audio file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_audio:
            # Write some dummy audio data
            dummy_audio = b'\x00' * 8000  # Dummy audio data
            temp_audio.write(dummy_audio)
            temp_audio_path = temp_audio.name
        
        sample_transcript = "Hello, this is a test transcript for S3 upload functionality."
        
        sample_diarization = {
            "statistics": {
                "total_speakers": 2,
                "speaker_ids": ["SPEAKER_1", "SPEAKER_2"],
                "total_segments": 3,
                "total_duration_seconds": 15.5
            },
            "diarized_segments": [
                {
                    "segment_id": 1,
                    "speaker_id": "SPEAKER_1",
                    "start_time_seconds": 0.0,
                    "end_time_seconds": 5.2,
                    "transcript": "Hello, how are you feeling today?"
                },
                {
                    "segment_id": 2,
                    "speaker_id": "SPEAKER_2", 
                    "start_time_seconds": 5.2,
                    "end_time_seconds": 10.1,
                    "transcript": "I have been having headaches for the past week."
                }
            ]
        }
        
        sample_prescription = """Medical Prescription
        
Patient: Test Patient
Date: """ + datetime.now().strftime("%Y-%m-%d") + """

Chief Complaint: Headaches

Assessment:
- Patient reports headaches for past week
- No other symptoms mentioned

Plan:
- Continue monitoring symptoms
- Follow up if symptoms worsen

This is a test prescription generated for S3 integration testing."""

        sample_metadata = {
            "test_mode": True,
            "created_at": datetime.now().isoformat(),
            "test_description": "S3 integration test"
        }
        
        # Upload to S3
        from pathlib import Path
        upload_results = await s3_service.upload_session_data(
            user_sub=test_user_sub,
            session_id=test_session_id,
            audio_file_path=Path(temp_audio_path),
            transcript=sample_transcript,
            diarization_results=sample_diarization,
            medical_prescription=sample_prescription,
            session_metadata=sample_metadata
        )
        
        print("Upload Results:")
        print(f"  Success: {upload_results['success']}")
        print(f"  Folder: {upload_results['folder_path']}")
        print(f"  Uploaded files: {len(upload_results['uploaded_files'])}")
        print(f"  Failed files: {len(upload_results['failed_files'])}")
        
        if upload_results['uploaded_files']:
            print("  Successfully uploaded:")
            for file_type, s3_key in upload_results['uploaded_files'].items():
                print(f"    {file_type}: {s3_key}")
        
        if upload_results['failed_files']:
            print("  Failed uploads:")
            for file_type, error in upload_results['failed_files'].items():
                print(f"    {file_type}: {error}")
        
        # Test 3: Get session URLs
        print("\nTest 3: Getting session URLs...")
        session_urls = s3_service.get_session_urls(test_user_sub, test_session_id)
        
        print("Session URLs:")
        for file_type, url in session_urls.items():
            print(f"  {file_type}: {url}")
        
        # Test 4: List user sessions
        print("\nTest 4: Listing user sessions...")
        user_sessions = s3_service.list_user_sessions(test_user_sub)
        print(f"Found {len(user_sessions)} sessions for user {test_user_sub}")
        
        if user_sessions:
            print("Sessions:")
            for session in user_sessions[:5]:  # Show first 5
                print(f"  - {session}")
        
        # Cleanup
        try:
            os.unlink(temp_audio_path)
            print(f"\nCleaned up temporary file: {temp_audio_path}")
        except:
            pass
        
        print(f"\nS3 Integration Test {'PASSED' if upload_results['success'] else 'FAILED'}")
        return upload_results['success']
        
    except Exception as e:
        print(f"S3 Integration Test FAILED with error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_folder_structure():
    """Test folder structure generation"""
    print("\nTesting folder structure...")
    
    s3_service = S3StorageService()
    
    # Test with different users and sessions
    test_cases = [
        ("operisoft", "realtime_1758314123_5a2b286f"),
        ("testuser", "session_123456"),
        ("another_user", "realtime_999_abc")
    ]
    
    for user_sub, session_id in test_cases:
        folder_path = s3_service._get_folder_structure(user_sub, session_id)
        print(f"  {user_sub} / {session_id} -> {folder_path}")

if __name__ == "__main__":
    print("S3 Integration Test Suite")
    print("=" * 60)
    
    # Test folder structure
    asyncio.run(test_folder_structure())
    
    # Test full integration
    success = asyncio.run(test_s3_integration())
    
    if success:
        print("\nAll tests passed! S3 integration is working correctly.")
    else:
        print("\nSome tests failed. Please check the output above for details.")
    
    print("\nTo run this test:")
    print("  cd /home/ubuntu/rainbow/Rainbow/Backend")  
    print("  python test_s3_integration.py")