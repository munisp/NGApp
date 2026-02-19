import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
export const ComposeMessageScreen = ({ navigation }: any) => {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const send = () => { Alert.alert('Success', 'Message sent', [{text: 'OK', onPress: () => navigation.goBack()}]); };
  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="To" value={to} onChangeText={setTo}/>
      <TextInput style={styles.input} placeholder="Subject" value={subject} onChangeText={setSubject}/>
      <TextInput style={[styles.input, styles.body]} placeholder="Message" value={body} onChangeText={setBody} multiline/>
      <TouchableOpacity style={styles.button} onPress={send}><Text style={styles.buttonText}>Send</Text></TouchableOpacity>
    </View>
  );
};
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 15, marginBottom: 15 },
  body: { height: 200, textAlignVertical: 'top' },
  button: { backgroundColor: '#667eea', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});