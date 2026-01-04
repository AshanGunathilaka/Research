import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";

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
  "Energy audit":
    "Gently scan your day and notice what activities drain you and what restores you. Adjust one small thing in your favour.",
  "Task chunking (25/5 Pomodoro)":
    "Work for 25 minutes on a single task, then rest for 5. Repeat a few cycles and keep tasks small and specific.",
  "Two-minute small start":
    "Commit to only 2 minutes of a task. Often, starting is the hardest step and momentum will carry you afterwards.",
  "Mindful breathing":
    "Bring attention to your breath. Notice the air moving in and out, and gently return your focus when your mind wanders.",
};

export function TechniqueDetailCard({ technique }) {
  if (!technique) return null;

  return (
    <View style={styles.card}>
      <ThemedText style={styles.title}>{technique}</ThemedText>
      <ThemedText style={styles.body}>
        {TECHNIQUE_DETAILS[technique] ||
          "This is a grounding or coping technique. You can try it gently and notice how your body responds."}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
    color: "#0F172A",
  },
  body: {
    fontSize: 12,
    lineHeight: 18,
    color: "#4B5563",
  },
});
