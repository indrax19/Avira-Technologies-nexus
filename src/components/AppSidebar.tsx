import {
  Cake,
  Bell,
  BriefcaseBusiness,
  Calculator,
  ChevronDown,
  ClipboardList,
  Handshake,
  LayoutDashboard,
  Receipt,
  RefreshCw,
  Settings,
  Shield,
  ShoppingCart,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/context/AuthContext";
import { employeesAPI, type EmployeeData } from "@/integrations/firebase/employeesAPI";
import { domainsAPI, isDomainExpired, isDomainExpiringSoon, type DomainData } from "@/integrations/firebase/domainsAPI";
import { hostingAPI, isHostingExpiringSoon, type HostingData } from "@/integrations/firebase/hostingAPI";
import { isPartnerExpiringSoon, partnerDataAPI, type PartnerData } from "@/integrations/firebase/partnerDataAPI";
import { isBirthdayReminder } from "@/utils/birthdayReminder";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const sections = [
  {
    title: "Business Relations",
    icon: Handshake,
    items: [
      { title: "Partners", url: "/partner" },
      { title: "Customers", url: "/customer-data" },
      { title: "Vendors", url: "/vendor-database" },
      { title: "Contacts", url: "/contacts" },
      { title: "Outreach & Activities", url: "/outreach-mill" },
    ],
  },
  {
    title: "Sales & Commercial",
    icon: BriefcaseBusiness,
    items: [
      { title: "Leads", url: "/leads" },
      { title: "Opportunities", url: "/opportunities" },
      { title: "Quotations", url: "/quotations" },
      { title: "Sales Orders", url: "/sales-orders" },
      { title: "Contracts", url: "/contracts" },
    ],
  },
  {
    title: "Procurement",
    icon: ShoppingCart,
    items: [
      { title: "Purchase Requests", url: "/purchase-requests" },
      { title: "RFQs", url: "/rfqs" },
      { title: "Vendor Quotations", url: "/vendor-quotations" },
      { title: "Purchase Comparison", url: "/purchase-comparison" },
      { title: "Purchase Orders", url: "/purchase-orders" },
      { title: "GRN", url: "/grn" },
    ],
  },
  {
    title: "Projects & Operations",
    icon: ClipboardList,
    items: [
      { title: "Projects", url: "/projects" },
      { title: "Sites", url: "/sites" },
      { title: "Assignments", url: "/assignments" },
      { title: "Tasks", url: "/tasks" },
      { title: "Site Visits", url: "/site-visit" },
      { title: "Deployment", url: "/deployment" },
    ],
  },
  {
    title: "Costing & Profitability",
    icon: Calculator,
    items: [
      { title: "General Costing", url: "/costing/general" },
      { title: "Tax & GST", url: "/costing/tax-gst" },
      { title: "Project Costing", url: "/costing/project" },
      { title: "Labour Costing", url: "/costing/labour" },
      { title: "Profitability", url: "/costing/profitability" },
    ],
  },
  {
    title: "Subscriptions & Renewals",
    icon: RefreshCw,
    items: [
      { title: "Domains", url: "/domains" },
      { title: "Hosting", url: "/hosting" },
      { title: "SSL", url: "/ssl" },
      { title: "Software Licenses", url: "/software-licenses" },
      { title: "SLA", url: "/sla" },
      { title: "AMC", url: "/amc" },
      { title: "OEM Renewals", url: "/oem-renewals" },
      { title: "Renewal Calendar", url: "/renewal-calendar" },
    ],
  },
  {
    title: "Billing & Invoicing",
    icon: Receipt,
    items: [
      { title: "Invoices", url: "/invoices" },
      { title: "Payments", url: "/payments" },
    ],
  },
  {
    title: "Workforce & HR",
    icon: Users,
    items: [
      { title: "Employees", url: "/employees" },
      { title: "Attendance", url: "/attendance" },
      { title: "Field Attendance", url: "/field-attendance" },
      { title: "Monthly Payroll", url: "/monthly-payroll" },
      { title: "TADA & Expenses", url: "/tada-expenses" },
      { title: "Expense Claimed", url: "/costing/expense" },
    ],
  },
];

const adminItems = [
  { title: "Manage Users", url: "/manage-users", icon: Shield, adminOnly: true },
  { title: "Profile", url: "/profile", icon: Users, permission: "profile" },
  { title: "Settings", url: "/settings", icon: Settings, permission: "settings" },
];

const sidebarPermissions: Record<string, string> = {
  "/partner": "partner",
  "/costing/general": "general-costing",
  "/costing/tax-gst": "tax-gst",
  "/costing/project": "project-costing",
  "/costing/labour": "labour-costing",
  "/costing/expense": "expense-costing",
  "/costing/profitability": "profitability",
};

function getSidebarPermission(url: string) {
  return sidebarPermissions[url] || url.slice(1);
}

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const { isAdmin, hasPermission } = useAuth();
  const { pathname } = useLocation();
  const collapsed = state === "collapsed";
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [partners, setPartners] = useState<PartnerData[]>([]);
  const [domains, setDomains] = useState<DomainData[]>([]);
  const [hosting, setHosting] = useState<HostingData[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    return employeesAPI.subscribeAll(setEmployees);
  }, [isAdmin]);

  useEffect(() => {
    if (!hasPermission("partner")) return;
    return partnerDataAPI.subscribeAll(setPartners);
  }, [hasPermission]);

  useEffect(() => {
    if (!hasPermission("domains")) return;
    return domainsAPI.subscribeAll(setDomains);
  }, [hasPermission]);

  useEffect(() => {
    if (!hasPermission("hosting")) return;
    return hostingAPI.subscribeAll(setHosting);
  }, [hasPermission]);

  const expiringPartnerCount = useMemo(() => partners.filter((partner) => isPartnerExpiringSoon(partner.validTill)).length, [partners]);
  const expiringDomainCount = useMemo(() => domains.filter((domain) => isDomainExpired(domain.expiryDate) || isDomainExpiringSoon(domain.expiryDate)).length, [domains]);
  const expiringHostingCount = useMemo(() => hosting.filter((item) => isHostingExpiringSoon(item.nextRenewalDate)).length, [hosting]);
  const hasBirthdayReminder = useMemo(() => isAdmin && employees.some((employee) => isBirthdayReminder(employee.dateOfBirth)), [employees, isAdmin]);
  const visibleAdminItems = useMemo(() => {
    if (isAdmin) return adminItems;
    return adminItems.filter((item) => item.url === "/profile" && hasPermission("profile"));
  }, [hasPermission, isAdmin]);
  const accessibleSections = useMemo(() => sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => hasPermission(getSidebarPermission(item.url))),
    }))
    .filter((section) => section.items.length > 0), [hasPermission]);
  const visibleSections = useMemo(() => [
    ...accessibleSections,
    ...(visibleAdminItems.length > 0
      ? [{
          title: isAdmin ? "Admin" : "Settings",
          icon: isAdmin ? Shield : Settings,
          items: visibleAdminItems,
        }]
      : []),
  ], [accessibleSections, isAdmin, visibleAdminItems]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      visibleSections.map((section) => [
        section.title,
        section.items.some((item) => pathname === item.url || pathname.startsWith(`${item.url}/`)),
      ]),
    ),
  );

  useEffect(() => {
    const activeSection = visibleSections.find((section) => section.items.some((item) => pathname === item.url || pathname.startsWith(`${item.url}/`)));
    if (!activeSection) return;
    setOpenSections((current) => current[activeSection.title] ? current : { ...current, [activeSection.title]: true });
  }, [pathname, visibleSections]);

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className="overflow-x-hidden border-r border-slate-700 bg-gradient-to-b from-slate-900 to-slate-800">
      <SidebarHeader className="border-b border-slate-700 px-4 py-3">
        <Link to="/projects" onClick={handleNavClick} className="flex items-center gap-3 transition-opacity hover:opacity-90">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">Avira Technologies</span>
              <span className="text-xs text-slate-300">Project Management</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="overflow-x-hidden py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {hasPermission("dashboard") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/dashboard"
                      className="flex min-w-0 items-center rounded-lg px-3 py-1.5 text-xs text-slate-200 transition-all hover:bg-slate-700/50 hover:text-white"
                      activeClassName="bg-gradient-to-r from-blue-500 to-indigo-500 font-medium text-white shadow-md"
                      onClick={handleNavClick}
                    >
                      <LayoutDashboard className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span className="text-sm">Dashboard</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}


              {visibleSections.map((section) => {
                const active = section.items.some((item) => pathname === item.url || pathname.startsWith(`${item.url}/`));
                const hasExplicitOpenState = Object.prototype.hasOwnProperty.call(openSections, section.title);
                const open = hasExplicitOpenState ? openSections[section.title] : active;

                return (
                  <SidebarMenuItem key={section.title}>
                    <SidebarMenuButton
                      onClick={() => setOpenSections((current) => ({ ...current, [section.title]: !current[section.title] }))}
                      className={`flex min-w-0 items-center rounded-lg px-3 py-1.5 text-xs text-slate-200 transition-colors hover:bg-slate-700/50 hover:text-white ${active ? "bg-slate-700/60 text-white" : ""}`}
                      aria-expanded={open}
                      aria-label={section.title}
                    >
                      <section.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="min-w-0 flex-1 truncate text-left text-xs">{section.title}</span>
                          <ChevronDown className={`h-4 w-4 ${open ? "rotate-180" : ""}`} />
                        </>
                      )}
                    </SidebarMenuButton>
                    {!collapsed && open && (
                      <SidebarMenu className="ml-4 mt-1 gap-1 border-l border-slate-600/70 pl-1">
                        {section.items.map((item) => (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild>
                              <NavLink
                                to={item.url}
                                className="block min-w-0 truncate rounded-lg px-3 py-1.5 text-xs text-slate-300 transition-all hover:bg-slate-700/50 hover:text-white"
                                activeClassName="bg-gradient-to-r from-blue-500 to-indigo-500 font-medium text-white shadow-md"
                                onClick={handleNavClick}
                              >
                                <span className="flex min-w-0 flex-1 items-center gap-1 truncate"><span className="truncate">{item.title}</span>{item.title === "Employees" && hasBirthdayReminder && <Cake className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label="Birthday reminder" />}{item.title === "Partners" && expiringPartnerCount > 0 && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-500/90 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white" title={`${expiringPartnerCount} partner${expiringPartnerCount === 1 ? "" : "s"} expiring within one week`}><Bell className="h-3 w-3" aria-hidden="true" />{expiringPartnerCount}</span>}{item.title === "Domains" && expiringDomainCount > 0 && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-500/90 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white" title={`${expiringDomainCount} domain${expiringDomainCount === 1 ? "" : "s"} expired or expiring within one week`}><Bell className="h-3 w-3" aria-hidden="true" />{expiringDomainCount}</span>}{item.title === "Hosting" && expiringHostingCount > 0 && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-500/90 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white" title={`${expiringHostingCount} hosting account${expiringHostingCount === 1 ? "" : "s"} renewing within one week`}><Bell className="h-3 w-3" aria-hidden="true" />{expiringHostingCount}</span>}</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

    </Sidebar>
  );
}
