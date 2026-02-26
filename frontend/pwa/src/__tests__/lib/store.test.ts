import { useMarketStore, useTradingStore, useUserStore, getMockOrderBook } from "@/lib/store";

describe("useMarketStore", () => {
  it("initializes with mock commodities", () => {
    const state = useMarketStore.getState();
    expect(state.commodities).toHaveLength(10);
    expect(state.commodities[0].symbol).toBe("MAIZE");
  });

  it("has default watchlist", () => {
    const state = useMarketStore.getState();
    expect(state.watchlist).toContain("MAIZE");
    expect(state.watchlist).toContain("GOLD");
  });

  it("toggles watchlist items", () => {
    useMarketStore.getState().toggleWatchlist("WHEAT");
    expect(useMarketStore.getState().watchlist).toContain("WHEAT");
    useMarketStore.getState().toggleWatchlist("WHEAT");
    expect(useMarketStore.getState().watchlist).not.toContain("WHEAT");
  });

  it("sets selected symbol", () => {
    useMarketStore.getState().setSelectedSymbol("GOLD");
    expect(useMarketStore.getState().selectedSymbol).toBe("GOLD");
  });
});

describe("useTradingStore", () => {
  it("initializes with mock orders", () => {
    const state = useTradingStore.getState();
    expect(state.orders.length).toBeGreaterThan(0);
  });

  it("initializes with mock positions", () => {
    const state = useTradingStore.getState();
    expect(state.positions.length).toBeGreaterThan(0);
  });

  it("adds a new order", () => {
    const before = useTradingStore.getState().orders.length;
    useTradingStore.getState().addOrder({
      id: "test-order",
      symbol: "MAIZE",
      side: "BUY",
      type: "LIMIT",
      status: "OPEN",
      quantity: 10,
      price: 280,
      filledQuantity: 0,
      averagePrice: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(useTradingStore.getState().orders.length).toBe(before + 1);
  });
});

describe("useUserStore", () => {
  it("initializes with mock user", () => {
    const state = useUserStore.getState();
    expect(state.user).toBeTruthy();
    expect(state.user?.email).toBe("trader@nexcom.exchange");
  });

  it("tracks unread notifications", () => {
    const state = useUserStore.getState();
    expect(state.unreadCount).toBeGreaterThan(0);
  });

  it("marks notifications as read", () => {
    const before = useUserStore.getState().unreadCount;
    const firstNotif = useUserStore.getState().notifications[0];
    useUserStore.getState().markRead(firstNotif.id);
    expect(useUserStore.getState().unreadCount).toBe(before - 1);
  });
});

describe("getMockOrderBook", () => {
  it("returns order book for a symbol", () => {
    const book = getMockOrderBook("MAIZE");
    expect(book.symbol).toBe("MAIZE");
    expect(book.bids.length).toBe(15);
    expect(book.asks.length).toBe(15);
    expect(book.spread).toBeGreaterThan(0);
  });

  it("has cumulative totals", () => {
    const book = getMockOrderBook("GOLD");
    for (let i = 1; i < book.bids.length; i++) {
      expect(book.bids[i].total).toBeGreaterThanOrEqual(book.bids[i - 1].total);
    }
  });
});
