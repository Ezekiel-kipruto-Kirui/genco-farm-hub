import { Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Sprout, Menu } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "./DashboardSidebar";

const DashboardLayout = () => {
  const { user, userRole, signOutUser } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <DashboardSidebar />
        
        <div className="flex-1 flex flex-col w-full min-w-0"> {/* Added min-w-0 for flexbox shrinking */}
          <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 h-16">
            <div className="w-full px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <SidebarTrigger className="flex-shrink-0" />
                <div className="w-10 h-10 sm:w-10 sm:h-10 rounded-full bg-primary/10 shadow-lg flex items-center justify-center flex-shrink-0">
                  <img src="./img/logo.png" className="rounded-full"/>
                </div>
                <div className="min-w-0 flex-1"> {/* Added for text truncation */}
                  <h1 className="text-lg sm:text-xl font-bold truncate">GenCo Company</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full bg-primary/10 text-primary font-medium whitespace-nowrap flex-shrink-0">
                  {userRole === "chief-admin" ? "Chief Admin" : "Admin"}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={signOutUser}
                  className="hidden xs:flex flex-shrink-0" // Hide on extra small screens
                >
                  <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
                {/* Mobile sign out button */}
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={signOutUser}
                  className="xs:hidden flex-shrink-0" // Show only on extra small screens
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;