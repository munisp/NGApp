"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  ArrowRight,
  KeyRound,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithKeycloak, isLoading, error } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      router.push("/");
    }
  };

  // For demo mode - skip auth
  const handleDemoLogin = () => {
    useAuthStore.setState({
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: "demo-001",
        email: "demo@nexcom.exchange",
        name: "Demo Trader",
        roles: ["trader"],
        accountTier: "retail_trader",
        emailVerified: true,
      },
    });
    router.push("/");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0a0f1c 0%, #0f172a 50%, #0a1628 100%)" }}
    >
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, #10b981 0%, transparent 70%)" }} />
        <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}
          >
            NX
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight">NEXCOM Exchange</h1>
          <p className="mt-2 text-sm text-gray-500">
            Next-Generation Commodity Trading Platform
          </p>
        </div>

        {/* Login Form */}
        <div className="rounded-2xl p-6 space-y-6"
          style={{
            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(24px)",
          }}
        >
          <div>
            <h2 className="text-xl font-semibold">Sign In</h2>
            <p className="mt-1 text-sm text-gray-500">Access your trading account</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl p-3 text-sm text-red-400"
              style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.15)" }}
              role="alert"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field mt-1.5"
                placeholder="trader@nexcom.exchange"
                required
                autoComplete="email"
                aria-label="Email address"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                  aria-label="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }} />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 text-gray-600" style={{ background: "rgba(15, 23, 42, 0.8)" }}>or</span>
            </div>
          </div>

          {/* Keycloak SSO */}
          <button
            onClick={loginWithKeycloak}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl py-3 text-sm font-medium text-gray-300 transition-all hover:text-white"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <KeyRound className="h-4 w-4 text-amber-400" />
            Sign in with Keycloak SSO
          </button>

          {/* Demo Mode */}
          <button
            onClick={handleDemoLogin}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm text-gray-500 transition-all hover:text-brand-400"
            style={{ border: "1px dashed rgba(255,255,255,0.06)" }}
          >
            <Zap className="h-4 w-4" />
            Try Demo Mode (no login required)
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-600">
            <ShieldCheck className="h-3.5 w-3.5" />
            Protected by <span className="text-brand-400 font-medium">Keycloak</span> & <span className="text-brand-400 font-medium">OpenAppSec</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-[11px] text-gray-700">
          <p>NEXCOM Exchange &copy; 2026. All rights reserved.</p>
          <p className="mt-0.5">Regulated by CMA Kenya</p>
        </div>
      </motion.div>
    </div>
  );
}
