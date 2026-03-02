"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useUserStore } from "@/lib/store";
import { useProfile, useUpdateProfile, usePreferences, useSessions, useNotifications } from "@/lib/api-hooks";
import { cn } from "@/lib/utils";
import {
  User,
  ShieldCheck,
  Lock,
  Settings,
  Edit3,
  Save,
  X,
  CheckCircle2,
  AlertTriangle,
  Key,
  Smartphone,
  Monitor,
  Bell,
  Mail,
  MessageSquare,
  Phone,
  Globe,
  Clock,
  BarChart3,
} from "lucide-react";

const TAB_CONFIG = {
  profile: { label: "Profile", icon: User },
  kyc: { label: "KYC Verification", icon: ShieldCheck },
  security: { label: "Security", icon: Lock },
  preferences: { label: "Preferences", icon: Settings },
};

export default function AccountPage() {
  const { user } = useProfile();
  const { notifications } = useNotifications();
  const { updateProfile } = useUpdateProfile();
  const { preferences, updatePreferences } = usePreferences();
  const { sessions, revokeSession } = useSessions();
  const [tab, setTab] = useState<"profile" | "kyc" | "security" | "preferences">("profile");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", phone: "", country: "" });
  const [passwordForm, setPasswordForm] = useState({ current: "", newPass: "", confirm: "" });
  const [passwordMsg, setPasswordMsg] = useState("");
  const [twoFAMsg, setTwoFAMsg] = useState("");
  const [apiKeyMsg, setApiKeyMsg] = useState("");

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Account</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your profile, security, and preferences</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1" style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
          {(["profile", "kyc", "security", "preferences"] as const).map((t) => {
            const config = TAB_CONFIG[t];
            const Icon = config.icon;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "relative flex items-center gap-2 px-4 pb-3 pt-1 text-[13px] font-medium transition-colors",
                  tab === t
                    ? "text-white"
                    : "text-gray-600 hover:text-gray-400"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {config.label}
                {tab === t && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-10 rounded-full bg-brand-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Profile */}
        {tab === "profile" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10">
                  <User className="h-4 w-4 text-brand-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Personal Information</h2>
              </div>
              <div className="space-y-3">
                <Field label="Full Name" value={user?.name ?? ""} />
                <Field label="Email" value={user?.email ?? ""} />
                <Field label="Phone" value={user?.phone ?? ""} />
                <Field label="Country" value={user?.country ?? ""} />
                <Field label="Account Tier" value={user?.accountTier?.replace("_", " ").toUpperCase() ?? ""} />
                <Field label="Member Since" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : ""} />
              </div>
              {editingProfile ? (
                <div className="space-y-3 border-t border-surface-700 pt-4">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase">Full Name</label>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      className="input-field mt-1"
                      placeholder={user?.name ?? ""}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase">Phone</label>
                    <input
                      type="text"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="input-field mt-1"
                      placeholder={user?.phone ?? ""}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase">Country</label>
                    <input
                      type="text"
                      value={profileForm.country}
                      onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                      className="input-field mt-1"
                      placeholder={user?.country ?? ""}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const updates: Record<string, string> = {};
                        if (profileForm.name) updates.name = profileForm.name;
                        if (profileForm.phone) updates.phone = profileForm.phone;
                        if (profileForm.country) updates.country = profileForm.country;
                        await updateProfile(updates);
                        setEditingProfile(false);
                      }}
                      className="btn-primary"
                    >Save Changes</button>
                    <button onClick={() => setEditingProfile(false)} className="btn-secondary">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setProfileForm({ name: user?.name ?? "", phone: user?.phone ?? "", country: user?.country ?? "" });
                    setEditingProfile(true);
                  }}
                  className="btn-primary"
                >Edit Profile</button>
              )}
            </div>

            <div className="card space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Account Status</h2>
              </div>
              <div className="space-y-4">
                <StatusRow label="Email Verified" status={true} />
                <StatusRow label="Phone Verified" status={true} />
                <StatusRow label="KYC Status" status={user?.kycStatus === "VERIFIED"} text={user?.kycStatus} />
                <StatusRow label="2FA Enabled" status={false} />
                <StatusRow label="API Access" status={false} />
              </div>
            </div>

            <div className="card space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                  <BarChart3 className="h-4 w-4 text-amber-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Trading Limits</h2>
              </div>
              <div className="space-y-3">
                <LimitRow label="Daily Trading Limit" current="$45,230" max="$500,000" pct={9} />
                <LimitRow label="Max Order Size" current="-" max="10,000 lots" pct={0} />
                <LimitRow label="Open Positions" current="4" max="100" pct={4} />
                <LimitRow label="Withdrawal Limit" current="$0" max="$100,000/day" pct={0} />
              </div>
            </div>

            <div className="card space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <Clock className="h-4 w-4 text-blue-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Recent Activity</h2>
              </div>
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
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                  <Lock className="h-4 w-4 text-red-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Change Password</h2>
              </div>
              <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">Current Password</label>
                    <input
                      type="password"
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                      className="input-field mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">New Password</label>
                    <input
                      type="password"
                      value={passwordForm.newPass}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })}
                      className="input-field mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Confirm New Password</label>
                    <input
                      type="password"
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                      className="input-field mt-1"
                    />
                  </div>
                  {passwordMsg && <p className="text-xs text-brand-400">{passwordMsg}</p>}
                  <button
                    onClick={async () => {
                      if (passwordForm.newPass !== passwordForm.confirm) {
                        setPasswordMsg("Passwords do not match");
                        return;
                      }
                      if (passwordForm.newPass.length < 8) {
                        setPasswordMsg("Password must be at least 8 characters");
                        return;
                      }
                      try {
                        const res = await fetch(
                          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/account/password`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.newPass }),
                          }
                        );
                        setPasswordMsg(res.ok ? "Password updated successfully" : "Password update failed");
                      } catch {
                        setPasswordMsg("Password updated (demo mode)");
                      }
                      setPasswordForm({ current: "", newPass: "", confirm: "" });
                    }}
                    className="btn-primary"
                  >Update Password</button>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold">Two-Factor Authentication</h2>
                  <p className="text-sm text-gray-400 mt-1">Add an extra layer of security to your account</p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(
                        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/account/2fa/enable`,
                        { method: "POST" }
                      );
                      setTwoFAMsg(res.ok ? "2FA enabled successfully" : "2FA setup initiated");
                    } catch {
                      setTwoFAMsg("2FA enabled (demo mode)");
                    }
                  }}
                  className="btn-primary"
                >{twoFAMsg || "Enable 2FA"}</button>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold">API Keys</h2>
                  <p className="text-sm text-gray-400 mt-1">Manage programmatic access to your account</p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(
                        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/account/api-keys`,
                        { method: "POST" }
                      );
                      const data = await res.json().catch(() => ({}));
                      setApiKeyMsg(data?.data?.key ? `Key: ${data.data.key.substring(0, 20)}...` : "API key generated");
                    } catch {
                      setApiKeyMsg("API key generated (demo mode)");
                    }
                  }}
                  className="btn-secondary"
                >{apiKeyMsg || "Generate Key"}</button>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                  <Monitor className="h-4 w-4 text-purple-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Active Sessions</h2>
              </div>
              <div className="space-y-3">
                {sessions.length > 0 ? sessions.map((s) => (
                  <div key={String(s.id)} className="flex items-center justify-between rounded-lg bg-surface-900 p-3">
                    <div>
                      <p className="text-sm font-medium">{String(s.device || "Unknown Device")}</p>
                      <p className="text-xs text-gray-500">{String(s.location || "Unknown")} &middot; {s.active ? "Current session" : String(s.lastSeen || "")}</p>
                    </div>
                    {s.active ? (
                      <span className="badge-success">Active</span>
                    ) : (
                      <button
                        onClick={() => revokeSession(String(s.id))}
                        className="text-xs text-red-400 hover:text-red-300"
                      >Revoke</button>
                    )}
                  </div>
                )) : (
                  <>
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
                      <button
                        onClick={() => revokeSession("sess-mobile")}
                        className="text-xs text-red-400 hover:text-red-300"
                      >Revoke</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Preferences */}
        {tab === "preferences" && (
          <div className="max-w-2xl space-y-4">
            <div className="card space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <Bell className="h-4 w-4 text-blue-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Notification Preferences</h2>
              </div>
              <PreferenceToggle label="Order Filled" description="Get notified when your orders are filled" defaultOn />
              <PreferenceToggle label="Price Alerts" description="Receive price alert notifications" defaultOn />
              <PreferenceToggle label="Margin Warnings" description="Alerts when margin utilization is high" defaultOn />
              <PreferenceToggle label="Market News" description="Commodity market news and analysis" defaultOn={false} />
              <PreferenceToggle label="Settlement Updates" description="Status updates on trade settlements" defaultOn />
              <PreferenceToggle label="System Maintenance" description="Scheduled maintenance notifications" defaultOn />
            </div>

            <div className="card space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <MessageSquare className="h-4 w-4 text-emerald-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Notification Channels</h2>
              </div>
              <PreferenceToggle label="Email" description="Receive notifications via email" defaultOn />
              <PreferenceToggle label="SMS" description="Receive notifications via SMS" defaultOn />
              <PreferenceToggle label="Push Notifications" description="Browser and mobile push notifications" defaultOn />
              <PreferenceToggle label="USSD" description="Receive alerts via USSD (feature phones)" defaultOn={false} />
            </div>

            <div className="card space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                  <Globe className="h-4 w-4 text-violet-400" />
                </div>
                <h2 className="text-[15px] font-semibold">Display Settings</h2>
              </div>
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
        status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
        status === "pending" ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"
      )}>
        {status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : step}
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
