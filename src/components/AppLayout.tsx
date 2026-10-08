import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";
import { toast } from "sonner";
import { useComplaintNotifications } from "@/hooks/useComplaintNotifications";

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppLayoutContent />
    </SidebarProvider>
  );
}

const regularPagePreloaders = [
  ["dashboard", () => import("@/pages/Dashboard")],
  ["partner", () => import("@/pages/Partner")],
  ["customer-data", () => import("@/pages/CustomerData")],
  ["vendor-database", () => import("@/pages/VendorDatabase")],
  ["contacts", () => import("@/pages/Contacts")],
  ["outreach-mill", () => import("@/pages/OutreachMill")],
  ["leads", () => import("@/pages/Leads")],
  ["opportunities", () => import("@/pages/Opportunities")],
  ["quotations", () => import("@/pages/Quotations")],
  ["sales-orders", () => import("@/pages/SalesOrders")],
  ["contracts", () => import("@/pages/Contracts")],
  ["purchase-requests", () => import("@/pages/PurchaseRequests")],
  ["rfqs", () => import("@/pages/RFQs")],
  ["vendor-quotations", () => import("@/pages/VendorQuotations")],
  ["purchase-comparison", () => import("@/pages/PurchaseComparison")],
  ["purchase-orders", () => import("@/pages/PurchaseOrders")],
  ["grn", () => import("@/pages/GRN")],
  ["dashboard", () => import("@/pages/Projects")],
  ["sites", () => import("@/pages/OperationsWorkspace")],
  ["assignments", () => import("@/pages/Assignments")],
  ["tasks", () => import("@/pages/OperationsWorkspace")],
  ["site-visit", () => import("@/pages/OperationsWorkspace")],
  ["deployment", () => import("@/pages/OperationsWorkspace")],
  ["general-costing", () => import("@/pages/GeneralCosting")],
  ["tax-gst", () => import("@/pages/TaxGST")],
  ["project-costing", () => import("@/pages/ProjectCosting")],
  ["labour-costing", () => import("@/pages/LabourCosting")],
  ["profitability", () => import("@/pages/Profitability")],
  ["domains", () => import("@/pages/Domains")],
  ["hosting", () => import("@/pages/Hosting")],
  ["ssl", () => import("@/pages/SSL")],
  ["software-licenses", () => import("@/pages/SoftwareLicenses")],
  ["sla", () => import("@/pages/SLA")],
  ["amc", () => import("@/pages/AMC")],
  ["oem-renewals", () => import("@/pages/OEMRenewals")],
  ["renewal-calendar", () => import("@/pages/RenewalCalendar")],
  ["invoices", () => import("@/pages/Invoices")],
  ["payments", () => import("@/pages/Payments")],
  ["employees", () => import("@/pages/Employees")],
  ["attendance", () => import("@/pages/Attendance")],
  ["field-attendance", () => import("@/pages/FieldAttendance")],
  ["monthly-payroll", () => import("@/pages/MonthlyPayroll")],
  ["tada-expenses", () => import("@/pages/TADAExpenses")],
  ["expense-costing", () => import("@/pages/ExpenseCosting")],
  ["profile", () => import("@/pages/Profile")],
] as const;

function AppLayoutContent() {
  const { logout, isAdmin, hasPermission } = useAuth();
  const { pathname } = useLocation();
  const { openMobile, toggleSidebar } = useSidebar();
  const mainRef = useRef<HTMLElement>(null);
  useComplaintNotifications();

  useEffect(() => {
    if (isAdmin) return;
    regularPagePreloaders.forEach(([permission, preload]) => {
      if (hasPermission(permission)) void preload();
    });
  }, [hasPermission, isAdmin]);

  useLayoutEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 sm:h-14 flex items-center justify-between border-b bg-white shadow-sm px-2 sm:px-4 gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-9 w-9 shrink-0 md:hidden"
              aria-label="Open navigation menu"
              aria-expanded={openMobile}
              title="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link
              to="/"
              className="text-xs sm:text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer truncate"
            >
              Nexus
            </Link>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all duration-200 shadow-sm text-xs sm:text-sm font-medium"
            title="Logout"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </header>
        <main ref={mainRef} className="flex-1 overflow-auto overflow-x-auto p-2 sm:p-4 md:p-6">
          <Outlet />
        </main>
        <footer className="border-t bg-card py-2 px-2 sm:px-4 md:px-6">
          <div className="flex flex-col items-center justify-center text-[8px] sm:text-[10px] text-muted-foreground gap-0.5 sm:gap-1">
            <span>© 2026 Nexus. All rights reserved.</span>
            <span className="font-medium bg-muted px-2 py-0.5 rounded-full">
              V 1.1.1
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
