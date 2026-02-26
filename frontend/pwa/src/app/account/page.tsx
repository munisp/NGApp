"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useUserStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function AccountPage() {
  const { user, notifications } = useUserStore();
  const [tab, setTab] = useState<"profile" | "kyc" | "security" | "preferences">("profile");

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Account</h1>

        {/* Tabs */}
        <div className="flex items-center gap-4 border-b border-surface-700">
          {(["profile", "kyc", "security", "preferences"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "pb-3 text-sm font-medium capitalize transition-colors border-b-2",
                tab === t
                  ? "border-brand-500 text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              )}
            >
              {t === "kyc" ? "KYC Verification" : t}
            </button>
          ))}
        </div>

        {/* Profile */}
        {tab === "profile" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card space-y-4">
              <h2 className="text-lg font-semibold">Personal Information</h2>
              <div className="space-y-3">
                <Field label="Full Name" value={user?.name ?? ""} />
                <Field label="Email" value={user?.email ?? ""} />
                <Field label="Phone" value={user?.phone ?? ""} />
                <Field label="Country" value={user?.country ?? ""} />
                <Field label="Account Tier" value={user?.accountTier?.replace("_", " ").toUpperCase() ?? ""} />
                <Field label="Member Since" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : ""} />
              </div>
              <button className="btn-primary">Edit Profile</button>
            </div>

            <div className="card space-y-4">
              <h2 className="text-lg font-semibold">Account Status</h2>
              <div className="space-y-4">
                <StatusRow label="Email Verified" status={true} />
                <StatusRow label="Phone Verified" status={true} />
                <StatusRow label="KYC Status" status={user?.kycStatus === "VERIFIED"} text={user?.kycStatus} />
                <StatusRow label="2FA Enabled" status={false} />
                <StatusRow label="API Access" status={false} />
              </div>
            </div>

            <div className="card space-y-4">
              <h2 className="text-lg font-semibold">Trading Limits</h2>
              <div className="space-y-3">
                <LimitRow label="Daily Trading Limit" current="$45,230" max="$500,000" pct={9} />
                <LimitRow label="Max Order Size" current="-" max="10,000 lots" pct={0} />
                <LimitRow label="Open Positions" current="4" max="100" pct={4} />
                <LimitRow label="Withdrawal Limit" current="$0" max="$100,000/day" pct={0} />
              </div>
            </div>

            <div className="card space-y-4">
              <h2 className="text-lg font-semibold">Recent Activity</h2>
              <div className="space-y-2">
                {notifications.slice(0, 5).map((n) => (
                  <div key={n.id} className="flex items-start gap-2 rounded-lg bg-surface-900 p-3">
                    <span className={cn(
                      "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                      n.type === "trade" ? "bg-brand-500" :
                      n.type === "alert" ? "bg-yellow-500" :
                      n.type === "margin" ? "bg-red-500" : "bg-gray-500"
                    )} />
                    <div>
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-gray-500">{n.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* KYC */}
        {tab === "kyc" && (
          <div className="max-w-2xl space-y-6">
            <div className="card">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                  <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Identity Verified</h2>
                  <p className="text-sm text-gray-400">Your KYC verification is complete. Full trading access is enabled.</p>
                </div>
              </div>

              <div className="space-y-4">
                <KYCStep step={1} label="Email Verification" status="completed" />
                <KYCStep step={2} label="Phone Verification" status="completed" />
                <KYCStep step={3} label="Identity Document" status="completed" description="National ID uploaded and verified" />
                <KYCStep step={4} label="Proof of Address" status="completed" description="Utility bill verified" />
                <KYCStep step={5} label="Sanctions Screening" status="completed" description="Passed AML/CFT checks" />
                <KYCStep step={6} label="Risk Assessment" status="completed" description="Low risk - Retail Trader tier" />
              </div>
            </div>
          </div>
        )}

        {/* Security */}
        {tab === "security" && (
          <div className="max-w-2xl space-y-4">
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Change Password</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">Current Password</label>
                  <input type="password" className="input-field mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">New Password</label>
                  <input type="password" className="input-field mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Confirm New Password</label>
                  <input type="password" className="input-field mt-1" />
                </div>
                <button className="btn-primary">Update Password</button>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Two-Factor Authentication</h2>
                  <p className="text-sm text-gray-400 mt-1">Add an extra layer of security to your account</p>
                </div>
                <button className="btn-primary">Enable 2FA</button>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">API Keys</h2>
                  <p className="text-sm text-gray-400 mt-1">Manage programmatic access to your account</p>
                </div>
                <button className="btn-secondary">Generate Key</button>
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Active Sessions</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-surface-900 p-3">
                  <div>
                    <p className="text-sm font-medium">Chrome on macOS</p>
                    <p className="text-xs text-gray-500">Nairobi, Kenya &middot; Current session</p>
                  </div>
                  <span className="badge-success">Active</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-surface-900 p-3">
                  <div>
                    <p className="text-sm font-medium">NEXCOM Mobile App</p>
                    <p className="text-xs text-gray-500">Nairobi, Kenya &middot; 2 hours ago</p>
                  </div>
                  <button className="text-xs text-red-400">Revoke</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preferences */}
        {tab === "preferences" && (
          <div className="max-w-2xl space-y-4">
            <div className="card space-y-4">
              <h2 className="text-lg font-semibold">Notification Preferences</h2>
              <PreferenceToggle label="Order Filled" description="Get notified when your orders are filled" defaultOn />
              <PreferenceToggle label="Price Alerts" description="Receive price alert notifications" defaultOn />
              <PreferenceToggle label="Margin Warnings" description="Alerts when margin utilization is high" defaultOn />
              <PreferenceToggle label="Market News" description="Commodity market news and analysis" defaultOn={false} />
              <PreferenceToggle label="Settlement Updates" description="Status updates on trade settlements" defaultOn />
              <PreferenceToggle label="System Maintenance" description="Scheduled maintenance notifications" defaultOn />
            </div>

            <div className="card space-y-4">
              <h2 className="text-lg font-semibold">Notification Channels</h2>
              <PreferenceToggle label="Email" description="Receive notifications via email" defaultOn />
              <PreferenceToggle label="SMS" description="Receive notifications via SMS" defaultOn />
              <PreferenceToggle label="Push Notifications" description="Browser and mobile push notifications" defaultOn />
              <PreferenceToggle label="USSD" description="Receive alerts via USSD (feature phones)" defaultOn={false} />
            </div>

            <div className="card space-y-4">
              <h2 className="text-lg font-semibold">Display Settings</h2>
              <div>
                <label className="text-xs text-gray-500">Default Currency</label>
                <select className="input-field mt-1">
                  <option>USD - US Dollar</option>
                  <option>KES - Kenyan Shilling</option>
                  <option>NGN - Nigerian Naira</option>
                  <option>ZAR - South African Rand</option>
                  <option>EUR - Euro</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Time Zone</label>
                <select className="input-field mt-1">
                  <option>Africa/Nairobi (EAT, UTC+3)</option>
                  <option>Africa/Lagos (WAT, UTC+1)</option>
                  <option>Africa/Johannesburg (SAST, UTC+2)</option>
                  <option>UTC</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Default Chart Timeframe</label>
                <select className="input-field mt-1">
                  <option>1 Hour</option>
                  <option>4 Hours</option>
                  <option>1 Day</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-[10px] text-gray-500 uppercase">{label}</label>
      <p className="text-sm font-medium">{value || "-"}</p>
    </div>
  );
}

function StatusRow({ label, status, text }: { label: string; status: boolean; text?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={status ? "badge-success" : "badge-danger"}>
        {text ?? (status ? "Enabled" : "Disabled")}
      </span>
    </div>
  );
}

function LimitRow({ label, current, max, pct }: { label: string; current: string; max: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono">{current} / {max}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-surface-700 overflow-hidden">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function KYCStep({ step, label, status, description }: {
  step: number;
  label: string;
  status: "completed" | "pending" | "failed";
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        status === "completed" ? "bg-green-500 text-white" :
        status === "pending" ? "bg-yellow-500 text-black" : "bg-red-500 text-white"
      )}>
        {status === "completed" ? "✓" : step}
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
    </div>
  );
}

function PreferenceToggle({ label, description, defaultOn }: {
  label: string;
  description: string;
  defaultOn?: boolean;
}) {
  const [enabled, setEnabled] = useState(defaultOn ?? false);
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => setEnabled(!enabled)}
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors",
          enabled ? "bg-brand-600" : "bg-surface-700"
        )}
      >
        <span className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
          enabled ? "left-[22px]" : "left-0.5"
        )} />
      </button>
    </div>
  );
}
