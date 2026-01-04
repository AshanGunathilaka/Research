import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { ThemedText } from "@/components/themed-text";

export function ChatInputBar({
  value,
  onChangeText,
  onSend,
  isSending,
  accent,
}) {
  const canSend = value?.trim();

  return (
    <View style={styles.inputRow}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Type how you're feeling…"
        placeholderTextColor="#94A3B8"
        multiline
        style={styles.input}
      />

      <Pressable
        onPress={onSend}
        disabled={!canSend || isSending}
        style={({ pressed }) => [
          styles.sendButton,
          {
            backgroundColor: !canSend ? "#94A3B8" : accent,
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
  );
}

const styles = StyleSheet.create({
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
