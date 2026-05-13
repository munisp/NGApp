import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeContext';

function ThemeConsumer() {
  const { theme, toggleTheme, switchable } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="switchable">{String(switchable)}</span>
      {toggleTheme && <button onClick={toggleTheme}>Toggle</button>}
    </div>
  );
}

describe('ThemeContext', () => {
  it('provides default theme', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
  });

  it('allows theme toggling when switchable', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider defaultTheme="light" switchable>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId('switchable')).toHaveTextContent('true');
    await user.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  it('does not show toggle when not switchable', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(screen.queryByText('Toggle')).not.toBeInTheDocument();
  });

  it('throws when useTheme used outside provider', () => {
    expect(() => render(<ThemeConsumer />)).toThrow(/useTheme must be used within ThemeProvider/);
  });
});
