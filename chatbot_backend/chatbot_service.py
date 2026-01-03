import os
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS"] = "1"

from fastapi import HTTPException
from pydantic import BaseModel
from typing import List, Dict
import uuid
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification


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
# EMOTION  STRESS
# -----------------------------------------------------------
def emotion_to_stress(emotion: str) -> str:
    if emotion in ["fear", "sadness", "anger", "disgust"]:
        return "high"
    if emotion == "surprise":
        return "medium"
    return "low"


# -----------------------------------------------------------
# ACADEMIC STRESS DETECTOR
# -----------------------------------------------------------
def academic_stress_classifier(text: str, emotion: str) -> str:
    """Heuristic classifier focused on academic / study stress.

    Combines simple keyword spotting with the detected emotion.
    """

    t = text.lower()

    high_k = [
        "overwhelmed",
        "can't handle",
        "hopeless",
        "panic",
        "breakdown",
        "giving up",
        "end it",
        "crisis",
    ]
    med_k = [
        "stressed",
        "pressure",
        "anxious",
        "worried",
        "tired",
        "frustrated",
        "behind",
        "can't focus",
        "cant focus",
        "procrastinating",
        "procrastination",
    ]
    burnout_k = [
        "burnout",
        "burnt out",
        "exhausted",
        "drained",
        "no energy",
        "fatigued",
        "done with everything",
    ]
    academic_k = [
        "exam",
        "exams",
        "midterm",
        "final",
        "quiz",
        "assignment",
        "assignments",
        "deadline",
        "due",
        "project",
        "thesis",
        "dissertation",
        "university",
        "college",
        "school",
        "lectures",
        "lecture",
        "coursework",
        "gpa",
        "grades",
        "mark",
        "marks",
        "study",
        "studies",
        "studying",
    ]

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
def risk_detector(text: str) -> str:
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
def overall_status_engine(emotion: str, stress: str, academic_stress: str, risk: str) -> str:
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
def generate_response(overall_status: str, emotion: str, academic_stress: str, risk: str) -> str:
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
def suggest_techniques(emotion: str, academic_stress: str) -> List[str]:
    """Return a small set of concrete coping techniques.

    The names are interpreted on the frontend, where more detailed
    instructions can be shown.
    """

    techniques: List[str] = []

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

    # Fallback general tools
    if not techniques:
        techniques = ["Mindful breathing"]

    # Keep list short and unique
    deduped: List[str] = []
    for t in techniques:
        if t not in deduped:
            deduped.append(t)

    return deduped[:4]


# -----------------------------------------------------------
# THERAPEUTIC REPLY (SESSION MODE)
# -----------------------------------------------------------
def _classify_theme_from_history(history: List[Dict[str, str]], latest_text: str) -> str:
    """Roughly classify what the user is talking about (studies, relationships, life)."""

    combined = " ".join(m.get("message", "") for m in history if m.get("role") == "user")
    combined += " " + latest_text
    t = combined.lower()

    academic_terms = [
        "exam",
        "assignment",
        "lecture",
        "school",
        "university",
        "college",
        "gpa",
        "grade",
        "project",
        "thesis",
        "study",
        "studying",
    ]
    relationship_terms = [
        "friend",
        "friends",
        "relationship",
        "partner",
        "boyfriend",
        "girlfriend",
        "family",
        "parents",
        "mom",
        "dad",
    ]
    work_terms = ["job", "work", "shift", "boss", "office"]

    if any(w in t for w in academic_terms):
        return "studies"
    if any(w in t for w in relationship_terms):
        return "relationships"
    if any(w in t for w in work_terms):
        return "work"
    return "general"


def _build_reflection_sentence(text: str, emotion: str, academic_stress: str, theme: str) -> str:
    base = "Thank you for trusting me with this. "

    if theme == "studies":
        context = "It sounds like your studies and academic workload are really weighing on you. "
    elif theme == "relationships":
        context = "It sounds like the people around you and your relationships are on your mind a lot. "
    elif theme == "work":
        context = "It sounds like work and responsibilities are feeling heavy right now. "
    else:
        context = "It sounds like a lot is happening inside your head and heart. "

    if academic_stress == "burnout":
        stress_line = "Feeling burnt out is a sign you've been carrying too much for too long. "
    elif academic_stress == "academic_stress_high":
        stress_line = "This level of pressure would be intense for anyone in your position. "
    elif academic_stress == "academic_stress_medium":
        stress_line = "It's understandable that you're feeling stressed about this. "
    else:
        stress_line = "Even when stress is lower, your feelings still matter. "

    if emotion in ["sadness", "fear"]:
        emotion_line = "It's okay to feel this way, and you're not weak for feeling it. "
    elif emotion in ["anger"]:
        emotion_line = "Feeling angry can be a sign that something important to you feels threatened or unfair. "
    else:
        emotion_line = "Whatever you're feeling right now is valid. "

    return base + context + stress_line + emotion_line


def _build_followup_question(turns: int, risk: str, academic_stress: str) -> str:
    if risk == "high_risk":
        return (
            " If you can, please also consider telling a trusted person how you feel, "
            "or reaching out to a professional or emergency service in your area."
        )

    if turns <= 1:
        return " What part of this feels the heaviest right now?"

    if academic_stress in ("academic_stress_high", "burnout"):
        return " Of everything you've shared, which study-related pressure feels most urgent to ease, even a little?"

    return " What is one small change that, if it happened, would make this even slightly easier to carry?"


def _detect_cbt_pattern(text: str) -> str | None:
    """Very simple CBT-style helper.

    Looks for common thinking patterns and returns a gentle
    reframe if something is detected. This is *not* a
    clinical tool, just a conversational aid.
    """

    t = text.lower()

    all_or_nothing = ["always", "never", "completely fail", "ruined everything"]
    catastrophizing = ["disaster", "ruined", "no way out", "everything will go wrong"]
    mind_reading = ["everyone thinks", "they all think", "people will think"]
    self_criticism = ["i'm useless", "i am useless", "i'm stupid", "i am stupid", "i'm a failure", "i am a failure"]

    if any(p in t for p in self_criticism):
        return (
            "I also notice some very harsh thoughts about yourself. In CBT we might gently question "
            "those thoughts and ask: if a close friend were in your situation, would you judge them as harshly? "
        )

    if any(p in t for p in all_or_nothing):
        return (
            "It sounds like your mind is pulling things into all-or-nothing terms. A small CBT step is to look for "
            "examples that don't fully fit the 'always/never' story, even if they feel small. "
        )

    if any(p in t for p in catastrophizing):
        return (
            "Some of what you wrote sounds like your mind is jumping to the worst-case scenario. "
            "A CBT-style question here is: what is the most realistic outcome, and what evidence supports it? "
        )

    if any(p in t for p in mind_reading):
        return (
            "You mentioned worrying about what others think. In CBT this is sometimes called 'mind-reading'— "
            "assuming we know others' thoughts without clear evidence. It can help to pause and ask what you actually know for sure. "
        )

    return None


def generate_therapeutic_reply(
    text: str,
    emotion: str,
    stress: str,
    academic_stress: str,
    risk: str,
    history: List[Dict[str, str]],
):
    """Generate a supportive, stress-focused reply using simple rules.

    This function is intentionally conservative: it offers validation,
    coping strategies and gentle reflection, and defers to real-world
    help for any high-risk situations.
    """

    # High-risk: prioritise safety messaging and do not try to "fix" things
    if risk == "high_risk":
        return {
            "bot_message": (
                "I'm really glad you shared this with me. Your safety matters more than anything. "
                "I'm an AI and I can't provide emergency help, but I care about your wellbeing. "
                "If you feel like you might harm yourself or are in immediate danger, please contact "
                "emergency services or a crisis hotline in your country right now. "
                "You don't have to face this alone."
            ),
            "techniques": [
                "Call emergency services",
                "Contact someone you trust",
            ],
        }

    turns = sum(1 for m in history if m.get("role") == "user")
    theme = _classify_theme_from_history(history, text)

    # ChatGPT-like greeting on the very first turn
    greeting = ""
    if turns == 0:
        greeting = (
            "Hi, I'm MindPlus, an AI companion focused on stress, emotions, and academic pressure. "
            "I can't replace a human professional, but I can help you explore what you're feeling and suggest coping ideas. "
        )

    reflection = _build_reflection_sentence(text, emotion, academic_stress, theme)

    if stress == "high" or academic_stress in ["academic_stress_high", "burnout"]:
        tone = "Right now your nervous system is trying to cope with a lot. "
    elif stress == "medium":
        tone = "Your reaction makes sense given what you're dealing with. "
    else:
        tone = "Even if things seem okay from the outside, it's valid to want support. "

    # Simple CBT-style line (optional)
    cbt_line = _detect_cbt_pattern(text) or ""

    # Academic-ready short explanation of the classification
    overall = overall_status_engine(emotion, stress, academic_stress, risk)
    academic_expl = (
        "From a stress-screening point of view, this looks like "
        f"'{overall}' overall with '{academic_stress}' related to your studies. "
        "This is just an automated approximation, not a diagnosis. "
    )

    techniques = suggest_techniques(emotion, academic_stress)
    technique_line = (
        "Here are a couple of gentle things you could try: "
        + ", ".join(techniques)
        + ". "
    )

    followup = _build_followup_question(turns, risk, academic_stress)

    bot_message = greeting + reflection + tone + academic_expl + cbt_line + technique_line + followup

    return {"bot_message": bot_message, "techniques": techniques}


# -----------------------------------------------------------
# IN-MEMORY SESSION STORE
# -----------------------------------------------------------
Sessions: Dict[str, List[Dict[str, str]]] = {}


# -----------------------------------------------------------
# SERVICE FUNCTIONS
# -----------------------------------------------------------

def health_service() -> Dict[str, str]:
    return {"status": "ok"}


def analyze_text_service(input: TextInput) -> AnalysisResult:
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

        analysis = AnalysisResult(
            emotion=emotion,
            stress_level=stress,
            academic_stress_category=academic_stress,
            risk_level=risk,
            overall_status=overall,
            bot_response=bot_response,
        )

        # user_id is currently unused but kept for future extension
        _ = user_id

        return analysis

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {e}")


def chat_start_service() -> ChatStartResponse:
    session_id = str(uuid.uuid4())
    Sessions[session_id] = []
    return ChatStartResponse(session_id=session_id)


def chat_message_service(input: ChatMessageInput) -> ChatMessageResponse:
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

        history = Sessions.get(session_id, [])
        reply = generate_therapeutic_reply(text, emotion, stress, academic_stress, risk, history)
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
            techniques=techniques,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {e}")
