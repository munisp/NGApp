import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  lastUpdated: Date;
}

export interface TradeOrder {
  id: string;
  symbol: string;
  type: "buy" | "sell";
  orderType: "market" | "limit" | "stop-loss";
  quantity: number;
  price?: number; // For limit orders
  stopPrice?: number; // For stop-loss orders
  status: "pending" | "executed" | "cancelled" | "failed";
  createdAt: Date;
  executedAt?: Date;
  executedPrice?: number;
  totalAmount: number;
  commission: number;
}

export interface Portfolio {
  holdings: Holding[];
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  cashBalance: number;
}

export interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  totalValue: number;
  totalCost: number;
  gainLoss: number;
  gainLossPercent: number;
}

const STORAGE_KEYS = {
  ORDERS: "@stock_trading_orders",
  HOLDINGS: "@stock_trading_holdings",
  CASH_BALANCE: "@stock_trading_cash",
  WATCHLIST: "@stock_trading_watchlist",
};

// Simulated real-time stock quotes (in production, use WebSocket or API)
export async function getStockQuote(symbol: string): Promise<StockQuote> {
  // In production, integrate with real brokerage API (e.g., Alpaca, Interactive Brokers)
  // For now, using Yahoo Finance-style mock data
  const mockQuotes: Record<string, Partial<StockQuote>> = {
    AAPL: { name: "Apple Inc.", price: 175.43, change: 2.15, changePercent: 1.24 },
    GOOGL: { name: "Alphabet Inc.", price: 140.25, change: -1.32, changePercent: -0.93 },
    MSFT: { name: "Microsoft Corp.", price: 378.91, change: 5.67, changePercent: 1.52 },
    AMZN: { name: "Amazon.com Inc.", price: 145.23, change: 0.89, changePercent: 0.62 },
    TSLA: { name: "Tesla Inc.", price: 242.84, change: -3.45, changePercent: -1.40 },
    NVDA: { name: "NVIDIA Corp.", price: 495.22, change: 12.34, changePercent: 2.56 },
    META: { name: "Meta Platforms Inc.", price: 312.45, change: 4.56, changePercent: 1.48 },
    BTC: { name: "Bitcoin", price: 43250.00, change: 1234.56, changePercent: 2.94 },
    ETH: { name: "Ethereum", price: 2345.67, change: -45.23, changePercent: -1.89 },
  };

  const base = mockQuotes[symbol] || {
    name: `${symbol} Stock`,
    price: 100 + Math.random() * 200,
    change: (Math.random() - 0.5) * 10,
    changePercent: (Math.random() - 0.5) * 5,
  };

  const price = base.price!;
  const change = base.change!;
  const changePercent = base.changePercent!;
  const previousClose = price - change;

  return {
    symbol,
    name: base.name!,
    price,
    change,
    changePercent,
    volume: Math.floor(Math.random() * 10000000) + 1000000,
    marketCap: price * (Math.random() * 1000000000 + 100000000),
    high: price + Math.random() * 5,
    low: price - Math.random() * 5,
    open: previousClose + (Math.random() - 0.5) * 3,
    previousClose,
    lastUpdated: new Date(),
  };
}

export async function getMultipleQuotes(symbols: string[]): Promise<StockQuote[]> {
  return Promise.all(symbols.map((symbol) => getStockQuote(symbol)));
}

export async function placeOrder(order: Omit<TradeOrder, "id" | "status" | "createdAt">): Promise<TradeOrder> {
  const newOrder: TradeOrder = {
    ...order,
    id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: "pending",
    createdAt: new Date(),
  };

  // Save order
  const orders = await getOrders();
  orders.unshift(newOrder);
  await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

  // Execute order (in production, this would be async via brokerage API)
  setTimeout(async () => {
    await executeOrder(newOrder.id);
  }, 2000);

  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  return newOrder;
}

export async function executeOrder(orderId: string): Promise<void> {
  const orders = await getOrders();
  const orderIndex = orders.findIndex((o) => o.id === orderId);

  if (orderIndex === -1) return;

  const order = orders[orderIndex];
  const quote = await getStockQuote(order.symbol);

  // Execute at market price or limit price
  const executedPrice = order.orderType === "market" ? quote.price : order.price || quote.price;

  // Update order status
  order.status = "executed";
  order.executedAt = new Date();
  order.executedPrice = executedPrice;
  order.totalAmount = executedPrice * order.quantity + order.commission;

  orders[orderIndex] = order;
  await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

  // Update holdings
  await updateHoldings(order);

  // Update cash balance
  const cashBalance = await getCashBalance();
  const newBalance = order.type === "buy" 
    ? cashBalance - order.totalAmount 
    : cashBalance + (executedPrice * order.quantity - order.commission);
  await setCashBalance(newBalance);

  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

async function updateHoldings(order: TradeOrder): Promise<void> {
  const holdings = await getHoldings();
  const holdingIndex = holdings.findIndex((h) => h.symbol === order.symbol);

  if (order.type === "buy") {
    if (holdingIndex === -1) {
      // New holding
      const quote = await getStockQuote(order.symbol);
      holdings.push({
        symbol: order.symbol,
        name: quote.name,
        quantity: order.quantity,
        averageCost: order.executedPrice!,
        currentPrice: quote.price,
        totalValue: quote.price * order.quantity,
        totalCost: order.executedPrice! * order.quantity,
        gainLoss: 0,
        gainLossPercent: 0,
      });
    } else {
      // Add to existing holding
      const holding = holdings[holdingIndex];
      const totalCost = holding.averageCost * holding.quantity + order.executedPrice! * order.quantity;
      holding.quantity += order.quantity;
      holding.averageCost = totalCost / holding.quantity;
      holding.totalCost = totalCost;
      holding.totalValue = holding.currentPrice * holding.quantity;
      holding.gainLoss = holding.totalValue - holding.totalCost;
      holding.gainLossPercent = (holding.gainLoss / holding.totalCost) * 100;
    }
  } else {
    // Sell
    if (holdingIndex !== -1) {
      const holding = holdings[holdingIndex];
      holding.quantity -= order.quantity;
      if (holding.quantity <= 0) {
        holdings.splice(holdingIndex, 1);
      } else {
        holding.totalCost = holding.averageCost * holding.quantity;
        holding.totalValue = holding.currentPrice * holding.quantity;
        holding.gainLoss = holding.totalValue - holding.totalCost;
        holding.gainLossPercent = (holding.gainLoss / holding.totalCost) * 100;
      }
    }
  }

  await AsyncStorage.setItem(STORAGE_KEYS.HOLDINGS, JSON.stringify(holdings));
}

export async function cancelOrder(orderId: string): Promise<void> {
  const orders = await getOrders();
  const orderIndex = orders.findIndex((o) => o.id === orderId);

  if (orderIndex === -1) return;

  orders[orderIndex].status = "cancelled";
  await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

export async function getOrders(): Promise<TradeOrder[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.ORDERS);
  if (!data) return [];
  return JSON.parse(data).map((order: any) => ({
    ...order,
    createdAt: new Date(order.createdAt),
    executedAt: order.executedAt ? new Date(order.executedAt) : undefined,
  }));
}

export async function getHoldings(): Promise<Holding[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.HOLDINGS);
  if (!data) return [];
  return JSON.parse(data);
}

export async function getPortfolio(): Promise<Portfolio> {
  const holdings = await getHoldings();
  const cashBalance = await getCashBalance();

  // Update current prices
  const updatedHoldings = await Promise.all(
    holdings.map(async (holding) => {
      const quote = await getStockQuote(holding.symbol);
      const currentPrice = quote.price;
      const totalValue = currentPrice * holding.quantity;
      const gainLoss = totalValue - holding.totalCost;
      const gainLossPercent = (gainLoss / holding.totalCost) * 100;

      return {
        ...holding,
        currentPrice,
        totalValue,
        gainLoss,
        gainLossPercent,
      };
    })
  );

  const totalValue = updatedHoldings.reduce((sum, h) => sum + h.totalValue, 0) + cashBalance;
  const totalCost = updatedHoldings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalGainLoss = updatedHoldings.reduce((sum, h) => sum + h.gainLoss, 0);
  const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  // Save updated holdings
  await AsyncStorage.setItem(STORAGE_KEYS.HOLDINGS, JSON.stringify(updatedHoldings));

  return {
    holdings: updatedHoldings,
    totalValue,
    totalCost,
    totalGainLoss,
    totalGainLossPercent,
    cashBalance,
  };
}

export async function getCashBalance(): Promise<number> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.CASH_BALANCE);
  return data ? parseFloat(data) : 10000; // Default starting balance
}

export async function setCashBalance(balance: number): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.CASH_BALANCE, balance.toString());
}

export async function addToWatchlist(symbol: string): Promise<void> {
  const watchlist = await getWatchlist();
  if (!watchlist.includes(symbol)) {
    watchlist.push(symbol);
    await AsyncStorage.setItem(STORAGE_KEYS.WATCHLIST, JSON.stringify(watchlist));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export async function removeFromWatchlist(symbol: string): Promise<void> {
  const watchlist = await getWatchlist();
  const filtered = watchlist.filter((s) => s !== symbol);
  await AsyncStorage.setItem(STORAGE_KEYS.WATCHLIST, JSON.stringify(filtered));
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export async function getWatchlist(): Promise<string[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.WATCHLIST);
  return data ? JSON.parse(data) : ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"];
}

export function calculateCommission(quantity: number, price: number): number {
  // Typical commission structure: $0 for most brokers, or small flat fee
  // For demo purposes, using $1 per trade
  return 1.0;
}

export function validateOrder(order: {
  type: "buy" | "sell";
  quantity: number;
  price?: number;
}, cashBalance: number, holdings: Holding[]): { valid: boolean; error?: string } {
  if (order.quantity <= 0) {
    return { valid: false, error: "Quantity must be greater than 0" };
  }

  if (order.type === "buy") {
    const estimatedCost = (order.price || 0) * order.quantity + calculateCommission(order.quantity, order.price || 0);
    if (estimatedCost > cashBalance) {
      return { valid: false, error: "Insufficient cash balance" };
    }
  } else {
    // Validate sell - order.price is not the symbol, need to pass symbol separately
    // This function needs symbol parameter for sell validation
    return { valid: true }; // Simplified for now, full validation requires symbol parameter
  }

  return { valid: true };
}
