import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getParentDashboardApi } from "@/api/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LogOut, ClipboardList, AlertTriangle, CheckCircle, Mail, Eye } from "lucide-react";
import { toast } from "sonner";
import eauLogo from "@/assets/eau-logo.png";

const statusColors: Record<string, string> = {
  Present: "bg-[#608B50]/10 text-[#608B50] border-[#608B50]/30",
  Late: "bg-yellow-400/20 text-yellow-600 border-yellow-400/30",
  Exempted: "bg-slate-500/10 text-slate-600 border-slate-500/30",
  Absent: "bg-red-500/10 text-red-500 border-red-500/30",
};

export default function ParentDashboard() {
  const { signOut } = useAuth();
  const [data, setData] = useState<any>(null);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await getParentDashboardApi();
        setData(res.data.children);
        if (res.data.children && res.data.children.length > 0) {
          setSelectedChildId(res.data.children[0].student.student_id);
        }
      } catch (error) {
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">Loading dashboard...</div>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-center">
        <Eye className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">No linked students found</h2>
        <p className="text-slate-500 mt-2">Please contact administration to link your child's account.</p>
        <Button variant="outline" className="mt-6" onClick={signOut}>Sign Out</Button>
      </div>
    );
  }

  const currentChildData = data.find((d: any) => d.student.student_id === selectedChildId) || data[0];
  const { student, metrics, course_breakdown, history } = currentChildData;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <img src={eauLogo} alt="EAU Logo" className="h-8 object-contain" />
          <h1 className="font-semibold text-lg">Parent Portal</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
          <LogOut className="w-4 h-4" /> Sign Out
        </Button>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8 animate-fade-in">
        
        {/* Child Selector */}
        {data.length > 1 && (
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit mb-6">
            {data.map((d: any) => (
              <button
                key={d.student.student_id}
                onClick={() => setSelectedChildId(d.student.student_id)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  selectedChildId === d.student.student_id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {d.student.full_name}
              </button>
            ))}
          </div>
        )}

        {/* Welcome Section */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{student.full_name}'s Attendance</h2>
          <p className="text-slate-500 text-sm mt-1">Student ID: {student.student_id}</p>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-sm border-0 border-t-4 border-t-[#608B50]">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="p-3 rounded-lg bg-[#608B50]/10">
                <ClipboardList className="w-6 h-6 text-[#608B50]" />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">{metrics.overall_percentage}%</p>
                <p className="text-sm font-medium text-slate-500">Overall Attendance</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-0">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="p-3 rounded-lg bg-blue-100">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">{metrics.enrolled_courses}</p>
                <p className="text-sm font-medium text-slate-500">Enrolled Courses</p>
              </div>
            </CardContent>
          </Card>

          <Card className={`shadow-sm border-0 ${metrics.is_at_risk ? 'bg-red-50' : ''}`}>
            <CardContent className="p-6 flex items-start gap-4">
              <div className={`p-3 rounded-lg ${metrics.is_at_risk ? 'bg-red-100' : 'bg-slate-100'}`}>
                <AlertTriangle className={`w-6 h-6 ${metrics.is_at_risk ? 'text-red-500' : 'text-slate-500'}`} />
              </div>
              <div>
                <p className={`text-3xl font-bold ${metrics.is_at_risk ? 'text-red-600' : 'text-slate-900'}`}>
                  {metrics.is_at_risk ? 'At Risk' : 'Good'}
                </p>
                <p className="text-sm font-medium text-slate-500">Status</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Course Breakdown */}
        <Card className="shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Course Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {(course_breakdown || []).map((course: any, idx: number) => {
              const safeRate = Math.max(0, 100 - course.absence_rate);
              const isCritical = course.is_critical;
              
              return (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-slate-900">{course.course_name}</p>
                    <div className="flex items-center gap-2">
                      {isCritical && <Badge variant="destructive" className="bg-red-500 text-[10px] uppercase font-bold tracking-wider">Critical</Badge>}
                      <span className="text-sm font-bold text-slate-700">{safeRate.toFixed(1)}%</span>
                    </div>
                  </div>
                  {/* Custom progress bar to match design */}
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div 
                      className={`h-full ${isCritical ? 'bg-red-500' : 'bg-[#608B50]'}`}
                      style={{ width: `${safeRate}%` }}
                    />
                    {!isCritical && safeRate < 100 && (
                      <div 
                        className="h-full bg-yellow-400"
                        style={{ width: `${Math.min(course.absence_rate, 10)}%` }}
                      />
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {course.absent_hours} absent hours / {course.total_credit_hours} credit hours ({course.absence_rate.toFixed(1)}% absence rate)
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Bottom Section: History and Legend */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="shadow-sm border-0 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold">Recent Attendance</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No attendance records yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Course</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold text-right">Contact Teacher</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(history || []).map((r: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm border-b-0 py-3">{r.date}</TableCell>
                        <TableCell className="text-sm font-medium text-slate-900 border-b-0 py-3">{r.course_name}</TableCell>
                        <TableCell className="border-b-0 py-3">
                          <Badge variant="outline" className={`text-xs font-semibold px-2.5 py-0.5 border-transparent ${statusColors[r.status] || ""}`}>
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right border-b-0 py-3">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                            <Mail className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-0 h-fit">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Attendance Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-3">
                <div className="mt-1 flex-shrink-0 w-3 h-3 rounded-full bg-[#608B50]" />
                <div>
                  <p className="text-sm font-bold text-slate-900">Present</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">Student attended the required session duration.</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="mt-1 flex-shrink-0 w-3 h-3 rounded-full bg-slate-500" />
                <div>
                  <p className="text-sm font-bold text-slate-900">Exempted</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">Excused absences include documented medical or emergency reasons.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="mt-1 flex-shrink-0 w-3 h-3 rounded-full bg-yellow-400" />
                <div>
                  <p className="text-sm font-bold text-slate-900">Late</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">Excessive tardiness may have academic consequences.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="mt-1 flex-shrink-0 w-3 h-3 rounded-full bg-red-500" />
                <div>
                  <p className="text-sm font-bold text-slate-900">Absent</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">Recorded as Absent. This negatively impacts the student's attendance rating.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
