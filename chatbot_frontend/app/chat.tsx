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

const TECHNIQUE_DETAILS: Record<string, string> = {
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
  "Energy audit":
    "Gently scan your day and notice what activities drain you and what restores you. Adjust one small thing in your favour.",
  "Task chunking (25/5 Pomodoro)":
    "Work for 25 minutes on a single task, then rest for 5. Repeat a few cycles and keep tasks small and specific.",
  "Two-minute small start":
    "Commit to only 2 minutes of a task. Often, starting is the hardest step and momentum will carry you afterwards.",
  "Mindful breathing":
    "Bring attention to your breath. Notice the air moving in and out, and gently return your focus when your mind wanders.",
};

type MessageMeta = {
  emotion: string;
  stressLevel: string;
  academicStress: string;
  riskLevel: string;
  overallStatus: string;
};

type Message = {
  id: string;
  role: "user" | "bot";
  text: string;
  techniques?: string[];
  critical?: boolean;
  meta?: MessageMeta;
};

const STATUS_THEME: Record<string, { bg: string; border: string }> = {
  critical: { bg: "#FEE2E2", border: "#EF4444" },
  high_stress: { bg: "#FEF3C7", border: "#F59E0B" },
  moderate_stress: { bg: "#E0F2FE", border: "#38BDF8" },
  low_stress: { bg: "#DCFCE7", border: "#22C55E" },
  normal: { bg: "#EEF2FF", border: "#6366F1" },
  idle: { bg: "#EEF2FF", border: "#CBD5F5" },
};

const HISTORY_KEY = "mindplus_chat_history_v1";

function formatOverallStatus(status?: string) {
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

function formatEmotion(emotion?: string) {
  if (!emotion) return "Emotion: pending";
  return `Emotion: ${emotion}`;
}

function formatStressLevel(level?: string) {
  if (!level) return "Stress: pending";
  return `Stress: ${level}`;
}

function formatRiskLevel(risk?: string) {
  if (!risk) return "Risk: assessing";
  if (risk === "safe") return "Risk: safe";
  if (risk === "moderate_risk") return "Risk: needs care";
  if (risk === "high_risk") return "Risk: urgent";
  return `Risk: ${risk}`;
}

function formatAcademicStress(label?: string) {
  if (!label) return "Study stress: pending";

  if (label === "burnout") return "Study stress: burnout";
  if (label === "academic_stress_high") return "Study stress: high";
  if (label === "academic_stress_medium") return "Study stress: medium";
  if (label === "academic_stress_low") return "Study stress: low";

  return `Study stress: ${label}`;
}

function loadHistory(): Message[] | null {
  try {
    if (typeof globalThis === "undefined") return null;
    const anyGlobal = globalThis as any;
    if (!("localStorage" in anyGlobal)) return null;
    const raw = anyGlobal.localStorage.getItem(HISTORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as Message[];
  } catch {
    return null;
  }
}

function saveHistory(messages: Message[]) {
  try {
    if (typeof globalThis === "undefined") return;
    const anyGlobal = globalThis as any;
    if (!("localStorage" in anyGlobal)) return;
    const trimmed = messages.slice(-50); // keep last 50 messages
    anyGlobal.localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore persistence errors
  }
}

export default function ChatScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();

  const [session, setSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "intro",
      role: "bot",
      text: "I'm here to listen and support you. You can talk freely about what's been stressing you.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const [selectedTechnique, setSelectedTechnique] = useState<string | null>(
    null
  );

  const accent = useThemeColor({}, "tint");
  const listRef = useRef<FlatList>(null);

  const lastStatusMeta: MessageMeta | null =
    [...messages].reverse().find((m) => m.role === "bot" && m.meta)?.meta ??
    null;

  const statusThemeKey = lastStatusMeta?.overallStatus ?? "idle";
  const statusTheme = STATUS_THEME[statusThemeKey] ?? STATUS_THEME.idle;

  const botMetas = messages
    .filter((m) => m.role === "bot" && m.meta)
    .map((m) => m.meta!);
  const turns = botMetas.length;
  const currentRisk = lastStatusMeta?.riskLevel ?? "safe";

  // ---------------- INIT SESSION ----------------
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

  // ---------------- AUTO SCROLL ----------------
  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // ---------------- PERSIST HISTORY ----------------
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  // ---------------- SEND MESSAGE ----------------
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

      const meta: MessageMeta = {
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

  // ---------------- LOADING ----------------
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
      {/* HEADER */}
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>
          MindPlus Assistant 💙
        </ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          You’re safe to talk here
        </ThemedText>
      </View>

      <View
        style={[
          styles.statusCard,
          {
            backgroundColor: statusTheme.bg,
            borderColor: statusTheme.border,
          },
        ]}
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
                    style={[styles.bubbleText, isUser && { color: "#fff" }]}
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

        {/* QUICK PROMPTS */}
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

        {/* INPUT */}
        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type how you're feeling…"
            placeholderTextColor="#94A3B8"
            multiline
            style={styles.input}
          />

          <Pressable
            onPress={handleSend}
            disabled={!input.trim() || isSending}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: !input.trim() ? "#94A3B8" : accent,
                opacity: pressed || isSending ? 0.85 : 1,
              },
            ]}
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
    backgroundColor: "#EEF2FF",
  },
  flex: { flex: 1 },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  /* HEADER */
  header: {
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 20,
    backgroundColor: "#6366F1",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
    fontSize: 13,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },

  messageRow: {
    flexDirection: "row",
  },

  bubble: {
    maxWidth: "78%",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },

  userBubble: {
    backgroundColor: "#6366F1",
    borderTopRightRadius: 6,
  },

  botBubble: {
    backgroundColor: "#F1F5F9",
    borderTopLeftRadius: 6,
  },

  criticalBubble: {
    backgroundColor: "#FEE2E2",
    borderColor: "#EF4444",
    borderWidth: 1,
    borderTopLeftRadius: 6,
  },

  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#0F172A",
  },

  techniquesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },

  techChip: {
    backgroundColor: "#DBEAFE",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  techChipText: {
    fontSize: 11,
    color: "#1D4ED8",
    fontWeight: "600",
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    margin: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },

  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F1F5F9",
    fontSize: 15,
  },

  sendButton: {
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  sendLabel: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },

  promptRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  promptChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#E0E7FF",
  },
  promptChipText: {
    fontSize: 11,
    color: "#3730A3",
  },

  statusCard: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
    color: "#0F172A",
  },
  statusMeta: {
    fontSize: 12,
    color: "#475569",
  },

  techDetailCard: {
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  techDetailTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
    color: "#0F172A",
  },
  techDetailBody: {
    fontSize: 12,
    lineHeight: 18,
    color: "#4B5563",
  },
});
