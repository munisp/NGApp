import React, { useState, useRef, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Avatar } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../services/api';
import { spacing, typography, theme } from '../../utils/theme';
import { t } from '../../services/i18n';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

const QUICK_PROMPTS = [
  'What insurance do I need?',
  'How do I file a claim?',
  'Explain my policy coverage',
  'Compare health insurance plans',
  'What is the claims process?',
];

export default function AIAdvisorScreen({ navigation }: any) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI Insurance Advisor. I can help you understand your policies, compare plans, file claims, and answer any insurance-related questions. How can I assist you today?',
      timestamp: new Date(),
      suggestions: QUICK_PROMPTS.slice(0, 3),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiClient.post('/ai/chat', {
        message,
        context: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
      });
      return response.data;
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        suggestions: data.suggestions,
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
    onError: () => {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again or contact support if the issue persists.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    },
  });

  const handleSend = (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    chatMutation.mutate(messageText);
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';

    return (
      <View key={message.id} style={[styles.messageContainer, isUser && styles.userMessageContainer]}>
        {!isUser && (
          <Avatar.Icon
            size={36}
            icon="robot"
            style={styles.avatar}
          />
        )}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.messageText, isUser && styles.userMessageText]}>
            {message.content}
          </Text>
          <Text style={[styles.timestamp, isUser && styles.userTimestamp]}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {isUser && (
          <Avatar.Icon
            size={36}
            icon="account"
            style={[styles.avatar, styles.userAvatar]}
          />
        )}
      </View>
    );
  };

  const renderSuggestions = (suggestions: string[]) => (
    <View style={styles.suggestionsContainer}>
      {suggestions.map((suggestion, index) => (
        <TouchableOpacity
          key={index}
          style={styles.suggestionChip}
          onPress={() => handleSend(suggestion)}
        >
          <Text style={styles.suggestionText}>{suggestion}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Avatar.Icon size={40} icon="robot" style={styles.headerAvatar} />
          <View>
            <Text style={styles.headerTitle}>AI Insurance Advisor</Text>
            <Text style={styles.headerSubtitle}>Always here to help</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.menuButton}>
          <Icon name="dots-vertical" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map(message => (
          <View key={message.id}>
            {renderMessage(message)}
            {message.suggestions && message.role === 'assistant' && renderSuggestions(message.suggestions)}
          </View>
        ))}
        {chatMutation.isPending && (
          <View style={styles.typingIndicator}>
            <Avatar.Icon size={36} icon="robot" style={styles.avatar} />
            <View style={styles.typingBubble}>
              <Text style={styles.typingText}>Thinking...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask me anything about insurance..."
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={() => handleSend()}
          disabled={!inputText.trim() || chatMutation.isPending}
        >
          <Icon
            name="send"
            size={24}
            color={inputText.trim() ? '#fff' : theme.colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  headerAvatar: {
    backgroundColor: theme.colors.primary,
    marginRight: spacing.md,
  },
  headerTitle: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  headerSubtitle: {
    ...typography.small,
    color: theme.colors.success,
  },
  menuButton: {
    padding: spacing.xs,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    alignItems: 'flex-end',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  avatar: {
    backgroundColor: theme.colors.primary,
  },
  userAvatar: {
    backgroundColor: theme.colors.secondary,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: spacing.md,
    borderRadius: 16,
    marginHorizontal: spacing.sm,
  },
  assistantBubble: {
    backgroundColor: theme.colors.surface,
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  messageText: {
    ...typography.body,
    color: theme.colors.text,
  },
  userMessageText: {
    color: '#fff',
  },
  timestamp: {
    ...typography.small,
    color: theme.colors.textSecondary,
    marginTop: spacing.xs,
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: 48,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  suggestionChip: {
    backgroundColor: theme.colors.primary + '15',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  suggestionText: {
    ...typography.small,
    color: theme.colors.primary,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  typingBubble: {
    backgroundColor: theme.colors.surface,
    padding: spacing.md,
    borderRadius: 16,
    marginLeft: spacing.sm,
  },
  typingText: {
    ...typography.body,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    marginRight: spacing.sm,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
});
