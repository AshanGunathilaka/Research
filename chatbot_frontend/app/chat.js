import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";
import { startChatSession, sendChatMessage } from "@/src/services/chatApi";

const TECHNIQUE_DETAILS = {
  "5-4-3-2-1 grounding":
    "Look around and gently notice: 5 things you can see, 4 you can feel, 3 you can hear, 2 you can smell, and 1 you can taste.",
  "Box breathing (4-4-4-4)":
    "Inhale through your nose for 4 seconds, hold for 4, exhale for 4, hold for 4. Repeat this slow rhythm a few times.",
  "Self-compassion check-in":
    "Pause and speak to yourself as you would to a kind friend. Acknowledge that what you feel is valid and understandable.",
  "Small activation task":
    "Pick one tiny, doable task (like opening your notes or writing a title) to gently move things forward.",
  "4-7-8 breathing":
    "Breathe in for 4 seconds, hold for 7, and exhale slowly for 8. This can calm your nervous system.",
  "Cognitive defusion":
    "Notice your thoughts as mental events, not facts. You might say: 'I am having the thought that…' instead of 'This is true'.",
  "5-minute micro-break":
    "Step away for 5 minutes: stretch, drink water, or look out of a window. Let your body reset a little.",
  Energy audit:
    "Gently scan your day and notice what activities drain you and what restores you. Adjust one small thing in your favour.",
  "Task chunking (25/5 Pomodoro)":
    "Work for 25 minutes on a single task, then rest for 5. Repeat a few cycles and keep tasks small and specific.",
  "Two-minute small start":
    "Commit to only 2 minutes of a task. Often, starting is the hardest step and momentum will carry you afterwards.",
  "Mindful breathing":
    "Bring attention to your breath. Notice the air moving in and out, and gently return your focus when your mind wanders.",
};

const STATUS_THEME = {
  critical: { bg: "#FEE2E2", border: "#EF4444" },
  high_stress: { bg: "#FEF3C7", border: "#F59E0B" },
  moderate_stress: { bg: "#E0F2FE", border: "#38BDF8" },
  low_stress: { bg: "#DCFCE7", border: "#22C55E" },
  normal: { bg: "#EEF2FF", border: "#6366F1" },
  idle: { bg: "#EEF2FF", border: "#CBD5F5" },
};

const HISTORY_KEY = "mindplus_chat_history_v1";

function formatOverallStatus(status) {
  switch (status) {
    case "critical":
      return "Critical · Please reach out for real-time help";
    case "high_stress":
      return "High stress detected";
    case "moderate_stress":
      return "Moderate stress";
    case "low_stress":
      return "Low stress";
    case "normal":
      return "Stable for now";
    default:
      return "Tell me how you're feeling to get a snapshot";
  }
}

function formatEmotion(emotion) {
  if (!emotion) return "Emotion: pending";
  return `Emotion: ${emotion}`;
}

function formatStressLevel(level) {
  if (!level) return "Stress: pending";
  return `Stress: ${level}`;
}

function formatRiskLevel(risk) {
  if (!risk) return "Risk: assessing";
  if (risk === "safe") return "Risk: safe";
  if (risk === "moderate_risk") return "Risk: needs care";
  if (risk === "high_risk") return "Risk: urgent";
  return `Risk: ${risk}`;
}

function formatAcademicStress(label) {
  if (!label) return "Study stress: pending";

  if (label === "burnout") return "Study stress: burnout";
  if (label === "academic_stress_high") return "Study stress: high";
  if (label === "academic_stress_medium") return "Study stress: medium";
  if (label === "academic_stress_low") return "Study stress: low";

  return `Study stress: ${label}`;
}

function loadHistory() {
  try {
    if (typeof globalThis === "undefined") return null;
    const anyGlobal = globalThis;
    if (!("localStorage" in anyGlobal)) return null;
    const raw = anyGlobal.localStorage.getItem(HISTORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveHistory(messages) {
  try {
    if (typeof globalThis === "undefined") return;
    const anyGlobal = globalThis;
    if (!("localStorage" in anyGlobal)) return;
    const trimmed = messages.slice(-50); // keep last 50 messages
    anyGlobal.localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore persistence errors
  }
}

export default function ChatScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams();

  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: "intro",
      role: "bot",
      text: "I'm here to listen and support you. You can talk freely about what's been stressing you.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const [selectedTechnique, setSelectedTechnique] = useState(null);

  const accent = useThemeColor({}, "tint");
  const listRef = useRef(null);

  const lastStatusMeta =
    [...messages].reverse().find((m) => m.role === "bot" && m.meta)?.meta ??
    null;

  const statusThemeKey = lastStatusMeta?.overallStatus ?? "idle";
  const statusTheme = STATUS_THEME[statusThemeKey] ?? STATUS_THEME.idle;

  const botMetas = messages
    .filter((m) => m.role === "bot" && m.meta)
    .map((m) => m.meta);
  const turns = botMetas.length;
  const currentRisk = lastStatusMeta?.riskLevel ?? "safe";

  // Init session
  useEffect(() => {
    const stored = loadHistory();
    if (stored && stored.length) {
      setMessages(stored);
    }

    async function init() {
      try {
        if (sessionId) {
          setSession(sessionId);
        } else {
          const newSession = await startChatSession();
          setSession(newSession);
          router.setParams({ sessionId: newSession });
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: "session-error",
            role: "bot",
            text: "I couldn't start a chat session. Please make sure the backend is running.",
          },
        ]);
      } finally {
        setIsInitializing(false);
      }
    }
    init();
  }, [sessionId, router]);

  // Auto scroll
  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // Persist history
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  async function handleSend() {
    if (!session || !input.trim() || isSending) return;

    const userText = input.trim();
    setInput("");
    setIsSending(true);

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", text: userText },
    ]);

    try {
      const response = await sendChatMessage(session, userText);

      const meta = {
        emotion: response.emotion,
        stressLevel: response.stress_level,
        academicStress: response.academic_stress_category,
        riskLevel: response.risk_level,
        overallStatus: response.overall_status,
      };

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-bot`,
          role: "bot",
          text: response.bot_message,
          techniques: response.techniques,
          critical: response.overall_status === "critical",
          meta,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: "bot",
          text: "I'm having trouble connecting right now. Please try again.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  if (isInitializing) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <ThemedText style={{ marginTop: 12 }}>
          Starting secure session…
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.root}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>
          MindPlus Assistant 💙
        </ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          You’re safe to talk here
        </ThemedText>
      </View>

      <View
        style=[
          styles.statusCard,
          {
            backgroundColor: statusTheme.bg,
            borderColor: statusTheme.border,
          },
        ]
      >
        <ThemedText style={styles.statusLabel}>
          {formatOverallStatus(lastStatusMeta?.overallStatus)}
        </ThemedText>
        <ThemedText style={styles.statusMeta}>
          {formatEmotion(lastStatusMeta?.emotion)} ·{" "}
          {formatStressLevel(lastStatusMeta?.stressLevel)} ·{" "}
          {formatAcademicStress(lastStatusMeta?.academicStress)} ·{" "}
          {formatRiskLevel(lastStatusMeta?.riskLevel)}
        </ThemedText>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isUser = item.role === "user";

            return (
              <View
                style={[
                  styles.messageRow,
                  { justifyContent: isUser ? "flex-end" : "flex-start" },
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    isUser
                      ? styles.userBubble
                      : item.critical
                      ? styles.criticalBubble
                      : styles.botBubble,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.bubbleText,
                      isUser && { color: "#fff" },
                    ]}
                  >
                    {item.text}
                  </ThemedText>

                  {item.techniques?.length ? (
                    <View style={styles.techniquesRow}>
                      {item.techniques.map((t) => (
                        <Pressable
                          key={t}
                          onPress={() => setSelectedTechnique(t)}
                          style={styles.techChip}
                        >
                          <ThemedText style={styles.techChipText}>
                            {t}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }}
        />

        <View style={styles.promptRow}>
          {[
            "I'm overwhelmed with exams",
            "I can't focus on studying",
            "I'm scared I'll fail",
          ].map((prompt) => (
            <Pressable
              key={prompt}
              onPress={() => setInput(prompt)}
              style={styles.promptChip}
            >
              <ThemedText style={styles.promptChipText}>{prompt}</ThemedText>
            </Pressable>
          ))}
        </View>

        {selectedTechnique && (
          <View style={styles.techDetailCard}>
            <ThemedText style={styles.techDetailTitle}>
              {selectedTechnique}
            </ThemedText>
            <ThemedText style={styles.techDetailBody}>
              {TECHNIQUE_DETAILS[selectedTechnique] ||
                "This is a grounding or coping technique. You can try it gently and notice how your body responds."}
            </ThemedText>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type what’s on your mind…"
            placeholderTextColor="rgba(148, 163, 184, 1)"
            value={input}
            onChangeText={setInput}
            multiline
          />
          <Pressable
            style={[styles.sendButton, { backgroundColor: accent }]}
            onPress={handleSend}
            disabled={isSending || !input.trim()}
          >
            {isSending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.sendLabel}>Send</ThemedText>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 24,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    opacity: 0.9,
  },
  statusCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusMeta: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.9,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 16,
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: 4,
  },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: "#4F46E5",
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: "#E5E7EB",
    borderBottomLeftRadius: 4,
  },
  criticalBubble: {
    backgroundColor: "#FEE2E2",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  bubbleText: {
    fontSize: 15,
  },
  techniquesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  techChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EEF2FF",
  },
  techChipText: {
    fontSize: 12,
  },
  promptRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  promptChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
  },
  promptChipText: {
    fontSize: 12,
  },
  techDetailCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  techDetailTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  techDetailBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    fontSize: 14,
  },
  sendButton: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  sendLabel: {
    color: "#fff",
    fontWeight: "600",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
