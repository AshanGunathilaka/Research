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
    description="Detect a user's emotional state, stress level, academic stress category, and risk level.",
    version="2.0"
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

# Basic stress mapping based on emotion
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

# Academic stress classifier (rule-based)
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

    # High-risk academic stress
    if any(word in text_lower for word in high_keywords):
        return "academic_stress_high"

    # Burnout detection
    if any(word in text_lower for word in burnout_keywords):
        return "burnout"

    # Medium academic stress
    if any(word in text_lower for word in medium_keywords):
        return "academic_stress_medium"

    # Academic context influences stress
    if any(word in text_lower for word in academic_keywords):
        if emotion in ["fear", "sadness", "anger"]:
            return "academic_stress_high"
        elif emotion == "surprise":
            return "academic_stress_medium"
        else:
            return "academic_stress_low"

    # Fallback based on emotion
    if emotion in ["fear", "sadness", "anger"]:
        return "academic_stress_medium"

    return "academic_stress_low"

# High-risk / suicidal intent classifier
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

    return {
        "emotion": emotion,
        "stress_level": stress,
        "academic_stress_category": academic_stress,
        "risk_level": risk
    }
