"use client";

import { useSearchParams } from "next/navigation";
import { PortalSidebar } from "./PortalSidebar";

export function PortalSidebarWrapper({ isAdmin }: { isAdmin: boolean }) {
  const searchParams = useSearchParams();
  const currentView = isAdmin ? (searchParams.get("view") || "admin") : "user";

  return <PortalSidebar isAdmin={isAdmin} currentView={currentView} />;
}

