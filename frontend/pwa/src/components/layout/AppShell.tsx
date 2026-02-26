"use client";

import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pl-16 lg:pl-56">
        <TopBar />
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
}
