import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isDevBypass, fetchDevData } from "@/lib/devBypass";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LogOut, ClipboardList, AlertTriangle, CheckCircle } from "lucide-react";
import eauLogo from "@/assets/eau-logo.png";

const statusColors: Record<string, string> = {
  Present: "bg-primary/10 text-primary border-primary/30",
  Late: "bg-secondary/20 text-secondary-foreground border-secondary/30",
  Excused: "bg-muted text-muted-foreground border-border",
  Unexcused: "bg-destructive/10 text-destructive border-destructive/30",
};

const StudentDashboard = () => {
  const { signOut, profileId, user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) return;
    const load = async () => {
      setLoading(true);
      if (isDevBypass()) {
        const data = await fetchDevData("student", profileId);
        setProfile(data.profile);
        setRecords(data.attendance || []);
        setCourses(data.courses || []);
      } else {
        const [profRes, attRes, scRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", profileId).single(),
          supabase.from("attendance").select("*, courses(course_name, total_credit_hours)").eq("student_id", profileId).order("date", { ascending: false }),
          supabase.from("student_courses").select("courses(id, course_name, total_credit_hours)").eq("student_id", profileId),
        ]);
        setProfile(profRes.data);
        setRecords(attRes.data || []);
        setCourses(scRes.data?.map((s: any) => s.courses).filter(Boolean) || []);
      }
      setLoading(false);
    };
    load();
  }, [profileId]);

  // Calculate per-course stats
  const courseStats = courses.map(c => {
    const courseRecords = records.filter(r => r.course_id === c.id);
    const unexcusedHours = courseRecords.filter(r => r.status === "Unexcused").reduce((a, r) => a + Number(r.hours_missed || 0), 0);
    const absenceRate = c.total_credit_hours > 0 ? (unexcusedHours / c.total_credit_hours) * 100 : 0;
    const total = courseRecords.length;
    const present = courseRecords.filter(r => r.status === "Present" || r.status === "Late").length;
    return { ...c, total, present, unexcusedHours, absenceRate, attendanceRate: total > 0 ? (present / total) * 100 : 100 };
  });

  const overallRecords = records.length;
  const overallPresent = records.filter(r => r.status === "Present" || r.status === "Late").length;
  const overallRate = overallRecords > 0 ? (overallPresent / overallRecords) * 100 : 100;
  const atRisk = courseStats.some(c => c.absenceRate >= 10);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 lg:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={eauLogo} alt="EAU" className="h-12 object-contain" />
          <h1 className="font-display text-lg font-bold">Student Portal</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5"><LogOut className="w-4 h-4" />Sign Out</Button>
      </header>

      <main className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Loading your dashboard...</div>
        ) : (
          <>
            <div className="animate-fade-in">
              <h2 className="font-display text-xl font-bold mb-1">Welcome, {profile?.full_name || "Student"}</h2>
              <p className="text-sm text-muted-foreground">{profile?.university_id} · {profile?.email}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="shadow-card border-border/50 animate-fade-in">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10"><ClipboardList className="w-5 h-5 text-primary" /></div>
                  <div>
                    <p className="text-2xl font-display font-bold">{overallRate.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Overall Attendance</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-card border-border/50 animate-fade-in">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-secondary/10"><CheckCircle className="w-5 h-5 text-secondary-foreground" /></div>
                  <div>
                    <p className="text-2xl font-display font-bold">{courses.length}</p>
                    <p className="text-xs text-muted-foreground">Enrolled Courses</p>
                  </div>
                </CardContent>
              </Card>
              <Card className={`shadow-card border-border/50 animate-fade-in ${atRisk ? "border-destructive/30 bg-destructive/5" : ""}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${atRisk ? "bg-destructive/10" : "bg-primary/10"}`}>
                    <AlertTriangle className={`w-5 h-5 ${atRisk ? "text-destructive" : "text-primary"}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-display font-bold">{atRisk ? "At Risk" : "Good"}</p>
                    <p className="text-xs text-muted-foreground">Status</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {courseStats.length > 0 && (
              <Card className="shadow-card border-border/50 animate-fade-in">
                <CardHeader><CardTitle className="font-display text-base">Course Attendance Breakdown</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {courseStats.map(c => (
                    <div key={c.id} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-medium">{c.course_name}</p>
                        <div className="flex items-center gap-2">
                          {c.absenceRate >= 15 && <Badge variant="destructive" className="text-xs">Critical</Badge>}
                          {c.absenceRate >= 10 && c.absenceRate < 15 && <Badge className="text-xs bg-secondary text-secondary-foreground">Warning</Badge>}
                          <span className="text-xs font-mono font-semibold">{c.attendanceRate.toFixed(1)}%</span>
                        </div>
                      </div>
                      <Progress value={c.attendanceRate} className="h-2" />
                      <p className="text-xs text-muted-foreground">{c.unexcusedHours} unexcused hours / {c.total_credit_hours} credit hours ({c.absenceRate.toFixed(1)}% absence rate)</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="shadow-card border-border/50 animate-fade-in">
              <CardHeader><CardTitle className="font-display text-base">Attendance History</CardTitle></CardHeader>
              <CardContent className="p-0">
                {records.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">No attendance records yet.</div>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Course</TableHead><TableHead>Status</TableHead><TableHead className="hidden sm:table-cell">Hours Missed</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {records.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm">{r.date}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.courses?.course_name || "—"}</TableCell>
                          <TableCell><Badge variant="outline" className={`text-xs ${statusColors[r.status] || ""}`}>{r.status}</Badge></TableCell>
                          <TableCell className="hidden sm:table-cell font-mono text-sm">{r.hours_missed}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default StudentDashboard;
