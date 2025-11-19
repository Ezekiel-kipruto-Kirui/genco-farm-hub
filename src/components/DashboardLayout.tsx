import { Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "./DashboardSidebar";
import { fetchData } from "@/lib/firebase";
import { useState, useEffect } from "react";
interface AppUser {
  
  email: string;
  name?: string; // optional, prevents TS errors
}
const DashboardLayout = () => {
  const { user, userRole, signOutUser } = useAuth();
  const [username, setUsername] = useState("");

 useEffect(() => {
  const getUser = async () => {
    if (!user?.email) return;
    
    try {
      const data = await fetchData();
      const users: AppUser[] = data?.users || [];

      // Find user by email
      const userData = users.find((u) => u.email === user.email);

      // Set username safely
      setUsername(userData?.name || user.email);
      
    } catch (error) {
      console.error("Error fetching user:", error);
      setUsername(user.email || "User");
    }
  };

  getUser();
}, [user?.email]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-primary/5 via-background to-accent/5">
        
        <DashboardSidebar />

        <div className="flex-1 flex flex-col w-full min-w-0">
          <header className="border-b bg-card/50 bg-white sticky top-0 z-10 h-16">
            <div className="w-full px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">

              <div className="flex items-center gap-2 sm:gap-3">
                <SidebarTrigger className="flex-shrink-0" />
                <p className="text-sm text-muted-foreground truncate">
                  {username || user?.email || "User"}
                </p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full bg-primary/10 text-primary font-medium whitespace-nowrap flex-shrink-0">
                  {userRole === "chief-admin" ? "Chief Admin" : "Admin"}
                </span>

                {/* Desktop signout */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={signOutUser}
                  className="hidden xs:flex flex-shrink-0"
                >
                  <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>

                {/* Mobile signout */}
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={signOutUser}
                  className="xs:hidden flex-shrink-0"
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