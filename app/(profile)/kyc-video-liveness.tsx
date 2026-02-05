import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';
import { videoLivenessService } from '@/lib/api/video-liveness-service';

type Challenge = 'blink' | 'turn_head_left' | 'turn_head_right' | 'smile' | 'nod';

interface ChallengeConfig {
  type: Challenge;
  instruction: string;
  emoji: string;
  duration: number; // seconds
}

const CHALLENGES: ChallengeConfig[] = [
  { type: 'blink', instruction: 'Blink your eyes twice', emoji: '👁️', duration: 3 },
  { type: 'turn_head_left', instruction: 'Turn your head to the left', emoji: '⬅️', duration: 2 },
  { type: 'turn_head_right', instruction: 'Turn your head to the right', emoji: '➡️', duration: 2 },
  { type: 'smile', instruction: 'Smile at the camera', emoji: '😊', duration: 2 },
  { type: 'nod', instruction: 'Nod your head up and down', emoji: '⬇️⬆️', duration: 3 },
];

export default function KYCVideoLivenessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [challenges, setChallenges] = useState<ChallengeConfig[]>([]);
  const [challengeStartTime, setChallengeStartTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [recordedVideo, setRecordedVideo] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate random challenges on mount
  useEffect(() => {
    const shuffled = [...CHALLENGES].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 3); // Select 3 random challenges
    setChallenges(selected);
  }, []);

  // Timer for challenge duration
  useEffect(() => {
    if (challengeStartTime && isRecording) {
      const currentChallenge = challenges[currentChallengeIndex];
      if (!currentChallenge) return;

      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - challengeStartTime) / 1000;
        const remaining = Math.max(0, currentChallenge.duration - elapsed);
        setTimeRemaining(remaining);

        if (remaining === 0) {
          // Move to next challenge
          if (currentChallengeIndex < challenges.length - 1) {
            setCurrentChallengeIndex(currentChallengeIndex + 1);
            setChallengeStartTime(Date.now());
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            // All challenges complete
            stopRecording();
          }
        }
      }, 100);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [challengeStartTime, isRecording, currentChallengeIndex, challenges]);

  if (!permission) {
    return (
      <ScreenContainer className="p-4 justify-center">
        <ActivityIndicator size="large" />
      </ScreenContainer>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenContainer className="p-4 justify-center">
        <Stack.Screen options={{ title: 'Camera Permission' }} />
        <View className="items-center gap-4">
          <Text className="text-6xl mb-4">📹</Text>
          <Text className="text-2xl font-bold text-foreground text-center mb-2">
            Camera Access Required
          </Text>
          <Text className="text-muted text-center mb-6">
            We need access to your camera to verify your identity through video liveness detection.
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            className="bg-primary rounded-xl p-4 w-full"
            style={{ opacity: 1 }}
          >
            <Text className="text-white text-center font-semibold text-lg">Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const startRecording = async () => {
    if (!cameraRef.current || challenges.length === 0) return;

    try {
      setIsRecording(true);
      setCurrentChallengeIndex(0);
      setChallengeStartTime(Date.now());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const video = await cameraRef.current.recordAsync({
        maxDuration: 30, // 30 seconds max
      });

      if (video) {
        setRecordedVideo(video.uri);
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start video recording');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!cameraRef.current) return;

    try {
      await cameraRef.current.stopRecording();
      setIsRecording(false);
      setChallengeStartTime(null);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  const handleSubmit = async () => {
    if (!recordedVideo) {
      Alert.alert('Error', 'Please complete the video liveness check');
      return;
    }

    try {
      setIsProcessing(true);

      // Submit video to liveness detection service
      const result = await videoLivenessService.verifyLiveness(recordedVideo, challenges.map(c => c.type));

      if (result.is_live) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Success',
          'Video liveness verification passed! You can now proceed with document upload.',
          [
            {
              text: 'Continue',
              onPress: () => router.push({ pathname: '/(profile)/kyc', params: { livenessVerified: 'true' } }),
            },
          ]
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Verification Failed',
          result.failure_reason || 'Video liveness check failed. Please try again.',
          [
            {
              text: 'Retry',
              onPress: () => {
                setRecordedVideo(null);
                setCurrentChallengeIndex(0);
              },
            },
          ]
        );
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to verify video liveness');
    } finally {
      setIsProcessing(false);
    }
  };

  const currentChallenge = challenges[currentChallengeIndex];

  return (
    <ScreenContainer className="p-0">
      <Stack.Screen options={{ title: 'Video Liveness Check' }} />

      {!recordedVideo ? (
        <View className="flex-1">
          {/* Camera View */}
          <View className="flex-1 relative">
            <CameraView
              ref={cameraRef}
              style={{ flex: 1 }}
              facing={facing}
              mode="video"
            >
              {/* Challenge Overlay */}
              {isRecording && currentChallenge && (
                <View className="absolute top-0 left-0 right-0 bg-black/70 p-6">
                  <View className="items-center">
                    <Text className="text-6xl mb-2">{currentChallenge.emoji}</Text>
                    <Text className="text-white text-2xl font-bold text-center mb-2">
                      {currentChallenge.instruction}
                    </Text>
                    <View className="bg-primary rounded-full px-4 py-2">
                      <Text className="text-white font-bold text-lg">
                        {Math.ceil(timeRemaining)}s
                      </Text>
                    </View>
                    <View className="flex-row gap-2 mt-4">
                      {challenges.map((_, index) => (
                        <View
                          key={index}
                          className={`w-3 h-3 rounded-full ${
                            index < currentChallengeIndex
                              ? 'bg-success'
                              : index === currentChallengeIndex
                              ? 'bg-primary'
                              : 'bg-white/30'
                          }`}
                        />
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {/* Face Guide Overlay */}
              {!isRecording && (
                <View className="absolute inset-0 items-center justify-center">
                  <View className="w-64 h-80 border-4 border-white rounded-full opacity-50" />
                  <Text className="absolute bottom-20 text-white text-center text-lg font-semibold bg-black/50 px-4 py-2 rounded-lg">
                    Position your face within the oval
                  </Text>
                </View>
              )}
            </CameraView>
          </View>

          {/* Instructions and Controls */}
          <View className="bg-background p-6">
            {!isRecording ? (
              <View>
                <Text className="text-2xl font-bold text-foreground mb-2">
                  Video Liveness Check
                </Text>
                <Text className="text-muted mb-4">
                  You will be asked to perform {challenges.length} random actions to verify you are a real person.
                </Text>

                {challenges.length > 0 && (
                  <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
                    <Text className="text-foreground font-semibold mb-2">Challenges:</Text>
                    {challenges.map((challenge, index) => (
                      <View key={index} className="flex-row items-center gap-2 mb-1">
                        <Text className="text-2xl">{challenge.emoji}</Text>
                        <Text className="text-muted">{challenge.instruction}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View className="bg-warning/10 rounded-xl p-4 mb-4 border border-warning">
                  <Text className="text-warning font-semibold mb-1">⚠️ Important Tips:</Text>
                  <Text className="text-muted text-sm">• Ensure good lighting</Text>
                  <Text className="text-muted text-sm">• Look directly at the camera</Text>
                  <Text className="text-muted text-sm">• Remove glasses if possible</Text>
                  <Text className="text-muted text-sm">• Stay within the oval guide</Text>
                </View>

                <TouchableOpacity
                  onPress={startRecording}
                  disabled={challenges.length === 0}
                  className="bg-primary rounded-xl p-4"
                  style={{ opacity: 1 }}
                >
                  <Text className="text-white text-center font-semibold text-lg">
                    🎥 Start Recording
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text className="text-muted text-center mb-4">
                  Recording in progress... Follow the instructions above
                </Text>
                <TouchableOpacity
                  onPress={stopRecording}
                  className="bg-error rounded-xl p-4"
                  style={{ opacity: 1 }}
                >
                  <Text className="text-white text-center font-semibold text-lg">
                    ⏹️ Stop Recording
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View className="flex-1 p-6 justify-center">
          <Text className="text-6xl text-center mb-4">✅</Text>
          <Text className="text-2xl font-bold text-foreground text-center mb-2">
            Recording Complete
          </Text>
          <Text className="text-muted text-center mb-6">
            Your video has been recorded. Click submit to verify your liveness.
          </Text>

          <View className="gap-3">
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isProcessing}
              className={`rounded-xl p-4 ${isProcessing ? 'bg-primary/50' : 'bg-primary'}`}
              style={{ opacity: 1 }}
            >
              {isProcessing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white text-center font-semibold text-lg">
                  Submit for Verification
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setRecordedVideo(null);
                setCurrentChallengeIndex(0);
              }}
              disabled={isProcessing}
              className="bg-surface border border-border rounded-xl p-4"
              style={{ opacity: 1 }}
            >
              <Text className="text-foreground text-center font-semibold text-lg">
                Retry Recording
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}
