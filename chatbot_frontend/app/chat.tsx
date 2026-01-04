import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";
import { startChatSession, sendChatMessage } from "@/src/services/chatApi";
import { ChatHeader } from "@/src/component/ChatHeader";
import { ChatStatusCard } from "@/src/component/ChatStatusCard";
import { MessageList } from "@/src/component/MessageList";
import { QuickPrompts } from "@/src/component/QuickPrompts";
import { TechniqueDetailCard } from "@/src/component/TechniqueDetailCard";
import { ChatInputBar } from "@/src/component/ChatInputBar";

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

  const lastStatusMeta: MessageMeta | null =
    [...messages].reverse().find((m) => m.role === "bot" && m.meta)?.meta ??
    null;

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
      <ChatHeader />

      <ChatStatusCard meta={lastStatusMeta ?? undefined} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <MessageList
          messages={messages}
          onSelectTechnique={setSelectedTechnique}
        />

        <QuickPrompts onSelect={setInput} />

        <TechniqueDetailCard technique={selectedTechnique} />

        <ChatInputBar
          value={input}
          onChangeText={setInput}
          onSend={handleSend}
          isSending={isSending}
          accent={accent}
        />
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
});
