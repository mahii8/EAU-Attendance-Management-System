import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000/api";
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
            refresh,
          });
          localStorage.setItem("access_token", res.data.access);
          original.headers.Authorization = `Bearer ${res.data.access}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = "/login";
        }
      } else {
        localStorage.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

// Auth
export const loginApi = (username: string, password: string) =>
  api.post("/auth/login/", { username, password });
export const getMeApi = () => api.get("/auth/me/");

// Programmes & Sections
export const getProgrammesApi = () => api.get("/programmes/");
export const getSectionsApi = (params?: {
  programme?: number;
  year?: number;
  semester?: number;
  academic_year?: string;
}) => api.get("/sections/", { params });

// Courses
export const getCoursesApi = (params?: {
  programme?: number;
  year?: number;
  semester?: number;
  section?: number;
}) => api.get("/courses/", { params });

export const createCourseApi = (data: {
  name: string;
  code?: string;
  total_credit_hours: number;
  programme_id: number;
  year: number;
  semester: number;
}) => api.post("/courses/", data);

export const updateCourseApi = (courseId: number, data: any) =>
  api.patch(`/courses/${courseId}/`, data);

export const getCourseStudentsApi = (courseId: number, sectionId?: number) =>
  api.get(`/courses/${courseId}/students/`, {
    params: sectionId ? { section: sectionId } : {},
  });

export const getCourseSummaryApi = (courseId: number, sectionId?: number) =>
  api.get(`/courses/${courseId}/summary/`, {
    params: sectionId ? { section: sectionId } : {},
  });

export const getCourseTrendApi = (courseId: number, months: number = 3) =>
  api.get(`/courses/${courseId}/trend/`, { params: { months } });

// Students
export const getStudentsApi = (params?: {
  section?: number;
  programme?: number;
  year?: number;
  search?: string;
}) => api.get("/students/", { params });

export const createStudentApi = (data: {
  first_name: string;
  last_name: string;
  student_id: string;
  email: string;
  parent_email?: string;
  parent_telegram?: string;
  section_id: number;
}) => api.post("/students/", data);

export const updateStudentApi = (studentId: number, data: any) =>
  api.patch(`/students/${studentId}/`, data);

export const deleteStudentApi = (studentId: number) =>
  api.delete(`/students/${studentId}/`);

// Attendance
export const getAttendanceApi = (params?: {
  course?: number;
  date?: string;
  section?: number;
  programme?: number;
  year?: number;
  search?: string;
}) => api.get("/attendance/", { params });

export const submitAttendanceApi = (data: {
  course_id: number;
  section_id: number;
  date: string;
  session_type: string;
  session_hours: number;
  records: { student_id: number; status: string }[];
}) => api.post("/attendance/submit/", data);

// Users
export const getUsersApi = () => api.get("/users/");

export const createUserApi = (data: {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  password: string;
}) => api.post("/users/", data);

export const updateUserApi = (userId: number, data: any) =>
  api.patch(`/users/${userId}/`, data);

export const deleteUserApi = (userId: number) =>
  api.delete(`/users/${userId}/`);

// Notifications
export const getNotificationsApi = () => api.get("/notifications/");
export const markNotificationReadApi = (id: number) =>
  api.post(`/notifications/${id}/read/`);

// Settings
export const getSettingsApi = () => api.get("/settings/");
export const updateSettingsApi = (data: any) => api.patch("/settings/", data);

// Reports
// Reports
export const downloadReportApi = async (
  type: "course" | "student" | "summary",
  id: number | null,
  format: "pdf" | "csv",
  reportType: "full" | "weekly" = "full",
) => {
  const token = localStorage.getItem("access_token");
  
  const params = new URLSearchParams();
  if (type === "course" && id !== null) params.append("course_id", id.toString());
  if (type === "student" && id !== null) params.append("student_id", id.toString());
  if (type === "summary") params.append("summary", "true");
  
  params.append("format", format);
  params.append("type", reportType);

  const url = `${API_BASE_URL}/reports/download/?${params.toString()}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error("Download failed");

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  
  // Extract filename from the Content-Disposition header if available
  const contentDisposition = response.headers.get("Content-Disposition");
  let filename = `report_${new Date().getTime()}.${format}`;
  if (contentDisposition && contentDisposition.includes("filename=")) {
    const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
    if (filenameMatch && filenameMatch.length === 2) {
      filename = filenameMatch[1];
    }
  } else {
    filename = type === "course"
      ? `course_${id}_${reportType}.${format}`
      : type === "student"
      ? `student_${id}.${format}`
      : `summary_report.${format}`;
  }

  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
};

// Portals
export const getStudentDashboardApi = () => api.get("/student/dashboard/");
export const getParentDashboardApi = () => api.get("/parent/dashboard/");

export default api;
