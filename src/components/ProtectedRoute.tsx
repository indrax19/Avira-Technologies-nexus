import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requiredPermission?: string; // Permission ID required to access this route
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  requiredPermission,
}) => {
  const { isAuthenticated, isAdmin, loading, appUser } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requiredPermission) {
    const permissions = appUser?.permissions || [];
    const legacyProjectPages = new Set([
      "dashboard", "contacts", "leads", "opportunities", "quotations", "sales-orders", "contracts",
      "purchase-requests", "rfqs", "vendor-quotations", "purchase-comparison", "purchase-orders", "grn",
      "assignments", "domains", "hosting", "ssl", "software-licenses", "sla", "amc", "oem-renewals",
      "renewal-calendar", "payments", "employees", "attendance", "field-attendance", "monthly-payroll",
      "tada-expenses", "sites", "tasks", "site-visit", "deployment",
    ]);
    const hasLegacyAccess = requiredPermission === "partner"
      ? permissions.includes("customer-data")
      : legacyProjectPages.has(requiredPermission) && permissions.includes("project-tracking");

    if (!isAdmin && !permissions.includes(requiredPermission) && !hasLegacyAccess) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};
