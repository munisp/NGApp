/**
 * Behavioral Biometrics Service
 * Tracks user behavior patterns for account takeover detection
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

interface KeystrokeEvent {
  key: string;
  pressTime: number;
  releaseTime: number;
  duration: number;
  flightTime?: number;  // Time between this key and previous key
}

interface TouchEvent {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
  duration: number;
  velocity?: number;
}

interface DeviceFingerprint {
  deviceId: string;
  deviceName: string;
  osName: string;
  osVersion: string;
  brand: string;
  modelName: string;
  screenWidth: number;
  screenHeight: number;
  timezone: string;
  locale: string;
  appVersion: string;
  buildNumber: string;
}

interface BehavioralProfile {
  userId: string;
  keystrokeDynamics: {
    avgKeyPressDuration: number;
    avgFlightTime: number;
    typingSpeed: number;  // keys per minute
    errorRate: number;
  };
  touchPatterns: {
    avgPressure: number;
    avgTouchDuration: number;
    avgSwipeVelocity: number;
    preferredHand: 'left' | 'right' | 'both';
  };
  deviceFingerprints: DeviceFingerprint[];
  sessionPatterns: {
    avgSessionDuration: number;
    peakActivityHours: number[];
    commonLocations: string[];
  };
  createdAt: string;
  lastUpdated: string;
}

interface AnomalyScore {
  overall: number;
  keystrokeDynamics: number;
  touchPatterns: number;
  deviceFingerprint: number;
  sessionPattern: number;
  isAnomaly: boolean;
  confidence: number;
}

class BehavioralBiometricsService {
  private keystrokeBuffer: KeystrokeEvent[] = [];
  private touchBuffer: TouchEvent[] = [];
  private currentProfile: BehavioralProfile | null = null;
  private sessionStartTime: number = Date.now();
  
  /**
   * Initialize behavioral biometrics tracking for user
   */
  async initialize(userId: string): Promise<void> {
    this.sessionStartTime = Date.now();
    this.currentProfile = await this.loadProfile(userId);
    
    if (!this.currentProfile) {
      // Create new profile
      this.currentProfile = await this.createProfile(userId);
    }
  }
  
  /**
   * Track keystroke event
   */
  trackKeystroke(key: string, pressTime: number, releaseTime: number): void {
    const duration = releaseTime - pressTime;
    
    const event: KeystrokeEvent = {
      key,
      pressTime,
      releaseTime,
      duration,
    };
    
    // Calculate flight time (time since previous key)
    if (this.keystrokeBuffer.length > 0) {
      const prevEvent = this.keystrokeBuffer[this.keystrokeBuffer.length - 1];
      event.flightTime = pressTime - prevEvent.releaseTime;
    }
    
    this.keystrokeBuffer.push(event);
    
    // Keep buffer size manageable
    if (this.keystrokeBuffer.length > 100) {
      this.keystrokeBuffer.shift();
    }
  }
  
  /**
   * Track touch event
   */
  trackTouch(x: number, y: number, pressure: number, timestamp: number, duration: number): void {
    const event: TouchEvent = {
      x,
      y,
      pressure,
      timestamp,
      duration,
    };
    
    // Calculate velocity if we have previous touch
    if (this.touchBuffer.length > 0) {
      const prevTouch = this.touchBuffer[this.touchBuffer.length - 1];
      const distance = Math.sqrt(
        Math.pow(x - prevTouch.x, 2) + Math.pow(y - prevTouch.y, 2)
      );
      const timeDiff = (timestamp - prevTouch.timestamp) / 1000; // seconds
      event.velocity = distance / timeDiff;
    }
    
    this.touchBuffer.push(event);
    
    // Keep buffer size manageable
    if (this.touchBuffer.length > 100) {
      this.touchBuffer.shift();
    }
  }
  
  /**
   * Get current device fingerprint
   */
  async getDeviceFingerprint(): Promise<DeviceFingerprint> {
    const fingerprint: DeviceFingerprint = {
      deviceId: await this.getDeviceId(),
      deviceName: Device.deviceName || 'Unknown',
      osName: Device.osName || Platform.OS,
      osVersion: Device.osVersion || 'Unknown',
      brand: Device.brand || 'Unknown',
      modelName: Device.modelName || 'Unknown',
      screenWidth: 0,  // Set by caller with Dimensions.get('window').width
      screenHeight: 0,  // Set by caller with Dimensions.get('window').height
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: 'en-US',  // Can be enhanced with expo-localization
      appVersion: Application.nativeApplicationVersion ?? '1.0.0',
      buildNumber: Application.nativeBuildVersion ?? '1',
    };
    
    return fingerprint;
  }
  
  /**
   * Get unique device ID
   */
  private async getDeviceId(): Promise<string> {
    // Try to get stored device ID first
    let deviceId = await AsyncStorage.getItem('device_id');
    
    if (!deviceId) {
      // Generate new device ID
      if (Platform.OS === 'android') {
        deviceId = await Application.getAndroidId() || this.generateDeviceId();
      } else if (Platform.OS === 'ios') {
         deviceId = await Application.getIosIdForVendorAsync();
      if (!deviceId) {
        deviceId = this.generateDeviceId();
      }
      } else {
        deviceId = this.generateDeviceId();
      }
      
      if (deviceId) {
        await AsyncStorage.setItem('device_id', deviceId);
      }
    }
    
    return deviceId || this.generateDeviceId();
  }
  
  /**
   * Generate random device ID
   */
  private generateDeviceId(): string {
    return 'device_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
  
  /**
   * Analyze current behavior and detect anomalies
   */
  async detectAnomalies(): Promise<AnomalyScore> {
    if (!this.currentProfile) {
      return {
        overall: 0,
        keystrokeDynamics: 0,
        touchPatterns: 0,
        deviceFingerprint: 0,
        sessionPattern: 0,
        isAnomaly: false,
        confidence: 0,
      };
    }
    
    // Analyze keystroke dynamics
    const keystrokeScore = this.analyzeKeystrokeDynamics();
    
    // Analyze touch patterns
    const touchScore = this.analyzeTouchPatterns();
    
    // Analyze device fingerprint
    const deviceScore = await this.analyzeDeviceFingerprint();
    
    // Analyze session patterns
    const sessionScore = this.analyzeSessionPatterns();
    
    // Calculate overall score (weighted average)
    const overall = (
      keystrokeScore * 0.3 +
      touchScore * 0.3 +
      deviceScore * 0.3 +
      sessionScore * 0.1
    );
    
    // Determine if anomaly (score > 0.7 indicates potential account takeover)
    const isAnomaly = overall > 0.7;
    const confidence = Math.abs(overall - 0.5) * 2;  // 0-1 scale
    
    return {
      overall,
      keystrokeDynamics: keystrokeScore,
      touchPatterns: touchScore,
      deviceFingerprint: deviceScore,
      sessionPattern: sessionScore,
      isAnomaly,
      confidence,
    };
  }
  
  /**
   * Analyze keystroke dynamics against profile
   */
  private analyzeKeystrokeDynamics(): number {
    if (this.keystrokeBuffer.length < 10 || !this.currentProfile) {
      return 0;
    }
    
    // Calculate current metrics
    const avgDuration = this.keystrokeBuffer.reduce((sum, e) => sum + e.duration, 0) / this.keystrokeBuffer.length;
    const flightTimes = this.keystrokeBuffer.filter(e => e.flightTime !== undefined).map(e => e.flightTime!);
    const avgFlightTime = flightTimes.length > 0 
      ? flightTimes.reduce((sum, t) => sum + t, 0) / flightTimes.length 
      : 0;
    
    // Compare with profile
    const profile = this.currentProfile.keystrokeDynamics;
    
    const durationDiff = Math.abs(avgDuration - profile.avgKeyPressDuration) / profile.avgKeyPressDuration;
    const flightTimeDiff = profile.avgFlightTime > 0 
      ? Math.abs(avgFlightTime - profile.avgFlightTime) / profile.avgFlightTime 
      : 0;
    
    // Return anomaly score (0-1, higher = more anomalous)
    return Math.min((durationDiff + flightTimeDiff) / 2, 1);
  }
  
  /**
   * Analyze touch patterns against profile
   */
  private analyzeTouchPatterns(): number {
    if (this.touchBuffer.length < 10 || !this.currentProfile) {
      return 0;
    }
    
    // Calculate current metrics
    const avgPressure = this.touchBuffer.reduce((sum, e) => sum + e.pressure, 0) / this.touchBuffer.length;
    const avgDuration = this.touchBuffer.reduce((sum, e) => sum + e.duration, 0) / this.touchBuffer.length;
    const velocities = this.touchBuffer.filter(e => e.velocity !== undefined).map(e => e.velocity!);
    const avgVelocity = velocities.length > 0 
      ? velocities.reduce((sum, v) => sum + v, 0) / velocities.length 
      : 0;
    
    // Compare with profile
    const profile = this.currentProfile.touchPatterns;
    
    const pressureDiff = Math.abs(avgPressure - profile.avgPressure) / Math.max(profile.avgPressure, 0.1);
    const durationDiff = Math.abs(avgDuration - profile.avgTouchDuration) / profile.avgTouchDuration;
    const velocityDiff = profile.avgSwipeVelocity > 0 
      ? Math.abs(avgVelocity - profile.avgSwipeVelocity) / profile.avgSwipeVelocity 
      : 0;
    
    // Return anomaly score
    return Math.min((pressureDiff + durationDiff + velocityDiff) / 3, 1);
  }
  
  /**
   * Analyze device fingerprint against profile
   */
  private async analyzeDeviceFingerprint(): Promise<number> {
    if (!this.currentProfile) {
      return 0;
    }
    
    const currentDevice = await this.getDeviceFingerprint();
    const knownDevices = this.currentProfile.deviceFingerprints;
    
    // Check if current device matches any known device
    const isKnownDevice = knownDevices.some(device => 
      device.deviceId === currentDevice.deviceId ||
      (device.brand === currentDevice.brand && 
       device.modelName === currentDevice.modelName &&
       device.osVersion === currentDevice.osVersion)
    );
    
    // Return 0 if known device, 1 if unknown
    return isKnownDevice ? 0 : 1;
  }
  
  /**
   * Analyze session patterns
   */
  private analyzeSessionPatterns(): number {
    if (!this.currentProfile) {
      return 0;
    }
    
    const currentHour = new Date().getHours();
    const sessionDuration = (Date.now() - this.sessionStartTime) / 1000 / 60;  // minutes
    
    // Check if current hour is in peak activity hours
    const isPeakHour = this.currentProfile.sessionPatterns.peakActivityHours.includes(currentHour);
    
    // Check if session duration is unusual
    const avgSessionDuration = this.currentProfile.sessionPatterns.avgSessionDuration;
    const durationDiff = avgSessionDuration > 0 
      ? Math.abs(sessionDuration - avgSessionDuration) / avgSessionDuration 
      : 0;
    
    // Return anomaly score
    const hourScore = isPeakHour ? 0 : 0.5;
    const durationScore = Math.min(durationDiff, 1);
    
    return (hourScore + durationScore) / 2;
  }
  
  /**
   * Update user profile with current session data
   */
  async updateProfile(): Promise<void> {
    if (!this.currentProfile || this.keystrokeBuffer.length < 10 || this.touchBuffer.length < 10) {
      return;
    }
    
    // Update keystroke dynamics
    const avgDuration = this.keystrokeBuffer.reduce((sum, e) => sum + e.duration, 0) / this.keystrokeBuffer.length;
    const flightTimes = this.keystrokeBuffer.filter(e => e.flightTime !== undefined).map(e => e.flightTime!);
    const avgFlightTime = flightTimes.length > 0 
      ? flightTimes.reduce((sum, t) => sum + t, 0) / flightTimes.length 
      : 0;
    
    // Update touch patterns
    const avgPressure = this.touchBuffer.reduce((sum, e) => sum + e.pressure, 0) / this.touchBuffer.length;
    const avgTouchDuration = this.touchBuffer.reduce((sum, e) => sum + e.duration, 0) / this.touchBuffer.length;
    const velocities = this.touchBuffer.filter(e => e.velocity !== undefined).map(e => e.velocity!);
    const avgVelocity = velocities.length > 0 
      ? velocities.reduce((sum, v) => sum + v, 0) / velocities.length 
      : 0;
    
    // Smooth update (exponential moving average)
    const alpha = 0.3;  // Learning rate
    
    this.currentProfile.keystrokeDynamics.avgKeyPressDuration = 
      alpha * avgDuration + (1 - alpha) * this.currentProfile.keystrokeDynamics.avgKeyPressDuration;
    this.currentProfile.keystrokeDynamics.avgFlightTime = 
      alpha * avgFlightTime + (1 - alpha) * this.currentProfile.keystrokeDynamics.avgFlightTime;
    
    this.currentProfile.touchPatterns.avgPressure = 
      alpha * avgPressure + (1 - alpha) * this.currentProfile.touchPatterns.avgPressure;
    this.currentProfile.touchPatterns.avgTouchDuration = 
      alpha * avgTouchDuration + (1 - alpha) * this.currentProfile.touchPatterns.avgTouchDuration;
    this.currentProfile.touchPatterns.avgSwipeVelocity = 
      alpha * avgVelocity + (1 - alpha) * this.currentProfile.touchPatterns.avgSwipeVelocity;
    
    // Update device fingerprint if new
    const currentDevice = await this.getDeviceFingerprint();
    const isKnownDevice = this.currentProfile.deviceFingerprints.some(d => d.deviceId === currentDevice.deviceId);
    if (!isKnownDevice) {
      this.currentProfile.deviceFingerprints.push(currentDevice);
    }
    
    // Update session patterns
    const currentHour = new Date().getHours();
    if (!this.currentProfile.sessionPatterns.peakActivityHours.includes(currentHour)) {
      this.currentProfile.sessionPatterns.peakActivityHours.push(currentHour);
    }
    
    this.currentProfile.lastUpdated = new Date().toISOString();
    
    // Save profile
    await this.saveProfile(this.currentProfile);
  }
  
  /**
   * Load user profile from storage
   */
  private async loadProfile(userId: string): Promise<BehavioralProfile | null> {
    try {
      const profileJson = await AsyncStorage.getItem(`behavioral_profile_${userId}`);
      return profileJson ? JSON.parse(profileJson) : null;
    } catch (error) {
      console.error('Failed to load behavioral profile:', error);
      return null;
    }
  }
  
  /**
   * Save user profile to storage
   */
  private async saveProfile(profile: BehavioralProfile): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `behavioral_profile_${profile.userId}`,
        JSON.stringify(profile)
      );
    } catch (error) {
      console.error('Failed to save behavioral profile:', error);
    }
  }
  
  /**
   * Create new profile for user
   */
  private async createProfile(userId: string): Promise<BehavioralProfile> {
    const deviceFingerprint = await this.getDeviceFingerprint();
    
    const profile: BehavioralProfile = {
      userId,
      keystrokeDynamics: {
        avgKeyPressDuration: 100,  // Default 100ms
        avgFlightTime: 150,  // Default 150ms
        typingSpeed: 40,  // Default 40 keys per minute
        errorRate: 0.05,  // Default 5% error rate
      },
      touchPatterns: {
        avgPressure: 0.5,  // Default medium pressure
        avgTouchDuration: 200,  // Default 200ms
        avgSwipeVelocity: 500,  // Default 500 pixels/second
        preferredHand: 'both',
      },
      deviceFingerprints: [deviceFingerprint],
      sessionPatterns: {
        avgSessionDuration: 15,  // Default 15 minutes
        peakActivityHours: [new Date().getHours()],
        commonLocations: [],
      },
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };
    
    await this.saveProfile(profile);
    return profile;
  }
  
  /**
   * Clear session data
   */
  clearSession(): void {
    this.keystrokeBuffer = [];
    this.touchBuffer = [];
    this.sessionStartTime = Date.now();
  }
}

// Export singleton instance
export const behavioralBiometrics = new BehavioralBiometricsService();
export type { AnomalyScore, BehavioralProfile, DeviceFingerprint };
