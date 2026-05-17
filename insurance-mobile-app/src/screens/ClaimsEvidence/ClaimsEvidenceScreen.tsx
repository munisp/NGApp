import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function ClaimsEvidenceScreen() {
  const [uploads] = useState([
    { id: '1', type: 'photo', name: 'damage_front.jpg', status: 'verified', aiScore: 95 },
    { id: '2', type: 'photo', name: 'damage_side.jpg', status: 'verified', aiScore: 92 },
    { id: '3', type: 'video', name: 'incident_video.mp4', status: 'processing', aiScore: 0 },
  ]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="camera" size={32} color="#2563eb" />
        <Text style={styles.title}>Claims Evidence</Text>
        <Text style={styles.subtitle}>Upload photos & videos with AI verification</Text>
      </View>

      <View style={styles.uploadSection}>
        <TouchableOpacity style={styles.uploadButton}>
          <Icon name="camera-plus" size={48} color="#2563eb" />
          <Text style={styles.uploadText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadButton}>
          <Icon name="video-plus" size={48} color="#2563eb" />
          <Text style={styles.uploadText}>Record Video</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadButton}>
          <Icon name="folder-upload" size={48} color="#2563eb" />
          <Text style={styles.uploadText}>Upload File</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Uploaded Evidence</Text>
      {uploads.map((upload) => (
        <View key={upload.id} style={styles.uploadCard}>
          <View style={styles.uploadIcon}>
            <Icon name={upload.type === 'photo' ? 'image' : 'video'} size={24} color="#6b7280" />
          </View>
          <View style={styles.uploadInfo}>
            <Text style={styles.uploadName}>{upload.name}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, upload.status === 'verified' ? styles.verifiedBadge : styles.processingBadge]}>
                <Text style={styles.statusText}>{upload.status === 'verified' ? 'AI Verified' : 'Processing'}</Text>
              </View>
              {upload.aiScore > 0 && (
                <Text style={styles.aiScore}>AI Score: {upload.aiScore}%</Text>
              )}
            </View>
          </View>
          <Icon name="check-circle" size={24} color={upload.status === 'verified' ? '#22c55e' : '#9ca3af'} />
        </View>
      ))}

      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>Tips for Better Evidence</Text>
        <View style={styles.tipItem}>
          <Icon name="lightbulb" size={20} color="#f59e0b" />
          <Text style={styles.tipText}>Ensure good lighting</Text>
        </View>
        <View style={styles.tipItem}>
          <Icon name="lightbulb" size={20} color="#f59e0b" />
          <Text style={styles.tipText}>Capture multiple angles</Text>
        </View>
        <View style={styles.tipItem}>
          <Icon name="lightbulb" size={20} color="#f59e0b" />
          <Text style={styles.tipText}>Include timestamps</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { padding: 20, alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  uploadSection: { flexDirection: 'row', justifyContent: 'space-around', padding: 20, backgroundColor: '#fff', marginTop: 8 },
  uploadButton: { alignItems: 'center', padding: 16, backgroundColor: '#eff6ff', borderRadius: 12, width: 100 },
  uploadText: { fontSize: 12, color: '#2563eb', marginTop: 8, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', padding: 16 },
  uploadCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  uploadIcon: { width: 48, height: 48, backgroundColor: '#f3f4f6', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  uploadInfo: { flex: 1, marginLeft: 12 },
  uploadName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  verifiedBadge: { backgroundColor: '#dcfce7' },
  processingBadge: { backgroundColor: '#fef3c7' },
  statusText: { fontSize: 12, color: '#166534' },
  aiScore: { fontSize: 12, color: '#6b7280', marginLeft: 8 },
  tipsCard: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12 },
  tipsTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  tipItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tipText: { fontSize: 14, color: '#6b7280', marginLeft: 8 },
});
