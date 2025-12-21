import { Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import { Colors } from "@/constants/theme";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";

export default function HomeScreen() {
  const router = useRouter();
  const theme = useColorScheme() ?? "light";
  const accent = useThemeColor({}, "tint");
  const buttonLabel = theme === "dark" ? Colors.dark.background : "#fff";

  return (
    <ThemedView style={styles.container}>
      {/* Hero Section */}
      <ThemedView style={styles.heroBlock}>
        <ThemedText type="title" style={styles.heroTitle}>
          You don’t have to handle stress alone
        </ThemedText>

        <ThemedText style={styles.heroSubtitle}>
          Talk to an AI companion trained to understand emotions, stress,
          academic pressure, and difficult moments — in a safe, supportive way.
        </ThemedText>
      </ThemedView>

      {/* CTA Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start chatting with AI stress support"
        onPress={() => router.push("/chat")}
        style={({ pressed }) => [
          styles.chatButton,
          { backgroundColor: accent, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <ThemedText
          type="defaultSemiBold"
          style={[styles.chatButtonLabel, { color: buttonLabel }]}
        >
          Start Now
        </ThemedText>
      </Pressable>

      {/* Disclaimer */}
      <ThemedText style={styles.disclaimer}>
        This is not a replacement for professional mental health care.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 36,
  },
  heroBlock: {
    gap: 14,
    maxWidth: 420,
  },
  heroTitle: {
    textAlign: "center",
  },
  heroSubtitle: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.85,
  },
  chatButton: {
    borderRadius: 28,
    paddingHorizontal: 36,
    paddingVertical: 16,
    minWidth: 220,
    alignItems: "center",
  },
  chatButtonLabel: {
    fontSize: 18,
  },
  disclaimer: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: "center",
    marginTop: 8,
  },
});
