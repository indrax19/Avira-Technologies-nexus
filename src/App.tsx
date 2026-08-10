import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { ActivityProvider } from "@/context/ActivityContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { NotificationPermissionPrompt } from "@/components/NotificationPermissionPrompt";
import { NetworkStatusBar } from "@/components/NetworkStatusBar";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import MasterDashboard from "@/pages/MasterDashboard";
import CompanyDashboard from "@/pages/CompanyDashboard";
import NotFound from "@/pages/NotFound";

// Lazy load all route components for code splitting
const Invoices = lazy(() => import("@/pages/Invoices"));
const NewInvoice = lazy(() => import("@/pages/NewInvoice"));
const Settings = lazy(() => import("@/pages/Settings"));
const Profile = lazy(() => import("@/pages/Profile"));
const ManageUsers = lazy(() => import("@/pages/ManageUsers"));
const ProjectTracking = lazy(() => import("@/pages/ProjectTracking"));
const Projects = lazy(() => import("@/pages/Projects"));
const ProjectDetail = lazy(() => import("@/pages/ProjectDetail"));
const ProjectSiteForm = lazy(() => import("@/pages/ProjectSiteForm"));
const OutreachMill = lazy(() => import("@/pages/OutreachMill"));
const CustomerData = lazy(() => import("@/pages/CustomerData"));

// Loading Fallback Component
const PageLoader = () => (
  <Card className="mt-8">
    <CardContent className="flex flex-col items-center justify-center py-12">
      <div className="space-y-3 text-center">
        <img src="/avira-logo.webp" alt="Avira Technologies" className="h-12 w-auto mx-auto mb-4 animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </CardContent>
  </Card>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh
      gcTime: 1000 * 60 * 30, // 30 minutes - cache retention time (increased from 10)
      retry: 1,
      // Prevent Firebase AbortError by disabling query cancellation
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      networkMode: 'always',
    },
    mutations: {
      retry: 1,
      networkMode: 'always',
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <NetworkStatusBar />
      <BrowserRouter>
        <AuthProvider>
          <ActivityProvider>
            <NotificationPermissionPrompt />
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<MasterDashboard />} />
              <Route path="/companies/:companyId" element={<CompanyDashboard />} />
            </Route>
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
                <Route path="/invoices" element={<ProtectedRoute requiredPermission="invoices"><Suspense fallback={<PageLoader />}><Invoices /></Suspense></ProtectedRoute>} />
              <Route path="/invoices/new" element={<ProtectedRoute requiredPermission="invoices"><Suspense fallback={<PageLoader />}><NewInvoice /></Suspense></ProtectedRoute>} />
              <Route path="/invoices/:id" element={<ProtectedRoute requiredPermission="invoices"><Suspense fallback={<PageLoader />}><NewInvoice /></Suspense></ProtectedRoute>} />
              <Route path="/project-tracking" element={<ProtectedRoute requiredPermission="project-tracking"><Suspense fallback={<PageLoader />}><ProjectTracking /></Suspense></ProtectedRoute>} />
              <Route path="/outreach-mill" element={<ProtectedRoute requiredPermission="outreach-mill"><Suspense fallback={<PageLoader />}><OutreachMill /></Suspense></ProtectedRoute>} />
              <Route path="/customer-data" element={<ProtectedRoute requiredPermission="customer-data"><Suspense fallback={<PageLoader />}><CustomerData /></Suspense></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute requiredPermission="project-tracking"><Suspense fallback={<PageLoader />}><Projects /></Suspense></ProtectedRoute>} />
              <Route path="/projects/:id" element={<ProtectedRoute requiredPermission="project-tracking"><Suspense fallback={<PageLoader />}><ProjectDetail /></Suspense></ProtectedRoute>} />
              <Route path="/project-sites/new/:projectId" element={<ProtectedRoute requiredPermission="project-tracking"><Suspense fallback={<PageLoader />}><ProjectSiteForm /></Suspense></ProtectedRoute>} />
              <Route path="/project-sites/:siteId/:projectId" element={<ProtectedRoute requiredPermission="project-tracking"><Suspense fallback={<PageLoader />}><ProjectSiteForm /></Suspense></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute requiredPermission="settings"><Suspense fallback={<PageLoader />}><Settings /></Suspense></ProtectedRoute>} />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute requireAdmin>
                    <Suspense fallback={<PageLoader />}><Profile /></Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage-users"
                element={
                  <ProtectedRoute requireAdmin>
                    <Suspense fallback={<PageLoader />}><ManageUsers /></Suspense>
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ActivityProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
