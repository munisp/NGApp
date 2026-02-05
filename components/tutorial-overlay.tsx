import { View, Text, Pressable, Modal, Dimensions } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/use-colors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  position?: "top" | "bottom" | "center";
}

export interface TutorialOverlayProps {
  tutorialKey: string;
  steps: TutorialStep[];
  onComplete?: () => void;
  autoStart?: boolean;
}

export function TutorialOverlay({
  tutorialKey,
  steps,
  onComplete,
  autoStart = true,
}: TutorialOverlayProps) {
  const colors = useColors();
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(true);

  useEffect(() => {
    checkTutorialStatus();
  }, []);

  const checkTutorialStatus = async () => {
    try {
      const seen = await AsyncStorage.getItem(`tutorial_${tutorialKey}`);
      const hasSeen = seen === "true";
      setHasSeenTutorial(hasSeen);

      if (!hasSeen && autoStart) {
        // Delay showing tutorial to allow screen to render
        setTimeout(() => {
          setIsVisible(true);
        }, 500);
      }
    } catch (error) {
      console.error("Failed to check tutorial status:", error);
    }
  };

  const markTutorialComplete = async () => {
    try {
      await AsyncStorage.setItem(`tutorial_${tutorialKey}`, "true");
      setHasSeenTutorial(true);
    } catch (error) {
      console.error("Failed to mark tutorial complete:", error);
    }
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleComplete();
  };

  const handleComplete = () => {
    setIsVisible(false);
    markTutorialComplete();
    if (onComplete) {
      onComplete();
    }
  };

  const restartTutorial = async () => {
    try {
      await AsyncStorage.removeItem(`tutorial_${tutorialKey}`);
      setHasSeenTutorial(false);
      setCurrentStep(0);
      setIsVisible(true);
    } catch (error) {
      console.error("Failed to restart tutorial:", error);
    }
  };

  if (hasSeenTutorial && !isVisible) {
    return null;
  }

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
        }}
      >
        {/* Highlight target area if specified */}
        {step.targetArea && (
          <View
            style={{
              position: "absolute",
              left: step.targetArea.x,
              top: step.targetArea.y,
              width: step.targetArea.width,
              height: step.targetArea.height,
              borderWidth: 3,
              borderColor: colors.primary,
              borderRadius: 12,
              backgroundColor: "transparent",
            }}
          />
        )}

        {/* Tutorial content */}
        <View
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            [step.position === "top"
              ? "top"
              : step.position === "bottom"
              ? "bottom"
              : "top"]: step.position === "center" ? SCREEN_HEIGHT / 2 - 150 : 100,
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 20,
              padding: 24,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            {/* Progress bar */}
            <View
              style={{
                height: 4,
                backgroundColor: colors.border,
                borderRadius: 2,
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  height: 4,
                  backgroundColor: colors.primary,
                  borderRadius: 2,
                  width: `${progress}%`,
                }}
              />
            </View>

            {/* Step indicator */}
            <Text
              style={{
                color: colors.muted,
                fontSize: 12,
                fontWeight: "600",
                marginBottom: 8,
              }}
            >
              Step {currentStep + 1} of {steps.length}
            </Text>

            {/* Title */}
            <Text
              style={{
                color: colors.foreground,
                fontSize: 20,
                fontWeight: "700",
                marginBottom: 12,
              }}
            >
              {step.title}
            </Text>

            {/* Description */}
            <Text
              style={{
                color: colors.muted,
                fontSize: 15,
                lineHeight: 22,
                marginBottom: 24,
              }}
            >
              {step.description}
            </Text>

            {/* Actions */}
            <View
              style={{
                flexDirection: "row",
                gap: 12,
              }}
            >
              <Pressable
                onPress={handleSkip}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    backgroundColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: "center",
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  Skip
                </Text>
              </Pressable>

              <Pressable
                onPress={handleNext}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: "center",
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.background,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {currentStep < steps.length - 1 ? "Next" : "Got it!"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Hook to manage tutorial state
 */
export function useTutorial(tutorialKey: string) {
  const [hasSeenTutorial, setHasSeenTutorial] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkStatus();
  }, [tutorialKey]);

  const checkStatus = async () => {
    try {
      const seen = await AsyncStorage.getItem(`tutorial_${tutorialKey}`);
      setHasSeenTutorial(seen === "true");
    } catch (error) {
      console.error("Failed to check tutorial status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetTutorial = async () => {
    try {
      await AsyncStorage.removeItem(`tutorial_${tutorialKey}`);
      setHasSeenTutorial(false);
    } catch (error) {
      console.error("Failed to reset tutorial:", error);
    }
  };

  const markComplete = async () => {
    try {
      await AsyncStorage.setItem(`tutorial_${tutorialKey}`, "true");
      setHasSeenTutorial(true);
    } catch (error) {
      console.error("Failed to mark tutorial complete:", error);
    }
  };

  return {
    hasSeenTutorial,
    isLoading,
    resetTutorial,
    markComplete,
  };
}
