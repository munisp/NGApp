import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  balance: number;
  price_usd: number;
  value_usd: number;
  change_24h: number;
  wallet_address: string;
}

export interface CryptoWallet {
  id: string;
  name: string;
  type: "metamask" | "trust_wallet" | "coinbase" | "custom";
  address: string;
  assets: CryptoAsset[];
  total_value_usd: number;
  connected_at: number;
}

const CRYPTO_WALLETS_KEY = "crypto_wallets";
const CRYPTO_PRICES_KEY = "crypto_prices_cache";

/**
 * Fetch real-time cryptocurrency prices from CoinGecko API
 */
export async function fetchCryptoPrices(symbols: string[]): Promise<Record<string, { usd: number; usd_24h_change: number }>> {
  try {
    const ids = symbols.map((s) => s.toLowerCase()).join(",");
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
    );
    
    if (!response.ok) {
      throw new Error("Failed to fetch crypto prices");
    }

    const data = await response.json();
    
    // Cache the prices
    await AsyncStorage.setItem(CRYPTO_PRICES_KEY, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));

    return data;
  } catch (error) {
    console.error("Error fetching crypto prices:", error);
    
    // Try to return cached prices
    try {
      const cached = await AsyncStorage.getItem(CRYPTO_PRICES_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Use cache if less than 5 minutes old
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          return data;
        }
      }
    } catch (cacheError) {
      console.error("Error reading cached prices:", cacheError);
    }

    // Return mock data as fallback
    return {
      bitcoin: { usd: 45000, usd_24h_change: 2.5 },
      ethereum: { usd: 3000, usd_24h_change: 1.8 },
      binancecoin: { usd: 400, usd_24h_change: -0.5 },
      cardano: { usd: 0.5, usd_24h_change: 3.2 },
      solana: { usd: 100, usd_24h_change: 5.1 },
    };
  }
}

/**
 * Connect a cryptocurrency wallet
 */
export async function connectCryptoWallet(
  name: string,
  type: CryptoWallet["type"],
  address: string
): Promise<CryptoWallet> {
  // In production, this would integrate with actual wallet APIs
  // For now, we'll create a mock wallet with sample assets

  const mockAssets: CryptoAsset[] = [
    {
      id: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin",
      balance: 0.5,
      price_usd: 45000,
      value_usd: 22500,
      change_24h: 2.5,
      wallet_address: address,
    },
    {
      id: "ethereum",
      symbol: "ETH",
      name: "Ethereum",
      balance: 5,
      price_usd: 3000,
      value_usd: 15000,
      change_24h: 1.8,
      wallet_address: address,
    },
  ];

  const wallet: CryptoWallet = {
    id: `wallet_${Date.now()}`,
    name,
    type,
    address,
    assets: mockAssets,
    total_value_usd: mockAssets.reduce((sum, asset) => sum + asset.value_usd, 0),
    connected_at: Date.now(),
  };

  // Save wallet
  const wallets = await getCryptoWallets();
  wallets.push(wallet);
  await AsyncStorage.setItem(CRYPTO_WALLETS_KEY, JSON.stringify(wallets));

  return wallet;
}

/**
 * Get all connected crypto wallets
 */
export async function getCryptoWallets(): Promise<CryptoWallet[]> {
  try {
    const walletsJson = await AsyncStorage.getItem(CRYPTO_WALLETS_KEY);
    if (!walletsJson) return [];
    return JSON.parse(walletsJson);
  } catch (error) {
    console.error("Error getting crypto wallets:", error);
    return [];
  }
}

/**
 * Update wallet asset balances with latest prices
 */
export async function updateWalletPrices(walletId: string): Promise<CryptoWallet | null> {
  const wallets = await getCryptoWallets();
  const wallet = wallets.find((w) => w.id === walletId);
  
  if (!wallet) return null;

  // Fetch latest prices
  const symbols = wallet.assets.map((a) => a.id);
  const prices = await fetchCryptoPrices(symbols);

  // Update asset prices
  wallet.assets = wallet.assets.map((asset) => {
    const priceData = prices[asset.id];
    if (priceData) {
      const price_usd = priceData.usd;
      const value_usd = asset.balance * price_usd;
      const change_24h = priceData.usd_24h_change;

      return {
        ...asset,
        price_usd,
        value_usd,
        change_24h,
      };
    }
    return asset;
  });

  // Update total value
  wallet.total_value_usd = wallet.assets.reduce((sum, asset) => sum + asset.value_usd, 0);

  // Save updated wallet
  const updatedWallets = wallets.map((w) => (w.id === walletId ? wallet : w));
  await AsyncStorage.setItem(CRYPTO_WALLETS_KEY, JSON.stringify(updatedWallets));

  return wallet;
}

/**
 * Disconnect a crypto wallet
 */
export async function disconnectCryptoWallet(walletId: string): Promise<void> {
  const wallets = await getCryptoWallets();
  const updatedWallets = wallets.filter((w) => w.id !== walletId);
  await AsyncStorage.setItem(CRYPTO_WALLETS_KEY, JSON.stringify(updatedWallets));
}

/**
 * Get total crypto portfolio value across all wallets
 */
export async function getTotalCryptoValue(): Promise<number> {
  const wallets = await getCryptoWallets();
  return wallets.reduce((sum, wallet) => sum + wallet.total_value_usd, 0);
}

/**
 * Get crypto portfolio allocation
 */
export async function getCryptoAllocation(): Promise<{ symbol: string; name: string; percentage: number; value_usd: number }[]> {
  const wallets = await getCryptoWallets();
  const totalValue = await getTotalCryptoValue();

  if (totalValue === 0) return [];

  // Aggregate assets across all wallets
  const assetMap = new Map<string, { name: string; value_usd: number }>();

  wallets.forEach((wallet) => {
    wallet.assets.forEach((asset) => {
      const existing = assetMap.get(asset.symbol);
      if (existing) {
        existing.value_usd += asset.value_usd;
      } else {
        assetMap.set(asset.symbol, {
          name: asset.name,
          value_usd: asset.value_usd,
        });
      }
    });
  });

  // Calculate percentages
  return Array.from(assetMap.entries()).map(([symbol, data]) => ({
    symbol,
    name: data.name,
    value_usd: data.value_usd,
    percentage: (data.value_usd / totalValue) * 100,
  })).sort((a, b) => b.value_usd - a.value_usd);
}
