import { useState } from 'react';

export const useBallerine = () => {
  const [kybStatus, setKybStatus] = useState('idle');

  const initiateKyb = async (customerData) => {
    setKybStatus('processing');
    // Simulate API call to Ballerine
    console.log('Initiating KYB with Ballerine for:', customerData);
    await new Promise(resolve => setTimeout(resolve, 3000));
    const isSuccess = Math.random() > 0.2;
    setKybStatus(isSuccess ? 'success' : 'error');
  };

  return { kybStatus, initiateKyb };
};
