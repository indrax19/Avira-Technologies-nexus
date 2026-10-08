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
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

// Lazy load all route components for code splitting
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const NewInvoice = lazy(() => import("@/pages/NewInvoice"));
const Settings = lazy(() => import("@/pages/Settings"));
const Profile = lazy(() => import("@/pages/Profile"));
const ManageUsers = lazy(() => import("@/pages/ManageUsers"));
const Projects = lazy(() => import("@/pages/Projects"));
const ProjectDetail = lazy(() => import("@/pages/ProjectDetail"));
const ProjectSiteForm = lazy(() => import("@/pages/ProjectSiteForm"));
const OutreachMill = lazy(() => import("@/pages/OutreachMill"));
const CustomerData = lazy(() => import("@/pages/CustomerData"));
const Partner = lazy(() => import("@/pages/Partner"));
const VendorDatabase = lazy(() => import("@/pages/VendorDatabase"));
const GeneralCosting = lazy(() => import("@/pages/GeneralCosting"));
const TaxGST = lazy(() => import("@/pages/TaxGST"));
const ProjectCosting = lazy(() => import("@/pages/ProjectCosting"));
const LabourCosting = lazy(() => import("@/pages/LabourCosting"));
const ExpenseCosting = lazy(() => import("@/pages/ExpenseCosting"));
const Profitability = lazy(() => import("@/pages/Profitability"));
const OperationsWorkspace = lazy(() => import("@/pages/OperationsWorkspace"));
const Contacts = lazy(() => import("@/pages/Contacts"));
const Leads = lazy(() => import("@/pages/Leads"));
const Opportunities = lazy(() => import("@/pages/Opportunities"));
const Quotations = lazy(() => import("@/pages/Quotations"));
const SalesOrders = lazy(() => import("@/pages/SalesOrders"));
const Contracts = lazy(() => import("@/pages/Contracts"));
const PurchaseRequests = lazy(() => import("@/pages/PurchaseRequests"));
const RFQs = lazy(() => import("@/pages/RFQs"));
const VendorQuotations = lazy(() => import("@/pages/VendorQuotations"));
const PurchaseComparison = lazy(() => import("@/pages/PurchaseComparison"));
const PurchaseOrders = lazy(() => import("@/pages/PurchaseOrders"));
const GRN = lazy(() => import("@/pages/GRN"));
const Assignments = lazy(() => import("@/pages/Assignments"));
const Domains = lazy(() => import("@/pages/Domains"));
const Hosting = lazy(() => import("@/pages/Hosting"));
const SSL = lazy(() => import("@/pages/SSL"));
const SoftwareLicenses = lazy(() => import("@/pages/SoftwareLicenses"));
const SLA = lazy(() => import("@/pages/SLA"));
const AMC = lazy(() => import("@/pages/AMC"));
const OEMRenewals = lazy(() => import("@/pages/OEMRenewals"));
const RenewalCalendar = lazy(() => import("@/pages/RenewalCalendar"));
const Payments = lazy(() => import("@/pages/Payments"));
const Employees = lazy(() => import("@/pages/Employees"));
const Attendance = lazy(() => import("@/pages/Attendance"));
const FieldAttendance = lazy(() => import("@/pages/FieldAttendance"));
const MonthlyPayroll = lazy(() => import("@/pages/MonthlyPayroll"));
const TADAExpenses = lazy(() => import("@/pages/TADAExpenses"));
const DailyWageRequestForm = lazy(() => import("@/pages/DailyWageRequestForm"));
const RequestTypeForm = lazy(() => import("@/pages/RequestTypeForm"));

const workingRoutes = [
  ["/contacts", Contacts, "contacts"], ["/leads", Leads, "leads"], ["/opportunities", Opportunities, "opportunities"],
  ["/quotations", Quotations, "quotations"], ["/sales-orders", SalesOrders, "sales-orders"], ["/contracts", Contracts, "contracts"],
  ["/purchase-requests", PurchaseRequests, "purchase-requests"], ["/rfqs", RFQs, "rfqs"], ["/vendor-quotations", VendorQuotations, "vendor-quotations"],
  ["/purchase-comparison", PurchaseComparison, "purchase-comparison"], ["/purchase-orders", PurchaseOrders, "purchase-orders"], ["/grn", GRN, "grn"],
  ["/assignments", Assignments, "assignments"], ["/domains", Domains, "domains"], ["/hosting", Hosting, "hosting"], ["/ssl", SSL, "ssl"],
  ["/software-licenses", SoftwareLicenses, "software-licenses"], ["/sla", SLA, "sla"], ["/amc", AMC, "amc"], ["/oem-renewals", OEMRenewals, "oem-renewals"],
  ["/renewal-calendar", RenewalCalendar, "renewal-calendar"], ["/payments", Payments, "payments"], ["/employees", Employees, "employees"],
  ["/attendance", Attendance, "attendance"], ["/field-attendance", FieldAttendance, "field-attendance"], ["/monthly-payroll", MonthlyPayroll, "monthly-payroll"],
  ["/tada-expenses", TADAExpenses, "tada-expenses"],
  ["/request-form/loan", RequestTypeForm, "loan-form"], ["/request-form/advance-salary", RequestTypeForm, "advance-salary"],
  ["/request-form/rental-car", RequestTypeForm, "rental-car"], ["/request-form/room-rent", RequestTypeForm, "room-rent"],
] as const;

// Loading Fallback Component
const PageLoader = () => (
  <Card className="mt-8">
    <CardContent className="flex flex-col items-center justify-center py-12">
      <div className="space-y-3 text-center">
        <img src="/nexus-logo.svg" alt="Nexus" className="h-12 w-auto mx-auto mb-4 animate-pulse" />
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
      <NetworkStatusBar />
      <BrowserRouter>
        <AuthProvider>
          <ActivityProvider>
            <NotificationPermissionPrompt />
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<ProtectedRoute requiredPermission="dashboard"><Suspense fallback={<PageLoader />}><Dashboard /></Suspense></ProtectedRoute>} />
              <Route path="/invoices" element={<ProtectedRoute requiredPermission="invoices"><Suspense fallback={<PageLoader />}><Invoices /></Suspense></ProtectedRoute>} />
              <Route path="/invoices/new" element={<ProtectedRoute requiredPermission="invoices"><Suspense fallback={<PageLoader />}><NewInvoice /></Suspense></ProtectedRoute>} />
              <Route path="/invoices/:id" element={<ProtectedRoute requiredPermission="invoices"><Suspense fallback={<PageLoader />}><NewInvoice /></Suspense></ProtectedRoute>} />
              <Route path="/outreach-mill" element={<ProtectedRoute requiredPermission="outreach-mill"><Suspense fallback={<PageLoader />}><OutreachMill /></Suspense></ProtectedRoute>} />
              <Route path="/outreach-mill/:projectId" element={<ProtectedRoute requiredPermission="outreach-mill"><Suspense fallback={<PageLoader />}><OutreachMill /></Suspense></ProtectedRoute>} />
              <Route path="/customer-data" element={<ProtectedRoute requiredPermission="customer-data"><Suspense fallback={<PageLoader />}><CustomerData /></Suspense></ProtectedRoute>} />
              <Route path="/partner" element={<ProtectedRoute requiredPermission="partner"><Suspense fallback={<PageLoader />}><Partner /></Suspense></ProtectedRoute>} />
              <Route path="/vendor-database" element={<ProtectedRoute requiredPermission="vendor-database"><Suspense fallback={<PageLoader />}><VendorDatabase /></Suspense></ProtectedRoute>} />
              <Route path="/costing/general" element={<ProtectedRoute requiredPermission="general-costing"><Suspense fallback={<PageLoader />}><GeneralCosting /></Suspense></ProtectedRoute>} />
              <Route path="/costing/tax-gst" element={<ProtectedRoute requiredPermission="tax-gst"><Suspense fallback={<PageLoader />}><TaxGST /></Suspense></ProtectedRoute>} />
              <Route path="/costing/project" element={<ProtectedRoute requiredPermission="project-costing"><Suspense fallback={<PageLoader />}><ProjectCosting /></Suspense></ProtectedRoute>} />
              <Route path="/costing/labour" element={<ProtectedRoute requiredPermission="labour-costing"><Suspense fallback={<PageLoader />}><LabourCosting /></Suspense></ProtectedRoute>} />
              <Route path="/costing/expense" element={<ProtectedRoute requiredPermission="expense-costing"><Suspense fallback={<PageLoader />}><ExpenseCosting /></Suspense></ProtectedRoute>} />
              <Route path="/costing/profitability" element={<ProtectedRoute requiredPermission="profitability"><Suspense fallback={<PageLoader />}><Profitability /></Suspense></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute requiredPermission="dashboard"><Suspense fallback={<PageLoader />}><Projects /></Suspense></ProtectedRoute>} />
              {workingRoutes.map(([path, Component, permission]) => (
                <Route
                  key={path}
                  path={path}
                  element={<ProtectedRoute requiredPermission={permission}><Suspense fallback={<PageLoader />}><Component /></Suspense></ProtectedRoute>}
                />
              ))}
              <Route path="/request-form/daily-wage" element={<ProtectedRoute requiredPermission="request-form"><Suspense fallback={<PageLoader />}><DailyWageRequestForm /></Suspense></ProtectedRoute>} />
              <Route path="/request-form" element={<Navigate to="/request-form/daily-wage" replace />} />
              <Route path="/ssl/:projectId" element={<ProtectedRoute requiredPermission="ssl"><Suspense fallback={<PageLoader />}><SSL /></Suspense></ProtectedRoute>} />
              <Route path="/software-licenses/:projectId" element={<ProtectedRoute requiredPermission="software-licenses"><Suspense fallback={<PageLoader />}><SoftwareLicenses /></Suspense></ProtectedRoute>} />
              <Route path="/amc/:projectId" element={<ProtectedRoute requiredPermission="amc"><Suspense fallback={<PageLoader />}><AMC /></Suspense></ProtectedRoute>} />
              <Route path="/sla/:projectId" element={<ProtectedRoute requiredPermission="sla"><Suspense fallback={<PageLoader />}><SLA /></Suspense></ProtectedRoute>} />
              <Route path="/projects/:id" element={<ProtectedRoute requiredPermission="project-tracking"><Suspense fallback={<PageLoader />}><ProjectDetail /></Suspense></ProtectedRoute>} />
              <Route path="/transfer-means" element={<ProtectedRoute requiredPermission="project-tracking"><Suspense fallback={<PageLoader />}><OperationsWorkspace title="Transfer Means" description="Coordinate transport and transfer arrangements for your projects." /></Suspense></ProtectedRoute>} />
              <Route path="/sites" element={<ProtectedRoute requiredPermission="sites"><Suspense fallback={<PageLoader />}><OperationsWorkspace title="Sites" description="View and manage the locations associated with your project operations." /></Suspense></ProtectedRoute>} />
              <Route path="/tasks" element={<ProtectedRoute requiredPermission="tasks"><Suspense fallback={<PageLoader />}><OperationsWorkspace title="Tasks" description="Organize and follow up on operational work across your projects." /></Suspense></ProtectedRoute>} />
              <Route path="/site-visit" element={<ProtectedRoute requiredPermission="site-visit"><Suspense fallback={<PageLoader />}><OperationsWorkspace title="Site Visit" description="Plan and track site visits for your project teams." /></Suspense></ProtectedRoute>} />
              <Route path="/deployment" element={<ProtectedRoute requiredPermission="deployment"><Suspense fallback={<PageLoader />}><OperationsWorkspace title="Deployment" description="Coordinate deployment activities and field resources." /></Suspense></ProtectedRoute>} />
              <Route path="/project-sites/new/:projectId" element={<ProtectedRoute requiredPermission="project-tracking"><Suspense fallback={<PageLoader />}><ProjectSiteForm /></Suspense></ProtectedRoute>} />
              <Route path="/project-sites/:siteId/:projectId" element={<ProtectedRoute requiredPermission="project-tracking"><Suspense fallback={<PageLoader />}><ProjectSiteForm /></Suspense></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute requiredPermission="settings"><Suspense fallback={<PageLoader />}><Settings /></Suspense></ProtectedRoute>} />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute requiredPermission="profile">
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
