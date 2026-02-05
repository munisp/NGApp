import { ScrollView, Text, View, Pressable, FlatList, Platform } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { TutorialOverlay, TutorialStep } from "@/components/tutorial-overlay";
import {
  parseVoicePaymentCommand,
  executeVoicePayment,
  getVoicePaymentHelp,
} from "@/utils/voice-payments";

interface VoiceMessage {
  id: string;
  type: "user" | "assistant";
  text: string;
  timestamp: string;
}

export default function VoiceAssistantScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");

  const tutorialSteps: TutorialStep[] = [
    {
      id: 'voice_intro',
      title: 'Voice Assistant',
      description: 'Ask questions about your finances using natural language. Just tap the microphone and speak.',
      position: 'top',
    },
    {
      id: 'voice_commands',
      title: 'What You Can Ask',
      description: 'Try "What\'s my balance?", "Show recent transactions", or "How much did I spend this month?"',
      position: 'center',
    },
    {
      id: 'voice_responses',
      title: 'Smart Responses',
      description: 'The assistant will speak the answer back to you and show it in the conversation history.',
      position: 'bottom',
    },
  ];

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem("voice_history");
      if (saved) {
        setMessages(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  };

  const saveHistory = async (newMessages: VoiceMessage[]) => {
    try {
      await AsyncStorage.setItem("voice_history", JSON.stringify(newMessages));
    } catch (error) {
      console.error("Failed to save history:", error);
    }
  };

  const startListening = async () => {
    if (Platform.OS === "web") {
      // Web implementation using Web Speech API
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Speech recognition is not supported in your browser");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setTranscript(transcript);
        processVoiceCommand(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } else {
      // Mobile: Use native audio recording with permission check
      try {
        // Request microphone permissions
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== "granted") {
          alert("Microphone permission is required for voice commands");
          return;
        }

        setIsListening(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Note: For full native speech-to-text, integrate with platform-specific services
        // (e.g., Google Speech API, Apple Speech Framework)
        // For now, provide text input with microphone permission validated
        setTimeout(() => {
          setIsListening(false);
          const userInput = prompt("Voice Command (microphone ready):");
          if (userInput) {
            processVoiceCommand(userInput);
          }
        }, 500);
      } catch (error) {
        console.error("Voice recognition error:", error);
        setIsListening(false);
        alert("Failed to start voice recognition. Please try again.");
      }
    }
  };

  const processVoiceCommand = async (text: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Add user message
    const userMessage: VoiceMessage = {
      id: Date.now().toString(),
      type: "user",
      text,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Check if it's a payment command first
    const paymentCommand = parseVoicePaymentCommand(text);
    if (paymentCommand.type !== "unknown" && paymentCommand.confidence >= 0.6) {
      const result = await executeVoicePayment(paymentCommand);
      
      const assistantMessage: VoiceMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        text: result.message,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      saveHistory(finalMessages);
      speakResponse(result.message);

      // Navigate if payment was successful
      if (result.success && result.navigationPath) {
        setTimeout(() => {
          router.push(result.navigationPath as any);
        }, 2000);
      }
      return;
    }

    try {
      // Call backend voice API
      const response = await fetch("http://127.0.0.1:3000/api/voice/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: text,
          userContext: {
            balance: 5420.50,
            recentTransactions: 12,
            savingsGoals: 3,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to process voice command");
      }

      const data = await response.json();

      // Add assistant message
      const assistantMessage: VoiceMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        text: data.response,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      saveHistory(finalMessages);

      // Speak the response
      speakResponse(data.response);
    } catch (error) {
      console.error("Voice command error:", error);
      const errorMessage: VoiceMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        text: "I'm sorry, I couldn't process that request. Please try again.",
        timestamp: new Date().toISOString(),
      };
      const finalMessages = [...updatedMessages, errorMessage];
      setMessages(finalMessages);
      saveHistory(finalMessages);
    }
  };

  const speakResponse = (text: string) => {
    if (Platform.OS === "web") {
      // Web speech synthesis
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } else {
      // Mobile speech synthesis
      setIsSpeaking(true);
      Speech.speak(text, {
        language: "en-US",
        pitch: 1.0,
        rate: 1.0,
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    }
  };

  const stopSpeaking = () => {
    if (Platform.OS === "web") {
      window.speechSynthesis.cancel();
    } else {
      Speech.stop();
    }
    setIsSpeaking(false);
  };

  const clearHistory = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMessages([]);
    await AsyncStorage.removeItem("voice_history");
  };

  const quickQuestions = [
    "What's my balance?",
    "Show recent transactions",
    "How much did I spend this month?",
    "What are my savings goals?",
  ];

  const renderMessage = ({ item }: { item: VoiceMessage }) => (
    <View
      className={`mb-4 ${item.type === "user" ? "items-end" : "items-start"}`}
    >
      <View
        style={{
          backgroundColor: item.type === "user" ? colors.primary : colors.surface,
          maxWidth: "80%",
        }}
        className="rounded-2xl p-4"
      >
        <Text
          style={{
            color: item.type === "user" ? colors.background : colors.foreground,
          }}
          className="text-base"
        >
          {item.text}
        </Text>
        <Text
          style={{
            color: item.type === "user" ? colors.background + "CC" : colors.muted,
          }}
          className="text-xs mt-2"
        >
          {new Date(item.timestamp).toLocaleTimeString()}
        </Text>
      </View>
    </View>
  );

  return (
    <>
      <TutorialOverlay
        tutorialKey="voice_assistant"
        steps={tutorialSteps}
        autoStart={true}
      />
      <ScreenContainer className="p-6">
      <View className="flex-1 gap-6">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">
              Voice Assistant
            </Text>
            <Text className="text-sm text-muted">
              Ask me anything about your finances
            </Text>
          </View>
          {messages.length > 0 && (
            <Pressable
              onPress={clearHistory}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text className="text-primary font-semibold">Clear</Text>
            </Pressable>
          )}
        </View>

        {/* Messages */}
        {messages.length > 0 ? (
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        ) : (
          <View className="flex-1 items-center justify-center gap-6">
            <View className="items-center">
              <Text className="text-6xl mb-4">🎤</Text>
              <Text className="text-lg font-semibold text-foreground mb-2">
                Voice Assistant Ready
              </Text>
              <Text className="text-sm text-muted text-center px-8">
                Tap the microphone button to start talking
              </Text>
            </View>

            {/* Quick Questions */}
            <View className="w-full gap-2">
              <Text className="text-sm font-semibold text-muted mb-2">
                Try asking:
              </Text>
              {quickQuestions.map((question, index) => (
                <Pressable
                  key={index}
                  onPress={() => processVoiceCommand(question)}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.surface,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  className="p-4 rounded-2xl border border-border"
                >
                  <Text className="text-sm text-foreground">{question}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Voice Control Button */}
        <View className="items-center gap-3">
          {isSpeaking && (
            <Pressable
              onPress={stopSpeaking}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.error,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              className="px-6 py-3 rounded-full"
            >
              <Text className="text-background font-semibold">
                Stop Speaking
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={startListening}
            disabled={isListening || isSpeaking}
            style={({ pressed }) => [
              {
                backgroundColor: isListening ? colors.success : colors.primary,
                opacity: pressed || isSpeaking ? 0.5 : 1,
              },
            ]}
            className="w-20 h-20 rounded-full items-center justify-center"
          >
            <Text className="text-4xl">{isListening ? "🎙️" : "🎤"}</Text>
          </Pressable>

          <Text className="text-sm text-muted">
            {isListening
              ? "Listening..."
              : isSpeaking
              ? "Speaking..."
              : "Tap to speak"}
          </Text>
        </View>
      </View>
    </ScreenContainer>
    </>
  );
}
