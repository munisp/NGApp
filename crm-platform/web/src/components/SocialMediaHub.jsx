import { useState, useContext } from 'react';
import { TenantContext } from '../contexts/TenantContext';
import { Share2, Globe, MessageSquare, TrendingUp, DollarSign, Eye, MousePointer, Users, Target, Megaphone, BarChart3, Calendar, Play, Pause, Plus, ArrowUpRight, Heart, Repeat2 } from 'lucide-react';

const PLATFORMS = [
  { id: 'facebook', name: 'Facebook', color: 'bg-blue-600', textColor: 'text-blue-600', bgLight: 'bg-blue-50', followers: '125K', engagement: '4.2%', reach: '450K' },
  { id: 'instagram', name: 'Instagram', color: 'bg-pink-600', textColor: 'text-pink-600', bgLight: 'bg-pink-50', followers: '89K', engagement: '6.8%', reach: '320K' },
  { id: 'twitter', name: 'X (Twitter)', color: 'bg-gray-900', textColor: 'text-gray-900', bgLight: 'bg-gray-50', followers: '42K', engagement: '2.1%', reach: '180K' },
  { id: 'linkedin', name: 'LinkedIn', color: 'bg-blue-800', textColor: 'text-blue-800', bgLight: 'bg-blue-50', followers: '28K', engagement: '3.5%', reach: '95K' },
  { id: 'tiktok', name: 'TikTok', color: 'bg-gray-800', textColor: 'text-gray-800', bgLight: 'bg-gray-50', followers: '67K', engagement: '8.9%', reach: '850K' },
  { id: 'whatsapp', name: 'WhatsApp Business', color: 'bg-green-600', textColor: 'text-green-600', bgLight: 'bg-green-50', followers: '15K lists', engagement: '52%', reach: '15K' },
];

const CAMPAIGNS = [
  { id: 'sc-001', name: 'Savings Account Launch', platform: 'facebook', status: 'active', budget: 2500000, spent: 1850000, impressions: 2450000, clicks: 48500, leads: 3200, conversions: 192, ctr: 1.98, cpc: 38.14, startDate: '2025-04-15', endDate: '2025-05-15' },
  { id: 'sc-002', name: 'Agent Banking Recruitment', platform: 'instagram', status: 'active', budget: 1800000, spent: 1200000, impressions: 1800000, clicks: 36000, leads: 2100, conversions: 126, ctr: 2.0, cpc: 33.33, startDate: '2025-04-20', endDate: '2025-05-20' },
  { id: 'sc-003', name: 'Diaspora Remittance Promo', platform: 'twitter', status: 'active', budget: 1200000, spent: 890000, impressions: 950000, clicks: 19000, leads: 1100, conversions: 88, ctr: 2.0, cpc: 46.84, startDate: '2025-04-25', endDate: '2025-05-25' },
  { id: 'sc-004', name: 'Business Loan Awareness', platform: 'linkedin', status: 'paused', budget: 3000000, spent: 2100000, impressions: 650000, clicks: 13000, leads: 850, conversions: 68, ctr: 2.0, cpc: 161.54, startDate: '2025-04-01', endDate: '2025-04-30' },
  { id: 'sc-005', name: 'Youth Account TikTok', platform: 'tiktok', status: 'active', budget: 800000, spent: 450000, impressions: 3200000, clicks: 96000, leads: 4500, conversions: 180, ctr: 3.0, cpc: 4.69, startDate: '2025-05-01', endDate: '2025-05-31' },
  { id: 'sc-006', name: 'WhatsApp Micro-Loan', platform: 'whatsapp', status: 'completed', budget: 500000, spent: 480000, impressions: 15000, clicks: 7800, leads: 2800, conversions: 196, ctr: 52.0, cpc: 61.54, startDate: '2025-04-01', endDate: '2025-04-30' },
];

const CONTENT_CALENDAR = [
  { date: '2025-05-05', platform: 'facebook', type: 'Post', title: 'Financial Literacy Monday', status: 'scheduled', engagement: null },
  { date: '2025-05-05', platform: 'instagram', type: 'Reel', title: 'Agent Banking Success Story', status: 'scheduled', engagement: null },
  { date: '2025-05-06', platform: 'twitter', type: 'Thread', title: 'Remittance Savings Tips', status: 'draft', engagement: null },
  { date: '2025-05-07', platform: 'tiktok', type: 'Video', title: 'How to Open Account in 2 Min', status: 'scheduled', engagement: null },
  { date: '2025-05-07', platform: 'linkedin', type: 'Article', title: 'SME Financing Trends in Nigeria', status: 'draft', engagement: null },
  { date: '2025-05-08', platform: 'whatsapp', type: 'Broadcast', title: 'New Loan Products Announcement', status: 'approved', engagement: null },
];

const STATUS_COLORS = { active: 'bg-green-100 text-green-700', paused: 'bg-yellow-100 text-yellow-700', completed: 'bg-gray-100 text-gray-600', draft: 'bg-blue-100 text-blue-700', scheduled: 'bg-purple-100 text-purple-700', approved: 'bg-teal-100 text-teal-700' };

export default function SocialMediaHub() {
  const { tenantId } = useContext(TenantContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  const totalSpend = CAMPAIGNS.reduce((s, c) => s + c.spent, 0);
  const totalLeads = CAMPAIGNS.reduce((s, c) => s + c.leads, 0);
  const totalConversions = CAMPAIGNS.reduce((s, c) => s + c.conversions, 0);
  const totalImpressions = CAMPAIGNS.reduce((s, c) => s + c.impressions, 0);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'campaigns', label: 'Ad Campaigns', icon: Megaphone },
    { id: 'content', label: 'Content Calendar', icon: Calendar },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Share2 className="w-7 h-7 text-pink-600" /> Social Media Hub
          </h1>
          <p className="text-gray-500 mt-1">Campaign management, advertising, and social engagement across platforms</p>
        </div>
        <button className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-pink-700">
          <Plus className="w-4 h-4" /> Create Campaign
        </button>
      </div>

      {/* Platform Overview Cards */}
      <div className="grid grid-cols-6 gap-3">
        {PLATFORMS.map(p => (
          <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border p-3 text-center">
            <div className={`w-8 h-8 ${p.color} rounded-lg flex items-center justify-center mx-auto mb-2`}>
              <Globe className="w-4 h-4 text-white" />
            </div>
            <div className="text-xs font-medium text-gray-900">{p.name}</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{p.followers}</div>
            <div className="text-xs text-green-600">{p.engagement} eng.</div>
          </div>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Ad Spend', value: `₦${(totalSpend / 1000000).toFixed(1)}M`, icon: DollarSign, color: 'text-orange-600' },
          { label: 'Total Impressions', value: `${(totalImpressions / 1000000).toFixed(1)}M`, icon: Eye, color: 'text-blue-600' },
          { label: 'Leads Generated', value: totalLeads.toLocaleString(), icon: Users, color: 'text-green-600' },
          { label: 'Conversions', value: totalConversions.toLocaleString(), icon: Target, color: 'text-purple-600' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
            <h3 className="font-semibold mb-4">Platform Performance</h3>
            <div className="space-y-3">
              {PLATFORMS.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <div className={`w-8 h-8 ${p.color} rounded-lg flex items-center justify-center`}><Globe className="w-4 h-4 text-white" /></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.followers} followers</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-600">{p.engagement}</div>
                    <div className="text-xs text-gray-500">Reach: {p.reach}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
            <h3 className="font-semibold mb-4">Top Performing Campaigns</h3>
            <div className="space-y-3">
              {CAMPAIGNS.sort((a, b) => b.conversions - a.conversions).slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-gray-500 capitalize">{c.platform} · {c.leads} leads</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-600">{c.conversions} conv.</div>
                    <div className="text-xs text-gray-500">CTR: {c.ctr}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'campaigns' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border">
          <div className="divide-y">
            {CAMPAIGNS.map(c => (
              <div key={c.id} onClick={() => setSelectedCampaign(selectedCampaign?.id === c.id ? null : c)} className="p-4 hover:bg-gray-50 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${PLATFORMS.find(p => p.id === c.platform)?.color || 'bg-gray-500'}`}>
                      <Megaphone className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-500 capitalize">{c.platform} · {c.startDate} to {c.endDate}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                    <div className="text-right">
                      <div className="text-sm font-bold">₦{(c.spent / 1000000).toFixed(1)}M / ₦{(c.budget / 1000000).toFixed(1)}M</div>
                      <div className="text-xs text-gray-500">{c.leads} leads · {c.conversions} conversions</div>
                    </div>
                  </div>
                </div>
                {selectedCampaign?.id === c.id && (
                  <div className="mt-3 pt-3 border-t grid grid-cols-6 gap-4 text-center">
                    <div><div className="text-xs text-gray-500">Impressions</div><div className="text-sm font-bold">{(c.impressions / 1000).toFixed(0)}K</div></div>
                    <div><div className="text-xs text-gray-500">Clicks</div><div className="text-sm font-bold">{(c.clicks / 1000).toFixed(0)}K</div></div>
                    <div><div className="text-xs text-gray-500">CTR</div><div className="text-sm font-bold text-blue-600">{c.ctr}%</div></div>
                    <div><div className="text-xs text-gray-500">CPC</div><div className="text-sm font-bold">₦{c.cpc.toFixed(0)}</div></div>
                    <div><div className="text-xs text-gray-500">CPL</div><div className="text-sm font-bold">₦{(c.spent / c.leads).toFixed(0)}</div></div>
                    <div><div className="text-xs text-gray-500">ROAS</div><div className="text-sm font-bold text-green-600">{((c.conversions * 250000) / c.spent).toFixed(1)}x</div></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'content' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
          <h3 className="font-semibold mb-4">Content Calendar — May 2025</h3>
          <div className="divide-y">
            {CONTENT_CALENDAR.map((item, i) => (
              <div key={i} className="flex items-center gap-4 py-3">
                <div className="w-20 text-sm text-gray-500">{item.date.split('-').slice(1).join('/')}</div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${PLATFORMS.find(p => p.id === item.platform)?.color || 'bg-gray-500'}`}>
                  <Globe className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="text-xs text-gray-500 capitalize">{item.platform} · {item.type}</div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[item.status]}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
            <h3 className="font-semibold mb-4">Channel ROI Comparison</h3>
            <div className="space-y-3">
              {CAMPAIGNS.map(c => {
                const roas = ((c.conversions * 250000) / c.spent);
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <div className="w-40 text-sm truncate">{c.name}</div>
                    <div className="flex-1">
                      <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div className={`h-full rounded-full ${roas > 10 ? 'bg-green-500' : roas > 5 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${Math.min(100, roas * 5)}%` }} />
                      </div>
                    </div>
                    <div className="w-16 text-right text-sm font-bold">{roas.toFixed(1)}x</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
            <h3 className="font-semibold mb-4">Cost Efficiency</h3>
            <div className="space-y-4">
              {[
                { label: 'Lowest CPA', value: 'WhatsApp Business', metric: '₦850', color: 'text-green-600' },
                { label: 'Highest ROAS', value: 'Referral Program', metric: '24.0x', color: 'text-indigo-600' },
                { label: 'Best CTR', value: 'WhatsApp Broadcast', metric: '52.0%', color: 'text-blue-600' },
                { label: 'Most Leads', value: 'TikTok Youth Campaign', metric: '4,500', color: 'text-pink-600' },
                { label: 'Best Conversion', value: 'WhatsApp Micro-Loan', metric: '196 conv.', color: 'text-green-600' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-xs text-gray-500">{item.label}</div>
                    <div className="text-sm font-medium">{item.value}</div>
                  </div>
                  <div className={`text-lg font-bold ${item.color}`}>{item.metric}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
