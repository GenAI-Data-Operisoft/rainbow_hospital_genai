# Rainbow — Hospital GenAI

Lightweight transcription and diarization prototype for medical audio. This repository contains a Python backend for audio processing and a Next.js frontend for transcription UI.

## Repo Structure

- Backend/: Python services (VAD, diarization, AWS/S3 integration, Bedrock prompts)
- Frontend/: Next.js app (UI for uploading audio, viewing/transcribing, exporting PDFs)
- README.md: (this file)

## Quick Start

Prerequisites:
- Python 3.8+ and pip
- Node.js 16+ and npm/yarn
- (Optional) AWS credentials configured if using S3/Bedrock features

Backend (API / audio processing)

1. Create and activate a virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
```

2. Install dependencies and run:

```bash
pip install -r Backend/requirements.txt
python Backend/main.py
```

3. Environment: Backend has a `.env` file. Review or set environment variables required for S3/AWS and any API keys.

Files & folders of interest:
- `Backend/services/` — implementation of VAD, diarization, storage, and prompt templates.
- `Backend/uploads/audio/` — uploaded audio files used during development.

Frontend (Next.js UI)

1. Install dependencies and run dev server:

```bash
cd Frontend
npm install
npm run dev
```

2. Environment: Frontend supports `.env.local` for runtime configuration (see Frontend/.env.local if present).

3. Open the app at `http://localhost:3000` (default Next.js dev server).

Development Notes

- Backend and Frontend run independently during development. The Frontend calls the Backend APIs; ensure the Backend is running and CORS/network settings permit requests from the Next dev server.
- The Backend includes helper scripts and test files such as `test_diarization.py` and `debug_vad_test.py` for local testing.

Contributing

- Open issues or PRs for bugs or enhancements.
- Keep changes focused and include tests where applicable.

License

This project currently does not include an explicit license. Add a `LICENSE` file (for example, `MIT`) if you want to permit reuse.

Contact

For questions, open an issue in this repository.
