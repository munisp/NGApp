import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Copy, 
  Check,
  ChevronDown,
  AlertCircle,
  Clock,
  Zap,
  Globe,
  Shield,
  TrendingUp,
  QrCode,
  ExternalLink,
  Wifi,
  WifiOff
} from 'lucide-react';

// Types
interface WalletAddress {
  address_id: string;
  chain: string;
  address: string;
  is_active: boolean;
}

interface Balance {
  chain: string;
  stablecoin: string;
  balance: string;
  pending_balance: string;
}

interface Transaction {
  transaction_id: string;
  transaction_type: string;
  chain: string;
  stablecoin: string;
  amount: string;
  status: string;
  created_at: string;
  tx_hash?: string;
}

interface Quote {
  quote_id: string;
  from_currency: string;
  to_currency: string;
  from_amount: string;
  to_amount: string;
  rate: string;
  fee: string;
  is_ml_optimized: boolean;
}

// Chain configurations
const CHAINS = {
  tron: { name: 'Tron', symbol: 'TRX', color: 'bg-red-500', icon: '🔴', fee: '$1' },
  ethereum: { name: 'Ethereum', symbol: 'ETH', color: 'bg-blue-500', icon: '🔷', fee: '$5' },
  solana: { name: 'Solana', symbol: 'SOL', color: 'bg-purple-500', icon: '🟣', fee: '$0.01' },
  polygon: { name: 'Polygon', symbol: 'MATIC', color: 'bg-violet-500', icon: '🟪', fee: '$0.10' },
  bsc: { name: 'BNB Chain', symbol: 'BNB', color: 'bg-yellow-500', icon: '🟡', fee: '$0.30' },
};

const STABLECOINS = {
  usdt: { name: 'Tether', symbol: 'USDT', color: 'bg-green-500', icon: '💵' },
  usdc: { name: 'USD Coin', symbol: 'USDC', color: 'bg-blue-400', icon: '💲' },
  pyusd: { name: 'PayPal USD', symbol: 'PYUSD', color: 'bg-blue-600', icon: '🅿️' },
  dai: { name: 'Dai', symbol: 'DAI', color: 'bg-yellow-400', icon: '🌕' },
};

const API_BASE = import.meta.env.VITE_STABLECOIN_API_URL || 'http://localhost:8026';

export default function Stablecoin() {
  const [activeTab, setActiveTab] = useState<'wallet' | 'send' | 'receive' | 'convert' | 'ramp'>('wallet');
  const [wallets, setWallets] = useState<WalletAddress[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalBalance, setTotalBalance] = useState('0.00');
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  
  // Send form state
  const [sendChain, setSendChain] = useState('tron');
  const [sendStablecoin, setSendStablecoin] = useState('usdt');
  const [sendAmount, setSendAmount] = useState('');
  const [sendAddress, setSendAddress] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  
  // Convert form state
  const [fromChain, setFromChain] = useState('tron');
  const [fromStablecoin, setFromStablecoin] = useState('usdt');
  const [toChain, setToChain] = useState('ethereum');
  const [toStablecoin, setToStablecoin] = useState('usdc');
  const [convertAmount, setConvertAmount] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  
  // Ramp form state
  const [rampType, setRampType] = useState<'on' | 'off'>('on');
  const [rampFiat, setRampFiat] = useState('NGN');
  const [rampAmount, setRampAmount] = useState('');
  const [rampStablecoin, setRampStablecoin] = useState('usdt');
  const [rampChain, setRampChain] = useState('tron');
  
  // User ID (would come from auth in production)
  const userId = 'user_123';

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    setLoading(true);
    try {
      // Load wallets
      const walletsRes = await fetch(`${API_BASE}/wallet/${userId}`);
      if (walletsRes.ok) {
        const data = await walletsRes.json();
        setWallets(data.wallets || []);
      }
      
      // Load balances
      const balancesRes = await fetch(`${API_BASE}/wallet/${userId}/balances`);
      if (balancesRes.ok) {
        const data = await balancesRes.json();
        setBalances(data.balances || []);
        setTotalBalance(data.total_usd || '0.00');
      }
      
      // Load transactions
      const txRes = await fetch(`${API_BASE}/transactions/${userId}`);
      if (txRes.ok) {
        const data = await txRes.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Failed to load wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createWallet = async () => {
    try {
      const res = await fetch(`${API_BASE}/wallet/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          chains: ['tron', 'ethereum', 'solana', 'polygon', 'bsc'],
        }),
      });
      
      if (res.ok) {
        await loadWalletData();
      }
    } catch (error) {
      console.error('Failed to create wallet:', error);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleSend = async () => {
    if (!sendAmount || !sendAddress) return;
    
    setSendLoading(true);
    try {
      const res = await fetch(`${API_BASE}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          chain: sendChain,
          stablecoin: sendStablecoin,
          amount: sendAmount,
          to_address: sendAddress,
          is_offline_queued: !isOnline,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(data.status === 'queued_offline' 
          ? 'Transaction queued for when you\'re back online' 
          : `Transaction sent! TX: ${data.tx_hash}`
        );
        setSendAmount('');
        setSendAddress('');
        await loadWalletData();
      }
    } catch (error) {
      console.error('Failed to send:', error);
      alert('Failed to send. Please try again.');
    } finally {
      setSendLoading(false);
    }
  };

  const getQuote = async () => {
    if (!convertAmount) return;
    
    setQuoteLoading(true);
    try {
      const res = await fetch(`${API_BASE}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_currency: fromStablecoin,
          to_currency: toStablecoin,
          amount: convertAmount,
          use_ml_optimization: true,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setQuote(data);
      }
    } catch (error) {
      console.error('Failed to get quote:', error);
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!quote) return;
    
    try {
      const res = await fetch(`${API_BASE}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          from_stablecoin: fromStablecoin,
          from_chain: fromChain,
          to_stablecoin: toStablecoin,
          to_chain: toChain,
          amount: convertAmount,
          use_ml_optimization: true,
        }),
      });
      
      if (res.ok) {
        alert('Conversion successful!');
        setConvertAmount('');
        setQuote(null);
        await loadWalletData();
      }
    } catch (error) {
      console.error('Failed to convert:', error);
      alert('Failed to convert. Please try again.');
    }
  };

  const handleRamp = async () => {
    if (!rampAmount) return;
    
    try {
      const endpoint = rampType === 'on' ? '/ramp/on' : '/ramp/off';
      const body = rampType === 'on' 
        ? {
            user_id: userId,
            fiat_currency: rampFiat,
            fiat_amount: rampAmount,
            target_stablecoin: rampStablecoin,
            target_chain: rampChain,
            payment_method: 'bank_transfer',
          }
        : {
            user_id: userId,
            stablecoin: rampStablecoin,
            chain: rampChain,
            amount: rampAmount,
            target_fiat: rampFiat,
            payout_method: 'bank_transfer',
            payout_details: { account_number: '1234567890', bank_code: '058' },
          };
      
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`Order created! Order ID: ${data.order_id}`);
        setRampAmount('');
      }
    } catch (error) {
      console.error('Failed to create ramp order:', error);
      alert('Failed to create order. Please try again.');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'confirming': return 'text-yellow-600 bg-yellow-100';
      case 'pending': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'queued_offline': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Stablecoin Wallet</h1>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <span className="flex items-center text-green-300 text-sm">
                <Wifi className="w-4 h-4 mr-1" /> Online
              </span>
            ) : (
              <span className="flex items-center text-yellow-300 text-sm">
                <WifiOff className="w-4 h-4 mr-1" /> Offline
              </span>
            )}
          </div>
        </div>
        
        {/* Total Balance */}
        <div className="text-center py-4">
          <p className="text-sm opacity-80">Total Balance</p>
          <p className="text-4xl font-bold">${totalBalance}</p>
          <p className="text-sm opacity-80 mt-1">
            <TrendingUp className="w-4 h-4 inline mr-1" />
            ML-optimized rates active
          </p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex justify-center gap-4 mt-4">
          <button 
            onClick={() => setActiveTab('send')}
            className="flex flex-col items-center p-3 bg-white/20 rounded-xl hover:bg-white/30 transition"
          >
            <ArrowUpRight className="w-6 h-6" />
            <span className="text-xs mt-1">Send</span>
          </button>
          <button 
            onClick={() => setActiveTab('receive')}
            className="flex flex-col items-center p-3 bg-white/20 rounded-xl hover:bg-white/30 transition"
          >
            <ArrowDownLeft className="w-6 h-6" />
            <span className="text-xs mt-1">Receive</span>
          </button>
          <button 
            onClick={() => setActiveTab('convert')}
            className="flex flex-col items-center p-3 bg-white/20 rounded-xl hover:bg-white/30 transition"
          >
            <RefreshCw className="w-6 h-6" />
            <span className="text-xs mt-1">Convert</span>
          </button>
          <button 
            onClick={() => setActiveTab('ramp')}
            className="flex flex-col items-center p-3 bg-white/20 rounded-xl hover:bg-white/30 transition"
          >
            <Globe className="w-6 h-6" />
            <span className="text-xs mt-1">Buy/Sell</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-white sticky top-0 z-10">
        {['wallet', 'send', 'receive', 'convert', 'ramp'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            className={`flex-1 py-3 text-sm font-medium capitalize ${
              activeTab === tab 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500'
            }`}
          >
            {tab === 'ramp' ? 'Buy/Sell' : tab}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* Wallet Tab */}
        {activeTab === 'wallet' && (
          <div className="space-y-4">
            {/* Create Wallet Button */}
            {wallets.length === 0 && (
              <button
                onClick={createWallet}
                className="w-full p-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition"
              >
                Create Stablecoin Wallet
              </button>
            )}
            
            {/* Balances */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold mb-3">Your Balances</h3>
              {balances.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No balances yet</p>
              ) : (
                <div className="space-y-3">
                  {balances.map((balance, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {STABLECOINS[balance.stablecoin as keyof typeof STABLECOINS]?.icon || '💰'}
                        </span>
                        <div>
                          <p className="font-medium">
                            {STABLECOINS[balance.stablecoin as keyof typeof STABLECOINS]?.symbol || balance.stablecoin.toUpperCase()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {CHAINS[balance.chain as keyof typeof CHAINS]?.name || balance.chain}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${balance.balance}</p>
                        {parseFloat(balance.pending_balance) > 0 && (
                          <p className="text-xs text-yellow-600">
                            +${balance.pending_balance} pending
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Recent Transactions */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold mb-3">Recent Transactions</h3>
              {transactions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No transactions yet</p>
              ) : (
                <div className="space-y-3">
                  {transactions.slice(0, 5).map((tx) => (
                    <div key={tx.transaction_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          tx.transaction_type === 'deposit' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {tx.transaction_type === 'deposit' ? (
                            <ArrowDownLeft className="w-4 h-4 text-green-600" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium capitalize">{tx.transaction_type}</p>
                          <p className="text-xs text-gray-500">{formatDate(tx.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {tx.transaction_type === 'deposit' ? '+' : '-'}${tx.amount}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(tx.status)}`}>
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Features */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <Zap className="w-8 h-8 text-yellow-500 mb-2" />
                <h4 className="font-medium">Instant Transfers</h4>
                <p className="text-xs text-gray-500">Send in seconds, not days</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <Shield className="w-8 h-8 text-green-500 mb-2" />
                <h4 className="font-medium">Secure</h4>
                <p className="text-xs text-gray-500">Multi-chain security</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <TrendingUp className="w-8 h-8 text-blue-500 mb-2" />
                <h4 className="font-medium">ML Rates</h4>
                <p className="text-xs text-gray-500">AI-optimized timing</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <WifiOff className="w-8 h-8 text-purple-500 mb-2" />
                <h4 className="font-medium">Offline Ready</h4>
                <p className="text-xs text-gray-500">Queue when offline</p>
              </div>
            </div>
          </div>
        )}

        {/* Send Tab */}
        {activeTab === 'send' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold mb-4">Send Stablecoin</h3>
              
              {/* Chain Selection */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">Network</label>
                <select
                  value={sendChain}
                  onChange={(e) => setSendChain(e.target.value)}
                  className="w-full p-3 border rounded-lg bg-gray-50"
                >
                  {Object.entries(CHAINS).map(([key, chain]) => (
                    <option key={key} value={key}>
                      {chain.icon} {chain.name} (Fee: {chain.fee})
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Stablecoin Selection */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">Stablecoin</label>
                <select
                  value={sendStablecoin}
                  onChange={(e) => setSendStablecoin(e.target.value)}
                  className="w-full p-3 border rounded-lg bg-gray-50"
                >
                  {Object.entries(STABLECOINS).map(([key, coin]) => (
                    <option key={key} value={key}>
                      {coin.icon} {coin.symbol}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Amount */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-500">$</span>
                  <input
                    type="number"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-3 pl-8 border rounded-lg bg-gray-50"
                  />
                </div>
              </div>
              
              {/* Recipient Address */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">Recipient Address</label>
                <input
                  type="text"
                  value={sendAddress}
                  onChange={(e) => setSendAddress(e.target.value)}
                  placeholder="Enter wallet address"
                  className="w-full p-3 border rounded-lg bg-gray-50 font-mono text-sm"
                />
              </div>
              
              {/* Offline Notice */}
              {!isOnline && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">You're offline</p>
                    <p className="text-xs text-yellow-700">Transaction will be queued and sent when you're back online</p>
                  </div>
                </div>
              )}
              
              <button
                onClick={handleSend}
                disabled={sendLoading || !sendAmount || !sendAddress}
                className="w-full p-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendLoading ? 'Sending...' : isOnline ? 'Send Now' : 'Queue for Later'}
              </button>
            </div>
          </div>
        )}

        {/* Receive Tab */}
        {activeTab === 'receive' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold mb-4">Receive Stablecoin</h3>
              
              {wallets.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">Create a wallet to receive stablecoins</p>
                  <button
                    onClick={createWallet}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg"
                  >
                    Create Wallet
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {wallets.map((wallet) => (
                    <div key={wallet.address_id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium flex items-center gap-2">
                          {CHAINS[wallet.chain as keyof typeof CHAINS]?.icon}
                          {CHAINS[wallet.chain as keyof typeof CHAINS]?.name || wallet.chain}
                        </span>
                        <button
                          onClick={() => copyAddress(wallet.address)}
                          className="p-2 hover:bg-gray-200 rounded-lg transition"
                        >
                          {copiedAddress === wallet.address ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-600" />
                          )}
                        </button>
                      </div>
                      <p className="font-mono text-xs text-gray-600 break-all bg-white p-2 rounded">
                        {wallet.address}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Supports: USDT, USDC
                        {wallet.chain === 'ethereum' && ', PYUSD, DAI'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="bg-blue-50 rounded-xl p-4">
              <h4 className="font-medium text-blue-800 mb-2">Tips for Receiving</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Always verify the network matches the sender's</li>
                <li>• Tron (TRC20) has the lowest fees</li>
                <li>• Deposits are confirmed automatically</li>
              </ul>
            </div>
          </div>
        )}

        {/* Convert Tab */}
        {activeTab === 'convert' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold mb-4">Convert Stablecoin</h3>
              
              {/* From */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">From</label>
                <div className="flex gap-2">
                  <select
                    value={fromStablecoin}
                    onChange={(e) => setFromStablecoin(e.target.value)}
                    className="flex-1 p-3 border rounded-lg bg-gray-50"
                  >
                    {Object.entries(STABLECOINS).map(([key, coin]) => (
                      <option key={key} value={key}>{coin.symbol}</option>
                    ))}
                  </select>
                  <select
                    value={fromChain}
                    onChange={(e) => setFromChain(e.target.value)}
                    className="flex-1 p-3 border rounded-lg bg-gray-50"
                  >
                    {Object.entries(CHAINS).map(([key, chain]) => (
                      <option key={key} value={key}>{chain.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Amount */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-500">$</span>
                  <input
                    type="number"
                    value={convertAmount}
                    onChange={(e) => {
                      setConvertAmount(e.target.value);
                      setQuote(null);
                    }}
                    placeholder="0.00"
                    className="w-full p-3 pl-8 border rounded-lg bg-gray-50"
                  />
                </div>
              </div>
              
              {/* Swap Icon */}
              <div className="flex justify-center my-2">
                <div className="p-2 bg-gray-100 rounded-full">
                  <RefreshCw className="w-5 h-5 text-gray-600" />
                </div>
              </div>
              
              {/* To */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">To</label>
                <div className="flex gap-2">
                  <select
                    value={toStablecoin}
                    onChange={(e) => setToStablecoin(e.target.value)}
                    className="flex-1 p-3 border rounded-lg bg-gray-50"
                  >
                    {Object.entries(STABLECOINS).map(([key, coin]) => (
                      <option key={key} value={key}>{coin.symbol}</option>
                    ))}
                  </select>
                  <select
                    value={toChain}
                    onChange={(e) => setToChain(e.target.value)}
                    className="flex-1 p-3 border rounded-lg bg-gray-50"
                  >
                    {Object.entries(CHAINS).map(([key, chain]) => (
                      <option key={key} value={key}>{chain.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Get Quote Button */}
              {!quote && (
                <button
                  onClick={getQuote}
                  disabled={quoteLoading || !convertAmount}
                  className="w-full p-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition disabled:opacity-50 mb-4"
                >
                  {quoteLoading ? 'Getting Quote...' : 'Get Quote'}
                </button>
              )}
              
              {/* Quote Display */}
              {quote && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">You'll receive</span>
                    <span className="font-bold text-lg">${quote.to_amount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Rate</span>
                    <span>1 {fromStablecoin.toUpperCase()} = {quote.rate} {toStablecoin.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Fee</span>
                    <span>${quote.fee}</span>
                  </div>
                  {quote.is_ml_optimized && (
                    <div className="flex items-center gap-1 text-xs text-green-600 mt-2">
                      <TrendingUp className="w-3 h-3" />
                      ML-optimized rate applied
                    </div>
                  )}
                </div>
              )}
              
              <button
                onClick={handleConvert}
                disabled={!quote}
                className="w-full p-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Convert Now
              </button>
            </div>
          </div>
        )}

        {/* Ramp Tab (Buy/Sell) */}
        {activeTab === 'ramp' && (
          <div className="space-y-4">
            {/* Toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setRampType('on')}
                className={`flex-1 py-2 rounded-lg font-medium transition ${
                  rampType === 'on' ? 'bg-white shadow text-blue-600' : 'text-gray-600'
                }`}
              >
                Buy Stablecoin
              </button>
              <button
                onClick={() => setRampType('off')}
                className={`flex-1 py-2 rounded-lg font-medium transition ${
                  rampType === 'off' ? 'bg-white shadow text-blue-600' : 'text-gray-600'
                }`}
              >
                Sell Stablecoin
              </button>
            </div>
            
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold mb-4">
                {rampType === 'on' ? 'Buy Stablecoin with Fiat' : 'Sell Stablecoin for Fiat'}
              </h3>
              
              {/* Fiat Currency */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">
                  {rampType === 'on' ? 'Pay with' : 'Receive in'}
                </label>
                <select
                  value={rampFiat}
                  onChange={(e) => setRampFiat(e.target.value)}
                  className="w-full p-3 border rounded-lg bg-gray-50"
                >
                  <option value="NGN">🇳🇬 Nigerian Naira (NGN)</option>
                  <option value="USD">🇺🇸 US Dollar (USD)</option>
                  <option value="EUR">🇪🇺 Euro (EUR)</option>
                  <option value="GBP">🇬🇧 British Pound (GBP)</option>
                </select>
              </div>
              
              {/* Amount */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-500">
                    {rampFiat === 'NGN' ? '₦' : rampFiat === 'EUR' ? '€' : rampFiat === 'GBP' ? '£' : '$'}
                  </span>
                  <input
                    type="number"
                    value={rampAmount}
                    onChange={(e) => setRampAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-3 pl-8 border rounded-lg bg-gray-50"
                  />
                </div>
              </div>
              
              {/* Stablecoin */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">
                  {rampType === 'on' ? 'Receive' : 'Sell'}
                </label>
                <div className="flex gap-2">
                  <select
                    value={rampStablecoin}
                    onChange={(e) => setRampStablecoin(e.target.value)}
                    className="flex-1 p-3 border rounded-lg bg-gray-50"
                  >
                    {Object.entries(STABLECOINS).map(([key, coin]) => (
                      <option key={key} value={key}>{coin.symbol}</option>
                    ))}
                  </select>
                  <select
                    value={rampChain}
                    onChange={(e) => setRampChain(e.target.value)}
                    className="flex-1 p-3 border rounded-lg bg-gray-50"
                  >
                    {Object.entries(CHAINS).map(([key, chain]) => (
                      <option key={key} value={key}>{chain.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Rate Info */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Current Rate</span>
                  <span>1 USDT = {rampFiat === 'NGN' ? '₦1,650' : rampFiat === 'EUR' ? '€0.92' : rampFiat === 'GBP' ? '£0.79' : '$1.00'}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">Fee</span>
                  <span>1%</span>
                </div>
              </div>
              
              <button
                onClick={handleRamp}
                disabled={!rampAmount}
                className="w-full p-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rampType === 'on' ? 'Buy Now' : 'Sell Now'}
              </button>
            </div>
            
            {/* Payment Methods */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h4 className="font-medium mb-3">Payment Methods</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    🏦
                  </div>
                  <div>
                    <p className="font-medium">Bank Transfer</p>
                    <p className="text-xs text-gray-500">Instant for NGN, 1-2 days for others</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    💳
                  </div>
                  <div>
                    <p className="font-medium">Debit/Credit Card</p>
                    <p className="text-xs text-gray-500">Instant, 2.5% fee</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    📱
                  </div>
                  <div>
                    <p className="font-medium">Mobile Money</p>
                    <p className="text-xs text-gray-500">M-Pesa, MTN MoMo, Airtel Money</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
