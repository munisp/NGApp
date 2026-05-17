import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'yo', name: 'Yoruba', flag: '🇳🇬' },
  { code: 'ha', name: 'Hausa', flag: '🇳🇬' },
  { code: 'ig', name: 'Igbo', flag: '🇳🇬' },
  { code: 'pcm', name: 'Pidgin', flag: '🇳🇬' },
];

const quickCommands = [
  { icon: 'shield-check', label: 'Check my policies' },
  { icon: 'file-document-edit', label: 'File a claim' },
  { icon: 'cash', label: 'Payment status' },
  { icon: 'calculator', label: 'Get a quote' },
];

export default function VoiceAssistantScreen() {
  const [isListening, setIsListening] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your InsurePortal voice assistant. How can I help you today?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);

  const handleMicPress = () => {
    setIsListening(!isListening);
  };

  const handleQuickCommand = (command: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      text: command,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages([...messages, userMessage]);

    setTimeout(() => {
      const response: Message = {
        id: (Date.now() + 1).toString(),
        text: getResponseForCommand(command),
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, response]);
    }, 1000);
  };

  const getResponseForCommand = (command: string): string => {
    if (command.includes('policies')) {
      return 'You have 3 active policies: Auto Insurance (Premium), Health Insurance (Family), and Home Insurance (Standard). Would you like details on any of these?';
    }
    if (command.includes('claim')) {
      return "I can help you file a claim. What type of claim would you like to file? Auto, Health, or Property?";
    }
    if (command.includes('Payment')) {
      return 'Your next payment of ₦45,000 is due on February 15, 2026 for your Auto Insurance policy. Would you like to make a payment now?';
    }
    if (command.includes('quote')) {
      return 'I can get you a quote for Auto, Health, Home, Life, or Agricultural insurance. Which type are you interested in?';
    }
    return "I'm here to help! You can ask about your policies, file claims, check payments, or get insurance quotes.";
  };

  const selectedLang = languages.find((l) => l.code === selectedLanguage);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Voice Assistant</Text>
        <TouchableOpacity
          style={styles.languageButton}
          onPress={() => setShowLanguageMenu(!showLanguageMenu)}
        >
          <Text style={styles.languageText}>
            {selectedLang?.flag} {selectedLang?.name}
          </Text>
          <Icon name="chevron-down" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {showLanguageMenu && (
        <View style={styles.languageMenu}>
          {languages.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageOption,
                selectedLanguage === lang.code && styles.languageOptionSelected,
              ]}
              onPress={() => {
                setSelectedLanguage(lang.code);
                setShowLanguageMenu(false);
              }}
            >
              <Text style={styles.languageOptionText}>
                {lang.flag} {lang.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.micContainer}>
        <TouchableOpacity
          style={[styles.micButton, isListening && styles.micButtonActive]}
          onPress={handleMicPress}
        >
          <Icon
            name={isListening ? 'microphone' : 'microphone-outline'}
            size={48}
            color="#ffffff"
          />
        </TouchableOpacity>
        <Text style={styles.micText}>
          {isListening ? 'Listening...' : 'Tap to speak'}
        </Text>
      </View>

      <View style={styles.quickCommandsContainer}>
        <Text style={styles.sectionTitle}>Quick Commands</Text>
        <View style={styles.quickCommandsGrid}>
          {quickCommands.map((cmd, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickCommandButton}
              onPress={() => handleQuickCommand(cmd.label)}
            >
              <Icon name={cmd.icon} size={24} color="#3b82f6" />
              <Text style={styles.quickCommandText}>{cmd.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.conversationContainer}>
        <Text style={styles.sectionTitle}>Conversation</Text>
        <ScrollView style={styles.messagesContainer}>
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.isUser ? styles.userMessage : styles.assistantMessage,
              ]}
            >
              {!message.isUser && (
                <Icon
                  name="robot"
                  size={20}
                  color="#3b82f6"
                  style={styles.messageIcon}
                />
              )}
              <View style={styles.messageContent}>
                <Text style={styles.messageText}>{message.text}</Text>
                <Text style={styles.messageTime}>
                  {message.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.featuresContainer}>
        <View style={styles.featureItem}>
          <Icon name="microphone" size={16} color="#22c55e" />
          <Text style={styles.featureText}>Speech Recognition</Text>
        </View>
        <View style={styles.featureItem}>
          <Icon name="volume-high" size={16} color="#22c55e" />
          <Text style={styles.featureText}>Text-to-Speech</Text>
        </View>
        <View style={styles.featureItem}>
          <Icon name="translate" size={16} color="#22c55e" />
          <Text style={styles.featureText}>5 Languages</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  languageText: {
    fontSize: 14,
    color: '#374151',
    marginRight: 4,
  },
  languageMenu: {
    position: 'absolute',
    top: 70,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 100,
  },
  languageOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  languageOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  languageOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  micContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  micButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  micButtonActive: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  micText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  quickCommandsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  quickCommandsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickCommandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  quickCommandText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#374151',
  },
  conversationContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 12,
    maxWidth: '90%',
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
  },
  messageIcon: {
    marginRight: 8,
    marginTop: 4,
  },
  messageContent: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 12,
  },
  messageText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#6b7280',
  },
});
