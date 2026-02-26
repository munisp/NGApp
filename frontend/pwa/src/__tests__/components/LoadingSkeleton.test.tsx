import { render, screen } from "@testing-library/react";
import {
  Skeleton,
  CardSkeleton,
  TableSkeleton,
  ChartSkeleton,
  OrderBookSkeleton,
  DashboardSkeleton,
} from "@/components/common/LoadingSkeleton";

describe("LoadingSkeleton components", () => {
  it("renders Skeleton with custom className", () => {
    const { container } = render(<Skeleton className="w-32 h-4" />);
    expect(container.firstChild).toHaveClass("animate-pulse");
  });

  it("renders CardSkeleton", () => {
    const { container } = render(<CardSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders TableSkeleton with specified rows", () => {
    const { container } = render(<TableSkeleton rows={5} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders ChartSkeleton", () => {
    const { container } = render(<ChartSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders OrderBookSkeleton", () => {
    const { container } = render(<OrderBookSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders DashboardSkeleton", () => {
    const { container } = render(<DashboardSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });
});
