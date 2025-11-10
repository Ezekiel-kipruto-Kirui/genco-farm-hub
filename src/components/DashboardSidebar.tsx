import { Sprout, Wheat, Building2, GraduationCap, TrendingUp, Users } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";

const menuItems = [
  { title: "Overview", url: "/dashboard", icon: TrendingUp },
  { title: "Livestock Farmers", url: "/dashboard/livestock", icon: Sprout },
  { title: "Fodder Farmers", url: "/dashboard/fodder", icon: Wheat },
  { title: "Infrastructure", url: "/dashboard/infrastructure", icon: Building2 },
  { title: "Capacity Building", url: "/dashboard/capacity", icon: GraduationCap },
  { title: "Livestock Offtake", url: "/dashboard/livestock-offtake", icon: TrendingUp },
  { title: "Fodder Offtake", url: "/dashboard/fodder-offtake", icon: Wheat },
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const { userRole } = useAuth();
  const collapsed = state === "collapsed";

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Data Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end={item.url === "/dashboard"}
                      className="hover:bg-muted/50" 
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {userRole === "chief-admin" && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/dashboard/users" 
                      className="hover:bg-muted/50" 
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <Users className="h-4 w-4" />
                      {!collapsed && <span>User Management</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
