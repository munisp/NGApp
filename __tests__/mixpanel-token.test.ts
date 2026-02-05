import { describe, it, expect } from 'vitest';

describe('Mixpanel Token Validation', () => {
  it('should have EXPO_PUBLIC_MIXPANEL_TOKEN environment variable set', () => {
    const token = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;
    
    // Check token exists
    expect(token).toBeDefined();
    expect(token).not.toBe('');
    expect(token).not.toBe('DEMO_TOKEN');
    
    // Check token format (Mixpanel tokens are 32-character alphanumeric strings)
    expect(token).toMatch(/^[a-f0-9]{32}$/i);
    
    console.log('✓ Mixpanel token is valid and properly formatted');
  });

  it('should accept DEMO_TOKEN for development', () => {
    const token = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;
    
    // Allow DEMO_TOKEN for development/testing
    if (token === 'DEMO_TOKEN') {
      console.log('⚠ Using DEMO_TOKEN - analytics will not be collected');
      expect(token).toBe('DEMO_TOKEN');
    } else {
      // Production token should be 32 characters
      expect(token?.length).toBe(32);
    }
  });
});
