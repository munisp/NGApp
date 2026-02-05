/**
 * African Stock Markets Data Service
 * Provides real-time and historical stock data from African exchanges
 * Uses Yahoo Finance API for global coverage including African markets
 */

import { router, publicProcedure } from '../_core/trpc';
import { z } from 'zod';
import { callDataApi } from '../_core/dataApi';

// African stock symbols by exchange
const AFRICAN_STOCKS = {
  // Nigerian Stock Exchange (NSE)
  nigeria: [
    { symbol: 'DANGCEM.LG', name: 'Dangote Cement', exchange: 'NSE' },
    { symbol: 'BUACEMENT.LG', name: 'BUA Cement', exchange: 'NSE' },
    { symbol: 'MTNN.LG', name: 'MTN Nigeria', exchange: 'NSE' },
    { symbol: 'AIRTELAFRI.LG', name: 'Airtel Africa', exchange: 'NSE' },
    { symbol: 'ZENITHBANK.LG', name: 'Zenith Bank', exchange: 'NSE' },
    { symbol: 'GTCO.LG', name: 'Guaranty Trust Bank', exchange: 'NSE' },
    { symbol: 'UBA.LG', name: 'United Bank for Africa', exchange: 'NSE' },
    { symbol: 'ACCESSCORP.LG', name: 'Access Holdings', exchange: 'NSE' },
    { symbol: 'FBNH.LG', name: 'FBN Holdings', exchange: 'NSE' },
    { symbol: 'NESTLE.LG', name: 'Nestle Nigeria', exchange: 'NSE' },
  ],
  
  // Nairobi Securities Exchange (NSE Kenya)
  kenya: [
    { symbol: 'SCOM.NR', name: 'Safaricom', exchange: 'NSE Kenya' },
    { symbol: 'EQTY.NR', name: 'Equity Group Holdings', exchange: 'NSE Kenya' },
    { symbol: 'KCB.NR', name: 'KCB Group', exchange: 'NSE Kenya' },
    { symbol: 'EABL.NR', name: 'East African Breweries', exchange: 'NSE Kenya' },
    { symbol: 'BAT.NR', name: 'British American Tobacco Kenya', exchange: 'NSE Kenya' },
    { symbol: 'SCBK.NR', name: 'Standard Chartered Bank Kenya', exchange: 'NSE Kenya' },
    { symbol: 'ABSA.NR', name: 'Absa Bank Kenya', exchange: 'NSE Kenya' },
    { symbol: 'COOP.NR', name: 'Co-operative Bank of Kenya', exchange: 'NSE Kenya' },
  ],
  
  // Johannesburg Stock Exchange (JSE)
  south_africa: [
    { symbol: 'NPN.JO', name: 'Naspers', exchange: 'JSE' },
    { symbol: 'PRX.JO', name: 'Prosus', exchange: 'JSE' },
    { symbol: 'BHP.JO', name: 'BHP Group', exchange: 'JSE' },
    { symbol: 'AGL.JO', name: 'Anglo American', exchange: 'JSE' },
    { symbol: 'SOL.JO', name: 'Sasol', exchange: 'JSE' },
    { symbol: 'SBK.JO', name: 'Standard Bank Group', exchange: 'JSE' },
    { symbol: 'FSR.JO', name: 'FirstRand', exchange: 'JSE' },
    { symbol: 'ABG.JO', name: 'Absa Group', exchange: 'JSE' },
    { symbol: 'NED.JO', name: 'Nedbank Group', exchange: 'JSE' },
    { symbol: 'MTN.JO', name: 'MTN Group', exchange: 'JSE' },
    { symbol: 'VOD.JO', name: 'Vodacom Group', exchange: 'JSE' },
    { symbol: 'SHP.JO', name: 'Shoprite Holdings', exchange: 'JSE' },
  ],
  
  // Ghana Stock Exchange (GSE)
  ghana: [
    { symbol: 'MTNGH.GH', name: 'MTN Ghana', exchange: 'GSE' },
    { symbol: 'TOTAL.GH', name: 'TotalEnergies Ghana', exchange: 'GSE' },
    { symbol: 'GCB.GH', name: 'GCB Bank', exchange: 'GSE' },
    { symbol: 'CAL.GH', name: 'CAL Bank', exchange: 'GSE' },
    { symbol: 'FML.GH', name: 'Fan Milk', exchange: 'GSE' },
  ],
};

// Market indices
const AFRICAN_INDICES = {
  nigeria: { symbol: '^NSEASI', name: 'NSE All-Share Index' },
  kenya: { symbol: '^NSEI', name: 'NSE 20 Share Index' },
  south_africa: { symbol: '^J203', name: 'JSE All-Share Index' },
};

export const africanMarketsRouter = router({
  // Get list of available stocks by country
  getStocksByCountry: publicProcedure
    .input(z.object({
      country: z.enum(['nigeria', 'kenya', 'south_africa', 'ghana']),
    }))
    .query(async ({ input }) => {
      return {
        country: input.country,
        stocks: AFRICAN_STOCKS[input.country] || [],
        index: AFRICAN_INDICES[input.country as keyof typeof AFRICAN_INDICES] || null,
      };
    }),

  // Get all African stocks
  getAllStocks: publicProcedure.query(async () => {
    const allStocks = Object.entries(AFRICAN_STOCKS).map(([country, stocks]) => ({
      country,
      stocks,
      index: AFRICAN_INDICES[country as keyof typeof AFRICAN_INDICES] || null,
    }));
    
    return {
      total_stocks: Object.values(AFRICAN_STOCKS).reduce((sum, stocks) => sum + stocks.length, 0),
      markets: allStocks,
    };
  }),

  // Get real-time stock price
  getStockPrice: publicProcedure
    .input(z.object({
      symbol: z.string(),
      region: z.string().optional().default('US'),
    }))
    .query(async ({ input }) => {
      try {
        const response = await callDataApi('YahooFinance/get_stock_chart', {
          query: {
            symbol: input.symbol,
            region: input.region,
            interval: '1d',
            range: '1d',
            includeAdjustedClose: true,
          },
        });

        if (response && (response as any).chart && (response as any).chart.result && (response as any).chart.result.length > 0) {
          const result = (response as any).chart.result[0];
          const meta = result.meta;
          
          return {
            symbol: meta.symbol,
            name: meta.longName || meta.symbol,
            exchange: meta.exchangeName,
            currency: meta.currency,
            price: meta.regularMarketPrice,
            change: meta.regularMarketPrice - meta.previousClose,
            change_percent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
            day_high: meta.regularMarketDayHigh,
            day_low: meta.regularMarketDayLow,
            volume: meta.regularMarketVolume,
            market_cap: meta.marketCap,
            fifty_two_week_high: meta.fiftyTwoWeekHigh,
            fifty_two_week_low: meta.fiftyTwoWeekLow,
            timestamp: meta.regularMarketTime,
          };
        }

        throw new Error('No data available for this stock');
      } catch (error) {
        console.error(`Error fetching stock price for ${input.symbol}:`, error);
        throw new Error(`Failed to fetch stock price: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  // Get historical stock data
  getHistoricalData: publicProcedure
    .input(z.object({
      symbol: z.string(),
      region: z.string().optional().default('US'),
      interval: z.enum(['1d', '1wk', '1mo']).optional().default('1d'),
      range: z.enum(['1mo', '3mo', '6mo', '1y', '2y', '5y']).optional().default('1y'),
    }))
    .query(async ({ input }) => {
      try {
        const response = await callDataApi('YahooFinance/get_stock_chart', {
          query: {
            symbol: input.symbol,
            region: input.region,
            interval: input.interval,
            range: input.range,
            includeAdjustedClose: true,
            events: 'div,split',
          },
        });

        if (response && (response as any).chart && (response as any).chart.result && (response as any).chart.result.length > 0) {
          const result = (response as any).chart.result[0];
          const meta = result.meta;
          const timestamps = result.timestamp;
          const quotes = result.indicators.quote[0];
          
          // Convert to array of price data
          const priceData = timestamps.map((timestamp: number, index: number) => ({
            date: new Date(timestamp * 1000).toISOString(),
            timestamp,
            open: quotes.open[index],
            high: quotes.high[index],
            low: quotes.low[index],
            close: quotes.close[index],
            volume: quotes.volume[index],
          })).filter((item: any) => item.close !== null);

          return {
            symbol: meta.symbol,
            name: meta.longName || meta.symbol,
            exchange: meta.exchangeName,
            currency: meta.currency,
            interval: input.interval,
            range: input.range,
            data_points: priceData.length,
            price_data: priceData,
          };
        }

        throw new Error('No historical data available for this stock');
      } catch (error) {
        console.error(`Error fetching historical data for ${input.symbol}:`, error);
        throw new Error(`Failed to fetch historical data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  // Get market index data
  getMarketIndex: publicProcedure
    .input(z.object({
      country: z.enum(['nigeria', 'kenya', 'south_africa']),
      range: z.enum(['1d', '5d', '1mo', '3mo', '6mo', '1y']).optional().default('1mo'),
    }))
    .query(async ({ input }) => {
      const index = AFRICAN_INDICES[input.country];
      
      if (!index) {
        throw new Error(`No index available for ${input.country}`);
      }

      try {
        const response = await callDataApi('YahooFinance/get_stock_chart', {
          query: {
            symbol: index.symbol,
            region: 'US',
            interval: '1d',
            range: input.range,
            includeAdjustedClose: true,
          },
        });

        if (response && (response as any).chart && (response as any).chart.result && (response as any).chart.result.length > 0) {
          const result = (response as any).chart.result[0];
          const meta = result.meta;
          const timestamps = result.timestamp;
          const quotes = result.indicators.quote[0];
          
          // Get latest and first values for change calculation
          const latestClose = quotes.close[quotes.close.length - 1];
          const firstClose = quotes.close[0];
          
          const priceData = timestamps.map((timestamp: number, index: number) => ({
            date: new Date(timestamp * 1000).toISOString(),
            timestamp,
            value: quotes.close[index],
            volume: quotes.volume[index],
          })).filter((item: any) => item.value !== null);

          return {
            country: input.country,
            index_name: index.name,
            symbol: index.symbol,
            current_value: latestClose,
            change: latestClose - firstClose,
            change_percent: ((latestClose - firstClose) / firstClose) * 100,
            range: input.range,
            data_points: priceData.length,
            price_data: priceData,
          };
        }

        throw new Error('No index data available');
      } catch (error) {
        console.error(`Error fetching market index for ${input.country}:`, error);
        throw new Error(`Failed to fetch market index: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  // Get multiple stock prices (batch)
  getBatchStockPrices: publicProcedure
    .input(z.object({
      symbols: z.array(z.string()).max(20), // Limit to 20 stocks per request
      region: z.string().optional().default('US'),
    }))
    .query(async ({ input }) => {
      const results = [];
      
      for (const symbol of input.symbols) {
        try {
          const response = await callDataApi('YahooFinance/get_stock_chart', {
            query: {
              symbol,
              region: input.region,
              interval: '1d',
              range: '1d',
              includeAdjustedClose: true,
            },
          });

          if (response && (response as any).chart && (response as any).chart.result && (response as any).chart.result.length > 0) {
            const result = (response as any).chart.result[0];
            const meta = result.meta;
            
            results.push({
              symbol: meta.symbol,
              name: meta.longName || meta.symbol,
              price: meta.regularMarketPrice,
              change: meta.regularMarketPrice - meta.previousClose,
              change_percent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
              currency: meta.currency,
              success: true,
            });
          } else {
            results.push({
              symbol,
              success: false,
              error: 'No data available',
            });
          }
        } catch (error) {
          results.push({
            symbol,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        total_requested: input.symbols.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      };
    }),

  // Search stocks
  searchStocks: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      country: z.enum(['nigeria', 'kenya', 'south_africa', 'ghana', 'all']).optional().default('all'),
    }))
    .query(async ({ input }) => {
      const searchQuery = input.query.toLowerCase();
      const allStocks = input.country === 'all' 
        ? Object.values(AFRICAN_STOCKS).flat()
        : AFRICAN_STOCKS[input.country] || [];

      const results = allStocks.filter(stock => 
        stock.name.toLowerCase().includes(searchQuery) ||
        stock.symbol.toLowerCase().includes(searchQuery)
      );

      return {
        query: input.query,
        country: input.country,
        total_results: results.length,
        results,
      };
    }),
});
