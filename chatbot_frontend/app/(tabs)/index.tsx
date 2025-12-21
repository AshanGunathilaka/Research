import { Pressable, StyleSheet } from "react-native";

import { Colors } from "@/constants/theme";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";

export default function HomeScreen() {
  const theme = useColorScheme() ?? "light";
  const accent = useThemeColor({}, "tint");
  const buttonLabel = theme === "dark" ? Colors.dark.background : "#fff";

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.heroBlock}>
        <ThemedText type="title" style={styles.heroTitle}>
          Your AI copilot for everyday questions
        </ThemedText>
        <ThemedText style={styles.heroSubtitle}>
          Connect with the assistant to get answers, brainstorm ideas, or plan
          your next steps.
        </ThemedText>
      </ThemedView>
      <Pressable
        accessibilityRole="button"
        onPress={() => console.log("Chat with me tapped")}
        style={({ pressed }) => [
          styles.chatButton,
          { backgroundColor: accent, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <ThemedText
          type="defaultSemiBold"
          style={[styles.chatButtonLabel, { color: buttonLabel }]}
        >
          Chat with me
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 32,
  },
  heroBlock: {
    gap: 12,
    maxWidth: 420,
  },
  heroTitle: {
    textAlign: "center",
  },
  heroSubtitle: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
  },
  chatButton: {
    borderRadius: 28,
    paddingHorizontal: 32,
    paddingVertical: 16,
    minWidth: 220,
    alignItems: "center",
  },
  chatButtonLabel: {
    fontSize: 18,
  },
});
