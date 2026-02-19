import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
export const ChatbotScreen = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const send = () => { if(input.trim()) { setMessages([...messages, {id: Date.now(), text: input, user: true}]); setInput(''); }};
  return (
    <View style={styles.container}>
      <FlatList data={messages} keyExtractor={i=>i.id.toString()} renderItem={({item})=><View style={[styles.message, item.user && styles.userMessage]}><Text>{item.text}</Text></View>}/>
      <View style={styles.inputContainer}>
        <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Type a message..."/>
        <TouchableOpacity style={styles.sendButton} onPress={send}><Text style={styles.sendText}>Send</Text></TouchableOpacity>
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  message: { backgroundColor: '#fff', padding: 15, margin: 10, borderRadius: 10 },
  userMessage: { backgroundColor: '#667eea', alignSelf: 'flex-end' },
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#fff' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginRight: 10 },
  sendButton: { backgroundColor: '#667eea', padding: 10, borderRadius: 8, justifyContent: 'center' },
  sendText: { color: '#fff', fontWeight: '600' },
});