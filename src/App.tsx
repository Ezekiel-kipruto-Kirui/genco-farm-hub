import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import Auth from "./pages/Auth";
import DashboardLayout from "./components/DashboardLayout";
import DashboardOverview from "./pages/DashboardOverview";
import PerformanceReport from "./pages/reportspage";
import LivestockFarmersPage from "./pages/LivestockFarmersPage";
import LivestockFarmersAnalytics from "./pages/LivestockFarmersAnalytics";
import FodderFarmersPage from "./pages/FodderFarmersPage";
import InfrastructurePage from "./pages/BoreHole";
import HayStoragepage from "./pages/HayStoragepage";
import CapacityBuildingPage from "./pages/CapacityBuildingPage";
import LivestockOfftakePage from "./pages/LivestockOfftakePage";
import ActivitiesPage from "./pages/ActivitiesPage"
import OnboardingPage from "./pages/onboardingpage";

import FodderOfftakePage from "./pages/FodderOfftakePage";
import UserManagementPage from "./pages/UserManagementPage";
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
            {/* Public Routes */}
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Protected Dashboard Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={["admin", "chief-admin"]}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              {/* Nested routes under DashboardLayout */}
              <Route index element={<DashboardOverview />} />
              
              {/* Report route - FIXED: removed leading slash */}
              <Route
                path="reports"
                element={
                  <ProtectedRoute allowedRoles={["admin", "chief-admin"]}>
                    <PerformanceReport/>
                  </ProtectedRoute>
                }
              />
              
              <Route path="livestock">
                <Route index element={<LivestockFarmersPage />} />
                <Route path="analytics" element={<LivestockFarmersAnalytics />} />
              </Route>
              <Route path="fodder" element={<FodderFarmersPage />} />
              
              {/* Infrastructure Routes */}
              <Route path="hay-storage" element={<HayStoragepage />} />
              <Route path="borehole" element={<InfrastructurePage />} />
              
              <Route path="capacity" element={<CapacityBuildingPage />} />
              
              {/* Offtake Routes */}
              <Route path="livestock-offtake">
                <Route index element={<LivestockOfftakePage />} />
              </Route>
              <Route path="fodder-offtake" element={<FodderOfftakePage />} />
              
              <Route path="activities" element={<ActivitiesPage />} />
              <Route path="onboarding" element={<OnboardingPage />} />

              {/* Admin Only Routes */}
              <Route 
                path="users" 
                element={
                  <ProtectedRoute allowedRoles={["chief-admin", "admin"]}>
                    <UserManagementPage />
                  </ProtectedRoute>
                } 
              />
            </Route>

            {/* Catch-all route for 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;