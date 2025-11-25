import os
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS"] = "1"

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import uuid
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

# FastAPI app
app = FastAPI(
    title="Emotion, Stress & Risk Detection API",
    description="Detect a user's emotional state, stress level, academic stress category, risk level, and overall status.",
    version="2.6"
)

# Allow all origins (adjust in production as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load pretrained model
MODEL_NAME = "j-hartmann/emotion-english-distilroberta-base"

print("Loading model... This may take a few seconds...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
print("Model loaded successfully!")

# Request body
class TextInput(BaseModel):
    text: str


class AnalysisResult(BaseModel):
    emotion: str
    stress_level: str
    academic_stress_category: str
    risk_level: str
    overall_status: str
    bot_response: str


@app.get("/health")
def health():
    return {"status": "ok"}


# -----------------------------------------------------------
# EMOTION → BASIC STRESS
# -----------------------------------------------------------
def emotion_to_stress(emotion: str):
    high = ["fear", "sadness", "anger", "disgust"]
    medium = ["surprise"]
    low = ["joy", "neutral"]

    if emotion in high:
        return "high"
    elif emotion in medium:
        return "medium"
    else:
        return "low"


# -----------------------------------------------------------
# ACADEMIC STRESS CLASSIFIER
# -----------------------------------------------------------
def academic_stress_classifier(text: str, emotion: str):
    text_lower = text.lower()

    high_keywords = [
        "overwhelmed", "can't handle", "cannot handle", "suicidal", "hopeless",
        "panic", "breakdown", "giving up", "i'm done", "end it", "can't go on"
    ]

    medium_keywords = [
        "stressed", "pressure", "anxious", "worried", "tired", "frustrated",
        "fear", "scared", "nervous"
    ]

    burnout_keywords = [
        "burnout", "burnt out", "exhausted", "drained", "no energy", "empty", "fatigued"
    ]

    academic_keywords = [
        "exams", "exam", "assignments", "assignment", "university", "deadlines",
        "studies", "lectures", "tests", "projects", "school"
    ]

    # High academic stress triggers
    if any(word in text_lower for word in high_keywords):
        return "academic_stress_high"

    # Burnout
    if any(word in text_lower for word in burnout_keywords):
        return "burnout"

    # Medium stress
    if any(word in text_lower for word in medium_keywords):
        return "academic_stress_medium"

    # Academic context
    if any(word in text_lower for word in academic_keywords):
        if emotion in ["fear", "sadness", "anger"]:
            return "academic_stress_high"
        elif emotion == "surprise":
            return "academic_stress_medium"
        else:
            return "academic_stress_low"

    # Emotion fallback
    if emotion in ["fear", "sadness", "anger"]:
        return "academic_stress_medium"

    return "academic_stress_low"


# -----------------------------------------------------------
# RISK DETECTOR (SUICIDAL / CRITICAL)
# -----------------------------------------------------------
def risk_detector(text: str):
    text_lower = text.lower()

    high_risk_keywords = [
        "suicide", "kill myself", "end my life", "end it all", "i want to die",
        "i don't want to live", "no reason to live", "give up completely",
        "can't go on", "i want to end everything"
    ]

    moderate_risk_keywords = [
        "hopeless", "worthless", "nothing matters", "tired of everything",
        "i don't care anymore", "empty inside"
    ]

    if any(phrase in text_lower for phrase in high_risk_keywords):
        return "high_risk"

    if any(phrase in text_lower for phrase in moderate_risk_keywords):
        return "moderate_risk"

    return "safe"


# -----------------------------------------------------------
# OVERALL STATUS ENGINE (PHASE 2)
# -----------------------------------------------------------
def overall_status_engine(emotion, stress, academic_stress, risk):
    # Suicide or extreme distress
    if risk == "high_risk":
        return "critical"

    # At-risk individuals
    if risk == "moderate_risk":
        return "high_stress"

    # High academic stress OR burnout
    if academic_stress in ["academic_stress_high", "burnout"]:
        return "high_stress"

    # Medium stress
    if academic_stress == "academic_stress_medium" or stress == "medium":
        return "moderate_stress"

    # Low stress
    if stress == "low" and academic_stress == "academic_stress_low":
        return "low_stress"

    return "normal"


def generate_response(overall_status, emotion, academic_stress, risk):
    # Critical risk (suicidal)
    if overall_status == "critical":
        return (
            "I’m really sorry that you're feeling this way. "
            "You’re not alone, and your feelings are valid. "
            "This sounds extremely difficult, and it's important to get immediate support. "
            "If you can, please consider reaching out to someone you trust or a mental health professional. "
            "If you are in immediate danger or feel you might harm yourself, "
            "please contact your local emergency number right away."
        )

    # High stress
    if overall_status == "high_stress":
        return (
            "It sounds like you’re experiencing a lot of pressure right now. "
            "Thank you for sharing how you feel — it takes courage. "
            "Let’s take this one step at a time. "
            "Could you tell me what part feels hardest for you at the moment?"
        )

    # Moderate stress
    if overall_status == "moderate_stress":
        return (
            "I understand that things feel challenging. "
            "It’s okay to feel overwhelmed sometimes. "
            "You’re handling more than you realize. "
            "Would you like to talk about what has been stressing you the most?"
        )

    # Low stress
    if overall_status == "low_stress":
        return (
            "I hear you. It seems like you're experiencing some stress, "
            "but you're still managing things. "
            "I’m here to support you — what would you like to focus on?"
        )

    # Normal
    return (
        "Thank you for sharing. "
        "How can I support you today?"
    )


# -----------------------------------------------------------
# THERAPY ENGINE (PERSONALIZED CONVERSATIONS)
# -----------------------------------------------------------
def suggest_techniques(emotion: str, academic_stress: str) -> List[str]:
    techniques: List[str] = []
    if emotion in ["fear", "surprise"]:
        techniques.append("5-4-3-2-1 grounding exercise")
        techniques.append("Box breathing (4-4-4-4)")
    if emotion in ["sadness"]:
        techniques.append("Self-compassion check-in: talk to yourself kindly")
        techniques.append("Behavioral activation: small, doable action")
    if emotion in ["anger"]:
        techniques.append("4-7-8 breathing to reduce arousal")
        techniques.append("Cognitive defusion: name the emotion, not the person")
    if academic_stress == "burnout":
        techniques.append("Micro-break: 5 minutes away from screens")
        techniques.append("Energy audit: identify one drain and one battery")
    if academic_stress.startswith("academic_stress_"):
        techniques.append("Task chunking: 25-minute focus + 5-minute rest")
        techniques.append("Two-minute start: do the smallest possible step")
    return techniques[:4] if techniques else [
        "Mindful breathing (3 slow breaths)",
        "Name and note your feeling"
    ]


def generate_therapeutic_reply(
    user_text: str,
    emotion: str,
    stress: str,
    academic_stress: str,
    risk: str,
    history: List[Dict[str, str]]
) -> Dict[str, object]:
    if risk == "high_risk":
        crisis_msg = (
            "I’m really sorry you’re feeling this way. Your safety matters. "
            "If you feel at risk of harming yourself, please contact your local emergency number now. "
            "You can also reach your country's suicide prevention hotline or a trusted person nearby."
        )
        return {
            "bot_message": crisis_msg,
            "techniques": [
                "Call local emergency services",
                "Contact someone you trust",
                "Seek immediate professional help"
            ]
        }

    # Build a supportive, adaptive message
    opening = "Thank you for sharing that. "
    if stress == "high" or academic_stress in ["academic_stress_high", "burnout"]:
        tone = (
            "It sounds like a lot is on your plate right now. "
            "Let’s take this step by step. "
        )
    elif stress == "medium":
        tone = (
            "I hear that things feel challenging. "
            "You’re doing your best in a tough moment. "
        )
    else:
        tone = (
            "I’m here with you. "
            "Let’s focus on what would help most. "
        )

    techniques = suggest_techniques(emotion, academic_stress)
    technique_line = "Would you like to try one of these now: " + ", ".join(techniques) + "?"

    academic_hint = ""
    if academic_stress.startswith("academic_stress_") or academic_stress == "burnout":
        academic_hint = (
            " If this is about studies, we can pick one tiny task, set a 20–25 minute timer, "
            "and pause for 5 minutes after. I can help you plan it."
        )

    prompt_followup = (
        " What feels hardest at this moment, or what would you like us to focus on together?"
    )

    bot_message = opening + tone + technique_line + academic_hint + prompt_followup

    return {
        "bot_message": bot_message,
        "techniques": techniques
    }


# -----------------------------------------------------------
# SESSION STORE (IN-MEMORY)
# -----------------------------------------------------------
Sessions: Dict[str, List[Dict[str, str]]] = {}


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
# MAIN API ENDPOINT
# -----------------------------------------------------------
@app.post("/analyze", response_model=AnalysisResult)
def analyze_text(input: TextInput):
    try:
        text = input.text.strip()
        if not text:
            raise HTTPException(status_code=400, detail="Input text cannot be empty.")

        # Tokenize text & inference (no gradients for speed)
        with torch.no_grad():
            inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=256)
            outputs = model(**inputs)
            probs = torch.softmax(outputs.logits, dim=1)
            max_index = torch.argmax(probs).item()
            emotion = model.config.id2label[max_index]

        stress = emotion_to_stress(emotion)
        academic_stress = academic_stress_classifier(text, emotion)
        risk = risk_detector(text)
        overall = overall_status_engine(emotion, stress, academic_stress, risk)
        response = generate_response(overall, emotion, academic_stress, risk)

        return AnalysisResult(
            emotion=emotion,
            stress_level=stress,
            academic_stress_category=academic_stress,
            risk_level=risk,
            overall_status=overall,
            bot_response=response
        )
    except HTTPException:
        raise
    except Exception as e:
        # Generic failure
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")


@app.post("/chat/start", response_model=ChatStartResponse)
def chat_start():
    session_id = str(uuid.uuid4())
    Sessions[session_id] = []
    return ChatStartResponse(session_id=session_id)


@app.post("/chat/message", response_model=ChatMessageResponse)
def chat_message(input: ChatMessageInput):
    try:
        session_id = input.session_id
        text = input.text.strip()
        if not text:
            raise HTTPException(status_code=400, detail="Input text cannot be empty.")
        if session_id not in Sessions:
            raise HTTPException(status_code=404, detail="Session not found. Start a new chat.")

        with torch.no_grad():
            tokenized = tokenizer(text, return_tensors="pt", truncation=True, max_length=256)
            outputs = model(**tokenized)
            probs = torch.softmax(outputs.logits, dim=1)
            max_index = torch.argmax(probs).item()
            emotion = model.config.id2label[max_index]

        stress = emotion_to_stress(emotion)
        academic_stress = academic_stress_classifier(text, emotion)
        risk = risk_detector(text)
        overall = overall_status_engine(emotion, stress, academic_stress, risk)

        history = Sessions.get(session_id, [])
        history.append({"role": "user", "content": text})

        reply = generate_therapeutic_reply(text, emotion, stress, academic_stress, risk, history)
        bot_message: str = reply.get("bot_message", "I'm here to help.")
        techniques: List[str] = reply.get("techniques", [])
        history.append({"role": "assistant", "content": bot_message})
        Sessions[session_id] = history[-20:]  # keep recent context

        return ChatMessageResponse(
            bot_message=bot_message,
            emotion=emotion,
            stress_level=stress,
            academic_stress_category=academic_stress,
            risk_level=risk,
            overall_status=overall,
            techniques=techniques,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {e}")
