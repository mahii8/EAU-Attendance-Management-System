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

// ── Auth ──────────────────────────────────────────────────────
export const loginApi = (username: string, password: string) =>
  api.post("/auth/login/", { username, password });
export const getMeApi = () => api.get("/auth/me/");

// ── Programmes ────────────────────────────────────────────────
export const getProgrammesApi = (params?: { active_only?: boolean }) =>
  api.get("/programmes/", { params });
export const createProgrammeApi = (data: {
  name: string;
  code?: string;
  duration_years?: number;
}) => api.post("/programmes/", data);
export const updateProgrammeApi = (id: number, data: any) =>
  api.patch(`/programmes/${id}/`, data);
export const deleteProgrammeApi = (id: number) =>
  api.delete(`/programmes/${id}/`);

// ── Courses (templates) ───────────────────────────────────────
export const getCoursesApi = (params?: {
  programme?: number;
  year?: number;
  active_only?: boolean;
}) => api.get("/courses/", { params });
export const createCourseApi = (data: {
  name: string;
  code?: string;
  total_credit_hours: number;
  programme_id: number;
  year: number;
  minimum_attendance_percent?: number;
}) => api.post("/courses/", data);
export const updateCourseApi = (id: number, data: any) =>
  api.patch(`/courses/${id}/`, data);
export const deleteCourseApi = (id: number) => api.delete(`/courses/${id}/`);

// ── Academic Years ────────────────────────────────────────────
export const getAcademicYearsApi = () => api.get("/academic-years/");
export const createAcademicYearApi = (data: {
  name: string;
  start_date: string;
  end_date: string;
  is_current?: boolean;
}) => api.post("/academic-years/", data);
export const updateAcademicYearApi = (id: number, data: any) =>
  api.patch(`/academic-years/${id}/`, data);
export const deleteAcademicYearApi = (id: number) =>
  api.delete(`/academic-years/${id}/`);

// ── Semesters ─────────────────────────────────────────────────
export const getSemestersApi = (params?: {
  academic_year?: number;
  current?: boolean;
}) => api.get("/semesters/", { params });
export const createSemesterApi = (data: {
  academic_year_id: number;
  number: number;
  start_date: string;
  end_date: string;
  is_current?: boolean;
}) => api.post("/semesters/", data);
export const updateSemesterApi = (id: number, data: any) =>
  api.patch(`/semesters/${id}/`, data);
export const deleteSemesterApi = (id: number) =>
  api.delete(`/semesters/${id}/`);

// ── Sections ──────────────────────────────────────────────────
export const getSectionsApi = (params?: {
  semester?: number;
  programme?: number;
  year?: number;
}) => api.get("/sections/", { params });
export const createSectionApi = (data: {
  name: string;
  programme_id: number;
  year: number;
  semester_id: number;
}) => api.post("/sections/", data);
export const updateSectionApi = (id: number, data: any) =>
  api.patch(`/sections/${id}/`, data);
export const deleteSectionApi = (id: number) => api.delete(`/sections/${id}/`);

// ── Students ──────────────────────────────────────────────────
export const getStudentsApi = (params?: {
  programme?: number;
  semester?: number;
  section?: number;
  active_only?: boolean;
  search?: string;
}) => api.get("/students/", { params });
export const createStudentApi = (data: {
  first_name: string;
  last_name: string;
  student_id: string;
  email: string;
  parent_email?: string;
  parent_telegram?: string;
  programme_id?: number;
  section_id?: number;
}) => api.post("/students/", data);
export const updateStudentApi = (id: number, data: any) =>
  api.patch(`/students/${id}/`, data);
export const deleteStudentApi = (id: number) => api.delete(`/students/${id}/`);
export const bulkImportStudentsApi = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post("/students/import/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// ── Enrollments ───────────────────────────────────────────────
export const getEnrollmentsApi = (params?: {
  section?: number;
  student?: number;
  semester?: number;
  status?: string;
}) => api.get("/enrollments/", { params });
export const createEnrollmentApi = (data: {
  student_id: number;
  section_id: number;
}) => api.post("/enrollments/", data);
export const updateEnrollmentApi = (id: number, data: { status: string }) =>
  api.patch(`/enrollments/${id}/`, data);
export const deleteEnrollmentApi = (id: number) =>
  api.delete(`/enrollments/${id}/`);
export const bulkEnrollApi = (data: {
  section_id: number;
  student_ids: number[];
}) => api.post("/enrollments/bulk/", data);

// ── Course Offerings ──────────────────────────────────────────
export const getOfferingsApi = (params?: {
  semester?: number;
  section?: number;
  programme?: number;
  teacher?: number;
}) => api.get("/offerings/", { params });
export const createOfferingApi = (data: {
  course_id: number;
  section_id: number;
  teacher_id?: number;
}) => api.post("/offerings/", data);
export const updateOfferingApi = (id: number, data: { teacher_id?: number }) =>
  api.patch(`/offerings/${id}/`, data);
export const deleteOfferingApi = (id: number) =>
  api.delete(`/offerings/${id}/`);
export const getOfferingStudentsApi = (offeringId: number) =>
  api.get(`/offerings/${offeringId}/students/`);
export const getOfferingSummaryApi = (offeringId: number) =>
  api.get(`/offerings/${offeringId}/summary/`);

// ── Attendance ────────────────────────────────────────────────
export const getAttendanceApi = (params?: {
  offering?: number;
  section?: number;
  semester?: number;
  programme?: number;
  date?: string;
  search?: string;
}) => api.get("/attendance/", { params });
export const submitAttendanceApi = (data: {
  course_offering_id: number;
  date: string;
  session_type: string;
  session_hours: number;
  records: { student_id: number; status: string }[];
}) => api.post("/attendance/submit/", data);

// ── Dashboard ─────────────────────────────────────────────────
export const getStatsApi = (params?: { semester?: number }) =>
  api.get("/stats/", { params });
export const getAtRiskApi = (params?: {
  semester?: number;
  programme?: number;
}) => api.get("/at-risk/", { params });

// ── Users ─────────────────────────────────────────────────────
export const getUsersApi = (params?: { role?: string }) =>
  api.get("/users/", { params });
export const createUserApi = (data: {
  username: string;
  staff_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  password: string;
}) => api.post("/users/", data);
export const updateUserApi = (id: number, data: any) =>
  api.patch(`/users/${id}/`, data);
export const deleteUserApi = (id: number) => api.delete(`/users/${id}/`);

// ── Notifications ─────────────────────────────────────────────
export const getNotificationsApi = () => api.get("/notifications/");
export const markNotificationReadApi = (id: number) =>
  api.post(`/notifications/${id}/read/`);

// ── Settings ──────────────────────────────────────────────────
export const getSettingsApi = () => api.get("/settings/");
export const updateSettingsApi = (data: any) => api.patch("/settings/", data);

// ── Reports ───────────────────────────────────────────────────
export const downloadReportApi = async (
  type: "offering" | "student",
  id: number,
  format: "pdf" | "csv",
  reportType: "full" | "weekly" = "full",
) => {
  let token = localStorage.getItem("access_token");
  const url =
    type === "offering"
      ? `${API_BASE_URL}/reports/offering/${id}/?format=${format}&type=${reportType}`
      : `${API_BASE_URL}/reports/student/${id}/?format=${format}`;

  let response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    const refresh = localStorage.getItem("refresh_token");
    if (refresh) {
      try {
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          localStorage.setItem("access_token", data.access);
          token = data.access;
          response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch {
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
    }
  }

  if (!response.ok) {
    let errorMsg = `Server error: ${response.status}`;
    try {
      const errData = await response.json();
      errorMsg = errData.error || errData.detail || errorMsg;
    } catch {
      /* ignore */
    }
    throw new Error(errorMsg);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download =
    type === "offering"
      ? `offering_${id}_${reportType}.${format}`
      : `student_${id}.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
};

export default api;
