import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Download, Users, BookOpen, BarChart2, Search } from "lucide-react";
import {
  downloadReportApi,
  downloadSummaryReportApi,
  getDepartmentsApi,
  getOfferingsApi,
  getOfferingStudentsApi,
  getOfferingSummaryApi,
  getProgrammesApi,
  getSummaryReportApi,
  getSemestersApi,
  getUsersApi,
} from "@/api/axios";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Course {
  id: number;
  name: string;
}

interface Offering {
  id: number;
  course_name: string;
  section_name: string;
  section_year: number;
  programme_name: string;
  semester_label: string;
}

interface StudentOption {
  id: number;
  full_name: string;
  student_id: string;
}

interface SummaryRow {
  student_pk: number;
  student_id: string;
  full_name: string;
  present_hours: number;
  late_hours: number;
  excused_hours: number;
  absent_hours: number;
  attended_hours: number;
  percentage: number;
  minimum_required: number;
  status: "Safe" | "Warning" | "At Risk";
}

interface ReportsTabProps {
  courses: Course[];
}

const ReportsTab = ({ courses }: ReportsTabProps) => {
  const [activeReportTab, setActiveReportTab] = useState<
    "student" | "course" | "summary"
  >("student");
  const [selectedOffering, setSelectedOffering] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<string>("all");
  const [reportType, setReportType] = useState<"full" | "weekly" | "custom">(
    "full",
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [offeringStudents, setOfferingStudents] = useState<StudentOption[]>([]);
  const [previewRows, setPreviewRows] = useState<SummaryRow[]>([]);
  const [previewAggregates, setPreviewAggregates] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loadingOfferings, setLoadingOfferings] = useState(false);
  const [summarySemesters, setSummarySemesters] = useState<
    { id: number; label: string; is_current?: boolean }[]
  >([]);
  const [summaryFilters, setSummaryFilters] = useState({
    semester: "",
    programme: "all",
    department: "all",
    teacher: "all",
    start_date: "",
    end_date: "",
  });
  const [programmes, setProgrammes] = useState<{ id: number; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: number; full_name: string }[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);

  // Load offerings for current semester on mount
  useEffect(() => {
    const loadOfferings = async () => {
      setLoadingOfferings(true);
      try {
        const semRes = await getSemestersApi({ current: true });
        const currentSem = semRes.data?.[0];
        const params = currentSem ? { semester: currentSem.id } : {};
        const res = await getOfferingsApi(params);
        setOfferings(res.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingOfferings(false);
      }
    };
    loadOfferings();
  }, []);

  useEffect(() => {
    getSemestersApi()
      .then((res) => {
        const list = res.data || [];
        setSummarySemesters(list);
        const current = list.find((s: any) => s.is_current) || list[0];
        if (current) {
          setSummaryFilters((prev) => ({ ...prev, semester: String(current.id) }));
        }
      })
      .catch(() => setSummarySemesters([]));
    getProgrammesApi({ active_only: true })
      .then((res) => setProgrammes(res.data || []))
      .catch(() => setProgrammes([]));
    getUsersApi({ role: "teacher" })
      .then((res) => setTeachers(res.data || []))
      .catch(() => setTeachers([]));
  }, []);

  useEffect(() => {
    if (summaryFilters.programme === "all") {
      setDepartments([]);
      return;
    }
    getDepartmentsApi({
      programme: parseInt(summaryFilters.programme),
      active_only: true,
    })
      .then((res) => setDepartments(res.data || []))
      .catch(() => setDepartments([]));
  }, [summaryFilters.programme]);

  useEffect(() => {
    const loadStudentsForOffering = async () => {
      if (!selectedOffering) {
        setOfferingStudents([]);
        setSelectedStudent("all");
        setPreviewRows([]);
        setPreviewAggregates(null);
        return;
      }
      try {
        const res = await getOfferingStudentsApi(parseInt(selectedOffering));
        setOfferingStudents(res.data?.students || []);
      } catch (err) {
        console.error(err);
        setOfferingStudents([]);
      }
    };
    loadStudentsForOffering();
  }, [selectedOffering]);

  const fetchReportPreview = async (includeStudentFilter: boolean) => {
    if (!selectedOffering) {
      toast.error("Please select a course first");
      return;
    }
    if (reportType === "custom" && (!startDate || !endDate)) {
      toast.error("Please provide start and end date for custom filter");
      return;
    }
    setPreviewLoading(true);
    try {
      const params: any = { type: reportType };
      if (includeStudentFilter && selectedStudent !== "all") {
        params.student = parseInt(selectedStudent);
      }
      if (reportType === "custom") {
        params.start_date = startDate;
        params.end_date = endDate;
      }
      const res = await getOfferingSummaryApi(parseInt(selectedOffering), params);
      setPreviewRows(res.data?.rows || []);
      setPreviewAggregates(res.data?.aggregates || null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load report preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (
      (activeReportTab === "student" || activeReportTab === "course") &&
      selectedOffering &&
      (reportType !== "custom" || (startDate && endDate))
    ) {
      fetchReportPreview(activeReportTab === "student");
    }
  }, [
    activeReportTab,
    selectedOffering,
    selectedStudent,
    reportType,
    startDate,
    endDate,
  ]);

  const handleOfferingReport = async (
    format: "pdf" | "csv",
    type: "full" | "weekly" | "custom",
    extraParams?: {
      student?: number;
      start_date?: string;
      end_date?: string;
    },
  ) => {
    if (!selectedOffering) {
      toast.error("Please select a course first");
      return;
    }
    const key = `${format}-${type}`;
    setDownloading(key);
    try {
      await downloadReportApi(
        "offering",
        parseInt(selectedOffering),
        format,
        type,
        extraParams,
      );
      toast.success("Report downloaded!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to download report");
    } finally {
      setDownloading(null);
    }
  };

  const filteredStudents = offeringStudents.filter((s) => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      s.full_name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q)
    );
  });

  const chartRiskData = previewAggregates?.risk_distribution
    ? Object.entries(previewAggregates.risk_distribution).map(([name, value]) => ({
        name,
        value,
      }))
    : [];
  const chartBandData = previewAggregates?.attendance_bands
    ? Object.entries(previewAggregates.attendance_bands).map(([band, count]) => ({
        band,
        count,
      }))
    : [];

  const reportTabs = [
    { id: "student", label: "By Student", icon: Users },
    { id: "course", label: "By Course", icon: BookOpen },
    { id: "summary", label: "Summary", icon: BarChart2 },
  ];

  const fetchSummaryPreview = async () => {
    if (!summaryFilters.semester) {
      toast.error("Please select semester");
      return;
    }
    setSummaryLoading(true);
    try {
      const params: any = {
        semester: parseInt(summaryFilters.semester),
      };
      if (summaryFilters.programme !== "all") {
        params.programme = parseInt(summaryFilters.programme);
      }
      if (summaryFilters.department !== "all") {
        params.department = parseInt(summaryFilters.department);
      }
      if (summaryFilters.teacher !== "all") {
        params.teacher = parseInt(summaryFilters.teacher);
      }
      if (summaryFilters.start_date) params.start_date = summaryFilters.start_date;
      if (summaryFilters.end_date) params.end_date = summaryFilters.end_date;
      const res = await getSummaryReportApi(params);
      setSummaryData(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load summary analytics");
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (activeReportTab === "summary" && summaryFilters.semester) {
      fetchSummaryPreview();
    }
  }, [activeReportTab, summaryFilters.semester]);

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="font-display text-base">
            Reports & Analytics
          </CardTitle>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit mt-3">
          {reportTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveReportTab(id as any)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeReportTab === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* By Student */}
        {activeReportTab === "student" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Preview detailed attendance by student before downloading exactly
              what is filtered.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Select Course
                </p>
                <Select
                  value={selectedOffering}
                  onValueChange={setSelectedOffering}
                >
                  <SelectTrigger className="w-72">
                    <SelectValue
                      placeholder={
                        loadingOfferings ? "Loading..." : "Choose a course..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {offerings.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.course_name} — Sec {o.section_name} Y{o.section_year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Range
                </p>
                <Select
                  value={reportType}
                  onValueChange={(v) =>
                    setReportType(v as "full" | "weekly" | "custom")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="custom">Custom Date Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Student
                </p>
                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                  <SelectTrigger>
                    <SelectValue placeholder="All students" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All students</SelectItem>
                    {filteredStudents.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.full_name} ({s.student_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Search Student
                </p>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                  <input
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Name or ID"
                    className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm"
                  />
                </div>
              </div>
            </div>

            {reportType === "custom" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  className="text-left p-3 rounded-lg border border-border"
                >
                  <p className="text-xs mb-1 text-muted-foreground uppercase tracking-wide">
                    Start Date
                  </p>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  />
                </button>
                <button
                  className="text-left p-3 rounded-lg border border-border"
                >
                  <p className="text-xs mb-1 text-muted-foreground uppercase tracking-wide">
                    End Date
                  </p>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  />
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => fetchReportPreview(true)}
                disabled={!selectedOffering || previewLoading}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium disabled:opacity-50"
              >
                {previewLoading ? "Loading Preview..." : "Apply Filters"}
              </button>
              <button
                onClick={() => {
                  if (!selectedOffering) return;
                  const params: any = {};
                  if (selectedStudent !== "all")
                    params.student = parseInt(selectedStudent);
                  if (reportType === "custom") {
                    params.start_date = startDate;
                    params.end_date = endDate;
                  }
                  handleOfferingReport("pdf", reportType, params);
                }}
                disabled={!selectedOffering || !!downloading}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium disabled:opacity-50"
              >
                Download Filtered PDF
              </button>
              <button
                onClick={() => {
                  if (!selectedOffering) return;
                  const params: any = {};
                  if (selectedStudent !== "all")
                    params.student = parseInt(selectedStudent);
                  if (reportType === "custom") {
                    params.start_date = startDate;
                    params.end_date = endDate;
                  }
                  handleOfferingReport("csv", reportType, params);
                }}
                disabled={!selectedOffering || !!downloading}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium disabled:opacity-50"
              >
                Download Filtered CSV
              </button>
            </div>

            {selectedOffering && previewAggregates && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground">Students</p>
                  <p className="text-xl font-semibold">
                    {previewAggregates.total_students ?? 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground">Average %</p>
                  <p className="text-xl font-semibold">
                    {previewAggregates.average_attendance_percentage ?? 0}%
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground">Warning</p>
                  <p className="text-xl font-semibold">
                    {previewAggregates.warning_count ?? 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground">At Risk</p>
                  <p className="text-xl font-semibold">
                    {previewAggregates.at_risk_count ?? 0}
                  </p>
                </div>
              </div>
            )}

            {selectedOffering && previewRows.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="h-72 rounded-xl border border-border p-3">
                  <p className="text-sm font-medium mb-2">Risk Distribution</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartRiskData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={90}
                      >
                        <Cell fill="#16a34a" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#dc2626" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-72 rounded-xl border border-border p-3">
                  <p className="text-sm font-medium mb-2">Attendance Bands</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartBandData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="band" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {selectedOffering && previewRows.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2 text-left">Student</th>
                        <th className="p-2 text-right">Present</th>
                        <th className="p-2 text-right">Late</th>
                        <th className="p-2 text-right">Excused</th>
                        <th className="p-2 text-right">Absent</th>
                        <th className="p-2 text-right">Attendance %</th>
                        <th className="p-2 text-left">Status</th>
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr key={row.student_pk} className="border-t border-border">
                          <td className="p-2">
                            <p className="font-medium">{row.full_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.student_id}
                            </p>
                          </td>
                          <td className="p-2 text-right">{row.present_hours}</td>
                          <td className="p-2 text-right">{row.late_hours}</td>
                          <td className="p-2 text-right">{row.excused_hours}</td>
                          <td className="p-2 text-right">{row.absent_hours}</td>
                          <td className="p-2 text-right">{row.percentage}%</td>
                          <td className="p-2">{row.status}</td>
                          <td className="p-2">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() =>
                                  downloadReportApi(
                                    "student",
                                    row.student_pk,
                                    "pdf",
                                    reportType === "custom" ? "full" : reportType,
                                    {
                                      offering: parseInt(selectedOffering),
                                      ...(reportType === "custom"
                                        ? {
                                            start_date: startDate,
                                            end_date: endDate,
                                          }
                                        : {}),
                                    },
                                  )
                                }
                                className="px-2 py-1 rounded border border-border text-xs hover:bg-muted"
                              >
                                PDF
                              </button>
                              <button
                                onClick={() =>
                                  downloadReportApi(
                                    "student",
                                    row.student_pk,
                                    "csv",
                                    reportType === "custom" ? "full" : reportType,
                                    {
                                      offering: parseInt(selectedOffering),
                                      ...(reportType === "custom"
                                        ? {
                                            start_date: startDate,
                                            end_date: endDate,
                                          }
                                        : {}),
                                    },
                                  )
                                }
                                className="px-2 py-1 rounded border border-border text-xs hover:bg-muted"
                              >
                                CSV
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!selectedOffering && (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a course to preview student reports</p>
              </div>
            )}
          </div>
        )}

        {/* By Course */}
        {activeReportTab === "course" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Preview course-level attendance report before downloading.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Select Course
                </p>
                <Select
                  value={selectedOffering}
                  onValueChange={setSelectedOffering}
                >
                  <SelectTrigger className="w-72">
                    <SelectValue
                      placeholder={
                        loadingOfferings ? "Loading..." : "Choose a course..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {offerings.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.course_name} — Sec {o.section_name} Y{o.section_year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Range
                </p>
                <Select
                  value={reportType}
                  onValueChange={(v) =>
                    setReportType(v as "full" | "weekly" | "custom")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="custom">Custom Date Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {reportType === "custom" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  className="text-left p-3 rounded-lg border border-border"
                >
                  <p className="text-xs mb-1 text-muted-foreground uppercase tracking-wide">
                    Start Date
                  </p>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  />
                </button>
                <button
                  className="text-left p-3 rounded-lg border border-border"
                >
                  <p className="text-xs mb-1 text-muted-foreground uppercase tracking-wide">
                    End Date
                  </p>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  />
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => fetchReportPreview(false)}
                disabled={!selectedOffering || previewLoading}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium disabled:opacity-50"
              >
                {previewLoading ? "Loading Preview..." : "Apply Filters"}
              </button>
              <button
                onClick={() => {
                  if (!selectedOffering) return;
                  const params: any = {};
                  if (reportType === "custom") {
                    params.start_date = startDate;
                    params.end_date = endDate;
                  }
                  handleOfferingReport("pdf", reportType, params);
                }}
                disabled={!selectedOffering || !!downloading}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium disabled:opacity-50"
              >
                Download Filtered PDF
              </button>
              <button
                onClick={() => {
                  if (!selectedOffering) return;
                  const params: any = {};
                  if (reportType === "custom") {
                    params.start_date = startDate;
                    params.end_date = endDate;
                  }
                  handleOfferingReport("csv", reportType, params);
                }}
                disabled={!selectedOffering || !!downloading}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium disabled:opacity-50"
              >
                Download Filtered CSV
              </button>
            </div>

            {selectedOffering && previewAggregates && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground">Students</p>
                  <p className="text-xl font-semibold">
                    {previewAggregates.total_students ?? 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground">Average %</p>
                  <p className="text-xl font-semibold">
                    {previewAggregates.average_attendance_percentage ?? 0}%
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground">Warning</p>
                  <p className="text-xl font-semibold">
                    {previewAggregates.warning_count ?? 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground">At Risk</p>
                  <p className="text-xl font-semibold">
                    {previewAggregates.at_risk_count ?? 0}
                  </p>
                </div>
              </div>
            )}

            {selectedOffering && previewRows.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="h-72 rounded-xl border border-border p-3">
                  <p className="text-sm font-medium mb-2">Risk Distribution</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartRiskData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={90}
                      >
                        <Cell fill="#16a34a" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#dc2626" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-72 rounded-xl border border-border p-3">
                  <p className="text-sm font-medium mb-2">Attendance Bands</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartBandData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="band" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {selectedOffering && previewRows.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2 text-left">Student</th>
                        <th className="p-2 text-right">Present</th>
                        <th className="p-2 text-right">Late</th>
                        <th className="p-2 text-right">Excused</th>
                        <th className="p-2 text-right">Absent</th>
                        <th className="p-2 text-right">Attendance %</th>
                        <th className="p-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr key={row.student_pk} className="border-t border-border">
                          <td className="p-2">
                            <p className="font-medium">{row.full_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.student_id}
                            </p>
                          </td>
                          <td className="p-2 text-right">{row.present_hours}</td>
                          <td className="p-2 text-right">{row.late_hours}</td>
                          <td className="p-2 text-right">{row.excused_hours}</td>
                          <td className="p-2 text-right">{row.absent_hours}</td>
                          <td className="p-2 text-right">{row.percentage}%</td>
                          <td className="p-2">{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!selectedOffering && (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a course to preview course report</p>
              </div>
            )}
          </div>
        )}

        {/* Summary — all offerings */}
        {activeReportTab === "summary" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Executive cross-offering analytics with hotspots, rankings, and trends.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Semester
                </p>
                <Select
                  value={summaryFilters.semester}
                  onValueChange={(v) =>
                    setSummaryFilters((p) => ({ ...p, semester: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {summarySemesters.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Programme
                </p>
                <Select
                  value={summaryFilters.programme}
                  onValueChange={(v) =>
                    setSummaryFilters((p) => ({
                      ...p,
                      programme: v,
                      department: "all",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All programmes</SelectItem>
                    {programmes.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Department
                </p>
                <Select
                  value={summaryFilters.department}
                  onValueChange={(v) =>
                    setSummaryFilters((p) => ({ ...p, department: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Teacher
                </p>
                <Select
                  value={summaryFilters.teacher}
                  onValueChange={(v) =>
                    setSummaryFilters((p) => ({ ...p, teacher: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All teachers</SelectItem>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.full_name || `Teacher ${t.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Start Date
                </p>
                <input
                  type="date"
                  value={summaryFilters.start_date}
                  onChange={(e) =>
                    setSummaryFilters((p) => ({ ...p, start_date: e.target.value }))
                  }
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  End Date
                </p>
                <input
                  type="date"
                  value={summaryFilters.end_date}
                  onChange={(e) =>
                    setSummaryFilters((p) => ({ ...p, end_date: e.target.value }))
                  }
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={fetchSummaryPreview}
                disabled={summaryLoading}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium disabled:opacity-50"
              >
                {summaryLoading ? "Loading..." : "Apply Filters"}
              </button>
              <button
                onClick={async () => {
                  try {
                    const p: any = {};
                    if (summaryFilters.semester) p.semester = parseInt(summaryFilters.semester);
                    if (summaryFilters.programme !== "all") p.programme = parseInt(summaryFilters.programme);
                    if (summaryFilters.department !== "all") p.department = parseInt(summaryFilters.department);
                    if (summaryFilters.teacher !== "all") p.teacher = parseInt(summaryFilters.teacher);
                    if (summaryFilters.start_date) p.start_date = summaryFilters.start_date;
                    if (summaryFilters.end_date) p.end_date = summaryFilters.end_date;
                    await downloadSummaryReportApi("pdf", p);
                    toast.success("Summary PDF downloaded");
                  } catch (err: any) {
                    toast.error(err?.message || "Failed to download summary PDF");
                  }
                }}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium"
              >
                Download Executive PDF
              </button>
              <button
                onClick={async () => {
                  try {
                    const p: any = {};
                    if (summaryFilters.semester) p.semester = parseInt(summaryFilters.semester);
                    if (summaryFilters.programme !== "all") p.programme = parseInt(summaryFilters.programme);
                    if (summaryFilters.department !== "all") p.department = parseInt(summaryFilters.department);
                    if (summaryFilters.teacher !== "all") p.teacher = parseInt(summaryFilters.teacher);
                    if (summaryFilters.start_date) p.start_date = summaryFilters.start_date;
                    if (summaryFilters.end_date) p.end_date = summaryFilters.end_date;
                    await downloadSummaryReportApi("csv", p);
                    toast.success("Summary CSV downloaded");
                  } catch (err: any) {
                    toast.error(err?.message || "Failed to download summary CSV");
                  }
                }}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium"
              >
                Download Summary CSV
              </button>
            </div>

            {summaryData?.kpis && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground">Offerings</p>
                  <p className="text-xl font-semibold">{summaryData.kpis.total_offerings}</p>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground">Students</p>
                  <p className="text-xl font-semibold">{summaryData.kpis.total_students}</p>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground">Overall Avg %</p>
                  <p className="text-xl font-semibold">{summaryData.kpis.overall_average_attendance}%</p>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground">At Risk Students</p>
                  <p className="text-xl font-semibold">{summaryData.kpis.total_at_risk_students}</p>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground">Worst Offering</p>
                  <p className="text-sm font-semibold truncate">{summaryData.kpis.worst_offering_name}</p>
                </div>
              </div>
            )}

            {summaryData && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="h-72 rounded-xl border border-border p-3">
                  <p className="text-sm font-medium mb-2">Risk Distribution</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(summaryData.risk_distribution || {}).map(
                          ([name, value]) => ({ name, value }),
                        )}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={90}
                      >
                        <Cell fill="#16a34a" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#dc2626" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-72 rounded-xl border border-border p-3">
                  <p className="text-sm font-medium mb-2">Top vs Bottom Offerings</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        ...(summaryData.top_offerings || []).map((x: any) => ({
                          name: `${x.offering_label} (Top)`,
                          avg: x.average_attendance,
                        })),
                        ...(summaryData.bottom_offerings || []).map((x: any) => ({
                          name: `${x.offering_label} (Bottom)`,
                          avg: x.average_attendance,
                        })),
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" hide />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="avg" fill="#2563eb" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {summaryData?.attendance_trend?.length > 0 && (
              <div className="h-72 rounded-xl border border-border p-3">
                <p className="text-sm font-medium mb-2">Attendance Trend by Week</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summaryData.attendance_trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="average_attendance" fill="#0ea5e9" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {summaryData?.offering_analytics?.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="p-3 border-b border-border font-medium text-sm">
                  At-Risk Hotspots / Improvement Opportunities
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2 text-left">Offering</th>
                        <th className="p-2 text-left">Programme</th>
                        <th className="p-2 text-left">Department</th>
                        <th className="p-2 text-right">Students</th>
                        <th className="p-2 text-right">Avg %</th>
                        <th className="p-2 text-right">At Risk</th>
                        <th className="p-2 text-right">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryData.offering_analytics.map((row: any) => (
                        <tr key={row.offering_id} className="border-t border-border">
                          <td className="p-2">{row.offering_label}</td>
                          <td className="p-2">{row.programme_name}</td>
                          <td className="p-2">{row.department_name}</td>
                          <td className="p-2 text-right">{row.student_count}</td>
                          <td className="p-2 text-right">{row.average_attendance}%</td>
                          <td className="p-2 text-right">{row.at_risk_count}</td>
                          <td className="p-2 text-right">
                            {row.trend_delta > 0 ? "+" : ""}
                            {row.trend_delta}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!summaryLoading && !summaryData?.offering_analytics?.length && (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No summary data found for selected filters</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportsTab;
