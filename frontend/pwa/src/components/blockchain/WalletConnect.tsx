"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  Link2,
  Copy,
  Check,
  AlertCircle,
  ChevronDown,
  ExternalLink,
  Shield,
  LogOut,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: number | null;
  chainName: string | null;
  balance: string | null;
}

interface ChainConfig {
  chainId: string;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

// ── Chain Configurations ───────────────────────────────────────────────────

const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  80002: {
    chainId: "0x13882",
    chainName: "Polygon Amoy Testnet",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    rpcUrls: ["https://rpc-amoy.polygon.technology"],
    blockExplorerUrls: ["https://amoy.polygonscan.com/"],
  },
  11155111: {
    chainId: "0xaa36a7",
    chainName: "Ethereum Sepolia Testnet",
    nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://rpc.sepolia.org"],
    blockExplorerUrls: ["https://sepolia.etherscan.io/"],
  },
  137: {
    chainId: "0x89",
    chainName: "Polygon Mainnet",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    rpcUrls: ["https://polygon-rpc.com"],
    blockExplorerUrls: ["https://polygonscan.com/"],
  },
  1: {
    chainId: "0x1",
    chainName: "Ethereum Mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://eth.llamarpc.com"],
    blockExplorerUrls: ["https://etherscan.io/"],
  },
};

const CHAIN_COLORS: Record<number, string> = {
  1: "#627EEA",
  137: "#8247E5",
  80002: "#8247E5",
  11155111: "#627EEA",
};

// ── Ethereum Provider Type ─────────────────────────────────────────────────

interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

// ── Helper ─────────────────────────────────────────────────────────────────

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatBalance(wei: string): string {
  const eth = parseInt(wei, 16) / 1e18;
  return eth.toFixed(4);
}

// ── Wallet Context Hook ────────────────────────────────────────────────────

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: null,
    chainId: null,
    chainName: null,
    balance: null,
  });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getChainName = (chainId: number): string => {
    return SUPPORTED_CHAINS[chainId]?.chainName || `Chain ${chainId}`;
  };

  const fetchBalance = useCallback(async (address: string): Promise<string | null> => {
    if (!window.ethereum) return null;
    try {
      const balance = await window.ethereum.request({
        method: "eth_getBalance",
        params: [address, "latest"],
      });
      return formatBalance(balance as string);
    } catch {
      return null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("Digital wallet not detected. Please install a wallet app to connect.");
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      }) as string[];

      const chainIdHex = await window.ethereum.request({
        method: "eth_chainId",
      }) as string;
      const chainId = parseInt(chainIdHex, 16);

      const balance = await fetchBalance(accounts[0]);

      setWallet({
        connected: true,
        address: accounts[0],
        chainId,
        chainName: getChainName(chainId),
        balance,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet";
      setError(message);
    } finally {
      setConnecting(false);
    }
  }, [fetchBalance]);

  const disconnect = useCallback(() => {
    setWallet({
      connected: false,
      address: null,
      chainId: null,
      chainName: null,
      balance: null,
    });
    setError(null);
  }, []);

  const switchChain = useCallback(async (chainId: number) => {
    if (!window.ethereum) return;

    const config = SUPPORTED_CHAINS[chainId];
    if (!config) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: config.chainId }],
      });
    } catch (switchError) {
      // Chain not added — add it
      const err = switchError as { code?: number };
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [config],
          });
        } catch {
          setError("Failed to add network to your wallet");
        }
      }
    }
  }, []);

  // Listen for account and chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts.length === 0) {
        disconnect();
      } else {
        const balance = await fetchBalance(accounts[0]);
        setWallet((prev) => ({
          ...prev,
          address: accounts[0],
          balance,
        }));
      }
    };

    const handleChainChanged = (...args: unknown[]) => {
      const chainIdHex = args[0] as string;
      const chainId = parseInt(chainIdHex, 16);
      setWallet((prev) => ({
        ...prev,
        chainId,
        chainName: getChainName(chainId),
      }));
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [disconnect, fetchBalance]);

  // Auto-connect if previously connected
  useEffect(() => {
    if (!window.ethereum) return;
    (async () => {
      try {
        const accounts = await window.ethereum!.request({
          method: "eth_accounts",
        }) as string[];
        if (accounts.length > 0) {
          const chainIdHex = await window.ethereum!.request({
            method: "eth_chainId",
          }) as string;
          const chainId = parseInt(chainIdHex, 16);
          const balance = await fetchBalance(accounts[0]);

          setWallet({
            connected: true,
            address: accounts[0],
            chainId,
            chainName: getChainName(chainId),
            balance,
          });
        }
      } catch {
        // Not connected
      }
    })();
  }, [fetchBalance]);

  return { wallet, connecting, error, connect, disconnect, switchChain };
}

// ── Wallet Connect Button Component ────────────────────────────────────────

interface WalletConnectProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

export default function WalletConnect({ onConnect, onDisconnect }: WalletConnectProps) {
  const { wallet, connecting, error, connect, disconnect, switchChain } = useWallet();
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [hasEthereum, setHasEthereum] = useState(false);

  useEffect(() => {
    setHasEthereum(typeof window !== "undefined" && !!window.ethereum);
  }, []);

  useEffect(() => {
    if (wallet.connected && wallet.address && onConnect) {
      onConnect(wallet.address);
    }
  }, [wallet.connected, wallet.address, onConnect]);

  const handleCopyAddress = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setShowDropdown(false);
    onDisconnect?.();
  };

  const chainColor = wallet.chainId ? (CHAIN_COLORS[wallet.chainId] || "#6B7280") : "#6B7280";

  // ── Not Connected State ──────────────────────────────────────────────
  if (!wallet.connected) {
    return (
      <div className="space-y-2">
        <button
          onClick={connect}
          disabled={connecting}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-gradient-to-r from-purple-600/20 to-blue-600/20 px-4 py-2.5 text-sm font-medium text-white transition-all hover:from-purple-600/30 hover:to-blue-600/30 hover:border-purple-500/30 disabled:opacity-50"
        >
          {connecting ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <Wallet className="h-4 w-4" />
          )}
          {connecting ? "Connecting..." : hasEthereum ? "Connect Wallet" : "Set Up Wallet"}
        </button>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </div>
        )}

        {!hasEthereum && (
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
          >
            <ExternalLink className="h-3 w-3" />
            Get Digital Wallet
          </a>
        )}
      </div>
    );
  }

  // ── Connected State ──────────────────────────────────────────────────
  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm transition-all hover:bg-white/[0.08]"
      >
        {/* Chain badge */}
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: chainColor }}
        />

        {/* Address */}
        <span className="font-mono text-xs text-gray-200">
          {truncateAddress(wallet.address!)}
        </span>

        {/* Balance */}
        {wallet.balance && (
          <span className="text-xs text-gray-500">
            {wallet.balance} {wallet.chainId === 137 || wallet.chainId === 80002 ? "MATIC" : "ETH"}
          </span>
        )}

        <ChevronDown className={`h-3 w-3 text-gray-500 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-white/10 bg-gray-900/95 p-3 shadow-2xl backdrop-blur-xl">
          {/* Address + Copy */}
          <div className="mb-3 flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/20">
                <Wallet className="h-3 w-3 text-purple-400" />
              </div>
              <span className="font-mono text-xs text-gray-300">
                {truncateAddress(wallet.address!)}
              </span>
            </div>
            <button onClick={handleCopyAddress} className="text-gray-500 hover:text-white">
              {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Chain info */}
          <div className="mb-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Network</span>
              <span className="flex items-center gap-1.5 text-gray-300">
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: chainColor }} />
                {wallet.chainName}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Balance</span>
              <span className="text-gray-300">
                {wallet.balance} {wallet.chainId === 137 || wallet.chainId === 80002 ? "MATIC" : "ETH"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">KYC Status</span>
              <span className="flex items-center gap-1 text-green-400">
                <Shield className="h-3 w-3" />
                Verified
              </span>
            </div>
          </div>

          {/* Switch chain buttons */}
          <div className="mb-3 border-t border-white/[0.06] pt-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-600">Switch Network</p>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(SUPPORTED_CHAINS).map(([id, config]) => {
                const chainId = parseInt(id);
                const isActive = wallet.chainId === chainId;
                return (
                  <button
                    key={id}
                    onClick={() => switchChain(chainId)}
                    className={`rounded-lg px-2 py-1.5 text-[11px] transition-all ${
                      isActive
                        ? "bg-white/10 text-white border border-white/20"
                        : "bg-white/[0.03] text-gray-500 hover:bg-white/[0.06] hover:text-gray-300 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: CHAIN_COLORS[chainId] || "#6B7280" }}
                      />
                      {config.chainName.replace(" Testnet", "").replace(" Mainnet", "")}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Explorer + Disconnect */}
          <div className="flex gap-2 border-t border-white/[0.06] pt-3">
            {wallet.chainId && SUPPORTED_CHAINS[wallet.chainId] && (
              <a
                href={`${SUPPORTED_CHAINS[wallet.chainId].blockExplorerUrls[0]}address/${wallet.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-gray-400 hover:bg-white/[0.08] hover:text-white transition-all"
              >
                <ExternalLink className="h-3 w-3" />
                Explorer
              </a>
            )}
            <button
              onClick={handleDisconnect}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 hover:bg-red-500/20 transition-all"
            >
              <LogOut className="h-3 w-3" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
