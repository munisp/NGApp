"""
Exchange Rate Service

Aggregates exchange rates from multiple providers and caches them.
Supports crypto-to-crypto and crypto-to-fiat conversions.
"""

import asyncio
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from enum import Enum
import aiohttp


class RateProvider(Enum):
    COINBASE = "coinbase"
    CIRCLE = "circle"
    AUTO = "auto"


@dataclass
class CachedRate:
    rate: float
    bid_rate: Optional[float] = None
    ask_rate: Optional[float] = None
    provider: str = ""
    timestamp: datetime = field(default_factory=datetime.now)
    expires_at: datetime = field(default_factory=lambda: datetime.now() + timedelta(minutes=5))


@dataclass
class ExchangeRateQuote:
    from_currency: str
    to_currency: str
    rate: float
    bid_rate: Optional[float] = None
    ask_rate: Optional[float] = None
    amount: float = 0.0
    converted_amount: float = 0.0
    fee: float = 0.0
    total_cost: float = 0.0
    provider: str = ""
    expires_at: datetime = field(default_factory=lambda: datetime.now() + timedelta(minutes=5))


@dataclass
class ConversionResult:
    input_amount: float
    exchange_rate: float
    exchange_fee: float
    platform_fee: float
    total_fees: float
    output_amount: float
    effective_rate: float


@dataclass
class CurrencyPair:
    from_currency: str
    to_currency: str
    provider: str


@dataclass
class CacheEntry:
    pair: str
    rate: float
    provider: str
    age_ms: int
    expires_in_ms: int


@dataclass
class CacheStats:
    size: int
    entries: List[CacheEntry]


class ExchangeRateService:
    CACHE_TTL_SECONDS = 300  # 5 minutes
    DEFAULT_PLATFORM_FEE_PERCENT = 0.5
    DEFAULT_EXCHANGE_FEE_PERCENT = 1.0

    def __init__(self):
        self._cache: Dict[str, CachedRate] = {}
        self._coinbase_api_key: Optional[str] = None
        self._circle_api_key: Optional[str] = None
        self._session: Optional[aiohttp.ClientSession] = None

    def set_coinbase_api_key(self, api_key: str) -> None:
        self._coinbase_api_key = api_key

    def set_circle_api_key(self, api_key: str) -> None:
        self._circle_api_key = api_key

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    def _get_cache_key(self, from_currency: str, to_currency: str) -> str:
        return f"{from_currency}-{to_currency}"

    def _is_cache_valid(self, cached: CachedRate) -> bool:
        return cached.expires_at > datetime.now()

    async def get_exchange_rate(
        self,
        from_currency: str,
        to_currency: str,
        amount: float,
        provider: RateProvider = RateProvider.AUTO
    ) -> ExchangeRateQuote:
        cache_key = self._get_cache_key(from_currency, to_currency)
        cached = self._cache.get(cache_key)

        if cached and self._is_cache_valid(cached):
            converted_amount = amount * cached.rate
            fee = amount * 0.01  # 1% default fee

            return ExchangeRateQuote(
                from_currency=from_currency,
                to_currency=to_currency,
                rate=cached.rate,
                bid_rate=cached.bid_rate,
                ask_rate=cached.ask_rate,
                amount=amount,
                converted_amount=converted_amount,
                fee=fee,
                total_cost=amount + fee,
                provider=cached.provider,
                expires_at=cached.expires_at
            )

        actual_provider = provider
        if provider == RateProvider.AUTO:
            actual_provider = RateProvider.CIRCLE if from_currency == "USDC" else RateProvider.COINBASE

        quote = await self._fetch_rate_from_provider(
            from_currency, to_currency, amount, actual_provider
        )

        self._cache[cache_key] = CachedRate(
            rate=quote.rate,
            bid_rate=quote.bid_rate,
            ask_rate=quote.ask_rate,
            provider=quote.provider,
            timestamp=datetime.now(),
            expires_at=quote.expires_at
        )

        return quote

    async def _fetch_rate_from_provider(
        self,
        from_currency: str,
        to_currency: str,
        amount: float,
        provider: RateProvider
    ) -> ExchangeRateQuote:
        if provider == RateProvider.CIRCLE:
            return await self._fetch_circle_rate(from_currency, to_currency, amount)
        else:
            return await self._fetch_coinbase_rate(from_currency, to_currency, amount)

    async def _fetch_coinbase_rate(
        self,
        from_currency: str,
        to_currency: str,
        amount: float
    ) -> ExchangeRateQuote:
        session = await self._get_session()

        try:
            url = f"https://api.coinbase.com/v2/exchange-rates?currency={from_currency}"
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    rates = data.get("data", {}).get("rates", {})
                    rate = float(rates.get(to_currency, 0))

                    if rate > 0:
                        converted_amount = amount * rate
                        fee = amount * 0.01

                        return ExchangeRateQuote(
                            from_currency=from_currency,
                            to_currency=to_currency,
                            rate=rate,
                            amount=amount,
                            converted_amount=converted_amount,
                            fee=fee,
                            total_cost=amount + fee,
                            provider="coinbase",
                            expires_at=datetime.now() + timedelta(seconds=self.CACHE_TTL_SECONDS)
                        )
        except Exception as e:
            print(f"[ExchangeRate] Coinbase API error: {e}")

        return self._get_fallback_rate(from_currency, to_currency, amount, "coinbase")

    async def _fetch_circle_rate(
        self,
        from_currency: str,
        to_currency: str,
        amount: float
    ) -> ExchangeRateQuote:
        if from_currency != "USDC":
            return await self._fetch_coinbase_rate(from_currency, to_currency, amount)

        rate = 1.0
        if to_currency == "NGN":
            rate = 1550.0  # Example USDC to NGN rate
        elif to_currency != "USD":
            coinbase_quote = await self._fetch_coinbase_rate("USD", to_currency, 1.0)
            rate = coinbase_quote.rate

        converted_amount = amount * rate
        fee = amount * 0.005  # 0.5% fee for USDC

        return ExchangeRateQuote(
            from_currency=from_currency,
            to_currency=to_currency,
            rate=rate,
            amount=amount,
            converted_amount=converted_amount,
            fee=fee,
            total_cost=amount + fee,
            provider="circle",
            expires_at=datetime.now() + timedelta(seconds=self.CACHE_TTL_SECONDS)
        )

    def _get_fallback_rate(
        self,
        from_currency: str,
        to_currency: str,
        amount: float,
        provider: str
    ) -> ExchangeRateQuote:
        fallback_rates = {
            ("BTC", "USD"): 43000.0,
            ("BTC", "NGN"): 66650000.0,
            ("ETH", "USD"): 2300.0,
            ("ETH", "NGN"): 3565000.0,
            ("USDC", "USD"): 1.0,
            ("USDC", "NGN"): 1550.0,
            ("USDT", "USD"): 1.0,
            ("USDT", "NGN"): 1550.0,
        }

        rate = fallback_rates.get((from_currency, to_currency), 1.0)
        converted_amount = amount * rate
        fee = amount * 0.01

        return ExchangeRateQuote(
            from_currency=from_currency,
            to_currency=to_currency,
            rate=rate,
            amount=amount,
            converted_amount=converted_amount,
            fee=fee,
            total_cost=amount + fee,
            provider=provider,
            expires_at=datetime.now() + timedelta(seconds=self.CACHE_TTL_SECONDS)
        )

    async def get_multiple_exchange_rates(
        self,
        from_currency: str,
        to_currencies: List[str],
        amount: float
    ) -> List[ExchangeRateQuote]:
        tasks = [
            self.get_exchange_rate(from_currency, to_currency, amount)
            for to_currency in to_currencies
        ]
        return await asyncio.gather(*tasks)

    def calculate_conversion(
        self,
        amount: float,
        rate: float,
        platform_fee_percent: Optional[float] = None,
        exchange_fee_percent: Optional[float] = None
    ) -> ConversionResult:
        platform_fee_pct = platform_fee_percent or self.DEFAULT_PLATFORM_FEE_PERCENT
        exchange_fee_pct = exchange_fee_percent or self.DEFAULT_EXCHANGE_FEE_PERCENT

        exchange_fee = amount * (exchange_fee_pct / 100)
        platform_fee = amount * (platform_fee_pct / 100)
        total_fees = exchange_fee + platform_fee

        amount_after_fees = amount - total_fees
        output_amount = amount_after_fees * rate
        effective_rate = output_amount / amount if amount > 0 else 0

        return ConversionResult(
            input_amount=amount,
            exchange_rate=rate,
            exchange_fee=exchange_fee,
            platform_fee=platform_fee,
            total_fees=total_fees,
            output_amount=output_amount,
            effective_rate=effective_rate
        )

    async def get_historical_rates(
        self,
        from_currency: str,
        to_currency: str,
        start_date: datetime,
        end_date: datetime
    ) -> List[Tuple[datetime, float, str]]:
        return []

    def clear_rate_cache(self) -> None:
        self._cache.clear()

    def get_cache_stats(self) -> CacheStats:
        now = datetime.now()
        entries = []

        for pair, cached in self._cache.items():
            age_ms = int((now - cached.timestamp).total_seconds() * 1000)
            expires_in_ms = int((cached.expires_at - now).total_seconds() * 1000)

            entries.append(CacheEntry(
                pair=pair,
                rate=cached.rate,
                provider=cached.provider,
                age_ms=age_ms,
                expires_in_ms=expires_in_ms
            ))

        return CacheStats(size=len(self._cache), entries=entries)

    def get_supported_pairs(self) -> List[CurrencyPair]:
        return [
            CurrencyPair("BTC", "USD", "coinbase"),
            CurrencyPair("BTC", "NGN", "coinbase"),
            CurrencyPair("ETH", "USD", "coinbase"),
            CurrencyPair("ETH", "NGN", "coinbase"),
            CurrencyPair("USDC", "USD", "circle"),
            CurrencyPair("USDC", "NGN", "circle"),
            CurrencyPair("USDT", "USD", "coinbase"),
            CurrencyPair("USDT", "NGN", "coinbase"),
            CurrencyPair("BTC", "ETH", "coinbase"),
            CurrencyPair("ETH", "BTC", "coinbase"),
            CurrencyPair("BTC", "USDC", "coinbase"),
            CurrencyPair("ETH", "USDC", "coinbase"),
        ]

    def is_pair_supported(self, from_currency: str, to_currency: str) -> bool:
        return any(
            pair.from_currency == from_currency and pair.to_currency == to_currency
            for pair in self.get_supported_pairs()
        )

    async def get_best_rate(
        self,
        from_currency: str,
        to_currency: str,
        amount: float
    ) -> ExchangeRateQuote:
        providers = [RateProvider.COINBASE, RateProvider.CIRCLE]
        quotes = []

        for provider in providers:
            try:
                quote = await self.get_exchange_rate(
                    from_currency, to_currency, amount, provider
                )
                quotes.append(quote)
            except Exception:
                continue

        if not quotes:
            raise ValueError("No providers available for this currency pair")

        return max(quotes, key=lambda q: q.converted_amount)


exchange_rate_service = ExchangeRateService()


async def get_exchange_rate(
    from_currency: str,
    to_currency: str,
    amount: float,
    provider: str = "auto"
) -> dict:
    provider_enum = RateProvider(provider) if provider != "auto" else RateProvider.AUTO
    quote = await exchange_rate_service.get_exchange_rate(
        from_currency, to_currency, amount, provider_enum
    )
    return {
        "fromCurrency": quote.from_currency,
        "toCurrency": quote.to_currency,
        "rate": quote.rate,
        "amount": quote.amount,
        "convertedAmount": quote.converted_amount,
        "fee": quote.fee,
        "totalCost": quote.total_cost,
        "provider": quote.provider,
        "expiresAt": quote.expires_at.isoformat()
    }


async def get_best_rate(
    from_currency: str,
    to_currency: str,
    amount: float
) -> dict:
    quote = await exchange_rate_service.get_best_rate(
        from_currency, to_currency, amount
    )
    return {
        "provider": quote.provider,
        "rate": quote.rate,
        "convertedAmount": quote.converted_amount,
        "fee": quote.fee,
        "totalCost": quote.total_cost
    }


def calculate_conversion(
    amount: float,
    rate: float,
    platform_fee_percent: Optional[float] = None,
    exchange_fee_percent: Optional[float] = None
) -> dict:
    result = exchange_rate_service.calculate_conversion(
        amount, rate, platform_fee_percent, exchange_fee_percent
    )
    return {
        "inputAmount": result.input_amount,
        "exchangeRate": result.exchange_rate,
        "exchangeFee": result.exchange_fee,
        "platformFee": result.platform_fee,
        "totalFees": result.total_fees,
        "outputAmount": result.output_amount,
        "effectiveRate": result.effective_rate
    }


def get_supported_pairs() -> List[dict]:
    pairs = exchange_rate_service.get_supported_pairs()
    return [
        {"from": p.from_currency, "to": p.to_currency, "provider": p.provider}
        for p in pairs
    ]


def is_pair_supported(from_currency: str, to_currency: str) -> bool:
    return exchange_rate_service.is_pair_supported(from_currency, to_currency)


def clear_rate_cache() -> None:
    exchange_rate_service.clear_rate_cache()


def get_cache_stats() -> dict:
    stats = exchange_rate_service.get_cache_stats()
    return {
        "size": stats.size,
        "entries": [
            {
                "pair": e.pair,
                "rate": e.rate,
                "provider": e.provider,
                "age": e.age_ms,
                "expiresIn": e.expires_in_ms
            }
            for e in stats.entries
        ]
    }
