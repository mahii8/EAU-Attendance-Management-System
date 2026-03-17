import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  AlertTriangle,
  BarChart3,
  Bell,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
} from "lucide-react";
import eauLogo from "@/assets/eau-logo.png";

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  collapsed?: boolean;
  onCollapse?: (v: boolean) => void;
  notificationCount?: number;
}

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "students", label: "Students", icon: Users },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "attendance", label: "Attendance", icon: ClipboardList },
  { id: "at-risk", label: "At-Risk", icon: AlertTriangle },
  { id: "user-roles", label: "User Roles", icon: Shield },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
];

const AdminSidebar = ({
  activeTab,
  onTabChange,
  collapsed = false,
  onCollapse,
  notificationCount = 0,
}: AdminSidebarProps) => {
  const { signOut } = useAuth();

  return (
    <aside
      className={`hidden lg:flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 sticky top-0 h-screen flex-shrink-0 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border flex-shrink-0">
        <img
          src={eauLogo}
          alt="EAU"
          className={`object-contain flex-shrink-0 transition-all duration-300 ${collapsed ? "h-9 w-9" : "h-14 w-14"}`}
        />
        {!collapsed && (
          <div>
            <p className="font-display font-bold text-base leading-tight">
              EAU Attendance
            </p>
            <p className="text-xs text-sidebar-foreground/60">Admin Portal</p>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      {onCollapse && (
        <button
          onClick={() => onCollapse(!collapsed)}
          className="flex items-center justify-end px-3 py-2 text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors flex-shrink-0"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Nav — scrollable middle section */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          const showBadge = id === "notifications" && notificationCount > 0;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative ${
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
              {showBadge && (
                <span className="ml-auto bg-accent text-accent-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sign out — always pinned to bottom */}
      <div className="px-2 py-4 border-t border-sidebar-border flex-shrink-0">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
