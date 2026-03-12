import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Bell, Mail, Shield, Database } from "lucide-react";

const SettingsTab = () => {
  return (
    <div className="space-y-6">
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="font-display text-base">
              Notification Settings
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            {
              label: "Email alerts for absences",
              desc: "Send email when student is marked absent",
              enabled: true,
            },
            {
              label: "Telegram alerts",
              desc: "Send Telegram message when student is absent",
              enabled: false,
            },
            {
              label: "Threshold warnings",
              desc: "Alert when student approaches absence limit",
              enabled: true,
            },
            {
              label: "Weekly reports",
              desc: "Auto-generate weekly attendance reports",
              enabled: false,
            },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between py-3 border-b border-border last:border-0"
            >
              <div>
                <p className="font-medium text-sm">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
              </div>
              <div
                className={`w-10 h-5 rounded-full transition-colors ${s.enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
              >
                <span
                  className={`block w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${s.enabled ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="font-display text-base">
              Attendance Thresholds
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/10 border border-secondary/30">
            <div>
              <p className="font-medium text-sm">Warning Level</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Alert student via email/Telegram
              </p>
            </div>
            <span className="text-lg font-bold font-display text-secondary-foreground">
              10%
            </span>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-destructive/5 border border-destructive/20">
            <div>
              <p className="font-medium text-sm">Critical Level</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Alert student, parent, and admin
              </p>
            </div>
            <span className="text-lg font-bold font-display text-destructive">
              15%
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="font-display text-base">
              System Information
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Institution", value: "Ethiopian Aviation University" },
            { label: "System", value: "SAMS v1.0" },
            { label: "Backend", value: "Django 6.0 + PostgreSQL" },
            { label: "Environment", value: "Development" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="text-sm font-medium">{item.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsTab;
