import { useEffect, useMemo, useState } from "react";
import { Fingerprint, Smartphone, ShieldCheck, Workflow } from "lucide-react";

import ProductShell from "@/components/ProductShell";
import {
  formatRelativeIso,
  getAuthContext,
  getPlatformOverview,
  type AuthContextResponse,
  type OverviewResponse,
  type ProductSurface,
  type ServiceHealth,
} from "@/lib/platform";

// Design philosophy: make non-product-critical services visible in the same operating shell
// so identity and channel layers stop living as invisible infrastructure.
function fallbackService(name: string, description: string, route: string): ServiceHealth {
  return {
    name,
    route,
    status: "degraded",
    description,
    latencyMs: 0,
    dependencies: [],
  };
}

function statusTone(status: ServiceHealth["status"]) {
  switch (status) {
    case "healthy":
      return "border-emerald-300/30 bg-emerald-500/10 text-emerald-200";
    case "degraded":
      return "border-amber-300/30 bg-amber-300/10 text-amber-100";
    case "down":
      return "border-rose-400/30 bg-rose-500/10 text-rose-100";
    default:
      return "border-white/10 bg-white/5 text-stone-100";
  }
}

export default function IdentityChannelsWorkspace() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [authContext, setAuthContext] = useState<AuthContextResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [platform, auth] = await Promise.all([getPlatformOverview(), getAuthContext("operations")]);
        if (!active) {
          return;
        }

        setOverview(platform);
        setAuthContext(auth);
        setError(null);
      } catch (issue) {
        if (!active) {
          return;
        }

        setError(issue instanceof Error ? issue.message : "Unable to load identity and channel controls.");
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const products: ProductSurface[] = useMemo(() => overview?.products ?? [], [overview]);
  const services: ServiceHealth[] = useMemo(() => {
    const discovered = overview?.serviceHealth ?? [];
    const authService = discovered.find((item) => item.name === "Auth service") || fallbackService("Auth service", "Realm, issuer, and role-derived operator access context.", "/identity-channels");
    const ussdService = discovered.find((item) => item.name === "USSD gateway") || fallbackService("USSD gateway", "Session-based feature-phone banking channel still lacks an explicit shell proxy.", "/identity-channels");
    return [authService, ussdService];
  }, [overview]);

  return (
    <ProductShell
      products={products}
      services={services}
      eyebrow="Identity and channels"
      title="Authentication context and USSD channel posture inside the main platform shell."
      summary="This workspace promotes infrastructure-grade services into operator-visible surfaces. Authentication context is already bridged into the web shell, while the USSD channel is made visible as a tracked operational dependency instead of remaining an unexposed side system."
    >
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-4">
          <article className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5 shadow-lg shadow-black/20">
            <div className="flex items-center gap-3 text-amber-200">
              <Fingerprint size={18} />
              <p className="text-xs uppercase tracking-[0.24em]">Identity plane</p>
            </div>
            <h2 className="mt-4 font-serif text-3xl text-white">Auth context already reaches the web shell.</h2>
            <p className="mt-3 text-sm leading-7 text-stone-300">
              The active shell exposes an authentication context bridge, which means operator role, tenant, issuer, default route, and exported permissions can be observed without leaving the platform shell.
            </p>
            {authContext ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.3rem] border border-white/10 bg-stone-950/55 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Tenant</p>
                  <p className="mt-2 text-sm font-semibold text-white">{authContext.tenantId}</p>
                </div>
                <div className="rounded-[1.3rem] border border-white/10 bg-stone-950/55 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Issuer</p>
                  <p className="mt-2 text-sm font-semibold text-white">{authContext.issuer}</p>
                </div>
                <div className="rounded-[1.3rem] border border-white/10 bg-stone-950/55 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Actor</p>
                  <p className="mt-2 text-sm font-semibold text-white">{authContext.actorId}</p>
                </div>
                <div className="rounded-[1.3rem] border border-white/10 bg-stone-950/55 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Default route</p>
                  <p className="mt-2 text-sm font-semibold text-white">{authContext.defaultRoute}</p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-stone-400">Loading live authentication context…</p>
            )}
          </article>

          <article className="rounded-[1.8rem] border border-amber-300/20 bg-amber-300/10 p-5 shadow-lg shadow-black/20">
            <div className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-300/20 text-amber-100">
                <Smartphone size={18} />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-white">USSD remains shell-visible even though no web proxy is present yet.</h3>
                <p className="mt-2 text-sm leading-7 text-amber-50/90">
                  The audit confirmed that the USSD gateway is deeply implemented in the baseline services but still lacks an explicit route or API façade in the active web shell. This workspace closes the visibility gap and keeps the mobile-channel dependency in the operator flow until a direct proxy is introduced.
                </p>
              </div>
            </div>
          </article>
        </section>

        <section className="space-y-4">
          <article className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5 shadow-lg shadow-black/20">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-amber-300/75">Service posture</p>
                <h3 className="mt-3 font-serif text-3xl text-white">Identity and channel dependencies</h3>
              </div>
              <p className="text-sm text-stone-400">Updated {formatRelativeIso(overview?.asOf || authContext?.asOf)}</p>
            </div>
            <div className="mt-5 space-y-3">
              {services.map((service) => (
                <article key={service.name} className="rounded-[1.3rem] border border-white/10 bg-stone-950/55 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{service.name}</p>
                      <p className="mt-2 text-sm leading-7 text-stone-300">{service.description}</p>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-stone-500">
                        Route {service.route} · Latency {service.latencyMs ?? 0} ms
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em] ${statusTone(service.status)}`}>
                      {service.status}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5 shadow-lg shadow-black/20">
            <div className="flex items-center gap-3 text-amber-200">
              <Workflow size={18} />
              <p className="text-xs uppercase tracking-[0.24em]">Current integration state</p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.3rem] border border-emerald-300/20 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-2 text-emerald-100">
                  <ShieldCheck size={16} />
                  <p className="text-xs uppercase tracking-[0.2em]">Confirmed wired</p>
                </div>
                <p className="mt-3 text-sm leading-7 text-emerald-50/90">
                  Authentication context is actively bridged through the shell API and contributes operator identity, permissions, and route defaults to the live web surface.
                </p>
              </div>
              <div className="rounded-[1.3rem] border border-amber-300/20 bg-amber-300/10 p-4">
                <div className="flex items-center gap-2 text-amber-100">
                  <Smartphone size={16} />
                  <p className="text-xs uppercase tracking-[0.2em]">Visible but not proxied</p>
                </div>
                <p className="mt-3 text-sm leading-7 text-amber-50/90">
                  The USSD gateway is now represented in the main shell as an operational dependency, but a direct web-facing API bridge still remains a separate implementation task.
                </p>
              </div>
            </div>
            {error ? <p className="mt-4 text-sm text-rose-100">{error}</p> : null}
          </article>
        </section>
      </div>
    </ProductShell>
  );
}
