import { Sprout, Wheat, Building2, GraduationCap, TrendingUp, Users, BarChart3, Database } from "lucide-react";
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

const menuItems = [
  { 
    title: "Livestock Farmers", 
    icon: Sprout,
    subItems: [
      { title: "Dashboard", url: "/dashboard/livestock/analytics", icon: BarChart3 },
      { title: "Data", url: "/dashboard/livestock", icon: Database },
    ]
  },
  { 
    title: "Fodder Farmers", 
    icon: Wheat,
    subItems: [
      { title: "Dashboard", url: "/dashboard/fodder/analytics", icon: BarChart3 },
      { title: "Data", url: "/dashboard/fodder", icon: Database },
    ]
  },
  { 
    title: "Infrastructure", 
    icon: Building2,
    subItems: [
      { title: "Dashboard", url: "/dashboard/infrastructure/analytics", icon: BarChart3 },
      { title: "Data", url: "/dashboard/infrastructure", icon: Database },
    ]
  },
  { 
    title: "Capacity Building", 
    icon: GraduationCap,
    subItems: [
      { title: "Dashboard", url: "/dashboard/capacity/analytics", icon: BarChart3 },
      { title: "Data", url: "/dashboard/capacity", icon: Database },
    ]
  },
  { 
    title: "Livestock Offtake", 
    icon: TrendingUp,
    subItems: [
      { title: "Dashboard", url: "/dashboard/livestock-offtake/analytics", icon: BarChart3 },
      { title: "Data", url: "/dashboard/livestock-offtake", icon: Database },
    ]
  },
  { 
    title: "Fodder Offtake", 
    icon: Wheat,
    subItems: [
      { title: "Dashboard", url: "/dashboard/fodder-offtake/analytics", icon: BarChart3 },
      { title: "Data", url: "/dashboard/fodder-offtake", icon: Database },
    ]
  },
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const { userRole } = useAuth();
  const collapsed = state === "collapsed";

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 font-display">
            Overview
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink 
                    to="/dashboard" 
                    end
                    className="hover:bg-sidebar-accent text-sidebar-foreground" 
                    activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                  >
                    <TrendingUp className="h-4 w-4" />
                    {!collapsed && <span>Dashboard</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 font-display">
            Data Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <Collapsible key={item.title} defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="hover:bg-sidebar-accent text-sidebar-foreground">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && (
                          <>
                            <span>{item.title}</span>
                            <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                          </>
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    {!collapsed && (
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.subItems.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild>
                                <NavLink 
                                  to={subItem.url}
                                  className="hover:bg-sidebar-accent text-sidebar-foreground/80"
                                  activeClassName="bg-sidebar-primary/20 text-sidebar-primary font-medium"
                                >
                                  <subItem.icon className="h-3.5 w-3.5" />
                                  <span>{subItem.title}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    )}
                  </SidebarMenuItem>
                </Collapsible>
              ))}
              
              {userRole === "chief-admin" && (
                <Collapsible defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="hover:bg-sidebar-accent text-sidebar-foreground">
                        <Users className="h-4 w-4" />
                        {!collapsed && (
                          <>
                            <span>User Management</span>
                            <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                          </>
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    {!collapsed && (
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild>
                              <NavLink 
                                to="/dashboard/users/analytics"
                                className="hover:bg-sidebar-accent text-sidebar-foreground/80"
                                activeClassName="bg-sidebar-primary/20 text-sidebar-primary font-medium"
                              >
                                <BarChart3 className="h-3.5 w-3.5" />
                                <span>Dashboard</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild>
                              <NavLink 
                                to="/dashboard/users"
                                className="hover:bg-sidebar-accent text-sidebar-foreground/80"
                                activeClassName="bg-sidebar-primary/20 text-sidebar-primary font-medium"
                              >
                                <Database className="h-3.5 w-3.5" />
                                <span>Data</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    )}
                  </SidebarMenuItem>
                </Collapsible>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
