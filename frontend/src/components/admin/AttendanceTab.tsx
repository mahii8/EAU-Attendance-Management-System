import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import axios from "@/api/axios";

interface AttendanceRecord {
  id: number;
  date: string;
  student_name: string;
  student_id_number: string;
  course_name: string;
  status: string;
  session_hours: string;
}

const statusStyles: Record<string, string> = {
  present: "bg-primary/10 text-primary border-primary/30",
  late: "bg-secondary/20 text-secondary-foreground border-secondary/30",
  excused: "bg-muted text-muted-foreground border-border",
  absent: "bg-destructive/10 text-destructive border-destructive/30",
};

const statusLabels: Record<string, string> = {
  present: "Present",
  late: "Late",
  excused: "Excused",
  absent: "Unexcused",
};

const AttendanceTab = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const coursesRes = await axios.get("/courses/");
        const courses = coursesRes.data;
        const allRecords: AttendanceRecord[] = [];

        for (const course of courses) {
          const summaryRes = await axios.get(`/courses/${course.id}/summary/`);
          const summary = summaryRes.data.summary || [];
          // Convert summary to record-like format
          for (const row of summary) {
            allRecords.push({
              id: row.student.id,
              date: new Date().toISOString().split("T")[0],
              student_name: row.student.full_name,
              student_id_number: row.student.student_id,
              course_name: course.name,
              status:
                row.status === "safe"
                  ? "present"
                  : row.status === "warning"
                    ? "late"
                    : "absent",
              session_hours: String(row.attended_hours),
            });
          }
        }

        // Sort by date descending
        allRecords.sort((a, b) => b.date.localeCompare(a.date));
        setRecords(allRecords);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, []);

  const filtered = records.filter(
    (r) =>
      r.student_name.toLowerCase().includes(search.toLowerCase()) ||
      r.course_name.toLowerCase().includes(search.toLowerCase()) ||
      r.student_id_number.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="font-display text-base">
          Attendance Records
        </CardTitle>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-y border-border bg-muted/30">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                Date
              </th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                Student
              </th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                Course
              </th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                Status
              </th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                Hours Attended
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-12 text-muted-foreground"
                >
                  Loading records...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-12 text-muted-foreground"
                >
                  No records found
                </td>
              </tr>
            )}
            {filtered.map((r, i) => (
              <tr
                key={`${r.id}-${i}`}
                className="hover:bg-muted/20 transition-colors"
              >
                <td className="px-6 py-4 text-muted-foreground">{r.date}</td>
                <td className="px-6 py-4">
                  <p className="font-medium">{r.student_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {r.student_id_number}
                  </p>
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {r.course_name}
                </td>
                <td className="px-6 py-4">
                  <Badge
                    variant="outline"
                    className={`text-xs ${statusStyles[r.status] || ""}`}
                  >
                    {statusLabels[r.status] || r.status}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {r.session_hours} hrs
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};

export default AttendanceTab;
