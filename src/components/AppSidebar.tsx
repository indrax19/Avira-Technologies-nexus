import { LayoutDashboard, Package, Users, Settings, Shield, CheckSquare, Receipt, Building2 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Master Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Invoices", url: "/invoices", icon: Receipt, permission: "invoices" },
  { title: "Projects Tracking", url: "/projects", icon: CheckSquare, permission: "project-tracking" },
  { title: "Outreach Mill", url: "/outreach-mill", icon: Building2, permission: "outreach-mill" },
  { title: "Customer Data", url: "/customer-data", icon: Users, permission: "customer-data" },
  { title: "Settings", url: "/settings", icon: Settings, permission: "settings" },
];

const adminItems = [
  { title: "Manage Users", url: "/manage-users", icon: Shield },
  { title: "Profile", url: "/profile", icon: Users },
];

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { isAdmin, appUser } = useAuth();
  // Close mobile sidebar when a menu item is clicked
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon" className="bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-700">
      <SidebarHeader className="border-b border-slate-700 px-4 py-3">
        <Link to="/" onClick={handleNavClick} className="flex items-center gap-3 hover:opacity-90 transition-all duration-200 cursor-pointer">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
            <Package className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">Avira Technologies</span>
              <span className="text-xs text-slate-300">Project Management</span>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className="flex flex-col gap-4 py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 py-2">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navItems
                .filter((item) => {
                  // Admins see all items, regular users see only items they have permission for
                  if (isAdmin) return true;
                  // Items without a permission requirement are always shown
                  if (!item.permission) return true;
                  return appUser?.permissions?.includes(item.permission);
                })
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <div className="flex items-center justify-between w-full group">
                        <NavLink
                          to={item.url}
                          end={item.url === "/"}
                          className="flex-1 rounded-lg px-3 py-2 transition-all duration-200 flex items-center text-slate-200 hover:bg-slate-700/50 hover:text-white"
                          activeClassName="bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-medium shadow-md"
                          onClick={handleNavClick}
                        >
                          <item.icon className="mr-2 h-4 w-4 flex-shrink-0" />
                          {!collapsed && <span className="text-sm">{item.title}</span>}
                        </NavLink>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Section */}
        {isAdmin && (
          <SidebarGroup className="border-t border-slate-700 pt-4">
            <SidebarGroupLabel className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 py-2">Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/profile"}
                        className="rounded-lg px-3 py-2 transition-all duration-200 flex items-center text-slate-200 hover:bg-slate-700/50 hover:text-white"
                        activeClassName="bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-medium shadow-md"
                        onClick={handleNavClick}
                      >
                        <item.icon className="mr-2 h-4 w-4 flex-shrink-0" />
                        {!collapsed && <span className="text-sm">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
