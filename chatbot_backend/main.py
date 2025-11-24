import os
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS"] = "1"

from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

# FastAPI app
app = FastAPI(
    title="Emotion, Stress & Risk Detection API",
    description="Detect a user's emotional state, stress level, academic stress category, risk level, and overall status.",
    version="2.5"
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
# MAIN API ENDPOINT
# -----------------------------------------------------------
@app.post("/analyze")
def analyze_text(input: TextInput):
    text = input.text

    # Tokenize text
    inputs = tokenizer(text, return_tensors="pt")
    outputs = model(**inputs)

    # Predict emotion
    probs = torch.softmax(outputs.logits, dim=1)
    max_index = torch.argmax(probs).item()
    emotion = model.config.id2label[max_index]

    # Basic stress
    stress = emotion_to_stress(emotion)

    # Academic stress
    academic_stress = academic_stress_classifier(text, emotion)

    # Risk detection
    risk = risk_detector(text)

    # Final combined status
    overall = overall_status_engine(emotion, stress, academic_stress, risk)
    response = generate_response(overall, emotion, academic_stress, risk)



    return {
        "emotion": emotion,
        "stress_level": stress,
        "academic_stress_category": academic_stress,
        "risk_level": risk,
        "overall_status": overall,
        "bot_response": response
    }
