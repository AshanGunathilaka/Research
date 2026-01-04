import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";

const STATUS_THEME = {
  critical: { bg: "#FEE2E2", border: "#EF4444" },
  high_stress: { bg: "#FEF3C7", border: "#F59E0B" },
  moderate_stress: { bg: "#E0F2FE", border: "#38BDF8" },
  low_stress: { bg: "#DCFCE7", border: "#22C55E" },
  normal: { bg: "#EEF2FF", border: "#6366F1" },
  idle: { bg: "#EEF2FF", border: "#CBD5F5" },
};

function formatOverallStatus(status) {
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

function formatEmotion(emotion) {
  if (!emotion) return "Emotion: pending";
  return `Emotion: ${emotion}`;
}

function formatStressLevel(level) {
  if (!level) return "Stress: pending";
  return `Stress: ${level}`;
}

function formatRiskLevel(risk) {
  if (!risk) return "Risk: assessing";
  if (risk === "safe") return "Risk: safe";
  if (risk === "moderate_risk") return "Risk: needs care";
  if (risk === "high_risk") return "Risk: urgent";
  return `Risk: ${risk}`;
}

function formatAcademicStress(label) {
  if (!label) return "Study stress: pending";
  if (label === "burnout") return "Study stress: burnout";
  if (label === "academic_stress_high") return "Study stress: high";
  if (label === "academic_stress_medium") return "Study stress: medium";
  if (label === "academic_stress_low") return "Study stress: low";
  return `Study stress: ${label}`;
}

export function ChatStatusCard({ meta }) {
  const statusKey = meta?.overallStatus || "idle";
  const theme = STATUS_THEME[statusKey] || STATUS_THEME.idle;

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: 1,
        backgroundColor: theme.bg,
        borderColor: theme.border,
      }}
    >
      <ThemedText style={styles.statusLabel}>
        {formatOverallStatus(meta?.overallStatus)}
      </ThemedText>
      <ThemedText style={styles.statusMeta}>
        {formatEmotion(meta?.emotion)} · {formatStressLevel(meta?.stressLevel)}{" "}
        · {formatAcademicStress(meta?.academicStress)} ·{" "}
        {formatRiskLevel(meta?.riskLevel)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
