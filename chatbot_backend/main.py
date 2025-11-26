import os
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS"] = "1"

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
import uuid
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from pymongo import MongoClient
from dotenv import load_dotenv, find_dotenv

"""Environment setup: load .env robustly and init MongoDB if available."""
# Try to locate .env anywhere up the tree and load it
_dotenv_path = find_dotenv()
if _dotenv_path:
    load_dotenv(_dotenv_path, override=True)
else:
    load_dotenv(override=True)  # fallback to default locations

MONGO_URI = os.getenv("MONGO_URI")

client = None
conversations = None
if MONGO_URI:
    try:
        client = MongoClient(MONGO_URI)
        db = client["chatbot_db"]
        conversations = db["conversations"]
        print("MongoDB connected.")
    except Exception as _e:
        print(f"MongoDB connection failed: {_e}")
else:
    print("Warning: MONGO_URI not set. Mongo persistence is disabled.")


# Save message into Mongo
def save_message_to_db(user_id, user_text, analysis):
    if conversations is None:
        return  # silently no-op when Mongo not configured
    conversations.insert_one({
        "user_id": user_id,
        "user_text": user_text,
        "emotion": analysis["emotion"],
        "stress_level": analysis["stress_level"],
        "academic_stress_category": analysis["academic_stress_category"],
        "risk_level": analysis["risk_level"],
        "overall_status": analysis["overall_status"],
        "bot_response": analysis["bot_response"]
    })


# Fetch last N history entries
def get_user_history(user_id, limit=5):
    if conversations is None:
        return []
    return list(
        conversations.find({"user_id": user_id}).sort("_id", -1).limit(limit)
    )


# -----------------------------------------------------------
# FASTAPI INITIALIZATION
# -----------------------------------------------------------
app = FastAPI(
    title="Emotion, Stress & Risk Detection API",
    description="Full backend for AI stress chatbot with MongoDB memory.",
    version="3.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


# -----------------------------------------------------------
# MODEL LOAD
# -----------------------------------------------------------
MODEL_NAME = "j-hartmann/emotion-english-distilroberta-base"
print("Loading model... Please wait...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
print("Model loaded successfully!")


# -----------------------------------------------------------
# REQUEST/RESPONSE MODELS
# -----------------------------------------------------------
class TextInput(BaseModel):
    user_id: str
    text: str


class AnalysisResult(BaseModel):
    emotion: str
    stress_level: str
    academic_stress_category: str
    risk_level: str
    overall_status: str
    bot_response: str


class ChatStartResponse(BaseModel):
    session_id: str


class ChatMessageInput(BaseModel):
    session_id: str
    text: str


class ChatMessageResponse(BaseModel):
    bot_message: str
    emotion: str
    stress_level: str
    academic_stress_category: str
    risk_level: str
    overall_status: str
    techniques: List[str]


# -----------------------------------------------------------
# EMOTION → STRESS
# -----------------------------------------------------------
def emotion_to_stress(emotion):
    if emotion in ["fear", "sadness", "anger", "disgust"]:
        return "high"
    if emotion == "surprise":
        return "medium"
    return "low"


# -----------------------------------------------------------
# ACADEMIC STRESS DETECTOR
# -----------------------------------------------------------
def academic_stress_classifier(text, emotion):
    t = text.lower()

    high_k = ["overwhelmed", "can't handle", "hopeless", "panic", "breakdown", "giving up", "end it"]
    med_k = ["stressed", "pressure", "anxious", "worried", "tired", "frustrated"]
    burnout_k = ["burnout", "exhausted", "drained", "no energy", "fatigued"]
    academic_k = ["exam", "exams", "assignment", "assignments", "university", "lectures", "school", "studies"]

    if any(w in t for w in high_k):
        return "academic_stress_high"
    if any(w in t for w in burnout_k):
        return "burnout"
    if any(w in t for w in med_k):
        return "academic_stress_medium"

    if any(w in t for w in academic_k):
        if emotion in ["fear", "sadness", "anger"]:
            return "academic_stress_high"
        if emotion == "surprise":
            return "academic_stress_medium"
        return "academic_stress_low"

    if emotion in ["fear", "sadness", "anger"]:
        return "academic_stress_medium"

    return "academic_stress_low"


# -----------------------------------------------------------
# RISK DETECTOR
# -----------------------------------------------------------
def risk_detector(text):
    t = text.lower()

    high_risk = ["suicide", "kill myself", "end my life", "i want to die", "no reason to live", "end it all"]
    med_risk = ["hopeless", "worthless", "nothing matters", "empty inside"]

    if any(w in t for w in high_risk):
        return "high_risk"
    if any(w in t for w in med_risk):
        return "moderate_risk"
    return "safe"


# -----------------------------------------------------------
# OVERALL STATUS ENGINE
# -----------------------------------------------------------
def overall_status_engine(emotion, stress, academic_stress, risk):
    if risk == "high_risk":
        return "critical"
    if risk == "moderate_risk":
        return "high_stress"
    if academic_stress in ["academic_stress_high", "burnout"]:
        return "high_stress"
    if academic_stress == "academic_stress_medium" or stress == "medium":
        return "moderate_stress"
    if stress == "low" and academic_stress == "academic_stress_low":
        return "low_stress"
    return "normal"


# -----------------------------------------------------------
# COUNSELING RESPONSE GENERATOR
# -----------------------------------------------------------
def generate_response(overall_status, emotion, academic_stress, risk):
    if overall_status == "critical":
        return (
            "I'm really sorry you're feeling this way. Your feelings matter, "
            "and you're not alone. If you're in immediate danger or feel you "
            "might harm yourself, please contact emergency services or a suicide hotline right now."
        )

    if overall_status == "high_stress":
        return (
            "It sounds like you're under a lot of pressure right now. "
            "Thank you for opening up — that takes courage. "
            "Let’s take one step at a time. What feels hardest for you right now?"
        )

    if overall_status == "moderate_stress":
        return (
            "I hear that things are tough for you. "
            "It's okay to feel overwhelmed. I'm here to support you. "
            "What part of this feels the most stressful?"
        )

    if overall_status == "low_stress":
        return (
            "It seems like you're dealing with some stress, but you're holding up. "
            "How can I help you with what you're experiencing?"
        )

    return "Thank you for sharing. How can I support you today?"


# -----------------------------------------------------------
# THERAPEUTIC TECHNIQUES
# -----------------------------------------------------------
def suggest_techniques(emotion, academic_stress):
    techniques = []

    if emotion in ["fear", "surprise"]:
        techniques += ["5-4-3-2-1 grounding", "Box breathing (4-4-4-4)"]

    if emotion == "sadness":
        techniques += ["Self-compassion check-in", "Small activation task"]

    if emotion == "anger":
        techniques += ["4-7-8 breathing", "Cognitive defusion"]

    if academic_stress == "burnout":
        techniques += ["5-minute micro-break", "Energy audit"]

    if academic_stress.startswith("academic_stress_"):
        techniques += ["Task chunking (25/5 Pomodoro)", "Two-minute small start"]

    return techniques[:4] if techniques else ["Mindful breathing"]


# -----------------------------------------------------------
# THERAPEUTIC REPLY (SESSION MODE)
# -----------------------------------------------------------
def generate_therapeutic_reply(text, emotion, stress, academic_stress, risk):
    if risk == "high_risk":
        return {
            "bot_message": (
                "I’m really sorry you're feeling this way. Your safety matters. "
                "If you feel like you may harm yourself, please contact your emergency number right now."
            ),
            "techniques": ["Call emergency services", "Contact someone you trust"]
        }

    opening = "Thank you for sharing. "
    if stress == "high" or academic_stress in ["academic_stress_high", "burnout"]:
        tone = "It sounds like you're under a lot of pressure. "
    elif stress == "medium":
        tone = "I can hear that things feel challenging. "
    else:
        tone = "I'm here with you. "

    techniques = suggest_techniques(emotion, academic_stress)
    technique_line = "You might find these techniques helpful: " + ", ".join(techniques) + "."

    followup = " What feels hardest right now?"

    return {
        "bot_message": opening + tone + technique_line + followup,
        "techniques": techniques
    }


# -----------------------------------------------------------
# IN-MEMORY SESSION STORE
# -----------------------------------------------------------
Sessions: Dict[str, List[Dict[str, str]]] = {}


# -----------------------------------------------------------
# HEALTH CHECK
# -----------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}


# -----------------------------------------------------------
# ANALYZE ENDPOINT (SINGLE MESSAGE)
# -----------------------------------------------------------
@app.post("/analyze", response_model=AnalysisResult)
def analyze_text(input: TextInput):

    try:
        user_id = input.user_id
        text = input.text.strip()

        if not text:
            raise HTTPException(status_code=400, detail="Text cannot be empty")

        with torch.no_grad():
            tokens = tokenizer(text, return_tensors="pt", truncation=True, max_length=256)
            outputs = model(**tokens)
            probs = torch.softmax(outputs.logits, dim=1)
            emotion = model.config.id2label[int(torch.argmax(probs))]

        stress = emotion_to_stress(emotion)
        academic_stress = academic_stress_classifier(text, emotion)
        risk = risk_detector(text)
        overall = overall_status_engine(emotion, stress, academic_stress, risk)
        bot_response = generate_response(overall, emotion, academic_stress, risk)

        analysis = {
            "emotion": emotion,
            "stress_level": stress,
            "academic_stress_category": academic_stress,
            "risk_level": risk,
            "overall_status": overall,
            "bot_response": bot_response
        }

        save_message_to_db(user_id, text, analysis)

        return analysis

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {e}")


# -----------------------------------------------------------
# START CHAT SESSION
# -----------------------------------------------------------
@app.post("/chat/start", response_model=ChatStartResponse)
def chat_start():
    session_id = str(uuid.uuid4())
    Sessions[session_id] = []
    return ChatStartResponse(session_id=session_id)


# -----------------------------------------------------------
# CHAT MESSAGE ENDPOINT (SESSION MODE)
# -----------------------------------------------------------
@app.post("/chat/message", response_model=ChatMessageResponse)
def chat_message(input: ChatMessageInput):

    try:
        session_id = input.session_id
        text = input.text.strip()

        if session_id not in Sessions:
            raise HTTPException(status_code=404, detail="Session not found")

        if not text:
            raise HTTPException(status_code=400, detail="Text cannot be empty")

        with torch.no_grad():
            tokens = tokenizer(text, return_tensors="pt", truncation=True, max_length=256)
            outputs = model(**tokens)
            emotion = model.config.id2label[int(torch.argmax(torch.softmax(outputs.logits, dim=1)))]

        stress = emotion_to_stress(emotion)
        academic_stress = academic_stress_classifier(text, emotion)
        risk = risk_detector(text)
        overall = overall_status_engine(emotion, stress, academic_stress, risk)

        reply = generate_therapeutic_reply(text, emotion, stress, academic_stress, risk)
        bot_message = reply["bot_message"]
        techniques = reply["techniques"]

        Sessions[session_id].append({"role": "user", "message": text})
        Sessions[session_id].append({"role": "bot", "message": bot_message})

        return ChatMessageResponse(
            bot_message=bot_message,
            emotion=emotion,
            stress_level=stress,
            academic_stress_category=academic_stress,
            risk_level=risk,
            overall_status=overall,
            techniques=techniques
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {e}")
