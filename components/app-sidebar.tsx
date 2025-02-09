'use client';

import { Plus, Sidebar as SidebarIcon, Sparkles } from "lucide-react";
import { SidebarHistory } from "@/components/sidebar-history";
import {
  Sidebar,
  SidebarContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import Link from "next/link";

export function AppSidebar() {
  const { setOpenMobile, toggleSidebar } = useSidebar();

  return (
    <Sidebar collapsible="icon" side="left">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarGroupLabel className="text-md font-bold">
            Hello World Computer
          </SidebarGroupLabel>
          <SidebarMenuButton onClick={toggleSidebar}>
            <SidebarIcon /> Toggle Sidebar
          </SidebarMenuButton>
          <SidebarMenuButton asChild>
            <Link href="/" onClick={() => setOpenMobile(false)}>
              <Plus />
              New Chat
            </Link>
          </SidebarMenuButton>
          <SidebarMenuButton asChild>
            <Link href="/starter-kits" onClick={() => setOpenMobile(false)}>
              <Sparkles />
              Starter Kits
            </Link>
          </SidebarMenuButton>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory />
      </SidebarContent>
    </Sidebar>
  );
}
