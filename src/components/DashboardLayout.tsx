import { Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Sprout } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "./DashboardSidebar";

const DashboardLayout = () => {
  const { user, userRole, signOutUser } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <DashboardSidebar />
        
        <div className="flex-1 flex flex-col w-full">
          <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 h-16">
            <div className="container mx-auto px-4 h-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sprout className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">GenCo Agriculture</h1>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                  {userRole === "chief-admin" ? "Chief Admin" : "Admin"}
                </span>
                <Button variant="outline" size="sm" onClick={signOutUser}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            <div className="container mx-auto px-4 py-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
