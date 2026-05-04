import React from 'react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {title && (
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        )}
        {children}
      </div>
    </div>
  );
}
