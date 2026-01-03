from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from chatbot_service import (
    TextInput,
    AnalysisResult,
    ChatStartResponse,
    ChatMessageInput,
    ChatMessageResponse,
    health_service,
    analyze_text_service,
    chat_start_service,
    chat_message_service,
    MODEL_NAME,
)


app = FastAPI(
    title="Emotion, Stress & Risk Detection API",
    description="Backend for AI stress chatbot (in-memory sessions).",
    version="3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


@app.get("/")
def root():
    return {"message": "MindPlus chatbot backend running", "model": MODEL_NAME}


@app.get("/health")
def health():
    return health_service()


@app.post("/analyze", response_model=AnalysisResult)
def analyze_text(input: TextInput):
    return analyze_text_service(input)


@app.post("/chat/start", response_model=ChatStartResponse)
def chat_start():
    return chat_start_service()


@app.post("/chat/message", response_model=ChatMessageResponse)
def chat_message(input: ChatMessageInput):
    return chat_message_service(input)
