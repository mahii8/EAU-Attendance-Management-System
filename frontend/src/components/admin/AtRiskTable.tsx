import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import axios from "@/api/axios";

interface SummaryStudent {
  student: { id: number; full_name: string; student_id: string };
  attended_hours: number;
  missed_hours: number;
  attendance_percentage: number;
  minimum_required_hours: number;
  status: "safe" | "warning" | "at_risk";
  course_name?: string;
}

interface AtRiskTableProps {
  students: SummaryStudent[];
  fullPage?: boolean;
}

const statusConfig = {
  at_risk: {
    label: "≥15%",
    className: "bg-destructive text-destructive-foreground",
  },
  warning: {
    label: "≥10%",
    className: "bg-secondary text-secondary-foreground",
  },
  safe: { label: "<10%", className: "bg-muted text-muted-foreground" },
};

const AtRiskTable = ({ students, fullPage = false }: AtRiskTableProps) => {
  const [enriched, setEnriched] = useState<SummaryStudent[]>([]);

  useEffect(() => {
    const fetchCourseNames = async () => {
      try {
        const coursesRes = await axios.get("/courses/");
        const courses = coursesRes.data;
        const allStudentsWithCourse: SummaryStudent[] = [];

        for (const course of courses) {
          const summaryRes = await axios.get(`/courses/${course.id}/summary/`);
          const summary = summaryRes.data.summary || [];
          for (const row of summary) {
            if (row.status === "at_risk" || row.status === "warning") {
              allStudentsWithCourse.push({ ...row, course_name: course.name });
            }
          }
        }
        setEnriched(allStudentsWithCourse);
      } catch (e) {
        console.error(e);
      }
    };
    fetchCourseNames();
  }, []);

  const display = fullPage ? enriched : enriched.slice(0, 5);

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <CardTitle className="font-display text-base">
            At-Risk Students
          </CardTitle>
        </div>
        <button
          onClick={() => toast.info("Bulk notification sent!")}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          <Send className="w-3.5 h-3.5" /> Bulk Notify
        </button>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-y border-border bg-muted/30">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                Student
              </th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                Course
              </th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                Absence Rate
              </th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                Status
              </th>
              <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {display.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-12 text-muted-foreground"
                >
                  No at-risk students 🎉
                </td>
              </tr>
            )}
            {display.map((s, i) => {
              const total = Number(s.attended_hours) + Number(s.missed_hours);
              const absenceRate =
                total > 0
                  ? ((Number(s.missed_hours) / total) * 100).toFixed(1)
                  : "0.0";
              const config = statusConfig[s.status];
              return (
                <tr
                  key={`${s.student.id}-${i}`}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="font-medium">{s.student.full_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {s.student.student_id}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {s.course_name || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.min(100, parseFloat(absenceRate) * 5)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium">
                        {absenceRate}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${config.className}`}
                    >
                      {config.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() =>
                        toast.success(`Notified ${s.student.full_name}`)
                      }
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Notify
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};

export default AtRiskTable;
