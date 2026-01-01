import asyncio
from pathlib import Path
from services.realtime_service import RealTimeTranscriptionService


async def main():
    service = RealTimeTranscriptionService()

    # Create uploads directory if it doesn't exist
    Path('uploads/audio').mkdir(parents=True, exist_ok=True)

    try:
        server = await service.initialize_websocket_server('0.0.0.0', 8765)
        # print(f'WebSocket server started on ws://0.0.0.0:8765')

        # Keep the server running
        await asyncio.Future()  # Run forever
    except Exception as e:
        print(f"Failed to start server: {e}")
        # Clean up any resources if needed


if __name__ == '__main__':
    asyncio.run(main())
