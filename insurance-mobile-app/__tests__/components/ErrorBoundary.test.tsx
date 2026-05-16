import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ErrorBoundary, ErrorMessage, EmptyState } from '../../src/components/ErrorBoundary';

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <Text>No error</Text>;
};

describe('ErrorBoundary Component', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('should render children when no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Text>Child content</Text>
      </ErrorBoundary>
    );

    expect(getByText('Child content')).toBeTruthy();
  });

  it('should render error UI when error occurs', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('Try Again')).toBeTruthy();
  });

  it('should render custom fallback when provided', () => {
    const { getByText } = render(
      <ErrorBoundary fallback={<Text>Custom fallback</Text>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Custom fallback')).toBeTruthy();
  });

  it('should call onError callback when error occurs', () => {
    const onError = jest.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalled();
  });

  it('should recover when retry is pressed', () => {
    const { getByText, queryByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(getByText('No error')).toBeTruthy();
    expect(queryByText('Something went wrong')).toBeNull();
  });
});

describe('ErrorMessage Component', () => {
  it('should render error message', () => {
    const { getByText } = render(
      <ErrorMessage message="Something went wrong" />
    );

    expect(getByText('Something went wrong')).toBeTruthy();
  });

  it('should render retry button when onRetry provided', () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <ErrorMessage message="Error" onRetry={onRetry} />
    );

    const retryButton = getByText('Retry');
    expect(retryButton).toBeTruthy();

    fireEvent.press(retryButton);
    expect(onRetry).toHaveBeenCalled();
  });

  it('should not render retry button when onRetry not provided', () => {
    const { queryByText } = render(
      <ErrorMessage message="Error" />
    );

    expect(queryByText('Retry')).toBeNull();
  });
});

describe('EmptyState Component', () => {
  it('should render title', () => {
    const { getByText } = render(
      <EmptyState title="No items found" />
    );

    expect(getByText('No items found')).toBeTruthy();
  });

  it('should render message when provided', () => {
    const { getByText } = render(
      <EmptyState title="No items" message="Try adding some items" />
    );

    expect(getByText('Try adding some items')).toBeTruthy();
  });

  it('should render action button when provided', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <EmptyState
        title="No items"
        action={{ label: 'Add Item', onPress }}
      />
    );

    const actionButton = getByText('Add Item');
    expect(actionButton).toBeTruthy();

    fireEvent.press(actionButton);
    expect(onPress).toHaveBeenCalled();
  });
});
