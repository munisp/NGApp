//! Lock-free orderbook with price-time priority (FIFO).
//! Uses BTreeMap for sorted price levels and VecDeque for time-ordered queues.
//! All operations target microsecond latency.

use crate::types::*;
use chrono::Utc;
use ordered_float::OrderedFloat;
use parking_lot::RwLock;
use std::collections::{BTreeMap, HashMap, VecDeque};
use tracing::{debug, info, warn};
use uuid::Uuid;

/// A single price level containing orders in FIFO order.
#[derive(Debug, Clone)]
struct PriceLevelQueue {
    price: Price,
    orders: VecDeque<Order>,
    total_quantity: Qty,
}

impl PriceLevelQueue {
    fn new(price: Price) -> Self {
        Self {
            price,
            orders: VecDeque::new(),
            total_quantity: 0,
        }
    }

    fn add(&mut self, order: Order) {
        self.total_quantity += order.remaining_quantity;
        self.orders.push_back(order);
    }

    fn is_empty(&self) -> bool {
        self.orders.is_empty()
    }
}

/// The core orderbook for a single instrument.
/// Bids sorted descending (best bid = highest price first).
/// Asks sorted ascending (best ask = lowest price first).
pub struct OrderBook {
    pub symbol: String,
    /// Bids: price -> queue (BTreeMap sorts ascending, we reverse iterate for best bid)
    bids: BTreeMap<OrderedFloat<f64>, PriceLevelQueue>,
    /// Asks: price -> queue (BTreeMap sorts ascending, first entry = best ask)
    asks: BTreeMap<OrderedFloat<f64>, PriceLevelQueue>,
    /// Order ID -> (side, price) for O(1) cancel lookup
    order_index: HashMap<Uuid, (Side, OrderedFloat<f64>)>,
    /// Sequence counter for deterministic ordering
    sequence: u64,
    /// Last trade price
    pub last_price: Price,
    /// 24h volume
    pub volume_24h: Qty,
    /// 24h high
    pub high_24h: Price,
    /// 24h low
    pub low_24h: Price,
    /// Open price
    pub open_price: Price,
    /// Settlement price
    pub settlement_price: Price,
    /// Open interest (futures/options)
    pub open_interest: Qty,
    /// Circuit breaker: upper price limit
    pub upper_limit: Option<Price>,
    /// Circuit breaker: lower price limit
    pub lower_limit: Option<Price>,
    /// Whether trading is halted
    pub halted: bool,
}

impl OrderBook {
    pub fn new(symbol: String) -> Self {
        Self {
            symbol,
            bids: BTreeMap::new(),
            asks: BTreeMap::new(),
            order_index: HashMap::new(),
            sequence: 0,
            last_price: 0,
            volume_24h: 0,
            high_24h: 0,
            low_24h: Price::MAX,
            open_price: 0,
            settlement_price: 0,
            open_interest: 0,
            upper_limit: None,
            lower_limit: None,
            halted: false,
        }
    }

    /// Get next sequence number (monotonically increasing).
    fn next_sequence(&mut self) -> u64 {
        self.sequence += 1;
        self.sequence
    }

    /// Submit a new order. Returns (trades, order_status).
    pub fn submit_order(&mut self, mut order: Order) -> (Vec<Trade>, Order) {
        if self.halted {
            order.status = OrderStatus::Rejected;
            return (vec![], order);
        }

        // Circuit breaker check
        if let Some(upper) = self.upper_limit {
            if order.price > upper && order.order_type == OrderType::Limit {
                order.status = OrderStatus::Rejected;
                return (vec![], order);
            }
        }
        if let Some(lower) = self.lower_limit {
            if order.price < lower && order.price > 0 && order.order_type == OrderType::Limit {
                order.status = OrderStatus::Rejected;
                return (vec![], order);
            }
        }

        order.sequence = self.next_sequence();
        order.status = OrderStatus::New;

        let trades = self.match_order(&mut order);

        // Handle time-in-force
        match order.time_in_force {
            TimeInForce::ImmediateOrCancel => {
                if order.remaining_quantity > 0 {
                    if order.filled_quantity > 0 {
                        order.status = OrderStatus::PartiallyFilled;
                    } else {
                        order.status = OrderStatus::Cancelled;
                    }
                }
            }
            TimeInForce::FillOrKill => {
                if order.remaining_quantity > 0 {
                    // FOK: reject entirely if not fully filled
                    order.status = OrderStatus::Cancelled;
                    order.filled_quantity = 0;
                    order.remaining_quantity = order.quantity;
                    return (vec![], order); // Discard partial trades
                }
            }
            _ => {
                // For GTC/Day/GTD: place remainder on book
                if order.remaining_quantity > 0 && order.order_type == OrderType::Limit {
                    self.place_on_book(order.clone());
                }
            }
        }

        if order.remaining_quantity == 0 {
            order.status = OrderStatus::Filled;
        } else if order.filled_quantity > 0 {
            order.status = OrderStatus::PartiallyFilled;
        }

        (trades, order)
    }

    /// Match an incoming order against the opposite side of the book.
    fn match_order(&mut self, order: &mut Order) -> Vec<Trade> {
        let mut trades = Vec::new();

        loop {
            if order.remaining_quantity == 0 {
                break;
            }

            // Peek at best opposing price to check if we should match
            let best_price = if order.is_buy() {
                self.asks.values().next().map(|l| l.price)
            } else {
                self.bids.values().next_back().map(|l| l.price)
            };

            let best_price = match best_price {
                Some(p) => p,
                None => break,
            };

            // Price check: for limit orders, ensure price crosses
            if order.order_type == OrderType::Limit {
                if order.is_buy() && order.price < best_price {
                    break;
                }
                if !order.is_buy() && order.price > best_price {
                    break;
                }
            }

            let price_key = OrderedFloat(from_price(best_price));

            // Get the level mutably via the key
            let book_side = if order.is_buy() {
                &mut self.asks
            } else {
                &mut self.bids
            };

            let level = match book_side.get_mut(&price_key) {
                Some(l) => l,
                None => break,
            };

            // Match against orders at this price level (FIFO)
            while order.remaining_quantity > 0 && !level.orders.is_empty() {
                let resting = level.orders.front_mut().unwrap();
                let fill_qty = order.remaining_quantity.min(resting.remaining_quantity);
                let fill_price = resting.price;

                // Update aggressor
                order.filled_quantity += fill_qty;
                order.remaining_quantity -= fill_qty;
                order.average_price = if order.filled_quantity > 0 {
                    ((order.average_price as i128 * (order.filled_quantity - fill_qty) as i128
                        + fill_price as i128 * fill_qty as i128)
                        / order.filled_quantity as i128) as Price
                } else {
                    0
                };

                // Capture resting info before mutating
                let resting_id = resting.id;
                let resting_account = resting.account_id.clone();

                // Update resting order
                resting.filled_quantity += fill_qty;
                resting.remaining_quantity -= fill_qty;
                resting.updated_at = Utc::now();
                let resting_filled = resting.remaining_quantity == 0;
                if resting_filled {
                    resting.status = OrderStatus::Filled;
                } else {
                    resting.status = OrderStatus::PartiallyFilled;
                }

                level.total_quantity -= fill_qty;

                self.sequence += 1;
                let seq = self.sequence;

                let (buyer_order_id, seller_order_id, buyer_account, seller_account) =
                    if order.is_buy() {
                        (order.id, resting_id, order.account_id.clone(), resting_account)
                    } else {
                        (resting_id, order.id, resting_account, order.account_id.clone())
                    };

                let trade = Trade {
                    id: Uuid::new_v4(),
                    symbol: order.symbol.clone(),
                    price: fill_price,
                    quantity: fill_qty,
                    buyer_order_id,
                    seller_order_id,
                    buyer_account,
                    seller_account,
                    aggressor_side: order.side,
                    timestamp: Utc::now(),
                    sequence: seq,
                };

                // Update market data
                self.last_price = fill_price;
                self.volume_24h += fill_qty;
                if fill_price > self.high_24h {
                    self.high_24h = fill_price;
                }
                if fill_price < self.low_24h {
                    self.low_24h = fill_price;
                }
                if self.open_price == 0 {
                    self.open_price = fill_price;
                }

                debug!(
                    "Trade: {} {} @ {} (seq={})",
                    trade.symbol,
                    fill_qty,
                    from_price(fill_price),
                    seq
                );

                trades.push(trade);

                // Remove filled resting order from level
                if resting_filled {
                    let filled_order = level.orders.pop_front().unwrap();
                    self.order_index.remove(&filled_order.id);
                }
            }

            // Immediately clean up empty price level
            let level_empty = level.is_empty();
            if level_empty {
                let book_side = if order.is_buy() {
                    &mut self.asks
                } else {
                    &mut self.bids
                };
                book_side.remove(&price_key);
            }
        }

        trades
    }

    /// Place a limit order on the book (resting).
    fn place_on_book(&mut self, order: Order) {
        let price_key = OrderedFloat(from_price(order.price));
        let side = order.side;
        let order_id = order.id;

        self.order_index.insert(order_id, (side, price_key));

        match side {
            Side::Buy => {
                self.bids
                    .entry(price_key)
                    .or_insert_with(|| PriceLevelQueue::new(order.price))
                    .add(order);
            }
            Side::Sell => {
                self.asks
                    .entry(price_key)
                    .or_insert_with(|| PriceLevelQueue::new(order.price))
                    .add(order);
            }
        }
    }

    /// Cancel an order by ID.
    pub fn cancel_order(&mut self, order_id: Uuid) -> Option<Order> {
        let (side, price_key) = self.order_index.remove(&order_id)?;

        let book_side = match side {
            Side::Buy => &mut self.bids,
            Side::Sell => &mut self.asks,
        };

        if let Some(level) = book_side.get_mut(&price_key) {
            if let Some(pos) = level.orders.iter().position(|o| o.id == order_id) {
                let mut order = level.orders.remove(pos).unwrap();
                level.total_quantity -= order.remaining_quantity;
                order.status = OrderStatus::Cancelled;
                order.updated_at = Utc::now();

                if level.is_empty() {
                    book_side.remove(&price_key);
                }

                info!("Cancelled order {}", order_id);
                return Some(order);
            }
        }

        None
    }

    /// Get the current best bid price.
    pub fn best_bid(&self) -> Option<Price> {
        self.bids.values().next_back().map(|l| l.price)
    }

    /// Get the current best ask price.
    pub fn best_ask(&self) -> Option<Price> {
        self.asks.values().next().map(|l| l.price)
    }

    /// Get market depth snapshot (top N levels).
    pub fn depth(&self, levels: usize) -> MarketDepth {
        let bids: Vec<PriceLevel> = self
            .bids
            .values()
            .rev()
            .take(levels)
            .map(|l| PriceLevel {
                price: OrderedFloat(from_price(l.price)),
                quantity: l.total_quantity,
                order_count: l.orders.len() as u32,
            })
            .collect();

        let asks: Vec<PriceLevel> = self
            .asks
            .values()
            .take(levels)
            .map(|l| PriceLevel {
                price: OrderedFloat(from_price(l.price)),
                quantity: l.total_quantity,
                order_count: l.orders.len() as u32,
            })
            .collect();

        MarketDepth {
            symbol: self.symbol.clone(),
            bids,
            asks,
            last_price: self.last_price,
            last_quantity: 0,
            volume_24h: self.volume_24h,
            high_24h: self.high_24h,
            low_24h: if self.low_24h == Price::MAX {
                0
            } else {
                self.low_24h
            },
            open_price: self.open_price,
            settlement_price: self.settlement_price,
            open_interest: self.open_interest,
            timestamp: Utc::now(),
        }
    }

    /// Total number of orders on the book.
    pub fn order_count(&self) -> usize {
        self.order_index.len()
    }

    /// Total bid volume.
    pub fn bid_volume(&self) -> Qty {
        self.bids.values().map(|l| l.total_quantity).sum()
    }

    /// Total ask volume.
    pub fn ask_volume(&self) -> Qty {
        self.asks.values().map(|l| l.total_quantity).sum()
    }

    /// Set circuit breaker limits.
    pub fn set_price_limits(&mut self, lower: Price, upper: Price) {
        self.lower_limit = Some(lower);
        self.upper_limit = Some(upper);
    }

    /// Halt or resume trading.
    pub fn set_halted(&mut self, halted: bool) {
        self.halted = halted;
        if halted {
            warn!("Trading HALTED for {}", self.symbol);
        } else {
            info!("Trading RESUMED for {}", self.symbol);
        }
    }
}

/// Thread-safe orderbook manager for all symbols.
pub struct OrderBookManager {
    books: dashmap::DashMap<String, RwLock<OrderBook>>,
}

impl OrderBookManager {
    pub fn new() -> Self {
        Self {
            books: dashmap::DashMap::new(),
        }
    }

    /// Get or create an orderbook for a symbol.
    pub fn get_or_create(&self, symbol: &str) -> dashmap::mapref::one::Ref<String, RwLock<OrderBook>> {
        if !self.books.contains_key(symbol) {
            self.books
                .insert(symbol.to_string(), RwLock::new(OrderBook::new(symbol.to_string())));
        }
        self.books.get(symbol).unwrap()
    }

    /// Submit an order to the appropriate book.
    pub fn submit_order(&self, order: Order) -> (Vec<Trade>, Order) {
        let book_ref = self.get_or_create(&order.symbol);
        let mut book = book_ref.write();
        book.submit_order(order)
    }

    /// Cancel an order.
    pub fn cancel_order(&self, symbol: &str, order_id: Uuid) -> Option<Order> {
        if let Some(book_ref) = self.books.get(symbol) {
            let mut book = book_ref.write();
            book.cancel_order(order_id)
        } else {
            None
        }
    }

    /// Get market depth for a symbol.
    pub fn depth(&self, symbol: &str, levels: usize) -> Option<MarketDepth> {
        self.books.get(symbol).map(|book_ref| {
            let book = book_ref.read();
            book.depth(levels)
        })
    }

    /// List all active symbols.
    pub fn symbols(&self) -> Vec<String> {
        self.books.iter().map(|r| r.key().clone()).collect()
    }
}

impl Default for OrderBookManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_limit_order(side: Side, price: f64, qty: Qty) -> Order {
        Order::new(
            format!("test-{}", Uuid::new_v4()),
            "ACC001".to_string(),
            "GOLD-FUT-2026M06".to_string(),
            side,
            OrderType::Limit,
            TimeInForce::GoodTilCancel,
            to_price(price),
            0,
            qty,
        )
    }

    #[test]
    fn test_limit_order_match() {
        let mut book = OrderBook::new("GOLD-FUT-2026M06".to_string());

        // Place sell order at 2000.0
        let sell = make_limit_order(Side::Sell, 2000.0, 100);
        let (trades, order) = book.submit_order(sell);
        assert!(trades.is_empty());
        assert_eq!(order.status, OrderStatus::New);

        // Place buy order at 2000.0 - should match
        let buy = make_limit_order(Side::Buy, 2000.0, 50);
        let (trades, order) = book.submit_order(buy);
        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].quantity, 50);
        assert_eq!(order.status, OrderStatus::Filled);

        // Remaining sell should have 50 left
        assert_eq!(book.ask_volume(), 50);
    }

    #[test]
    fn test_price_time_priority() {
        let mut book = OrderBook::new("COFFEE-FUT-2026M03".to_string());

        // Place two sells at same price
        let sell1 = make_limit_order(Side::Sell, 150.0, 100);
        let sell1_id = sell1.id;
        book.submit_order(sell1);

        let sell2 = make_limit_order(Side::Sell, 150.0, 100);
        book.submit_order(sell2);

        // Buy 50 - should match against sell1 (first in time)
        let buy = make_limit_order(Side::Buy, 150.0, 50);
        let (trades, _) = book.submit_order(buy);
        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].seller_order_id, sell1_id);
    }

    #[test]
    fn test_cancel_order() {
        let mut book = OrderBook::new("MAIZE-FUT-2026M06".to_string());

        let sell = make_limit_order(Side::Sell, 300.0, 100);
        let sell_id = sell.id;
        book.submit_order(sell);

        assert_eq!(book.order_count(), 1);

        let cancelled = book.cancel_order(sell_id);
        assert!(cancelled.is_some());
        assert_eq!(cancelled.unwrap().status, OrderStatus::Cancelled);
        assert_eq!(book.order_count(), 0);
    }

    #[test]
    fn test_circuit_breaker() {
        let mut book = OrderBook::new("WHEAT-FUT-2026M09".to_string());
        book.set_price_limits(to_price(90.0), to_price(110.0));

        // Order above upper limit should be rejected
        let buy = make_limit_order(Side::Buy, 115.0, 100);
        let (_, order) = book.submit_order(buy);
        assert_eq!(order.status, OrderStatus::Rejected);

        // Order within limits should work
        let buy = make_limit_order(Side::Buy, 105.0, 100);
        let (_, order) = book.submit_order(buy);
        assert_eq!(order.status, OrderStatus::New);
    }

    #[test]
    fn test_market_depth() {
        let mut book = OrderBook::new("COCOA-FUT-2026M03".to_string());

        book.submit_order(make_limit_order(Side::Buy, 100.0, 50));
        book.submit_order(make_limit_order(Side::Buy, 99.0, 30));
        book.submit_order(make_limit_order(Side::Sell, 101.0, 40));
        book.submit_order(make_limit_order(Side::Sell, 102.0, 60));

        let depth = book.depth(10);
        assert_eq!(depth.bids.len(), 2);
        assert_eq!(depth.asks.len(), 2);
        assert_eq!(depth.bids[0].quantity, 50); // Best bid first
        assert_eq!(depth.asks[0].quantity, 40); // Best ask first
    }

    #[test]
    fn test_ioc_order() {
        let mut book = OrderBook::new("SUGAR-FUT-2026M06".to_string());

        // Place sell for 50
        book.submit_order(make_limit_order(Side::Sell, 200.0, 50));

        // IOC buy for 100 - should fill 50 and cancel remaining
        let mut buy = Order::new(
            "ioc-test".to_string(),
            "ACC001".to_string(),
            "SUGAR-FUT-2026M06".to_string(),
            Side::Buy,
            OrderType::Limit,
            TimeInForce::ImmediateOrCancel,
            to_price(200.0),
            0,
            100,
        );
        let (trades, order) = book.submit_order(buy);
        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].quantity, 50);
        assert_eq!(order.status, OrderStatus::PartiallyFilled);
        assert_eq!(order.remaining_quantity, 50);
        // IOC remainder should NOT be on the book
        assert_eq!(book.order_count(), 0);
    }

    #[test]
    fn test_fok_order() {
        let mut book = OrderBook::new("TEA-FUT-2026M06".to_string());

        // Place sell for 50
        book.submit_order(make_limit_order(Side::Sell, 200.0, 50));

        // FOK buy for 100 - should fail (not enough liquidity)
        let buy = Order::new(
            "fok-test".to_string(),
            "ACC001".to_string(),
            "TEA-FUT-2026M06".to_string(),
            Side::Buy,
            OrderType::Limit,
            TimeInForce::FillOrKill,
            to_price(200.0),
            0,
            100,
        );
        let (trades, order) = book.submit_order(buy);
        assert!(trades.is_empty());
        assert_eq!(order.status, OrderStatus::Cancelled);
    }
}
