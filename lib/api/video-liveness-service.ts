import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';

const VIDEO_LIVENESS_API_URL = 'http://localhost:5011';

export interface LivenessVerificationResult {
  is_live: boolean;
  confidence: number;
  challenges_completed: string[];
  failure_reason?: string;
  anti_spoofing_flags?: {
    screen_replay_detected: boolean;
    mask_detected: boolean;
    multiple_faces_detected: boolean;
  };
}

class VideoLivenessService {
  /**
   * Verify video liveness with random challenges
   */
  async verifyLiveness(
    videoUri: string,
    challenges: string[]
  ): Promise<LivenessVerificationResult> {
    try {
      // Read video file as base64
      const videoBase64 = await FileSystem.readAsStringAsync(videoUri, {
        encoding: 'base64',
      });

      // Call video liveness API
      const response = await axios.post(
        `${VIDEO_LIVENESS_API_URL}/verify-liveness`,
        {
          video_base64: videoBase64,
          challenges: challenges,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60 seconds timeout
        }
      );

      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(error.response.data.detail || 'Video liveness verification failed');
      } else if (error.request) {
        throw new Error('No response from video liveness service. Please check your connection.');
      } else {
        throw new Error(error.message || 'Failed to verify video liveness');
      }
    }
  }

  /**
   * Check video liveness service health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${VIDEO_LIVENESS_API_URL}/health`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

export const videoLivenessService = new VideoLivenessService();
