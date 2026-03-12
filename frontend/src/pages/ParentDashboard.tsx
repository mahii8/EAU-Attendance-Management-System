import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isDevBypass, fetchDevData } from "@/lib/devBypass";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LogOut, Eye, AlertTriangle, CheckCircle } from "lucide-react";
import eauLogo from "@/assets/eau-logo.png";

const statusColors: Record<string, string> = {
  Present: "bg-primary/10 text-primary border-primary/30",
  Late: "bg-secondary/20 text-secondary-foreground border-secondary/30",
  Excused: "bg-muted text-muted-foreground border-border",
  Unexcused: "bg-destructive/10 text-destructive border-destructive/30",
};

const ParentDashboard = () => {
  const { signOut, profileId } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [childProfile, setChildProfile] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [devChildData, setDevChildData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!profileId) return;
    const load = async () => {
      if (isDevBypass()) {
        const data = await fetchDevData("parent", profileId);
        const kids = data.children || [];
        setChildren(kids);
        setDevChildData(data.childData || {});
        if (kids.length > 0) setSelectedChild(kids[0].id);
      } else {
        const { data } = await supabase
          .from("relationships")
          .select("student_id, profiles!relationships_student_id_fkey(id, full_name, university_id)")
          .eq("parent_id", profileId);
        const kids = data?.map((d: any) => d.profiles).filter(Boolean) || [];
        setChildren(kids);
        if (kids.length > 0) setSelectedChild(kids[0].id);
      }
      setLoading(false);
    };
    load();
  }, [profileId]);

  useEffect(() => {
    if (!selectedChild) return;
    const load = async () => {
      if (isDevBypass() && devChildData[selectedChild]) {
        const cd = devChildData[selectedChild];
        setChildProfile(cd.profile);
        setRecords(cd.attendance || []);
        setCourses(cd.courses || []);
      } else if (!isDevBypass()) {
        const [profRes, attRes, scRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", selectedChild).single(),
          supabase.from("attendance").select("*, courses(course_name, total_credit_hours)").eq("student_id", selectedChild).order("date", { ascending: false }),
          supabase.from("student_courses").select("courses(id, course_name, total_credit_hours)").eq("student_id", selectedChild),
        ]);
        setChildProfile(profRes.data);
        setRecords(attRes.data || []);
        setCourses(scRes.data?.map((s: any) => s.courses).filter(Boolean) || []);
      }
    };
    load();
  }, [selectedChild, devChildData]);

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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 lg:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={eauLogo} alt="EAU" className="h-12 object-contain" />
          <h1 className="font-display text-lg font-bold">Parent Portal</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5"><LogOut className="w-4 h-4" />Sign Out</Button>
      </header>

      <main className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Loading...</div>
        ) : children.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Eye className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-display text-lg">No linked students found</p>
            <p className="text-sm">Please contact administration to link your child's account.</p>
          </div>
        ) : (
          <>
            {children.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {children.map(c => (
                  <Button key={c.id} variant={selectedChild === c.id ? "default" : "outline"} size="sm" onClick={() => setSelectedChild(c.id)}>
                    {c.full_name}
                  </Button>
                ))}
              </div>
            )}

            {childProfile && (
              <div className="animate-fade-in">
                <h2 className="font-display text-xl font-bold mb-1">{childProfile.full_name}'s Attendance</h2>
                <p className="text-sm text-muted-foreground">{childProfile.university_id}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="shadow-card border-border/50">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-display font-bold text-primary">{overallRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Overall Attendance Rate</p>
                  <Progress value={overallRate} className="mt-2 h-2" />
                </CardContent>
              </Card>
              <Card className="shadow-card border-border/50">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-display font-bold">{courses.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Enrolled Courses</p>
                </CardContent>
              </Card>
              <Card className="shadow-card border-border/50">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-display font-bold">{overallRecords}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Records</p>
                </CardContent>
              </Card>
            </div>

            {courseStats.length > 0 && (
              <Card className="shadow-card border-border/50 animate-fade-in">
                <CardHeader><CardTitle className="font-display text-base">Course Breakdown</CardTitle></CardHeader>
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
                      <p className="text-xs text-muted-foreground">{c.absenceRate.toFixed(1)}% absence rate</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="shadow-card border-border/50 animate-fade-in">
              <CardHeader><CardTitle className="font-display text-base">Recent Attendance</CardTitle></CardHeader>
              <CardContent className="p-0">
                {records.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">No attendance records.</div>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Course</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {records.slice(0, 20).map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm">{r.date}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.courses?.course_name || "—"}</TableCell>
                          <TableCell><Badge variant="outline" className={`text-xs ${statusColors[r.status] || ""}`}>{r.status}</Badge></TableCell>
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

export default ParentDashboard;
