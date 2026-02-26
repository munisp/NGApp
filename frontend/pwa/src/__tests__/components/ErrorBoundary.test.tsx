import { render, screen } from "@testing-library/react";
import { ErrorBoundary, InlineError } from "@/components/common/ErrorBoundary";

function ThrowError() {
  throw new Error("Test error");
}

function NoError() {
  return <div>Working fine</div>;
}

describe("ErrorBoundary", () => {
  // Suppress console.error for expected errors
  const originalError = console.error;
  beforeAll(() => { console.error = jest.fn(); });
  afterAll(() => { console.error = originalError; });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <NoError />
      </ErrorBoundary>
    );
    expect(screen.getByText("Working fine")).toBeInTheDocument();
  });

  it("renders fallback UI when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Reload Page")).toBeInTheDocument();
  });

  it("renders custom fallback message", () => {
    render(
      <ErrorBoundary fallbackMessage="Custom error">
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText("Custom error")).toBeInTheDocument();
  });
});

describe("InlineError", () => {
  it("renders error message with retry button", () => {
    const onRetry = jest.fn();
    render(<InlineError message="Failed to load" onRetry={onRetry} />);
    expect(screen.getByText("Failed to load")).toBeInTheDocument();
    screen.getByText("Retry").click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders default message when none provided", () => {
    render(<InlineError />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });
});
