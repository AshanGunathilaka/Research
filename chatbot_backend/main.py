from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

# FastAPI app
app = FastAPI(
    title="Emotion & Stress Detection API",
    description="Detect a user's emotional state and stress level from text",
    version="1.1"
)

# Load pretrained model
MODEL_NAME = "j-hartmann/emotion-english-distilroberta-base"

print("Loading model... This may take a few seconds...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
print("Model loaded!")

# Request body format
class TextInput(BaseModel):
    text: str

# Emotion → basic stress mapping
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


# NEW: Academic stress classifier (custom rule-based)
def academic_stress_classifier(text: str, emotion: str):
    text_lower = text.lower()

    # High stress keywords
    high_keywords = [
        "overwhelmed", "can't handle", "cannot handle", "suicidal",
        "hopeless", "panic", "breakdown", "giving up", "i'm done", "end it"
    ]

    # Medium stress keywords
    medium_keywords = [
        "stressed", "pressure", "anxious", "worried", "tired",
        "frustrated", "scared", "fear", "nervous"
    ]

    # Burnout detection
    burnout_keywords = [
        "burnout", "burnt out", "exhausted", "drained", "no energy",
        "empty", "fatigued"
    ]

    # Academic-specific words
    academic_keywords = [
        "exams", "exam", "assignments", "assignment", "university",
        "deadlines", "studies", "lectures", "tests", "school", "projects"
    ]

    # High-risk detection
    if any(word in text_lower for word in high_keywords):
        return "academic_stress_high"

    # Burnout
    if any(word in text_lower for word in burnout_keywords):
        return "burnout"

    # Medium stress
    if any(word in text_lower for word in medium_keywords):
        return "academic_stress_medium"

    # Academic context modifier
    if any(word in text_lower for word in academic_keywords):
        if emotion in ["fear", "sadness", "anger"]:
            return "academic_stress_high"
        elif emotion == "surprise":
            return "academic_stress_medium"
        else:
            return "academic_stress_low"

    # Emotion fallback logic
    if emotion in ["fear", "sadness", "anger"]:
        return "academic_stress_medium"

    return "academic_stress_low"


@app.post("/analyze")
def analyze_text(input: TextInput):
    text = input.text

    # Tokenize input
    inputs = tokenizer(text, return_tensors="pt")
    outputs = model(**inputs)

    # Predict emotion
    probs = torch.softmax(outputs.logits, dim=1)
    max_index = torch.argmax(probs).item()
    emotion = model.config.id2label[max_index]

    # Basic stress mapping
    stress = emotion_to_stress(emotion)

    # Academic stress classification
    academic_stress = academic_stress_classifier(text, emotion)

    return {
        "emotion": emotion,
        "stress_level": stress,
        "academic_stress_category": academic_stress
    }
