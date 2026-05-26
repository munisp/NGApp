import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Building2, CreditCard, Store, BarChart2, RefreshCw, Plus, Play, Download, Zap } from "lucide-react";

type SaasTab = "dashboard" | "plans" | "subscriptions" | "marketplace";

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-400 border-green-500/30",
  inactive: "text-zinc-400 border-zinc-700",
  trial: "text-blue-400 border-blue-500/30",
  cancelled: "text-red-400 border-red-500/30",
  past_due: "text-orange-400 border-orange-500/30",
  published: "text-green-400 border-green-500/30",
  draft: "text-yellow-400 border-yellow-500/30",
  pending: "text-yellow-400 border-yellow-500/30",
  completed: "text-green-400 border-green-500/30",
  failed: "text-red-400 border-red-500/30",
};

export default function SaasPlatformPage() {
  const [activeTab, setActiveTab] = useState<SaasTab>("dashboard");

  const { data: plans, refetch: refetchPlans } = trpc.saas.listPlans.useQuery();
  const { data: subscriptions, refetch: refetchSubs } = trpc.saas.listSubscriptions.useQuery(undefined);
  const { data: marketplaceApps, refetch: refetchApps } = trpc.saas.listMarketplaceApps.useQuery();
  const { data: installedApps, refetch: refetchInstalled } = trpc.saas.listInstalledApps.useQuery({ tenantId: "default-tenant" });
  const { data: dashboard } = trpc.saas.getSaasDashboard.useQuery();

  const seedPlansMutation = trpc.saas.seedDefaultPlans.useMutation({
    onSuccess: (data: { seeded: number }) => { toast.success(`${data.seeded} plans seeded`); refetchPlans(); },
  });

  const seedAppsMutation = trpc.saas.seedDefaultApps.useMutation({
    onSuccess: (data: { seeded: number }) => { toast.success(`${data.seeded} marketplace apps seeded`); refetchApps(); },
  });

  const installAppMutation = trpc.saas.installApp.useMutation({
    onSuccess: () => { toast.success("App installed"); refetchInstalled(); },
  });

  const runAppMutation = trpc.saas.runApp.useMutation({
    onSuccess: (data) => { toast.success(`App run complete: ${data.status}`); },
  });

  const tabs = [
    { id: "dashboard" as const, label: "Dashboard", icon: BarChart2 },
    { id: "plans" as const, label: "Plans & Pricing", icon: CreditCard },
    { id: "subscriptions" as const, label: "Subscriptions", icon: Building2 },
    { id: "marketplace" as const, label: "Marketplace", icon: Store },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Building2 className="w-7 h-7 text-cyan-400" />
              SaaS Platform Management
            </h1>
            <p className="text-zinc-400 text-sm mt-1">White-label Billing · Stripe Integration · Analytics Marketplace</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { refetchPlans(); refetchSubs(); refetchApps(); }}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? "bg-cyan-600 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {dashboard ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4">
                      <div className="text-zinc-400 text-xs mb-1">Total Tenants</div>
                      <div className="text-2xl font-bold text-white">{dashboard.totalPlans}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4">
                    <div className="text-zinc-400 text-xs mb-1">Active Subscriptions</div>
                    <div className="text-2xl font-bold text-green-400">{dashboard.activeSubs}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4">
                      <div className="text-zinc-400 text-xs mb-1">Monthly Revenue</div>
                      <div className="text-2xl font-bold text-cyan-400">${dashboard.totalRevenue.toFixed(0)}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4">
                      <div className="text-zinc-400 text-xs mb-1">Marketplace Apps</div>
                      <div className="text-2xl font-bold text-purple-400">{dashboard.appCount}</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-white text-base">Revenue by Plan</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-zinc-500 text-sm">Total Revenue: <span className="text-cyan-400">${dashboard.totalRevenue}/mo</span></div>
                    </CardContent>
                  </Card>

                  <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-white text-base">Top Marketplace Apps</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-zinc-500 text-sm">Total Installs: <span className="text-purple-400">{dashboard.totalInstalls}</span></div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <div className="text-zinc-500 text-sm p-8 text-center bg-zinc-900 rounded-lg">Loading dashboard...</div>
            )}
          </div>
        )}

        {/* Plans */}
        {activeTab === "plans" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Subscription Plans</h2>
              <Button size="sm" onClick={() => seedPlansMutation.mutate()} disabled={seedPlansMutation.isPending}>
                <Plus className="w-4 h-4 mr-1" /> Seed Default Plans
              </Button>
            </div>
            {plans?.length === 0 ? (
              <div className="text-zinc-500 text-sm p-8 text-center bg-zinc-900 rounded-lg">No plans. Click "Seed Default Plans" to create starter, professional, and enterprise plans.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans?.map((plan) => (
                  <Card key={plan.id} className={`bg-zinc-900 border-zinc-800 ${!plan.isActive ? "opacity-60" : ""}`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="text-lg font-bold text-white">{plan.name}</div>
                          <div className="text-xs font-mono text-cyan-400">{plan.planId}</div>
                        </div>
                        <Badge variant="outline" className={`text-xs ${plan.isActive ? STATUS_COLORS.active : STATUS_COLORS.inactive}`}>
                          {plan.isActive ? "active" : "inactive"}
                        </Badge>
                      </div>
                      {plan.description && <p className="text-xs text-zinc-500 mb-3">{plan.description}</p>}
                      <div className="space-y-1 text-sm mb-4">
                        <div className="text-2xl font-bold text-white">
                          ${plan.pricePerWellMonthly}<span className="text-xs text-zinc-400">/well/mo</span>
                        </div>
                        {plan.pricePerWellAnnual && (
                          <div className="text-xs text-zinc-500">${plan.pricePerWellAnnual}/well/yr (annual)</div>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 space-y-1">
                        <div>Max Wells: <span className="text-zinc-300">{plan.maxWells ?? "Unlimited"}</span></div>
                        <div>Max Users: <span className="text-zinc-300">{plan.maxUsers ?? "Unlimited"}</span></div>
                        <div>Data Retention: <span className="text-zinc-300">{plan.maxDataRetentionDays}d</span></div>
                        {plan.stripePriceIdMonthly && (
                          <div className="font-mono text-xs text-purple-400">Stripe: {plan.stripePriceIdMonthly}</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Subscriptions */}
        {activeTab === "subscriptions" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Tenant Subscriptions ({subscriptions?.length ?? 0})</h2>
            {subscriptions?.length === 0 ? (
              <div className="text-zinc-500 text-sm p-8 text-center bg-zinc-900 rounded-lg">No subscriptions yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800">
                      <th className="text-left py-2 pr-4">Subscription ID</th>
                      <th className="text-left pr-4">Tenant</th>
                      <th className="text-left pr-4">Plan</th>
                      <th className="text-left pr-4">Billing</th>
                      <th className="text-right pr-4">Wells</th>
                      <th className="text-right pr-4">Revenue/mo</th>
                      <th className="text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions?.map((sub) => (
                      <tr key={sub.id} className="border-b border-zinc-800/50 text-white">
                        <td className="py-2 pr-4 font-mono text-cyan-400">{sub.subscriptionId}</td>
                        <td className="pr-4 text-zinc-300">{sub.tenantId}</td>
                        <td className="pr-4 text-zinc-300">{sub.planId}</td>
                        <td className="pr-4 text-zinc-400">{sub.billingCycle}</td>
                        <td className="text-right pr-4">{sub.wellCount}</td>
                        <td className="text-right pr-4 text-cyan-400">${sub.monthlyRevenue?.toFixed(0) ?? "—"}</td>
                        <td>
                          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[sub.status] ?? ""}`}>
                            {sub.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Marketplace */}
        {activeTab === "marketplace" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Analytics Marketplace ({marketplaceApps?.length ?? 0})</h2>
              <Button size="sm" onClick={() => seedAppsMutation.mutate()} disabled={seedAppsMutation.isPending}>
                <Plus className="w-4 h-4 mr-1" /> Seed Default Apps
              </Button>
            </div>

            {marketplaceApps?.length === 0 ? (
              <div className="text-zinc-500 text-sm p-8 text-center bg-zinc-900 rounded-lg">No marketplace apps. Click "Seed Default Apps" to populate the marketplace.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {marketplaceApps?.map((app) => {
                  const isInstalled = installedApps?.some((i) => i.appId === app.appId);
                  return (
                    <Card key={app.id} className="bg-zinc-900 border-zinc-800">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium text-white">{app.name}</div>
                              <Badge variant="outline" className={`text-xs ${app.isActive ? STATUS_COLORS.active : STATUS_COLORS.inactive}`}>
                                {app.isActive ? "active" : "inactive"}
                              </Badge>
                            </div>
                            <div className="text-xs text-zinc-500 mt-1">{app.category} · v{app.version}</div>
                            <div className="text-xs text-zinc-600">by {app.author}</div>
                          </div>
                        </div>
                        {app.description && (
                          <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{app.description}</p>
                        )}
                        <div className="text-xs text-zinc-500 space-y-1 mb-3">
                          <div>Runtime: <span className="text-zinc-300">{app.runtime}</span></div>
                          <div>Installs: <span className="text-zinc-300">{app.installCount}</span></div>
                          {app.pricingModel !== "free" && (
                            <div>Price: <span className="text-cyan-400">${app.priceMonthly}/mo</span></div>
                          )}
                          {app.pricingModel === "free" && (
                            <div>Price: <span className="text-green-400">Free</span></div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {!isInstalled ? (
                            <Button size="sm" className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-xs" onClick={() => installAppMutation.mutate({ appId: app.appId, tenantId: "default-tenant" })} disabled={installAppMutation.isPending}>
                              <Download className="w-3 h-3 mr-1" /> Install
                            </Button>
                          ) : (
                            <>
                              <Badge variant="outline" className="text-xs text-green-400 border-green-500/30 flex-1 justify-center py-1">
                                ✓ Installed
                              </Badge>
                              <Button size="sm" variant="outline" className="text-xs" onClick={() => runAppMutation.mutate({ appId: app.appId, tenantId: "default-tenant", inputData: {} })} disabled={runAppMutation.isPending}>
                                <Play className="w-3 h-3 mr-1" /> Run
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Installed Apps */}
            {installedApps && installedApps.length > 0 && (
              <div>
                <h3 className="text-base font-semibold text-white mb-3">Installed Apps ({installedApps.length})</h3>
                <div className="space-y-2">
                  {installedApps.map((inst) => (
                    <div key={inst.id} className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-white">{inst.appId}</div>
                        <div className="text-xs text-zinc-500">
                          Installed: {new Date(inst.installedAt).toLocaleDateString()} · Runs: {inst.runCount}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${inst.isActive ? STATUS_COLORS.active : STATUS_COLORS.inactive}`}>
                          {inst.isActive ? "active" : "inactive"}
                        </Badge>
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => runAppMutation.mutate({ appId: inst.appId, tenantId: "default-tenant", inputData: {} })} disabled={runAppMutation.isPending}>
                          <Zap className="w-3 h-3 mr-1" /> Run
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
