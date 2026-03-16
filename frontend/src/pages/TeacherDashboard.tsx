import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BookOpen,
  ClipboardList,
  Users,
  LogOut,
  Plus,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import eauLogo from "@/assets/eau-logo.png";
import {
  getProgrammesApi,
  getSectionsApi,
  getCoursesApi,
  getCourseStudentsApi,
  getCourseSummaryApi,
  submitAttendanceApi,
} from "@/api/axios";

interface Programme {
  id: number;
  name: string;
  duration_years: number;
}
interface Section {
  id: number;
  name: string;
  year: number;
  semester: number;
  academic_year: string;
}
interface Course {
  id: number;
  name: string;
  total_credit_hours: string;
  programme_name: string;
}
interface Student {
  id: number;
  full_name: string;
  student_id: string;
}

type AttendanceStatus = "present" | "late" | "excused" | "unexcused";

const statusLabels: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  excused: "Excused",
  unexcused: "Unexcused",
};

const TeacherDashboard = () => {
  const { signOut, user } = useAuth();

  // Selection state
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [selectedProgramme, setSelectedProgramme] = useState("");
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");

  // Data state
  const [students, setStudents] = useState<Student[]>([]);
  const [summary, setSummary] = useState<any[]>([]);

  // Modal state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [sessionHours, setSessionHours] = useState("1.5");
  const [sessionType, setSessionType] = useState("theory");
  const [attendanceMap, setAttendanceMap] = useState<
    Record<number, AttendanceStatus>
  >({});
  const [shortName, setShortName] = useState(false);
  const [liveTime, setLiveTime] = useState(
    format(new Date(), "hh:mm:ss aa").toUpperCase(),
  );

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(format(new Date(), "hh:mm:ss aa").toUpperCase());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load programmes
  useEffect(() => {
    getProgrammesApi().then((res) => setProgrammes(res.data));
  }, []);

  // When programme selected — build year list
  useEffect(() => {
    if (!selectedProgramme) return;
    const prog = programmes.find((p) => p.id === parseInt(selectedProgramme));
    if (prog) {
      setYears(Array.from({ length: prog.duration_years }, (_, i) => i + 1));
    }
    setSelectedYear("");
    setSelectedSection("");
    setSelectedCourse("");
    setSections([]);
    setCourses([]);
    setStudents([]);
  }, [selectedProgramme]);

  // When year selected — load sections
  useEffect(() => {
    if (!selectedProgramme || !selectedYear) return;
    getSectionsApi({
      programme: parseInt(selectedProgramme),
      year: parseInt(selectedYear),
      semester: 2,
      academic_year: "2024/25",
    }).then((res) => setSections(res.data));
    setSelectedSection("");
    setSelectedCourse("");
    setCourses([]);
    setStudents([]);
  }, [selectedYear]);

  // When section selected — load courses for this teacher
  useEffect(() => {
    if (!selectedSection || !selectedProgramme || !selectedYear) return;
    getCoursesApi({
      section: parseInt(selectedSection),
      programme: parseInt(selectedProgramme),
      year: parseInt(selectedYear),
      semester: 2,
    }).then((res) => setCourses(res.data));
    setSelectedCourse("");
    setStudents([]);
  }, [selectedSection]);

  // When course selected — load students and summary
  useEffect(() => {
    if (!selectedCourse || !selectedSection) return;
    const courseId = parseInt(selectedCourse);
    const sectionId = parseInt(selectedSection);
    Promise.all([
      getCourseStudentsApi(courseId, sectionId),
      getCourseSummaryApi(courseId, sectionId),
    ]).then(([studRes, sumRes]) => {
      setStudents(studRes.data.students || []);
      setSummary(sumRes.data.summary || []);
      const defaults: Record<number, AttendanceStatus> = {};
      (studRes.data.students || []).forEach((s: Student) => {
        defaults[s.id] = "present";
      });
      setAttendanceMap(defaults);
    });
  }, [selectedCourse, selectedSection]);

  const currentCourse = courses.find((c) => c.id === parseInt(selectedCourse));
  const currentSection = sections.find(
    (s) => s.id === parseInt(selectedSection),
  );

  const getDisplayName = (name: string) => {
    if (!shortName) return name;
    const parts = name.split(" ");
    return parts.length > 1 ? `${parts[0]} ${parts[1].charAt(0)}.` : name;
  };

  const handleSubmit = async () => {
    if (!selectedCourse || !selectedSection) return;
    setSubmitting(true);
    try {
      const records = students.map((s) => ({
        student_id: s.id,
        status: attendanceMap[s.id] || "present",
      }));
      await submitAttendanceApi({
        course_id: parseInt(selectedCourse),
        section_id: parseInt(selectedSection),
        date: attendanceDate,
        session_type: sessionType,
        session_hours: parseFloat(sessionHours),
        records,
      });
      toast.success("Attendance submitted successfully!");
      setDialogOpen(false);
      const sumRes = await getCourseSummaryApi(
        parseInt(selectedCourse),
        parseInt(selectedSection),
      );
      setSummary(sumRes.data.summary || []);
    } catch {
      toast.error("Failed to submit attendance.");
    } finally {
      setSubmitting(false);
    }
  };

  const isReadyToLog = selectedCourse && selectedSection && students.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 lg:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={eauLogo} alt="EAU" className="h-10 object-contain" />
          <h1 className="font-display text-lg font-bold">Teacher Portal</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:block">
            {user?.first_name} {user?.last_name}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="gap-1.5"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
        {/* Step-by-step selectors */}
        <Card className="shadow-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">
              Select Class
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Programme */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Programme
                </p>
                <Select
                  value={selectedProgramme}
                  onValueChange={setSelectedProgramme}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select programme" />
                  </SelectTrigger>
                  <SelectContent>
                    {programmes.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Year */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Year
                </p>
                <Select
                  value={selectedYear}
                  onValueChange={setSelectedYear}
                  disabled={!selectedProgramme}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        Year {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Section */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Section
                </p>
                <Select
                  value={selectedSection}
                  onValueChange={setSelectedSection}
                  disabled={!selectedYear}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        Section {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Course */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Course
                </p>
                <Select
                  value={selectedCourse}
                  onValueChange={setSelectedCourse}
                  disabled={!selectedSection || courses.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isReadyToLog && (
              <div className="mt-4 flex justify-end">
                <Button
                  className="gap-1.5 bg-primary hover:bg-primary/90"
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="w-4 h-4" /> Log Attendance
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        {isReadyToLog && currentCourse && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-card border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">
                    {students.length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Section {currentSection?.name} Students
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-card border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-eau-mustard-light">
                  <ClipboardList className="w-5 h-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">
                    {summary.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Records</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-card border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-eau-crimson-light">
                  <BookOpen className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">
                    {currentCourse.total_credit_hours}
                  </p>
                  <p className="text-xs text-muted-foreground">Credit Hours</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Student Roster + Attendance Summary */}
        {isReadyToLog && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="shadow-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base">
                  Student Roster
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>University ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s, i) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-muted-foreground">
                          {i + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {s.full_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">
                          {s.student_id}
                        </TableCell>
                      </TableRow>
                    ))}
                    {students.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-muted-foreground py-8"
                        >
                          No students found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="shadow-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base">
                  Attendance Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Attended</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.slice(0, 10).map((row: any) => (
                      <TableRow key={row.student.id}>
                        <TableCell className="font-medium text-sm">
                          {row.student.full_name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {String(row.attended_hours)} hrs
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              row.status === "safe"
                                ? "bg-primary/10 text-primary border-primary/30"
                                : row.status === "warning"
                                  ? "bg-secondary/20 text-secondary-foreground border-secondary/30"
                                  : "bg-destructive/10 text-destructive border-destructive/30"
                            }`}
                          >
                            {row.status === "safe"
                              ? "Safe"
                              : row.status === "warning"
                                ? "Warning"
                                : "At Risk"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {summary.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-muted-foreground py-8"
                        >
                          No records yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty state */}
        {!isReadyToLog && (
          <div className="text-center py-20 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-display text-lg">
              Select a class to get started
            </p>
            <p className="text-sm mt-1">
              Choose programme → year → section → course above
            </p>
          </div>
        )}
      </main>

      {/* Log Attendance Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="font-display text-xl">
                  Log Attendance
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {currentCourse?.name} — Section {currentSection?.name}
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-lg text-sm font-mono">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                {liveTime}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Date
                </p>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Session Type
                </p>
                <Select value={sessionType} onValueChange={setSessionType}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="theory">Theory</SelectItem>
                    <SelectItem value="practical">Practical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Session Hours
                </p>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="8"
                  value={sessionHours}
                  onChange={(e) => setSessionHours(e.target.value)}
                  className="w-24 border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2 mb-1 ml-auto">
                <span className="text-sm text-muted-foreground">
                  Short Name
                </span>
                <button
                  onClick={() => setShortName(!shortName)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${shortName ? "bg-primary" : "bg-muted-foreground/30"}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${shortName ? "translate-x-5" : "translate-x-0.5"}`}
                  />
                </button>
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">
                      #
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">
                      Student
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">
                      ID
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {students.map((student, index) => (
                    <tr key={student.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {getDisplayName(student.full_name)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {student.student_id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {(
                            [
                              "present",
                              "late",
                              "excused",
                              "unexcused",
                            ] as AttendanceStatus[]
                          ).map((s) => (
                            <button
                              key={s}
                              onClick={() =>
                                setAttendanceMap((prev) => ({
                                  ...prev,
                                  [student.id]: s,
                                }))
                              }
                              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                                attendanceMap[student.id] === s
                                  ? s === "present"
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : s === "late"
                                      ? "bg-secondary text-secondary-foreground border-secondary"
                                      : s === "excused"
                                        ? "bg-muted text-foreground border-border"
                                        : "bg-destructive text-destructive-foreground border-destructive"
                                  : "bg-background text-muted-foreground border-border hover:bg-muted"
                              }`}
                            >
                              {statusLabels[s]}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                <span className="text-primary font-medium">
                  {students.length}
                </span>{" "}
                students in Section {currentSection?.name}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-primary hover:bg-primary/90"
                >
                  {submitting ? "Submitting..." : "Submit Attendance"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherDashboard;
