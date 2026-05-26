'use client';

import React, { useState } from 'react';

interface Journey {
  id: number;
  name: string;
  description: string;
  category: string;
  status: 'active' | 'pending' | 'completed' | 'failed';
  components: string[];
  successRate: number;
}

interface MobileJourneyCardProps {
  journey: Journey;
  onRun: (journeyId: number) => void;
  onViewDetails: (journey: Journey) => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  onboarding: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  payments: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  operations: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  analytics: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  security: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
};

const categoryColors: Record<string, { bg: string; text: string; icon: string }> = {
  onboarding: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', icon: 'text-blue-500' },
  payments: { bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: 'text-green-500' },
  operations: { bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', icon: 'text-purple-500' },
  analytics: { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', icon: 'text-orange-500' },
  security: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', icon: 'text-red-500' },
};

const statusColors: Record<string, string> = {
  active: 'bg-green-500',
  pending: 'bg-yellow-500',
  completed: 'bg-blue-500',
  failed: 'bg-red-500',
};

export default function MobileJourneyCard({ journey, onRun, onViewDetails }: MobileJourneyCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = categoryColors[journey.category] || categoryColors.operations;

  return (
    <div className={`rounded-2xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 ${colors.bg}`}>
      {/* Main Card Content */}
      <div
        className="p-4 cursor-pointer active:opacity-80 transition-opacity"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3">
          {/* Category Icon */}
          <div className={`p-2 rounded-xl bg-white dark:bg-gray-800 ${colors.icon}`}>
            {categoryIcons[journey.category]}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${statusColors[journey.status]}`} />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Journey {journey.id}
              </span>
            </div>
            <h3 className={`mt-1 font-semibold ${colors.text} line-clamp-1`}>
              {journey.name}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {journey.description}
            </p>
          </div>

          {/* Expand Icon */}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Success Rate Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500 dark:text-gray-400">Success Rate</span>
            <span className={`font-medium ${colors.text}`}>{journey.successRate}%</span>
          </div>
          <div className="h-1.5 bg-white/50 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all"
              style={{ width: `${journey.successRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Components */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Integrated Components
            </p>
            <div className="flex flex-wrap gap-1.5">
              {journey.components.map((component, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-white dark:bg-gray-800 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  {component}
                </span>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRun(journey.id);
              }}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Run Journey
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(journey);
              }}
              className="px-4 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors border border-gray-200 dark:border-gray-600"
            >
              Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
