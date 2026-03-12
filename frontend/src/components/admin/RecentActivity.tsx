import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { Notification } from "@/pages/AdminDashboard";

interface RecentActivityProps {
  notifications: Notification[];
}

const dotColors: Record<string, string> = {
  absence: "bg-destructive",
  threshold: "bg-secondary",
  info: "bg-primary",
};

const fallbackActivities = [
  { action: "Attendance logged", detail: "Database Systems — session recorded", type: "info", time: "2 min ago" },
  { action: "Warning sent", detail: "Student approaching absence threshold", type: "threshold", time: "15 min ago" },
  { action: "Report generated", detail: "Weekly attendance PDF exported", type: "info", time: "1 hr ago" },
  { action: "Student enrolled", detail: "New student added to Section A", type: "info", time: "2 hrs ago" },
  { action: "Course updated", detail: "Minimum hours threshold adjusted", type: "info", time: "3 hrs ago" },
];

const RecentActivity = ({ notifications }: RecentActivityProps) => {
  const activities = notifications.length > 0
    ? notifications.slice(0, 5).map((n) => ({
        action: n.notification_type === "absence" ? "Absence recorded" : "Threshold warning",
        detail: n.message,
        type: n.notification_type,
        time: new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }))
    : fallbackActivities;

  return (
    <Card className="shadow-card border-border/50 animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="font-display text-base">Recent Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.map((activity, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-2 h-2 rounded-full mt-2 ${dotColors[activity.type] || "bg-primary"}`} />
              {i < activities.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
            </div>
            <div className="pb-4">
              <p className="text-sm font-medium">{activity.action}</p>
              <p className="text-xs text-muted-foreground">{activity.detail}</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">{activity.time}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
