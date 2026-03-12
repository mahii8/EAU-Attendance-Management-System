import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import StatsCards from "@/components/admin/StatsCards";
import AttendanceChart from "@/components/admin/AttendanceChart";
import StatusDistribution from "@/components/admin/StatusDistribution";
import AtRiskTable from "@/components/admin/AtRiskTable";
import RecentActivity from "@/components/admin/RecentActivity";
import CoursesTab from "@/components/admin/CoursesTab";
import ReportsTab from "@/components/admin/ReportsTab";
import NotificationsTab from "@/components/admin/NotificationsTab";
import StudentsTab from "@/components/admin/StudentsTab";
import AttendanceTab from "@/components/admin/AttendanceTab";
import UserRolesTab from "@/components/admin/UserRolesTab";
import SettingsTab from "@/components/admin/SettingsTab";
import {
  getCoursesApi,
  getCourseSummaryApi,
  getNotificationsApi,
  markNotificationReadApi,
} from "@/api/axios";

const tabTitles: Record<string, string> = {
  overview: "Dashboard Overview",
  students: "Student Management",
  courses: "Course Management",
  attendance: "Attendance Records",
  "at-risk": "At-Risk Students",
  "user-roles": "User Roles",
  reports: "Reports & Analytics",
  notifications: "Notifications",
  settings: "Settings",
};

export interface Course {
  id: number;
  name: string;
  total_credit_hours: string;
  minimum_required_hours: number;
  programme_name: string;
}

export interface SummaryStudent {
  student: { id: number; full_name: string; student_id: string };
  attended_hours: number;
  missed_hours: number;
  attendance_percentage: number;
  minimum_required_hours: number;
  status: "safe" | "warning" | "at_risk";
}

export interface Notification {
  id: number;
  message: string;
  notification_type: string;
  created_at: string;
}

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [summary, setSummary] = useState<SummaryStudent[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    getCoursesApi().then((res) => {
      setCourses(res.data);
      if (res.data.length > 0) setSelectedCourse(res.data[0]);
    });
    getNotificationsApi().then((res) =>
      setNotifications(res.data.notifications),
    );
  }, []);

  useEffect(() => {
    if (!selectedCourse) return;
    getCourseSummaryApi(selectedCourse.id).then((res) => {
      setSummary(res.data.summary);
    });
  }, [selectedCourse]);

  const handleMarkRead = async (id: number) => {
    await markNotificationReadApi(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const atRisk = summary.filter((s) => s.status === "at_risk");
  const warning = summary.filter((s) => s.status === "warning");
  const safe = summary.filter((s) => s.status === "safe");

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 lg:hidden transform transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <AdminSidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setSidebarOpen(false);
          }}
          notificationCount={notifications.length}
        />
      </div>

      <AdminSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        collapsed={sidebarCollapsed}
        onCollapse={setSidebarCollapsed}
        notificationCount={notifications.length}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title={tabTitles[activeTab] || "Dashboard"}
          onMenuToggle={() => setSidebarOpen(true)}
          notifications={notifications}
          onMarkRead={handleMarkRead}
          onNavigate={setActiveTab}
        />

        <main className="flex-1 p-4 lg:p-6 space-y-6 overflow-auto">
          {activeTab === "overview" && (
            <>
              <StatsCards
                totalStudents={summary.length}
                totalCourses={courses.length}
                atRiskCount={atRisk.length}
                totalRecords={summary.reduce(
                  (acc, s) => acc + Number(s.attended_hours),
                  0,
                )}
              />
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2">
                  <AttendanceChart />
                </div>
                <StatusDistribution
                  safe={safe.length}
                  warning={warning.length}
                  atRisk={atRisk.length}
                />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2">
                  <AtRiskTable students={[...atRisk, ...warning]} />
                </div>
                <RecentActivity notifications={notifications} />
              </div>
            </>
          )}

          {activeTab === "students" && <StudentsTab />}
          {activeTab === "courses" && <CoursesTab courses={courses} />}
          {activeTab === "attendance" && <AttendanceTab />}
          {activeTab === "at-risk" && (
            <AtRiskTable students={[...atRisk, ...warning]} fullPage />
          )}
          {activeTab === "user-roles" && <UserRolesTab />}
          {activeTab === "reports" && <ReportsTab courses={courses} />}
          {activeTab === "notifications" && (
            <NotificationsTab
              notifications={notifications}
              onMarkRead={handleMarkRead}
            />
          )}
          {activeTab === "settings" && <SettingsTab />}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
