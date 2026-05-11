import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ATSProvider } from "@/contexts/ATSContext";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/pages/LoginPage";
import ConfirmEmailPage from "@/pages/ConfirmEmailPage";
import DashboardPage from "@/pages/DashboardPage";
import JobsPage from "@/pages/JobsPage";
import ScreeningPage from "@/pages/ScreeningPage";
import RankingPage from "@/pages/RankingPage";
import InsightsPage from "@/pages/InsightsPage";
import EmailPage from "@/pages/EmailPage";
import ReportsPage from "@/pages/ReportsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ATSProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/confirm-email" element={<ConfirmEmailPage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/jobs" element={<JobsPage />} />
                <Route path="/screening" element={<ScreeningPage />} />
                <Route path="/ranking" element={<RankingPage />} />
                <Route path="/insights" element={<InsightsPage />} />
                <Route path="/email" element={<EmailPage />} />
                <Route path="/reports" element={<ReportsPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ATSProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;


