import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DashboardLayout from "./components/DashboardLayout";
import DashboardOverview from "./pages/DashboardOverview";
import LivestockFarmersPage from "./pages/LivestockFarmersPage";
import LivestockFarmersAnalytics from "./pages/LivestockFarmersAnalytics";
import FodderFarmersPage from "./pages/FodderFarmersPage";
import FodderFarmersAnalytics from "./pages/FodderFarmersAnalytics";
import InfrastructurePage from "./pages/InfrastructurePage";
import InfrastructureAnalytics from "./pages/InfrastructureAnalytics";
import CapacityBuildingPage from "./pages/CapacityBuildingPage";
import CapacityBuildingAnalytics from "./pages/CapacityBuildingAnalytics";
import LivestockOfftakePage from "./pages/LivestockOfftakePage";
import LivestockOfftakeAnalytics from "./pages/LivestockOfftakeAnalytics";
import FodderOfftakePage from "./pages/FodderOfftakePage";
import FodderOfftakeAnalytics from "./pages/FodderOfftakeAnalytics";
import UserManagementPage from "./pages/UserManagementPage";
import UserManagementAnalytics from "./pages/UserManagementAnalytics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={["admin", "chief-admin"]}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardOverview />} />
              <Route path="livestock" element={<LivestockFarmersPage />} />
              <Route path="livestock/analytics" element={<LivestockFarmersAnalytics />} />
              <Route path="fodder" element={<FodderFarmersPage />} />
              <Route path="fodder/analytics" element={<FodderFarmersAnalytics />} />
              <Route path="infrastructure" element={<InfrastructurePage />} />
              <Route path="infrastructure/analytics" element={<InfrastructureAnalytics />} />
              <Route path="capacity" element={<CapacityBuildingPage />} />
              <Route path="capacity/analytics" element={<CapacityBuildingAnalytics />} />
              <Route path="livestock-offtake" element={<LivestockOfftakePage />} />
              <Route path="livestock-offtake/analytics" element={<LivestockOfftakeAnalytics />} />
              <Route path="fodder-offtake" element={<FodderOfftakePage />} />
              <Route path="fodder-offtake/analytics" element={<FodderOfftakeAnalytics />} />
              <Route 
                path="users" 
                element={
                  <ProtectedRoute allowedRoles={["chief-admin"]}>
                    <UserManagementPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="users/analytics" 
                element={
                  <ProtectedRoute allowedRoles={["chief-admin"]}>
                    <UserManagementAnalytics />
                  </ProtectedRoute>
                } 
              />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
