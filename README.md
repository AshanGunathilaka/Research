# Emotionally Intelligent Assistant API

FastAPI backend for real-time emotion and stress detection with personalized, evidence-based therapeutic conversations.

Endpoints:

- `GET /health` — service check
- `POST /analyze` — single-turn detection and a supportive reply
- `POST /chat/start` — open a session for a personalized conversation
- `POST /chat/message` — send a message within a session and receive adaptive support

## Requirements

Python 3.9+ recommended. Windows PowerShell commands are shown below.

Install dependencies (CPU):

```
pip install -r requirements.txt
```

Note: On some Windows setups, PyTorch may require a specific wheel. If the installation above fails, visit https://pytorch.org/get-started/locally/ and install the suggested CPU command, then re-run `pip install -r requirements.txt`.

## Run the API

From the `chatbot_backend` folder:

```
uvicorn main:app --reload
```

Open docs: http://127.0.0.1:8000/docs

## Quick Tests

Health check:

```
curl http://127.0.0.1:8000/health
```

Analyze (PowerShell escaping):

```
curl -X POST http://127.0.0.1:8000/analyze -H "Content-Type: application/json" -d "{\"text\":\"I feel overwhelmed by exams and hopeless\"}"
```

Start chat session:

```
$session = (curl -s http://127.0.0.1:8000/chat/start -Method POST | ConvertFrom-Json).session_id
"Session: $session"
```

Send a chat message:

```
curl -X POST http://127.0.0.1:8000/chat/message -H "Content-Type: application/json" -d "{\"session_id\":\"$session\",\"text\":\"Deadlines are crushing me and I can't focus\"}"
```

## Design Notes

- Uses `j-hartmann/emotion-english-distilroberta-base` to infer emotion; derives stress, academic stress, and risk using lightweight rules for real-time performance.
- Inference is wrapped with `torch.no_grad()` and input is truncated to 256 tokens for speed.
- Personalized chat uses an in-memory session with brief context and returns suggested techniques (e.g., grounding, breathing, task chunking).
- High-risk language triggers a crisis-safe response. This system is not a substitute for professional help.

## Next Steps (Optional)

- Persist sessions (Redis/Postgres) and add user profiles for deeper personalization.
- Add WebSocket streaming for token-by-token responses.
- Extend academic stress detector with a small fine-tuned classifier.
