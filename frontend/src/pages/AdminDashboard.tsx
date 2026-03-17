import { useState, useEffect } from "react";
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
  getStudentsApi,
  getAttendanceApi,
  getNotificationsApi,
  markNotificationReadApi,
  getProgrammesApi,
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
  code: string;
  total_credit_hours: string;
  minimum_required_hours: number;
  programme_name: string;
  year: number;
  semester: number;
}

export interface Programme {
  id: number;
  name: string;
  duration_years: number;
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
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [atRiskCount, setAtRiskCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<{id: number; full_name: string; student_id: string}[]>([]);
  const [statusCounts, setStatusCounts] = useState({ present: 0, late: 0, exempted: 0, absent: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [coursesRes, studentsRes, notifRes, programmesRes] =
          await Promise.all([
            getCoursesApi(),
            getStudentsApi(),
            getNotificationsApi(),
            getProgrammesApi(),
          ]);

        setCourses(coursesRes.data);
        setProgrammes(programmesRes.data);
        setTotalStudents(studentsRes.data.length);
        setStudents(studentsRes.data || []);
        setNotifications(notifRes.data.notifications || []);

        // Get attendance records count
        const attendanceRes = await getAttendanceApi();
        const records: any[] = attendanceRes.data || [];
        setTotalRecords(records.length);
        setStatusCounts({
          present:  records.filter((r) => r.status === "present").length,
          late:     records.filter((r) => r.status === "late").length,
          exempted: records.filter((r) => r.status === "exempted").length,
          absent:   records.filter((r) => r.status === "absent").length,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleMarkRead = async (id: number) => {
    await markNotificationReadApi(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

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
          students={students}
          courses={courses}
        />

        <main className="flex-1 p-4 lg:p-6 space-y-6 overflow-auto">
          {activeTab === "overview" && (
            <>
              <StatsCards
                totalStudents={totalStudents}
                totalCourses={courses.length}
                atRiskCount={atRiskCount}
                totalRecords={totalRecords}
              />
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2">
                  <AttendanceChart />
                </div>
                <StatusDistribution
                  present={statusCounts.present}
                  late={statusCounts.late}
                  exempted={statusCounts.exempted}
                  absent={statusCounts.absent}
                />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2">
                  <AtRiskTable students={[]} />
                </div>
                <RecentActivity notifications={notifications} />
              </div>
            </>
          )}

          {activeTab === "students" && <StudentsTab programmes={programmes} />}
          {activeTab === "courses" && (
            <CoursesTab
              courses={courses}
              programmes={programmes}
              onCoursesChange={setCourses}
            />
          )}
          {activeTab === "attendance" && (
            <AttendanceTab courses={courses} programmes={programmes} />
          )}
          {activeTab === "at-risk" && <AtRiskTable students={[]} fullPage />}
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
