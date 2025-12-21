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

type Message = {
  id: string;
  role: "user" | "bot";
  text: string;
  techniques?: string[];
  critical?: boolean;
};

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

  const accent = useThemeColor({}, "tint");
  const listRef = useRef<FlatList>(null);

  // ---------------- INIT SESSION ----------------
  useEffect(() => {
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

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-bot`,
          role: "bot",
          text: response.bot_message,
          techniques: response.techniques,
          critical: response.overall_status === "critical",
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
                        <View key={t} style={styles.techChip}>
                          <ThemedText style={styles.techChipText}>
                            {t}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }}
        />

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
});
