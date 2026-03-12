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

export const loginApi = (username: string, password: string) =>
  api.post("/auth/login/", { username, password });

export const getMeApi = () => api.get("/auth/me/");

export const getCoursesApi = () => api.get("/courses/");

export const getCourseStudentsApi = (courseId: number) =>
  api.get(`/courses/${courseId}/students/`);

export const getCourseSummaryApi = (courseId: number) =>
  api.get(`/courses/${courseId}/summary/`);

export const submitAttendanceApi = (data: {
  course_id: number;
  date: string;
  session_type: string;
  session_hours: number;
  records: { student_id: number; status: string }[];
}) => api.post("/attendance/", data);

export const getNotificationsApi = () => api.get("/notifications/");

export const markNotificationReadApi = (id: number) =>
  api.post(`/notifications/${id}/read/`);

export const downloadReportApi = async (
  type: "course" | "student",
  id: number,
  format: "pdf" | "csv",
  reportType: "full" | "weekly" = "full",
) => {
  const token = localStorage.getItem("access_token");
  const url =
    type === "course"
      ? `${API_BASE_URL}/reports/course/${id}/?format=${format}&type=${reportType}`
      : `${API_BASE_URL}/reports/student/${id}/?format=${format}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error("Download failed");

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download =
    type === "course"
      ? `course_${id}_${reportType}.${format}`
      : `student_${id}.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
};
export default api;
