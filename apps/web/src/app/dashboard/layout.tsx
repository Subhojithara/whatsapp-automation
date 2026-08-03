"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-100 dark:bg-[#09090b] p-2.5 gap-2.5 antialiased transition-colors duration-200">
      {/* Left Sidebar Panel */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
      />

      {/* Right Main Container Panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0c0c0e] border border-zinc-200/90 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-md dark:shadow-2xl transition-colors duration-200">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
