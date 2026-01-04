import { useRef, useEffect } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";

export function MessageList({ messages, onSelectTechnique }) {
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
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
                      onPress={() => onSelectTechnique?.(t)}
                      style={styles.techChip}
                    >
                      <ThemedText style={styles.techChipText}>{t}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
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
});
