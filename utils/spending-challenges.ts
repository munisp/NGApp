import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SpendingChallenge {
  id: string;
  name: string;
  description: string;
  goal_type: "reduce_spending" | "save_amount" | "no_spend_category";
  target_amount?: number;
  target_category?: string;
  start_date: number;
  end_date: number;
  creator_id: string;
  participants: ChallengeParticipant[];
  status: "active" | "completed" | "cancelled";
  reward_amount?: number;
}

export interface ChallengeParticipant {
  user_id: string;
  user_name: string;
  joined_at: number;
  current_progress: number;
  target_progress: number;
  rank: number;
  is_winner?: boolean;
}

export interface ChallengeProgress {
  challenge_id: string;
  user_id: string;
  date: number;
  amount_spent: number;
  amount_saved: number;
  transactions_count: number;
}

const CHALLENGES_STORAGE_KEY = "spending_challenges";
const PROGRESS_STORAGE_KEY = "challenge_progress";
const INVITES_STORAGE_KEY = "challenge_invites";

/**
 * Create a new spending challenge
 */
export async function createChallenge(
  name: string,
  description: string,
  goalType: "reduce_spending" | "save_amount" | "no_spend_category",
  targetAmount?: number,
  targetCategory?: string,
  durationDays: number = 30
): Promise<SpendingChallenge> {
  try {
    const challenge: SpendingChallenge = {
      id: `challenge_${Date.now()}`,
      name,
      description,
      goal_type: goalType,
      target_amount: targetAmount,
      target_category: targetCategory,
      start_date: Date.now(),
      end_date: Date.now() + durationDays * 24 * 60 * 60 * 1000,
      creator_id: "current_user",
      participants: [
        {
          user_id: "current_user",
          user_name: "You",
          joined_at: Date.now(),
          current_progress: 0,
          target_progress: targetAmount || 100,
          rank: 1,
        },
      ],
      status: "active",
      reward_amount: targetAmount ? targetAmount * 0.1 : undefined,
    };
    
    const challenges = await getAllChallenges();
    challenges.push(challenge);
    
    await AsyncStorage.setItem(CHALLENGES_STORAGE_KEY, JSON.stringify(challenges));
    
    return challenge;
  } catch (error) {
    console.error("Failed to create challenge:", error);
    throw error;
  }
}

/**
 * Get all challenges
 */
export async function getAllChallenges(): Promise<SpendingChallenge[]> {
  try {
    const challengesJson = await AsyncStorage.getItem(CHALLENGES_STORAGE_KEY);
    if (!challengesJson) return [];
    
    const challenges: SpendingChallenge[] = JSON.parse(challengesJson);
    
    // Sort by start_date descending
    challenges.sort((a, b) => b.start_date - a.start_date);
    
    return challenges;
  } catch (error) {
    console.error("Failed to get challenges:", error);
    return [];
  }
}

/**
 * Get active challenges
 */
export async function getActiveChallenges(): Promise<SpendingChallenge[]> {
  const challenges = await getAllChallenges();
  return challenges.filter((c) => c.status === "active" && c.end_date > Date.now());
}

/**
 * Get completed challenges
 */
export async function getCompletedChallenges(): Promise<SpendingChallenge[]> {
  const challenges = await getAllChallenges();
  return challenges.filter((c) => c.status === "completed" || c.end_date <= Date.now());
}

/**
 * Get challenge by ID
 */
export async function getChallengeById(challengeId: string): Promise<SpendingChallenge | null> {
  const challenges = await getAllChallenges();
  return challenges.find((c) => c.id === challengeId) || null;
}

/**
 * Invite friend to challenge
 */
export async function inviteFriendToChallenge(
  challengeId: string,
  friendName: string,
  friendEmail: string
): Promise<boolean> {
  try {
    const invitesJson = await AsyncStorage.getItem(INVITES_STORAGE_KEY);
    const invites = invitesJson ? JSON.parse(invitesJson) : [];
    
    invites.push({
      challenge_id: challengeId,
      friend_name: friendName,
      friend_email: friendEmail,
      invited_at: Date.now(),
      status: "pending",
    });
    
    await AsyncStorage.setItem(INVITES_STORAGE_KEY, JSON.stringify(invites));
    
    return true;
  } catch (error) {
    console.error("Failed to invite friend:", error);
    return false;
  }
}

/**
 * Join challenge
 */
export async function joinChallenge(
  challengeId: string,
  userId: string,
  userName: string
): Promise<boolean> {
  try {
    const challenges = await getAllChallenges();
    const challenge = challenges.find((c) => c.id === challengeId);
    
    if (!challenge || challenge.status !== "active") return false;
    
    // Check if already joined
    if (challenge.participants.some((p) => p.user_id === userId)) {
      return false;
    }
    
    // Add participant
    challenge.participants.push({
      user_id: userId,
      user_name: userName,
      joined_at: Date.now(),
      current_progress: 0,
      target_progress: challenge.target_amount || 100,
      rank: challenge.participants.length + 1,
    });
    
    await AsyncStorage.setItem(CHALLENGES_STORAGE_KEY, JSON.stringify(challenges));
    
    return true;
  } catch (error) {
    console.error("Failed to join challenge:", error);
    return false;
  }
}

/**
 * Update challenge progress
 */
export async function updateChallengeProgress(
  challengeId: string,
  userId: string,
  amountSpent: number,
  amountSaved: number
): Promise<boolean> {
  try {
    // Save progress entry
    const progressJson = await AsyncStorage.getItem(PROGRESS_STORAGE_KEY);
    const progress: ChallengeProgress[] = progressJson ? JSON.parse(progressJson) : [];
    
    progress.push({
      challenge_id: challengeId,
      user_id: userId,
      date: Date.now(),
      amount_spent: amountSpent,
      amount_saved: amountSaved,
      transactions_count: 1,
    });
    
    await AsyncStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    
    // Update participant progress
    const challenges = await getAllChallenges();
    const challenge = challenges.find((c) => c.id === challengeId);
    
    if (!challenge) return false;
    
    const participant = challenge.participants.find((p) => p.user_id === userId);
    
    if (!participant) return false;
    
    if (challenge.goal_type === "reduce_spending") {
      participant.current_progress += amountSaved;
    } else if (challenge.goal_type === "save_amount") {
      participant.current_progress += amountSaved;
    }
    
    // Update ranks
    challenge.participants.sort((a, b) => b.current_progress - a.current_progress);
    challenge.participants.forEach((p, index) => {
      p.rank = index + 1;
    });
    
    await AsyncStorage.setItem(CHALLENGES_STORAGE_KEY, JSON.stringify(challenges));
    
    return true;
  } catch (error) {
    console.error("Failed to update challenge progress:", error);
    return false;
  }
}

/**
 * Complete challenge
 */
export async function completeChallenge(challengeId: string): Promise<boolean> {
  try {
    const challenges = await getAllChallenges();
    const challenge = challenges.find((c) => c.id === challengeId);
    
    if (!challenge) return false;
    
    challenge.status = "completed";
    
    // Determine winner
    if (challenge.participants.length > 0) {
      const winner = challenge.participants.reduce((prev, current) =>
        current.current_progress > prev.current_progress ? current : prev
      );
      winner.is_winner = true;
    }
    
    await AsyncStorage.setItem(CHALLENGES_STORAGE_KEY, JSON.stringify(challenges));
    
    return true;
  } catch (error) {
    console.error("Failed to complete challenge:", error);
    return false;
  }
}

/**
 * Cancel challenge
 */
export async function cancelChallenge(challengeId: string): Promise<boolean> {
  try {
    const challenges = await getAllChallenges();
    const challenge = challenges.find((c) => c.id === challengeId);
    
    if (!challenge) return false;
    
    challenge.status = "cancelled";
    
    await AsyncStorage.setItem(CHALLENGES_STORAGE_KEY, JSON.stringify(challenges));
    
    return true;
  } catch (error) {
    console.error("Failed to cancel challenge:", error);
    return false;
  }
}

/**
 * Get leaderboard for challenge
 */
export async function getChallengeLeaderboard(
  challengeId: string
): Promise<ChallengeParticipant[]> {
  const challenge = await getChallengeById(challengeId);
  
  if (!challenge) return [];
  
  // Sort by current_progress descending
  const leaderboard = [...challenge.participants].sort(
    (a, b) => b.current_progress - a.current_progress
  );
  
  return leaderboard;
}

/**
 * Get challenge statistics
 */
export async function getChallengeStatistics(challengeId: string): Promise<{
  total_participants: number;
  total_progress: number;
  average_progress: number;
  top_performer: ChallengeParticipant | null;
  days_remaining: number;
  completion_rate: number;
}> {
  const challenge = await getChallengeById(challengeId);
  
  if (!challenge) {
    return {
      total_participants: 0,
      total_progress: 0,
      average_progress: 0,
      top_performer: null,
      days_remaining: 0,
      completion_rate: 0,
    };
  }
  
  const totalProgress = challenge.participants.reduce(
    (sum, p) => sum + p.current_progress,
    0
  );
  
  const averageProgress =
    challenge.participants.length > 0 ? totalProgress / challenge.participants.length : 0;
  
  const topPerformer =
    challenge.participants.length > 0
      ? challenge.participants.reduce((prev, current) =>
          current.current_progress > prev.current_progress ? current : prev
        )
      : null;
  
  const daysRemaining = Math.max(
    0,
    Math.ceil((challenge.end_date - Date.now()) / (24 * 60 * 60 * 1000))
  );
  
  const completionRate =
    challenge.target_amount && challenge.target_amount > 0
      ? (totalProgress / (challenge.target_amount * challenge.participants.length)) * 100
      : 0;
  
  return {
    total_participants: challenge.participants.length,
    total_progress: totalProgress,
    average_progress: averageProgress,
    top_performer: topPerformer,
    days_remaining: daysRemaining,
    completion_rate: Math.min(100, completionRate),
  };
}

/**
 * Get user's rank in challenge
 */
export async function getUserRankInChallenge(
  challengeId: string,
  userId: string
): Promise<number> {
  const leaderboard = await getChallengeLeaderboard(challengeId);
  const participant = leaderboard.find((p) => p.user_id === userId);
  return participant ? participant.rank : 0;
}

/**
 * Get challenge progress history
 */
export async function getChallengeProgressHistory(
  challengeId: string
): Promise<ChallengeProgress[]> {
  try {
    const progressJson = await AsyncStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!progressJson) return [];
    
    const progress: ChallengeProgress[] = JSON.parse(progressJson);
    
    return progress.filter((p) => p.challenge_id === challengeId).sort((a, b) => b.date - a.date);
  } catch (error) {
    console.error("Failed to get challenge progress history:", error);
    return [];
  }
}

/**
 * Check if challenge is expired
 */
export function isChallengeExpired(challenge: SpendingChallenge): boolean {
  return challenge.end_date <= Date.now();
}

/**
 * Get challenge progress percentage
 */
export function getChallengeProgressPercentage(participant: ChallengeParticipant): number {
  if (participant.target_progress === 0) return 0;
  return Math.min(100, (participant.current_progress / participant.target_progress) * 100);
}

/**
 * Format challenge goal
 */
export function formatChallengeGoal(challenge: SpendingChallenge): string {
  switch (challenge.goal_type) {
    case "reduce_spending":
      return `Reduce spending by $${challenge.target_amount?.toFixed(0) || 0}`;
    case "save_amount":
      return `Save $${challenge.target_amount?.toFixed(0) || 0}`;
    case "no_spend_category":
      return `No spending in ${challenge.target_category || "category"}`;
    default:
      return "Complete challenge";
  }
}

/**
 * Get challenge duration in days
 */
export function getChallengeDuration(challenge: SpendingChallenge): number {
  return Math.ceil((challenge.end_date - challenge.start_date) / (24 * 60 * 60 * 1000));
}

/**
 * Clear all challenges
 */
export async function clearAllChallenges(): Promise<boolean> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(CHALLENGES_STORAGE_KEY),
      AsyncStorage.removeItem(PROGRESS_STORAGE_KEY),
      AsyncStorage.removeItem(INVITES_STORAGE_KEY),
    ]);
    return true;
  } catch (error) {
    console.error("Failed to clear challenges:", error);
    return false;
  }
}
