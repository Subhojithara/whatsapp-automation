"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { NavSidebar } from "@/components/ui/NavSidebar";
import { Header } from "@/components/layout/header";
import { MobileDrawer } from "@/components/ui/MobileDrawer";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const pathname = usePathname();
  const isChat = pathname === "/dashboard/chat";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-100 dark:bg-[#09090b] p-0 md:p-2.5 gap-0 md:gap-2.5 antialiased transition-colors duration-200">
      {/* Desktop Left Sidebar (rareui NavSidebar) */}
      <NavSidebar
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
      />

      {/* Slide-over Navigation Drawer for Mobile Screens */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
      />

      {/* Right Main Container Panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0c0c0e] border-0 md:border border-zinc-200/90 dark:border-zinc-800/80 rounded-none md:rounded-2xl overflow-hidden shadow-none md:shadow-md dark:shadow-2xl transition-colors duration-200">
        <Header onOpenMobileMenu={() => setIsMobileDrawerOpen(true)} />
        <main
          className={`flex-1 relative ${
            isChat ? "overflow-hidden p-0" : "overflow-y-auto p-4 md:p-8 space-y-6"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
