"use client";

import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface-950">
      <Sidebar />
      <main className="flex-1 pl-[68px] lg:pl-60">
        <TopBar />
        <div className="relative p-4 lg:p-6">
          {/* Subtle background gradient */}
          <div className="pointer-events-none fixed inset-0 z-0 pl-[68px] lg:pl-60" aria-hidden="true">
            <div className="absolute top-0 right-0 w-[600px] h-[400px] opacity-30"
              style={{ background: "radial-gradient(ellipse at top right, rgba(16, 185, 129, 0.06) 0%, transparent 60%)" }}
            />
          </div>
          <div className="relative z-10">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
