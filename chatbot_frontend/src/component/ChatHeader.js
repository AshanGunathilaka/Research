import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";

export function ChatHeader() {
  return (
    <View style={styles.header}>
      <ThemedText style={styles.headerTitle}>MindPlus Assistant 💙</ThemedText>
      <ThemedText style={styles.headerSubtitle}>
        You’re safe to talk here
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
