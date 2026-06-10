import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useQuery: vi.fn(),
    createClient: vi.fn(),
    Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  },
}));

vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn().mockImplementation(() => ({
    getQueryCache: () => ({ subscribe: vi.fn() }),
    getMutationCache: () => ({ subscribe: vi.fn() }),
  })),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('App Component', () => {
  it('renders without crashing', async () => {
    const { default: App } = await import('./App');
    const { render } = await import('@testing-library/react');
    const { screen } = await import('@testing-library/react');
    render(<App />);
    expect(document.body).toBeTruthy();
  });
});
