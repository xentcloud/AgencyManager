import { Link } from "@tanstack/react-router";
import { Building2, Globe, Inbox, LayoutDashboard, LogOut, Rocket, Search } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

const agencyNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Customers", icon: Building2 },
  { to: "/sites", label: "Sites", icon: Globe },
  { to: "/requests", label: "Change requests", icon: Inbox },
  { to: "/releases", label: "Releases", icon: Rocket },
  { to: "/prospects", label: "Prospects", icon: Search },
] as const;

export function AppSidebar({ name, isAgency }: { name: string; isAgency: boolean }) {
  const nav = isAgency ? agencyNav : agencyNav.filter((n) => ["/", "/sites", "/requests"].includes(n.to));
  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3 font-semibold">Agency Portal</SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{isAgency ? "Agency" : "Your business"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild>
                    <Link to={item.to} activeOptions={{ exact: item.to === "/" }} activeProps={{ "data-active": true }}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => authClient.signOut().then(() => location.assign("/login"))}>
              <LogOut />
              <span className="truncate">Sign out {name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
