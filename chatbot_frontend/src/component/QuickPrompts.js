import { View, Pressable, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";

const DEFAULT_PROMPTS = [
  "I'm overwhelmed with exams",
  "I can't focus on studying",
  "I'm scared I'll fail",
];

export function QuickPrompts({ onSelect, prompts = DEFAULT_PROMPTS }) {
  return (
    <View style={styles.promptRow}>
      {prompts.map((prompt) => (
        <Pressable
          key={prompt}
          onPress={() => onSelect?.(prompt)}
          style={styles.promptChip}
        >
          <ThemedText style={styles.promptChipText}>{prompt}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
