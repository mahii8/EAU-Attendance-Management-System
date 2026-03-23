import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { getAtRiskApi } from "@/api/axios";

interface AtRiskStudent {
  student_id: string;
  student_name: string;
  course_name: string;
  section: string;
  programme: string;
  attended_hours: number;
  missed_hours: number;
  attendance_percentage: number;
  minimum_required: number;
}

interface AtRiskTableProps {
  semesterId?: number;
  fullPage?: boolean;
}

const AtRiskTable = ({ semesterId, fullPage = false }: AtRiskTableProps) => {
  const [students, setStudents] = useState<AtRiskStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAtRisk = async () => {
      try {
        setLoading(true);
        const params = semesterId ? { semester: semesterId } : {};
        const res = await getAtRiskApi(params);
        setStudents(res.data.students || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAtRisk();
  }, [semesterId]);

  const display = fullPage ? students : students.slice(0, 5);

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <CardTitle className="font-display text-base">
            At-Risk Students
          </CardTitle>
          {!loading && (
            <span className="text-xs text-muted-foreground">
              ({students.length} total)
            </span>
          )}
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
                Attendance
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
            {loading && (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-12 text-muted-foreground"
                >
                  Loading...
                </td>
              </tr>
            )}
            {!loading && display.length === 0 && (
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
              const pct = s.attendance_percentage;
              const isAtRisk = pct < 85;
              return (
                <tr
                  key={`${s.student_id}-${i}`}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="font-medium">{s.student_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {s.student_id}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    <p>{s.course_name}</p>
                    <p className="text-xs text-muted-foreground/60">
                      {s.programme} · Sec {s.section}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isAtRisk ? "bg-destructive" : "bg-secondary"}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{pct}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Min: {s.minimum_required} hrs
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        isAtRisk
                          ? "bg-destructive text-destructive-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {isAtRisk ? "At Risk" : "Warning"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() =>
                        toast.success(`Notified ${s.student_name}`)
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
