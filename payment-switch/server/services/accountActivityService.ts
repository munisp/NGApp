/**
 * Account Activity Service
 * 
 * Tracks and manages user login history and session activity
 */

import { getDb } from '../db';
import { loginHistory, type LoginHistory, type InsertLoginHistory } from '../../drizzle/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { getGeolocation } from './geolocationService';
import crypto from 'crypto';

/**
 * Log a login attempt
 */
export async function logLoginAttempt(params: {
  userId: number;
  success: boolean;
  userAgent: string;
  ipAddress: string;
  deviceFingerprint?: string;
  deviceName?: string;
  isTrustedDevice?: boolean;
  requiresTwoFactor?: boolean;
  twoFactorCompleted?: boolean;
  sessionId?: string;
  failureReason?: string;
}): Promise<{ success: boolean; loginId?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: 'Database not available' };
  }

  try {
    // Get geolocation data
    const geoData = await getGeolocation(params.ipAddress);

    // Create login history record
    const loginRecord: InsertLoginHistory = {
      userId: params.userId,
      success: params.success ? 'true' : 'false',
      userAgent: params.userAgent,
      deviceFingerprint: params.deviceFingerprint,
      deviceName: params.deviceName,
      ipAddress: params.ipAddress,
      country: geoData?.country,
      city: geoData?.city,
      region: geoData?.region,
      latitude: geoData?.latitude,
      longitude: geoData?.longitude,
      isTrustedDevice: params.isTrustedDevice ? 'true' : 'false',
      isSuspicious: 'false', // Will be updated by suspicious activity detection
      requiresTwoFactor: params.requiresTwoFactor ? 'true' : 'false',
      twoFactorCompleted: params.twoFactorCompleted ? 'true' : 'false',
      sessionId: params.sessionId,
      sessionActive: params.success ? 'true' : 'false',
      failureReason: params.failureReason,
    };

    const result = await db.insert(loginHistory).values(loginRecord);
    const loginId = result[0]?.insertId ? Number(result[0].insertId) : 0;

    console.log(`[AccountActivity] Logged ${params.success ? 'successful' : 'failed'} login for user ${params.userId} from ${geoData?.city}, ${geoData?.country}`);

    return { success: true, loginId };
  } catch (error) {
    console.error('[AccountActivity] Error logging login attempt:', error);
    return { success: false, error: 'Failed to log login attempt' };
  }
}

/**
 * Get user's login history
 */
export async function getLoginHistory(params: {
  userId: number;
  limit?: number;
  offset?: number;
  successOnly?: boolean;
  since?: Date;
}): Promise<LoginHistory[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    const conditions = [eq(loginHistory.userId, params.userId)];

    if (params.successOnly) {
      conditions.push(eq(loginHistory.success, 'true'));
    }

    if (params.since) {
      conditions.push(gte(loginHistory.loginAt, params.since));
    }

    const results = await db
      .select()
      .from(loginHistory)
      .where(and(...conditions))
      .orderBy(desc(loginHistory.loginAt))
      .limit(params.limit || 50)
      .offset(params.offset || 0);

    return results;
  } catch (error) {
    console.error('[AccountActivity] Error getting login history:', error);
    return [];
  }
}

/**
 * Get active sessions for a user
 */
export async function getActiveSessions(userId: number): Promise<LoginHistory[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    const results = await db
      .select()
      .from(loginHistory)
      .where(
        and(
          eq(loginHistory.userId, userId),
          eq(loginHistory.success, 'true'),
          eq(loginHistory.sessionActive, 'true')
        )
      )
      .orderBy(desc(loginHistory.loginAt));

    return results;
  } catch (error) {
    console.error('[AccountActivity] Error getting active sessions:', error);
    return [];
  }
}

/**
 * End a session
 */
export async function endSession(params: {
  userId: number;
  sessionId: string;
}): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: 'Database not available' };
  }

  try {
    await db
      .update(loginHistory)
      .set({
        sessionActive: 'false',
        sessionEndedAt: new Date(),
      })
      .where(
        and(
          eq(loginHistory.userId, params.userId),
          eq(loginHistory.sessionId, params.sessionId)
        )
      );

    console.log(`[AccountActivity] Ended session ${params.sessionId} for user ${params.userId}`);
    return { success: true };
  } catch (error) {
    console.error('[AccountActivity] Error ending session:', error);
    return { success: false, error: 'Failed to end session' };
  }
}

/**
 * End all sessions for a user (except current)
 */
export async function endAllSessions(params: {
  userId: number;
  exceptSessionId?: string;
}): Promise<{ success: boolean; count?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: 'Database not available' };
  }

  try {
    const conditions = [
      eq(loginHistory.userId, params.userId),
      eq(loginHistory.sessionActive, 'true'),
    ];

    // Get count of sessions to end
    const sessions = await db
      .select()
      .from(loginHistory)
      .where(and(...conditions));

    const sessionsToEnd = params.exceptSessionId
      ? sessions.filter(s => s.sessionId !== params.exceptSessionId)
      : sessions;

    // End all sessions
    for (const session of sessionsToEnd) {
      if (session.sessionId) {
        await endSession({
          userId: params.userId,
          sessionId: session.sessionId,
        });
      }
    }

    console.log(`[AccountActivity] Ended ${sessionsToEnd.length} sessions for user ${params.userId}`);
    return { success: true, count: sessionsToEnd.length };
  } catch (error) {
    console.error('[AccountActivity] Error ending all sessions:', error);
    return { success: false, error: 'Failed to end sessions' };
  }
}

/**
 * Mark login as suspicious
 */
export async function markLoginAsSuspicious(loginId: number): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) {
    return { success: false };
  }

  try {
    await db
      .update(loginHistory)
      .set({ isSuspicious: 'true' })
      .where(eq(loginHistory.id, loginId));

    return { success: true };
  } catch (error) {
    console.error('[AccountActivity] Error marking login as suspicious:', error);
    return { success: false };
  }
}

/**
 * Get last successful login for a user
 */
export async function getLastSuccessfulLogin(userId: number): Promise<LoginHistory | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }

  try {
    const [result] = await db
      .select()
      .from(loginHistory)
      .where(
        and(
          eq(loginHistory.userId, userId),
          eq(loginHistory.success, 'true')
        )
      )
      .orderBy(desc(loginHistory.loginAt))
      .limit(1);

    return result || null;
  } catch (error) {
    console.error('[AccountActivity] Error getting last login:', error);
    return null;
  }
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `sess_${crypto.randomBytes(32).toString('hex')}`;
}
