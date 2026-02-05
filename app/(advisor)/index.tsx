import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function FinancialAdvisorScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI financial advisor. I can help you with budgeting, savings, investments, and financial planning. How can I assist you today?',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Scroll to bottom when messages change
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Get conversation history (last 10 messages)
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Mock user context (in real app, fetch from backend)
      const userContext = {
        totalBalance: 15000,
        monthlyIncome: 5000,
        monthlyExpenses: 3500,
        savingsGoals: 20000,
      };

      const response = await axios.post(`${API_URL}/api/advisor/chat`, {
        message: inputText.trim(),
        conversationHistory,
        userContext,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.message || 'I apologize, but I couldn\'t process your request. Please try again.',
        timestamp: response.data.timestamp || new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I\'m sorry, I\'m having trouble connecting right now. Please try again later.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const quickQuestions = [
    'How can I save more money?',
    'What\'s a good investment strategy?',
    'How do I create a budget?',
    'Should I pay off debt or save?',
  ];

  const askQuickQuestion = (question: string) => {
    setInputText(question);
  };

  return (
    <ScreenContainer className="flex-1">
      <Stack.Screen options={{ title: 'Financial Advisor', headerShown: true }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={100}
      >
        <View className="flex-1 p-4">
          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            className="flex-1 mb-4"
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {messages.map(message => (
              <View
                key={message.id}
                className={`mb-4 ${
                  message.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <View
                  className={`max-w-[80%] rounded-2xl p-4 ${
                    message.role === 'user'
                      ? 'bg-primary'
                      : 'bg-surface border border-border'
                  }`}
                >
                  <Text
                    className={`text-base leading-relaxed ${
                      message.role === 'user' ? 'text-white' : 'text-foreground'
                    }`}
                  >
                    {message.content}
                  </Text>
                  <Text
                    className={`text-xs mt-2 ${
                      message.role === 'user' ? 'text-white/70' : 'text-muted'
                    }`}
                  >
                    {new Date(message.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            ))}

            {isLoading && (
              <View className="items-start mb-4">
                <View className="bg-surface border border-border rounded-2xl p-4">
                  <Text className="text-muted">Thinking...</Text>
                </View>
              </View>
            )}

            {/* Quick Questions */}
            {messages.length === 1 && !isLoading && (
              <View className="mt-4">
                <Text className="text-muted text-sm mb-3">Quick questions:</Text>
                <View className="flex-row flex-wrap gap-2">
                  {quickQuestions.map((question, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => askQuickQuestion(question)}
                      className="bg-primary/10 border border-primary/30 rounded-full px-4 py-2"
                      style={{ opacity: 1 }}
                    >
                      <Text className="text-primary text-sm">{question}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input */}
          <View className="flex-row items-center gap-3 pb-2">
            <View className="flex-1 bg-surface border border-border rounded-full px-4 py-3">
              <TextInput
                className="text-foreground text-base"
                placeholder="Ask me anything about finance..."
                placeholderTextColor="#9BA1A6"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                editable={!isLoading}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
              />
            </View>
            <TouchableOpacity
              onPress={sendMessage}
              disabled={!inputText.trim() || isLoading}
              className={`w-12 h-12 rounded-full items-center justify-center ${
                inputText.trim() && !isLoading ? 'bg-primary' : 'bg-surface border border-border'
              }`}
              style={{ opacity: inputText.trim() && !isLoading ? 1 : 0.5 }}
            >
              <Text className={`text-2xl ${inputText.trim() && !isLoading ? 'text-white' : 'text-muted'}`}>
                ↑
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
