import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sharing from "expo-sharing";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earnedDate: number;
  category: "savings" | "spending" | "investing" | "debt" | "streak";
  shared: boolean;
}

export interface Friend {
  id: string;
  name: string;
  email: string;
  healthScore: number;
  achievements: number;
  addedDate: number;
}

export interface GroupChallenge {
  id: string;
  name: string;
  description: string;
  goal: string;
  targetAmount: number;
  startDate: number;
  endDate: number;
  participants: Participant[];
  status: "active" | "completed" | "cancelled";
  prize?: string;
}

export interface Participant {
  id: string;
  name: string;
  progress: number;
  rank: number;
  lastUpdate: number;
}

export interface Leaderboard {
  challengeId: string;
  participants: Participant[];
  myRank: number;
}

const ACHIEVEMENTS_KEY = "@achievements";
const FRIENDS_KEY = "@friends";
const CHALLENGES_KEY = "@group_challenges";

// Predefined achievements
const ACHIEVEMENT_DEFINITIONS = [
  {
    id: "first_savings",
    title: "First Steps",
    description: "Made your first savings deposit",
    icon: "🎯",
    category: "savings" as const,
  },
  {
    id: "savings_1000",
    title: "Thousand Club",
    description: "Saved $1,000",
    icon: "💰",
    category: "savings" as const,
  },
  {
    id: "savings_5000",
    title: "Five Grand",
    description: "Saved $5,000",
    icon: "💎",
    category: "savings" as const,
  },
  {
    id: "budget_master",
    title: "Budget Master",
    description: "Stayed under budget for 3 months",
    icon: "📊",
    category: "spending" as const,
  },
  {
    id: "debt_free",
    title: "Debt Free",
    description: "Paid off all debts",
    icon: "🎉",
    category: "debt" as const,
  },
  {
    id: "first_investment",
    title: "Investor",
    description: "Made your first investment",
    icon: "📈",
    category: "investing" as const,
  },
  {
    id: "portfolio_10k",
    title: "Portfolio Pro",
    description: "Portfolio value reached $10,000",
    icon: "🚀",
    category: "investing" as const,
  },
  {
    id: "streak_7",
    title: "Week Warrior",
    description: "7-day savings streak",
    icon: "🔥",
    category: "streak" as const,
  },
  {
    id: "streak_30",
    title: "Month Master",
    description: "30-day savings streak",
    icon: "⚡",
    category: "streak" as const,
  },
  {
    id: "streak_100",
    title: "Century Saver",
    description: "100-day savings streak",
    icon: "👑",
    category: "streak" as const,
  },
];

export async function getAchievements(): Promise<Achievement[]> {
  const data = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
  if (!data) return [];
  return JSON.parse(data).sort((a: Achievement, b: Achievement) => b.earnedDate - a.earnedDate);
}

export async function unlockAchievement(achievementId: string): Promise<Achievement | null> {
  const achievements = await getAchievements();
  
  // Check if already unlocked
  if (achievements.some((a) => a.id === achievementId)) {
    return null;
  }

  const definition = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === achievementId);
  if (!definition) return null;

  const newAchievement: Achievement = {
    ...definition,
    earnedDate: Date.now(),
    shared: false,
  };

  achievements.push(newAchievement);
  await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements));

  return newAchievement;
}

export async function shareAchievement(achievementId: string): Promise<boolean> {
  const achievements = await getAchievements();
  const achievement = achievements.find((a) => a.id === achievementId);
  
  if (!achievement) return false;

  const shareMessage = `🎉 I just earned the "${achievement.title}" achievement! ${achievement.description} #FinancialGoals`;

  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      // In a real app, you'd generate an image or create a shareable link
      await Sharing.shareAsync("data:text/plain;base64," + btoa(shareMessage));
      
      // Mark as shared
      achievement.shared = true;
      await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements));
      
      return true;
    }
  } catch (error) {
    console.error("Failed to share achievement:", error);
  }

  return false;
}

export async function getFriends(): Promise<Friend[]> {
  const data = await AsyncStorage.getItem(FRIENDS_KEY);
  if (!data) {
    // Return mock friends for demo
    const mockFriends: Friend[] = [
      {
        id: "1",
        name: "Sarah Johnson",
        email: "sarah@example.com",
        healthScore: 82.5,
        achievements: 12,
        addedDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
      },
      {
        id: "2",
        name: "Michael Chen",
        email: "michael@example.com",
        healthScore: 78.3,
        achievements: 9,
        addedDate: Date.now() - 15 * 24 * 60 * 60 * 1000,
      },
      {
        id: "3",
        name: "Amina Okafor",
        email: "amina@example.com",
        healthScore: 85.7,
        achievements: 15,
        addedDate: Date.now() - 45 * 24 * 60 * 60 * 1000,
      },
    ];
    await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(mockFriends));
    return mockFriends;
  }
  return JSON.parse(data).sort((a: Friend, b: Friend) => b.healthScore - a.healthScore);
}

export async function addFriend(name: string, email: string): Promise<void> {
  const friends = await getFriends();
  
  const newFriend: Friend = {
    id: Date.now().toString(),
    name,
    email,
    healthScore: 70 + Math.random() * 20, // Random score for demo
    achievements: Math.floor(Math.random() * 10),
    addedDate: Date.now(),
  };

  friends.push(newFriend);
  await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
}

export async function removeFriend(friendId: string): Promise<void> {
  const friends = await getFriends();
  const filtered = friends.filter((f) => f.id !== friendId);
  await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(filtered));
}

export async function compareHealthScore(myScore: number): Promise<{
  myScore: number;
  averageScore: number;
  rank: number;
  totalFriends: number;
}> {
  const friends = await getFriends();
  const allScores = [myScore, ...friends.map((f) => f.healthScore)];
  const averageScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
  
  const sortedScores = [...allScores].sort((a, b) => b - a);
  const rank = sortedScores.indexOf(myScore) + 1;

  return {
    myScore,
    averageScore,
    rank,
    totalFriends: friends.length,
  };
}

export async function getGroupChallenges(): Promise<GroupChallenge[]> {
  const data = await AsyncStorage.getItem(CHALLENGES_KEY);
  if (!data) {
    // Return mock challenges for demo
    const now = Date.now();
    const mockChallenges: GroupChallenge[] = [
      {
        id: "1",
        name: "30-Day Savings Sprint",
        description: "Save the most money in 30 days",
        goal: "Highest total savings",
        targetAmount: 1000,
        startDate: now - 10 * 24 * 60 * 60 * 1000,
        endDate: now + 20 * 24 * 60 * 60 * 1000,
        status: "active",
        prize: "$50 bonus",
        participants: [
          { id: "me", name: "You", progress: 650, rank: 2, lastUpdate: now },
          { id: "1", name: "Sarah Johnson", progress: 720, rank: 1, lastUpdate: now - 2 * 60 * 60 * 1000 },
          { id: "2", name: "Michael Chen", progress: 580, rank: 3, lastUpdate: now - 5 * 60 * 60 * 1000 },
          { id: "3", name: "Amina Okafor", progress: 490, rank: 4, lastUpdate: now - 8 * 60 * 60 * 1000 },
        ],
      },
      {
        id: "2",
        name: "No Spend Weekend",
        description: "Go the entire weekend without spending",
        goal: "Zero discretionary spending",
        targetAmount: 0,
        startDate: now + 5 * 24 * 60 * 60 * 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        status: "active",
        participants: [
          { id: "me", name: "You", progress: 0, rank: 1, lastUpdate: now },
          { id: "1", name: "Sarah Johnson", progress: 0, rank: 1, lastUpdate: now },
          { id: "2", name: "Michael Chen", progress: 0, rank: 1, lastUpdate: now },
        ],
      },
    ];
    await AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(mockChallenges));
    return mockChallenges;
  }
  return JSON.parse(data);
}

export async function createGroupChallenge(challenge: Omit<GroupChallenge, "id" | "participants" | "status">): Promise<void> {
  const challenges = await getGroupChallenges();
  
  const newChallenge: GroupChallenge = {
    ...challenge,
    id: Date.now().toString(),
    participants: [
      { id: "me", name: "You", progress: 0, rank: 1, lastUpdate: Date.now() },
    ],
    status: "active",
  };

  challenges.push(newChallenge);
  await AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(challenges));
}

export async function joinChallenge(challengeId: string): Promise<void> {
  const challenges = await getGroupChallenges();
  const challenge = challenges.find((c) => c.id === challengeId);
  
  if (challenge && !challenge.participants.some((p) => p.id === "me")) {
    challenge.participants.push({
      id: "me",
      name: "You",
      progress: 0,
      rank: challenge.participants.length + 1,
      lastUpdate: Date.now(),
    });
    
    await AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(challenges));
  }
}

export async function updateChallengeProgress(challengeId: string, progress: number): Promise<void> {
  const challenges = await getGroupChallenges();
  const challenge = challenges.find((c) => c.id === challengeId);
  
  if (challenge) {
    const participant = challenge.participants.find((p) => p.id === "me");
    if (participant) {
      participant.progress = progress;
      participant.lastUpdate = Date.now();
      
      // Recalculate ranks
      const sorted = [...challenge.participants].sort((a, b) => b.progress - a.progress);
      sorted.forEach((p, index) => {
        const original = challenge.participants.find((op) => op.id === p.id);
        if (original) {
          original.rank = index + 1;
        }
      });
      
      await AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(challenges));
    }
  }
}

export async function getLeaderboard(challengeId: string): Promise<Leaderboard | null> {
  const challenges = await getGroupChallenges();
  const challenge = challenges.find((c) => c.id === challengeId);
  
  if (!challenge) return null;

  const myParticipant = challenge.participants.find((p) => p.id === "me");
  const myRank = myParticipant ? myParticipant.rank : challenge.participants.length + 1;

  return {
    challengeId,
    participants: challenge.participants,
    myRank,
  };
}

export async function leaveChallenge(challengeId: string): Promise<void> {
  const challenges = await getGroupChallenges();
  const challenge = challenges.find((c) => c.id === challengeId);
  
  if (challenge) {
    challenge.participants = challenge.participants.filter((p) => p.id !== "me");
    
    // Recalculate ranks
    const sorted = [...challenge.participants].sort((a, b) => b.progress - a.progress);
    sorted.forEach((p, index) => {
      const original = challenge.participants.find((op) => op.id === p.id);
      if (original) {
        original.rank = index + 1;
      }
    });
    
    await AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(challenges));
  }
}

export function getChallengeStatus(challenge: GroupChallenge): {
  daysRemaining: number;
  isActive: boolean;
  isCompleted: boolean;
  progressPercent: number;
} {
  const now = Date.now();
  const daysRemaining = Math.ceil((challenge.endDate - now) / (1000 * 60 * 60 * 24));
  const isActive = challenge.status === "active" && now >= challenge.startDate && now <= challenge.endDate;
  const isCompleted = challenge.status === "completed" || now > challenge.endDate;
  
  const myParticipant = challenge.participants.find((p) => p.id === "me");
  const progressPercent = myParticipant && challenge.targetAmount > 0
    ? (myParticipant.progress / challenge.targetAmount) * 100
    : 0;

  return {
    daysRemaining: Math.max(0, daysRemaining),
    isActive,
    isCompleted,
    progressPercent,
  };
}
