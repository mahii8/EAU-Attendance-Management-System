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
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import eauLogo from "@/assets/eau-logo.png";
import {
  getCoursesApi,
  getCourseStudentsApi,
  submitAttendanceApi,
  getCourseSummaryApi,
} from "@/api/axios";

interface Course {
  id: number;
  name: string;
  total_credit_hours: string;
  minimum_required_hours: number;
  programme_name: string;
}

interface Student {
  id: number;
  full_name: string;
  student_id: string;
  section_name: string;
}

type AttendanceStatus = "present" | "late" | "excused" | "absent";

const statusStyles: Record<AttendanceStatus, string> = {
  present: "bg-primary/10 text-primary border-primary/30",
  late: "bg-secondary/20 text-secondary-foreground border-secondary/30",
  excused: "bg-muted text-muted-foreground border-border",
  absent: "bg-destructive/10 text-destructive border-destructive/30",
};

const statusLabels: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  excused: "Excused",
  absent: "Unexcused",
};

const TeacherDashboard = () => {
  const { signOut, user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shortName, setShortName] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string>("all");

  // Attendance modal state
  const [attendanceDate, setAttendanceDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [attendanceMap, setAttendanceMap] = useState<
    Record<number, AttendanceStatus>
  >({});
  const [sessionHours, setSessionHours] = useState("1.5");
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

  useEffect(() => {
    getCoursesApi().then((res) => setCourses(res.data));
  }, []);

  useEffect(() => {
    if (!selectedCourse) return;
    const courseId = parseInt(selectedCourse);
    Promise.all([
      getCourseStudentsApi(courseId),
      getCourseSummaryApi(courseId),
    ]).then(([studentsRes, summaryRes]) => {
      setStudents(studentsRes.data.students);
      setSummary(summaryRes.data.summary || []);
      // Default all to present
      const defaults: Record<number, AttendanceStatus> = {};
      studentsRes.data.students.forEach((s: Student) => {
        defaults[s.id] = "present";
      });
      setAttendanceMap(defaults);
    });
  }, [selectedCourse]);

  const currentCourse = courses.find((c) => c.id === parseInt(selectedCourse));

  // Get unique sections
  const sections = Array.from(
    new Set(students.map((s) => s.section_name)),
  ).filter(Boolean);

  const filteredStudents =
    selectedSection === "all"
      ? students
      : students.filter((s) => s.section_name === selectedSection);

  const getDisplayName = (name: string) => {
    if (!shortName) return name;
    const parts = name.split(" ");
    return parts.length > 1 ? `${parts[0]} ${parts[1].charAt(0)}.` : name;
  };

  const handleStatusChange = (studentId: number, status: AttendanceStatus) => {
    setAttendanceMap((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSubmit = async () => {
    if (!selectedCourse) return;
    setSubmitting(true);
    try {
      const records = students.map((s) => ({
        student_id: s.id,
        status: attendanceMap[s.id] || "present",
      }));
      await submitAttendanceApi({
        course_id: parseInt(selectedCourse),
        date: attendanceDate,
        session_type: "theory",
        session_hours: parseFloat(sessionHours),
        records,
      });
      toast.success("Attendance submitted successfully!");
      setDialogOpen(false);
      // Refresh summary
      const summaryRes = await getCourseSummaryApi(parseInt(selectedCourse));
      setSummary(summaryRes.data.summary || []);
    } catch {
      toast.error("Failed to submit attendance.");
    } finally {
      setSubmitting(false);
    }
  };

  // Recent attendance from summary
  const recentRecords = summary.slice(0, 8);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 lg:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={eauLogo} alt="EAU" className="h-10 object-contain" />
          <h1 className="font-display text-lg font-bold">Teacher Portal</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
          <LogOut className="w-4 h-4" /> Sign Out
        </Button>
      </header>

      <main className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
        {/* Course selector + Log Attendance button */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">
              Select Course
            </p>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="w-64 border-primary/50 focus:ring-primary">
                <SelectValue placeholder="Choose a course" />
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
          {selectedCourse && (
            <Button
              className="gap-1.5 bg-primary hover:bg-primary/90"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="w-4 h-4" /> Log Attendance
            </Button>
          )}
        </div>

        {/* Stats */}
        {selectedCourse && currentCourse && (
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
                    {sections[0]
                      ? `${sections[0]} Students`
                      : "Enrolled Students"}
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
                  <p className="text-xs text-muted-foreground">
                    Records on {format(new Date(), "MMM d")}
                  </p>
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

        {/* Student Roster + Recent Attendance */}
        {selectedCourse && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Student Roster */}
            <Card className="shadow-card border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-base">
                    Student Roster
                  </CardTitle>
                  {sections.length > 0 && (
                    <Select
                      value={selectedSection}
                      onValueChange={setSelectedSection}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs gap-1">
                        <Filter className="w-3 h-3" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sections</SelectItem>
                        {sections.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>University ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          {s.full_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">
                          {s.student_id}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredStudents.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={2}
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

            {/* Recent Attendance */}
            <Card className="shadow-card border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-base">
                    Recent Attendance
                  </CardTitle>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-lg px-2 py-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(), "MMM d, yyyy")}
                  </div>
                </div>
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
                    {recentRecords.map((row: any) => (
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
                                ? statusStyles.present
                                : row.status === "warning"
                                  ? statusStyles.late
                                  : statusStyles.absent
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
                    {recentRecords.length === 0 && (
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
        {!selectedCourse && (
          <div className="text-center py-20 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-display text-lg">
              Select a course to get started
            </p>
            <p className="text-sm mt-1">
              Choose a course above to view students and log attendance
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
                  {currentCourse?.name}
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-lg text-sm font-mono">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                {liveTime}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Date + Section + Short Name toggle */}
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Date
                </p>
                <div className="flex items-center gap-2 border border-input rounded-lg px-3 py-2 text-sm">
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="bg-transparent outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Section / Class
                </p>
                <Select defaultValue={sections[0] || "A"}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
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
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    shortName ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      shortName ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Student attendance table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">
                      #
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">
                      Student Name
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">
                      University ID
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">
                      Attendance Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {students.map((student, index) => (
                    <tr key={student.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {getDisplayName(student.full_name)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {student.student_id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {(
                            [
                              "present",
                              "late",
                              "excused",
                              "absent",
                            ] as AttendanceStatus[]
                          ).map((status) => (
                            <button
                              key={status}
                              onClick={() =>
                                handleStatusChange(student.id, status)
                              }
                              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                                attendanceMap[student.id] === status
                                  ? status === "present"
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : status === "late"
                                      ? "bg-secondary text-secondary-foreground border-secondary"
                                      : status === "excused"
                                        ? "bg-muted text-muted-foreground border-border"
                                        : "bg-destructive text-destructive-foreground border-destructive"
                                  : "bg-background text-muted-foreground border-border hover:bg-muted"
                              }`}
                            >
                              {statusLabels[status]}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                <span className="text-primary font-medium">
                  {students.length}
                </span>{" "}
                students in {sections[0] || "Section A"}
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
