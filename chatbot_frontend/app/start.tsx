import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";
import { startChatSession } from "@/src/services/chatApi";

export default function StartScreen() {
  const router = useRouter();
  const accent = useThemeColor({}, "tint");
  const buttonText = useThemeColor({}, "background");

  const floatOne = useRef(new Animated.Value(0)).current;
  const floatTwo = useRef(new Animated.Value(0)).current;

  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --------------------------------------------------
  // BACKGROUND ANIMATION
  // --------------------------------------------------
  useEffect(() => {
    const sequenceOne = Animated.loop(
      Animated.sequence([
        Animated.timing(floatOne, {
          toValue: 1,
          duration: 6000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatOne, {
          toValue: 0,
          duration: 6000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const sequenceTwo = Animated.loop(
      Animated.sequence([
        Animated.timing(floatTwo, {
          toValue: 1,
          duration: 8000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatTwo, {
          toValue: 0,
          duration: 8000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    sequenceOne.start();
    sequenceTwo.start();

    return () => {
      sequenceOne.stop();
      sequenceTwo.stop();
    };
  }, [floatOne, floatTwo]);

  const blobOneStyle = {
    transform: [
      {
        translateX: floatOne.interpolate({
          inputRange: [0, 1],
          outputRange: [-120, -60],
        }),
      },
      {
        translateY: floatOne.interpolate({
          inputRange: [0, 1],
          outputRange: [-60, -100],
        }),
      },
      {
        scale: floatOne.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.15],
        }),
      },
    ],
  };

  const blobTwoStyle = {
    transform: [
      {
        translateX: floatTwo.interpolate({
          inputRange: [0, 1],
          outputRange: [80, 100],
        }),
      },
      {
        translateY: floatTwo.interpolate({
          inputRange: [0, 1],
          outputRange: [60, 20],
        }),
      },
      {
        scale: floatTwo.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.9],
        }),
      },
    ],
  };

  // --------------------------------------------------
  // START CHAT
  // --------------------------------------------------
  async function handleStart() {
    if (isStarting) return;
    setError(null);
    setIsStarting(true);

    try {
      const sessionId = await startChatSession();
      router.push({ pathname: "/chat", params: { sessionId } });
    } catch (e) {
      setError(
        "I couldn’t start a secure session. Please make sure the server is running and try again."
      );
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <ThemedView style={styles.root} lightColor="#fef6ff" darkColor="#020617">
      <Animated.View style={[styles.blob, styles.blobOne, blobOneStyle]} />
      <Animated.View style={[styles.blob, styles.blobTwo, blobTwoStyle]} />

      <ThemedView
        style={styles.content}
        lightColor="transparent"
        darkColor="transparent"
      >
        <ThemedText type="title" style={styles.title}>
          A safe space to talk
        </ThemedText>

        <ThemedText style={styles.subtitle}>
          Share what’s on your mind. This AI is designed to understand stress,
          emotions, and academic pressure — and respond with care.
        </ThemedText>

        {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start chat with AI support"
          onPress={handleStart}
          disabled={isStarting}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: accent,
              opacity: pressed || isStarting ? 0.85 : 1,
            },
          ]}
        >
          {isStarting ? (
            <ActivityIndicator color={buttonText} />
          ) : (
            <ThemedText
              type="defaultSemiBold"
              style={[styles.ctaLabel, { color: buttonText }]}
            >
              Start now
            </ThemedText>
          )}
        </Pressable>

        <ThemedText style={styles.disclaimer}>
          This app does not replace professional mental health care.
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  content: {
    gap: 16,
    paddingHorizontal: 24,
    maxWidth: 440,
    alignItems: "center",
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.9,
  },
  errorText: {
    textAlign: "center",
    fontSize: 14,
    color: "#ef4444",
  },
  disclaimer: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.6,
    textAlign: "center",
  },
  cta: {
    marginTop: 8,
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 999,
    elevation: 8,
  },
  ctaLabel: {
    fontSize: 18,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  blob: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 200,
    opacity: 0.45,
  },
  blobOne: {
    backgroundColor: "#f97316",
    top: -80,
    left: -60,
  },
  blobTwo: {
    backgroundColor: "#6366f1",
    bottom: -60,
    right: -40,
  },
});
