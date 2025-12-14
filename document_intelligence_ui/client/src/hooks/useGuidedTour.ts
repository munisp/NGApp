import { useState, useEffect } from 'react';
import { Step } from 'react-joyride';

interface TourConfig {
  tourKey: string;
  steps: Step[];
}

export function useGuidedTour({ tourKey, steps }: TourConfig) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    // Check if user has completed this tour
    const completed = localStorage.getItem(`tour_completed_${tourKey}`);
    const skipTour = localStorage.getItem(`tour_skip_${tourKey}`);
    
    // Auto-start tour if not completed and not skipped
    if (!completed && !skipTour) {
      const timer = setTimeout(() => {
        setRun(true);
      }, 1000); // Delay to let page render
      
      return () => clearTimeout(timer);
    }
  }, [tourKey]);

  const startTour = () => {
    setStepIndex(0);
    setRun(true);
  };

  const handleJoyrideCallback = (data: any) => {
    const { action, index, status, type } = data;

    if (status === 'finished' || status === 'skipped') {
      setRun(false);
      
      if (status === 'finished') {
        localStorage.setItem(`tour_completed_${tourKey}`, 'true');
      } else if (status === 'skipped') {
        localStorage.setItem(`tour_skip_${tourKey}`, 'true');
      }
    }

    if (type === 'step:after') {
      setStepIndex(index + (action === 'prev' ? -1 : 1));
    }
  };

  const resetTour = () => {
    localStorage.removeItem(`tour_completed_${tourKey}`);
    localStorage.removeItem(`tour_skip_${tourKey}`);
    startTour();
  };

  return {
    run,
    stepIndex,
    startTour,
    resetTour,
    handleJoyrideCallback,
  };
}
