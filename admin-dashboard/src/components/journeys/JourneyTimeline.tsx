'use client';

import React, { useState, useEffect } from 'react';

interface JourneyStep {
  id: string;
  name: string;
  status: 'completed' | 'in_progress' | 'pending' | 'failed';
  component: string;
  timestamp?: string;
  duration?: string;
  details?: string;
}

interface JourneyTimelineProps {
  journeyId: number;
  journeyName: string;
  steps: JourneyStep[];
  onRetry?: (stepId: string) => void;
}

const statusIcons: Record<string, React.ReactNode> = {
  completed: (
    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  in_progress: (
    <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  ),
  pending: (
    <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
  ),
  failed: (
    <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  ),
};

const statusColors: Record<string, string> = {
  completed: 'border-green-500 bg-green-50 dark:bg-green-900/20',
  in_progress: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
  pending: 'border-gray-300 bg-gray-50 dark:bg-gray-800',
  failed: 'border-red-500 bg-red-50 dark:bg-red-900/20',
};

export default function JourneyTimeline({ journeyId, journeyName, steps, onRetry }: JourneyTimelineProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
              Journey {journeyId}: {journeyName}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {completedSteps} of {steps.length} steps completed
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 md:w-48">
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-4 md:p-6">
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-4 md:left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

          {/* Steps */}
          <div className="space-y-4 md:space-y-6">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`relative pl-10 md:pl-14 ${
                  expandedStep === step.id ? 'pb-4' : ''
                }`}
              >
                {/* Step Icon */}
                <div className={`absolute left-2 md:left-4 w-6 h-6 rounded-full flex items-center justify-center bg-white dark:bg-gray-800 border-2 ${
                  step.status === 'completed' ? 'border-green-500' :
                  step.status === 'in_progress' ? 'border-blue-500' :
                  step.status === 'failed' ? 'border-red-500' :
                  'border-gray-300'
                }`}>
                  {statusIcons[step.status]}
                </div>

                {/* Step Content */}
                <div
                  className={`p-3 md:p-4 rounded-lg border-l-4 cursor-pointer transition-all ${statusColors[step.status]}`}
                  onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {step.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Component: {step.component}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {step.timestamp && (
                        <span className="text-gray-500 dark:text-gray-400">
                          {step.timestamp}
                        </span>
                      )}
                      {step.duration && (
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                          {step.duration}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedStep === step.id && step.details && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {step.details}
                      </p>
                      {step.status === 'failed' && onRetry && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRetry(step.id);
                          }}
                          className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
                        >
                          Retry Step
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
