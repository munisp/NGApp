import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Star, Award, Medal, Target, Users, TrendingUp,
  MapPin, ArrowUpRight, Crown, Flame, Zap, Gift, BarChart3,
  Calendar, Clock, CheckCircle2, Smartphone, DollarSign
} from 'lucide-react';

const LEADERBOARD = [
  {
    rank: 1, name: 'Adebayo Ogunlesi', region: 'Lagos',
    points: 12450, level: 'Diamond', streak: 28,
    signups: 342, conversions: 189, revenue: 8420000,
    badges: ['Top Performer', 'Consistency King', '100 Conversions', 'Revenue Champion'],
    change: 0, avatar: 'AO',
  },
  {
    rank: 2, name: 'Halima Abubakar', region: 'Kano',
    points: 11200, level: 'Diamond', streak: 22,
    signups: 298, conversions: 165, revenue: 7100000,
    badges: ['Top Performer', 'Regional Champion', 'Speed Star'],
    change: 1, avatar: 'HA',
  },
  {
    rank: 3, name: 'Chidinma Okafor', region: 'Enugu',
    points: 10800, level: 'Platinum', streak: 19,
    signups: 276, conversions: 158, revenue: 6800000,
    badges: ['Rising Star', '50 Day Streak', 'Quality Champion'],
    change: -1, avatar: 'CO',
  },
  {
    rank: 4, name: 'Musa Abdullahi', region: 'Abuja',
    points: 9650, level: 'Platinum', streak: 15,
    signups: 245, conversions: 134, revenue: 5900000,
    badges: ['Consistent Performer', 'Referral Master'],
    change: 2, avatar: 'MA',
  },
  {
    rank: 5, name: 'Ngozi Eze', region: 'Port Harcourt',
    points: 9200, level: 'Gold', streak: 12,
    signups: 218, conversions: 121, revenue: 5400000,
    badges: ['Milestone Achiever', 'Campaign Star'],
    change: 0, avatar: 'NE',
  },
  {
    rank: 6, name: 'Yusuf Ibrahim', region: 'Kano',
    points: 8800, level: 'Gold', streak: 10,
    signups: 201, conversions: 112, revenue: 4800000,
    badges: ['Quick Starter', 'Team Player'],
    change: -2, avatar: 'YI',
  },
  {
    rank: 7, name: 'Funke Adeyemi', region: 'Ibadan',
    points: 8400, level: 'Gold', streak: 8,
    signups: 189, conversions: 98, revenue: 4200000,
    badges: ['Emerging Leader'],
    change: 3, avatar: 'FA',
  },
  {
    rank: 8, name: 'Emmanuel Nwachukwu', region: 'Lagos',
    points: 7950, level: 'Silver', streak: 6,
    signups: 172, conversions: 89, revenue: 3800000,
    badges: ['First 100 Signups'],
    change: -1, avatar: 'EN',
  },
];

const LEVEL_CONFIG = {
  Diamond: { color: 'blue', minPoints: 10000, icon: Crown },
  Platinum: { color: 'purple', minPoints: 8000, icon: Award },
  Gold: { color: 'amber', minPoints: 6000, icon: Medal },
  Silver: { color: 'gray', minPoints: 3000, icon: Star },
  Bronze: { color: 'orange', minPoints: 0, icon: Star },
};

const ACHIEVEMENTS = [
  { id: 1, name: 'First Sign-Up', description: 'Register your first customer', icon: Users, points: 50, earned: 1538, total: 1538 },
  { id: 2, name: '100 Conversions', description: 'Convert 100 campaign leads', icon: Target, points: 500, earned: 89, total: 1538 },
  { id: 3, name: '30-Day Streak', description: 'Active every day for 30 days', icon: Flame, points: 1000, earned: 42, total: 1538 },
  { id: 4, name: 'Revenue Champion', description: 'Generate ₦5M+ in campaign revenue', icon: DollarSign, points: 2000, earned: 28, total: 1538 },
  { id: 5, name: 'Regional Champion', description: 'Top performer in your region for a month', icon: MapPin, points: 1500, earned: 6, total: 1538 },
  { id: 6, name: 'Campaign Star', description: 'Achieve 50%+ conversion rate on a campaign', icon: Megaphone, points: 750, earned: 67, total: 1538 },
  { id: 7, name: 'Speed Star', description: 'Complete 10 sign-ups in a single day', icon: Zap, points: 300, earned: 124, total: 1538 },
  { id: 8, name: 'Quality Champion', description: 'Maintain 95%+ data quality score', icon: CheckCircle2, points: 800, earned: 156, total: 1538 },
];

const INCENTIVES = [
  { name: 'Monthly Performance Bonus', threshold: '10,000+ points', reward: '₦50,000 bonus', claimants: 3, status: 'active' },
  { name: 'Quarterly Top 5', threshold: 'Top 5 agents', reward: 'New smartphone', claimants: 5, status: 'active' },
  { name: 'Consistency Award', threshold: '30-day streak', reward: '₦20,000 + badge', claimants: 42, status: 'active' },
  { name: 'Revenue Milestone', threshold: '₦10M generated', reward: '₦100,000 + trophy', claimants: 8, status: 'active' },
  { name: 'Referral Bonus', threshold: '5 agent referrals', reward: '₦15,000 per referral', claimants: 23, status: 'active' },
];

const Megaphone = (props) => <Target {...props} />;

export default function AgentGamification() {
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [timeRange, setTimeRange] = useState('month');

  const totalPoints = LEADERBOARD.reduce((s, a) => s + a.points, 0);
  const totalSignups = LEADERBOARD.reduce((s, a) => s + a.signups, 0);
  const totalRevenue = LEADERBOARD.reduce((s, a) => s + a.revenue, 0);

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Trophy className="w-7 h-7 text-amber-500" />
            Agent Performance & Gamification
          </h1>
          <p className="text-sm text-gray-500 mt-1">Leaderboards, achievements, incentives & performance tracking</p>
        </div>
        <div className="flex gap-2">
          {['week', 'month', 'quarter', 'all'].map(range => (
            <button key={range} onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${timeRange === range ? 'bg-amber-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}>
              {range === 'all' ? 'All Time' : range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-3 gap-4">
        {LEADERBOARD.slice(0, 3).map((agent, i) => {
          const cfg = LEVEL_CONFIG[agent.level];
          return (
            <motion.div key={agent.rank} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }}
              className={`bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border-2 text-center ${i === 0 ? 'border-amber-400' : i === 1 ? 'border-gray-300' : 'border-orange-300'}`}>
              <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center text-xl font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-700' : 'bg-orange-100 text-orange-700'}`}>
                {agent.avatar}
              </div>
              <div className="mt-3">
                {i === 0 && <Crown className="w-6 h-6 text-amber-500 mx-auto mb-1" />}
                <h3 className="font-bold text-gray-900 dark:text-white">{agent.name}</h3>
                <p className="text-xs text-gray-500">{agent.region}</p>
                <div className="mt-2 flex items-center justify-center gap-1">
                  <cfg.icon className={`w-4 h-4 text-${cfg.color}-600`} />
                  <span className={`text-sm font-bold text-${cfg.color}-600`}>{agent.points.toLocaleString()} pts</span>
                </div>
                <div className="flex items-center justify-center gap-2 mt-2 text-xs text-gray-500">
                  <span>{agent.signups} signups</span>
                  <span>•</span>
                  <span>{agent.conversions} conv</span>
                </div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Flame className="w-3 h-3 text-orange-500" />
                  <span className="text-xs font-medium text-orange-600">{agent.streak} day streak</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Agents', value: '1,538', icon: Users, color: 'blue' },
          { label: 'Total Points Earned', value: `${(totalPoints / 1000).toFixed(1)}K`, icon: Star, color: 'amber' },
          { label: 'Campaign Sign-ups', value: totalSignups.toLocaleString(), icon: Target, color: 'green' },
          { label: 'Revenue Generated', value: `₦${(totalRevenue / 1000000).toFixed(1)}M`, icon: DollarSign, color: 'emerald' },
        ].map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-${m.color}-100 dark:bg-${m.color}-900/30`}>
                <m.icon className={`w-5 h-5 text-${m.color}-600`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{m.label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{m.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700 w-fit">
        {['leaderboard', 'achievements', 'incentives'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-amber-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'leaderboard' && (
          <motion.div key="leaderboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Full Leaderboard</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-gray-500 font-medium w-12">Rank</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Agent</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Region</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Level</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Points</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Sign-ups</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Conversions</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Revenue</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Streak</th>
                    <th className="text-center py-2 text-gray-500 font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {LEADERBOARD.map(agent => {
                    const cfg = LEVEL_CONFIG[agent.level];
                    return (
                      <tr key={agent.rank} className="border-b border-gray-100 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30"
                        onClick={() => setSelectedAgent(selectedAgent?.rank === agent.rank ? null : agent)}>
                        <td className="py-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${agent.rank <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                            {agent.rank}
                          </span>
                        </td>
                        <td className="py-3 font-medium text-gray-900 dark:text-white">{agent.name}</td>
                        <td className="py-3 text-gray-600 dark:text-gray-400">{agent.region}</td>
                        <td className="py-3">
                          <span className={`flex items-center gap-1 text-${cfg.color}-600`}>
                            <cfg.icon className="w-3.5 h-3.5" /> {agent.level}
                          </span>
                        </td>
                        <td className="py-3 text-right font-bold">{agent.points.toLocaleString()}</td>
                        <td className="py-3 text-right">{agent.signups}</td>
                        <td className="py-3 text-right text-green-600">{agent.conversions}</td>
                        <td className="py-3 text-right">₦{(agent.revenue / 1000000).toFixed(1)}M</td>
                        <td className="py-3 text-right">
                          <span className="flex items-center gap-1 justify-end">
                            <Flame className="w-3 h-3 text-orange-500" /> {agent.streak}d
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          {agent.change > 0 ? (
                            <span className="text-green-600 flex items-center justify-center gap-0.5"><ArrowUpRight className="w-3 h-3" />{agent.change}</span>
                          ) : agent.change < 0 ? (
                            <span className="text-red-600 flex items-center justify-center gap-0.5"><ArrowUpRight className="w-3 h-3 rotate-90" />{Math.abs(agent.change)}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'achievements' && (
          <motion.div key="achievements" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ACHIEVEMENTS.map((ach, i) => (
                <motion.div key={ach.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                      <ach.icon className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{ach.name}</h4>
                      <p className="text-xs text-gray-500">{ach.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs font-bold text-amber-600">+{ach.points} pts</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{ach.earned}/{ach.total} agents earned ({(ach.earned / ach.total * 100).toFixed(1)}%)</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(ach.earned / ach.total) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'incentives' && (
          <motion.div key="incentives" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Active Incentive Programs</h3>
              <div className="space-y-3">
                {INCENTIVES.map(inc => (
                  <div key={inc.name} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex items-center gap-3">
                      <Gift className="w-5 h-5 text-amber-500" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{inc.name}</p>
                        <p className="text-xs text-gray-500">Threshold: {inc.threshold}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Reward</p>
                        <p className="font-bold text-emerald-600">{inc.reward}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Claimants</p>
                        <p className="font-bold">{inc.claimants}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        {inc.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
