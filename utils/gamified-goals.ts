import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned_at: number;
}

export interface Milestone {
  id: string;
  percentage: number; // 25, 50, 75, 100
  amount: number;
  reached: boolean;
  reached_at?: number;
  reward: string;
}

export interface GamifiedGoal {
  id: string;
  name: string;
  description: string;
  target_amount: number;
  current_amount: number;
  deadline: number;
  category: "savings" | "investment" | "debt" | "emergency" | "custom";
  icon: string;
  milestones: Milestone[];
  achievements: Achievement[];
  streak_days: number;
  last_contribution_date?: number;
  total_contributions: number;
  is_active: boolean;
  created_at: number;
  completed_at?: number;
}

const GOALS_STORAGE_KEY = "gamified_goals";
const ACHIEVEMENTS_LIBRARY: Record<string, Omit<Achievement, "id" | "earned_at">> = {
  first_contribution: {
    name: "First Step",
    description: "Made your first contribution",
    icon: "🎯",
  },
  milestone_25: {
    name: "Quarter Master",
    description: "Reached 25% of your goal",
    icon: "🥉",
  },
  milestone_50: {
    name: "Halfway Hero",
    description: "Reached 50% of your goal",
    icon: "🥈",
  },
  milestone_75: {
    name: "Almost There",
    description: "Reached 75% of your goal",
    icon: "🥇",
  },
  goal_completed: {
    name: "Goal Crusher",
    description: "Completed your financial goal",
    icon: "🏆",
  },
  streak_7: {
    name: "Week Warrior",
    description: "7-day contribution streak",
    icon: "🔥",
  },
  streak_30: {
    name: "Month Master",
    description: "30-day contribution streak",
    icon: "⭐",
  },
  early_completion: {
    name: "Speed Saver",
    description: "Completed goal before deadline",
    icon: "⚡",
  },
  consistent_saver: {
    name: "Consistent Saver",
    description: "Made 10 contributions",
    icon: "💪",
  },
};

/**
 * Get all gamified goals
 */
export async function getGamifiedGoals(): Promise<GamifiedGoal[]> {
  try {
    const goalsJson = await AsyncStorage.getItem(GOALS_STORAGE_KEY);
    if (!goalsJson) return [];
    return JSON.parse(goalsJson);
  } catch (error) {
    console.error("Failed to get gamified goals:", error);
    return [];
  }
}

/**
 * Save gamified goals
 */
async function saveGamifiedGoals(goals: GamifiedGoal[]): Promise<void> {
  try {
    await AsyncStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
  } catch (error) {
    console.error("Failed to save gamified goals:", error);
    throw error;
  }
}

/**
 * Create milestones for a goal
 */
function createMilestones(targetAmount: number): Milestone[] {
  return [25, 50, 75, 100].map((percentage) => ({
    id: `milestone_${percentage}`,
    percentage,
    amount: (targetAmount * percentage) / 100,
    reached: false,
    reward: getMilestoneReward(percentage),
  }));
}

/**
 * Get milestone reward message
 */
function getMilestoneReward(percentage: number): string {
  switch (percentage) {
    case 25:
      return "Great start! Keep the momentum going!";
    case 50:
      return "Halfway there! You're doing amazing!";
    case 75:
      return "Almost there! The finish line is in sight!";
    case 100:
      return "Goal achieved! You're a financial champion!";
    default:
      return "Keep going!";
  }
}

/**
 * Create gamified goal
 */
export async function createGamifiedGoal(
  goal: Omit<GamifiedGoal, "id" | "current_amount" | "milestones" | "achievements" | "streak_days" | "total_contributions" | "is_active" | "created_at">
): Promise<GamifiedGoal> {
  const goals = await getGamifiedGoals();
  
  const newGoal: GamifiedGoal = {
    ...goal,
    id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    current_amount: 0,
    milestones: createMilestones(goal.target_amount),
    achievements: [],
    streak_days: 0,
    total_contributions: 0,
    is_active: true,
    created_at: Date.now(),
  };
  
  goals.push(newGoal);
  await saveGamifiedGoals(goals);
  
  return newGoal;
}

/**
 * Add contribution to goal
 */
export async function addContribution(
  goalId: string,
  amount: number
): Promise<{
  goal: GamifiedGoal;
  new_achievements: Achievement[];
  new_milestones: Milestone[];
}> {
  const goals = await getGamifiedGoals();
  const goal = goals.find((g) => g.id === goalId);
  
  if (!goal) {
    throw new Error("Goal not found");
  }
  
  const newAchievements: Achievement[] = [];
  const newMilestones: Milestone[] = [];
  
  // Update amount
  const previousAmount = goal.current_amount;
  goal.current_amount += amount;
  goal.total_contributions++;
  
  // Update streak
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  
  if (!goal.last_contribution_date || goal.last_contribution_date < oneDayAgo) {
    goal.streak_days++;
  }
  goal.last_contribution_date = now;
  
  // Check for first contribution achievement
  if (goal.total_contributions === 1) {
    const achievement = earnAchievement(goal, "first_contribution");
    newAchievements.push(achievement);
  }
  
  // Check for consistent saver achievement
  if (goal.total_contributions === 10) {
    const achievement = earnAchievement(goal, "consistent_saver");
    newAchievements.push(achievement);
  }
  
  // Check for streak achievements
  if (goal.streak_days === 7) {
    const achievement = earnAchievement(goal, "streak_7");
    newAchievements.push(achievement);
  }
  if (goal.streak_days === 30) {
    const achievement = earnAchievement(goal, "streak_30");
    newAchievements.push(achievement);
  }
  
  // Check milestones
  for (const milestone of goal.milestones) {
    if (!milestone.reached && goal.current_amount >= milestone.amount) {
      milestone.reached = true;
      milestone.reached_at = now;
      newMilestones.push(milestone);
      
      // Earn milestone achievement
      const achievementKey = `milestone_${milestone.percentage}` as keyof typeof ACHIEVEMENTS_LIBRARY;
      if (ACHIEVEMENTS_LIBRARY[achievementKey]) {
        const achievement = earnAchievement(goal, achievementKey);
        newAchievements.push(achievement);
      }
      
      // Send milestone notification
      await sendMilestoneNotification(goal, milestone);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }
  
  // Check if goal completed
  if (goal.current_amount >= goal.target_amount && !goal.completed_at) {
    goal.completed_at = now;
    
    // Earn completion achievement
    const achievement = earnAchievement(goal, "goal_completed");
    newAchievements.push(achievement);
    
    // Check for early completion
    if (now < goal.deadline) {
      const earlyAchievement = earnAchievement(goal, "early_completion");
      newAchievements.push(earlyAchievement);
    }
    
    // Send completion notification
    await sendGoalCompletedNotification(goal);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
  
  await saveGamifiedGoals(goals);
  
  return {
    goal,
    new_achievements: newAchievements,
    new_milestones: newMilestones,
  };
}

/**
 * Earn achievement
 */
function earnAchievement(goal: GamifiedGoal, achievementKey: keyof typeof ACHIEVEMENTS_LIBRARY): Achievement {
  const template = ACHIEVEMENTS_LIBRARY[achievementKey];
  const achievement: Achievement = {
    ...template,
    id: `achievement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    earned_at: Date.now(),
  };
  
  goal.achievements.push(achievement);
  
  return achievement;
}

/**
 * Send milestone notification
 */
async function sendMilestoneNotification(goal: GamifiedGoal, milestone: Milestone): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🎉 Milestone Reached!`,
      body: `You've reached ${milestone.percentage}% of your "${goal.name}" goal! ${milestone.reward}`,
      data: {
        type: "milestone_reached",
        goal_id: goal.id,
        milestone_id: milestone.id,
      },
    },
    trigger: null,
  });
}

/**
 * Send goal completed notification
 */
async function sendGoalCompletedNotification(goal: GamifiedGoal): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🏆 Goal Completed!",
      body: `Congratulations! You've achieved your "${goal.name}" goal of $${goal.target_amount.toFixed(2)}!`,
      data: {
        type: "goal_completed",
        goal_id: goal.id,
      },
    },
    trigger: null,
  });
}

/**
 * Get active goals
 */
export async function getActiveGoals(): Promise<GamifiedGoal[]> {
  const goals = await getGamifiedGoals();
  return goals.filter((g) => g.is_active && !g.completed_at);
}

/**
 * Get completed goals
 */
export async function getCompletedGoals(): Promise<GamifiedGoal[]> {
  const goals = await getGamifiedGoals();
  return goals.filter((g) => g.completed_at);
}

/**
 * Get goal progress percentage
 */
export function getProgressPercentage(goal: GamifiedGoal): number {
  return Math.min(100, (goal.current_amount / goal.target_amount) * 100);
}

/**
 * Get days remaining
 */
export function getDaysRemaining(goal: GamifiedGoal): number {
  const now = Date.now();
  const remaining = goal.deadline - now;
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

/**
 * Get next milestone
 */
export function getNextMilestone(goal: GamifiedGoal): Milestone | null {
  return goal.milestones.find((m) => !m.reached) || null;
}

/**
 * Get amount needed for next milestone
 */
export function getAmountForNextMilestone(goal: GamifiedGoal): number {
  const nextMilestone = getNextMilestone(goal);
  if (!nextMilestone) return 0;
  return Math.max(0, nextMilestone.amount - goal.current_amount);
}

/**
 * Get all achievements
 */
export async function getAllAchievements(): Promise<Achievement[]> {
  const goals = await getGamifiedGoals();
  const allAchievements: Achievement[] = [];
  
  for (const goal of goals) {
    allAchievements.push(...goal.achievements);
  }
  
  // Sort by earned date (most recent first)
  return allAchievements.sort((a, b) => b.earned_at - a.earned_at);
}

/**
 * Get goal statistics
 */
export async function getGoalStatistics(): Promise<{
  total_goals: number;
  active_goals: number;
  completed_goals: number;
  total_saved: number;
  total_achievements: number;
  average_progress: number;
  highest_streak: number;
}> {
  const goals = await getGamifiedGoals();
  const active = goals.filter((g) => g.is_active && !g.completed_at);
  const completed = goals.filter((g) => g.completed_at);
  
  const totalSaved = goals.reduce((sum, g) => sum + g.current_amount, 0);
  const totalAchievements = goals.reduce((sum, g) => sum + g.achievements.length, 0);
  const averageProgress = active.length > 0
    ? active.reduce((sum, g) => sum + getProgressPercentage(g), 0) / active.length
    : 0;
  const highestStreak = Math.max(...goals.map((g) => g.streak_days), 0);
  
  return {
    total_goals: goals.length,
    active_goals: active.length,
    completed_goals: completed.length,
    total_saved: totalSaved,
    total_achievements: totalAchievements,
    average_progress: averageProgress,
    highest_streak: highestStreak,
  };
}

/**
 * Delete goal
 */
export async function deleteGoal(goalId: string): Promise<boolean> {
  const goals = await getGamifiedGoals();
  const filtered = goals.filter((g) => g.id !== goalId);
  
  if (filtered.length === goals.length) return false;
  
  await saveGamifiedGoals(filtered);
  return true;
}

/**
 * Get motivational message based on progress
 */
export function getMotivationalMessage(goal: GamifiedGoal): string {
  const progress = getProgressPercentage(goal);
  const daysRemaining = getDaysRemaining(goal);
  
  if (progress >= 100) {
    return "🎉 Goal achieved! You're a financial champion!";
  } else if (progress >= 75) {
    return "🔥 Almost there! Keep pushing!";
  } else if (progress >= 50) {
    return "💪 Halfway there! You're doing great!";
  } else if (progress >= 25) {
    return "🌟 Great start! Keep the momentum!";
  } else if (daysRemaining <= 7) {
    return "⏰ Time is running out! Let's do this!";
  } else if (goal.streak_days >= 7) {
    return "🔥 Amazing streak! Keep it going!";
  } else {
    return "🎯 Every contribution counts! You've got this!";
  }
}

/**
 * Get category icon
 */
export function getCategoryIcon(category: GamifiedGoal["category"]): string {
  switch (category) {
    case "savings":
      return "💰";
    case "investment":
      return "📈";
    case "debt":
      return "💳";
    case "emergency":
      return "🚨";
    case "custom":
      return "🎯";
  }
}

/**
 * Get category color
 */
export function getCategoryColor(category: GamifiedGoal["category"]): string {
  switch (category) {
    case "savings":
      return "#22C55E";
    case "investment":
      return "#3B82F6";
    case "debt":
      return "#EF4444";
    case "emergency":
      return "#F59E0B";
    case "custom":
      return "#8B5CF6";
  }
}

/**
 * Calculate recommended contribution
 */
export function getRecommendedContribution(goal: GamifiedGoal): number {
  const remaining = goal.target_amount - goal.current_amount;
  const daysRemaining = getDaysRemaining(goal);
  
  if (daysRemaining <= 0) return remaining;
  
  return Math.ceil(remaining / daysRemaining);
}
