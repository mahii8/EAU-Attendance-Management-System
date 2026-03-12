import { useState, useEffect, useRef } from "react";
import { Menu, Bell, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { Notification } from "@/pages/AdminDashboard";

interface AdminHeaderProps {
  title: string;
  onMenuToggle?: () => void;
  onNavigate?: (tab: string) => void;
  notifications: Notification[];
  onMarkRead: (id: number) => void;
}

const AdminHeader = ({ title, onMenuToggle, onNavigate, notifications, onMarkRead }: AdminHeaderProps) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = user?.first_name
    ? user.first_name.charAt(0).toUpperCase() + (user.last_name?.charAt(0) || "").toUpperCase()
    : "AD";

  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuToggle}>
          <Menu className="w-5 h-5" />
        </Button>
        <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
      </div>

      <div className="flex items-center gap-3">
        {/* Search bar */}
        <div className="hidden md:block relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search students, courses..."
            className="pl-9 w-64 bg-muted border-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            )}
          </Button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold">Notifications</p>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNotifications(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">No notifications</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="px-4 py-3 border-b border-border/50 bg-primary/5 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-medium ${n.notification_type === "absence" ? "text-destructive" : "text-accent"}`}>
                          {n.message}
                        </p>
                        <button onClick={() => onMarkRead(n.id)} className="text-xs text-primary hover:underline whitespace-nowrap">✓</button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <button
                className="w-full px-4 py-2.5 text-xs text-primary hover:bg-muted transition-colors text-center font-medium"
                onClick={() => { onNavigate?.("notifications"); setShowNotifications(false); }}
              >
                View All Notifications
              </button>
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-xs font-bold">{initials}</span>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
