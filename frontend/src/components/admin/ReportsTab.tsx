import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Download, Users, BookOpen, BarChart2 } from "lucide-react";
import { downloadReportApi } from "@/api/axios";
import { toast } from "sonner";

interface Course {
  id: number;
  name: string;
}

interface ReportsTabProps {
  courses: Course[];
}

const ReportsTab = ({ courses }: ReportsTabProps) => {
  const [activeReportTab, setActiveReportTab] = useState<
    "student" | "course" | "summary"
  >("student");
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleCourseReport = async (
    format: "pdf" | "csv",
    type: "full" | "weekly",
  ) => {
    if (!selectedCourse) {
      toast.error("Please select a course first");
      return;
    }
    const key = `${format}-${type}`;
    setDownloading(key);
    try {
      await downloadReportApi("course", parseInt(selectedCourse), format, type);
      toast.success("Report downloaded!");
    } catch {
      toast.error("Failed to download report");
    } finally {
      setDownloading(null);
    }
  };

  const reportTabs = [
    { id: "student", label: "By Student", icon: Users },
    { id: "course", label: "By Course", icon: BookOpen },
    { id: "summary", label: "Summary", icon: BarChart2 },
  ];

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
              Download a full attendance report for all students in a selected
              course.
            </p>
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Select Course
                </p>
                <Select
                  value={selectedCourse}
                  onValueChange={setSelectedCourse}
                >
                  <SelectTrigger className="w-72">
                    <SelectValue placeholder="Choose a course..." />
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

            {selectedCourse && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  onClick={() => handleCourseReport("pdf", "full")}
                  disabled={!!downloading}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <div className="p-2 rounded-lg bg-destructive/10 group-hover:bg-destructive/20 transition-colors">
                    <FileText className="w-5 h-5 text-destructive" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">Full Report</p>
                    <p className="text-xs text-muted-foreground">PDF format</p>
                  </div>
                  <Download className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-primary" />
                </button>

                <button
                  onClick={() => handleCourseReport("csv", "full")}
                  disabled={!!downloading}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">Full Report</p>
                    <p className="text-xs text-muted-foreground">CSV format</p>
                  </div>
                  <Download className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-primary" />
                </button>

                <button
                  onClick={() => handleCourseReport("pdf", "weekly")}
                  disabled={!!downloading}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <div className="p-2 rounded-lg bg-secondary/20 group-hover:bg-secondary/30 transition-colors">
                    <FileText className="w-5 h-5 text-secondary-foreground" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">Weekly Report</p>
                    <p className="text-xs text-muted-foreground">PDF format</p>
                  </div>
                  <Download className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-primary" />
                </button>
              </div>
            )}

            {!selectedCourse && (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a course to see report options</p>
              </div>
            )}
          </div>
        )}

        {/* By Course */}
        {activeReportTab === "course" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Download course-level attendance reports.
            </p>
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Select Course
                </p>
                <Select
                  value={selectedCourse}
                  onValueChange={setSelectedCourse}
                >
                  <SelectTrigger className="w-72">
                    <SelectValue placeholder="Choose a course..." />
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

            {selectedCourse && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  onClick={() => handleCourseReport("pdf", "full")}
                  disabled={!!downloading}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <div className="p-2 rounded-lg bg-destructive/10 group-hover:bg-destructive/20 transition-colors">
                    <FileText className="w-5 h-5 text-destructive" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">Full PDF</p>
                    <p className="text-xs text-muted-foreground">All time</p>
                  </div>
                  <Download className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-primary" />
                </button>

                <button
                  onClick={() => handleCourseReport("csv", "full")}
                  disabled={!!downloading}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">Full CSV</p>
                    <p className="text-xs text-muted-foreground">All time</p>
                  </div>
                  <Download className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-primary" />
                </button>

                <button
                  onClick={() => handleCourseReport("pdf", "weekly")}
                  disabled={!!downloading}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <div className="p-2 rounded-lg bg-secondary/20 group-hover:bg-secondary/30 transition-colors">
                    <FileText className="w-5 h-5 text-secondary-foreground" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">Weekly PDF</p>
                    <p className="text-xs text-muted-foreground">Last 7 days</p>
                  </div>
                  <Download className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-primary" />
                </button>
              </div>
            )}

            {!selectedCourse && (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a course to see report options</p>
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        {activeReportTab === "summary" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Download a full summary report across all courses.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <BookOpen className="w-4 h-4 text-primary" />
                    </div>
                    <p className="font-medium text-sm">{course.name}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setDownloading(`pdf-${course.id}`);
                        try {
                          await downloadReportApi(
                            "course",
                            course.id,
                            "pdf",
                            "full",
                          );
                          toast.success("Downloaded!");
                        } catch {
                          toast.error("Failed");
                        } finally {
                          setDownloading(null);
                        }
                      }}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
                    >
                      <Download className="w-3 h-3" /> PDF
                    </button>
                    <button
                      onClick={async () => {
                        setDownloading(`csv-${course.id}`);
                        try {
                          await downloadReportApi(
                            "course",
                            course.id,
                            "csv",
                            "full",
                          );
                          toast.success("Downloaded!");
                        } catch {
                          toast.error("Failed");
                        } finally {
                          setDownloading(null);
                        }
                      }}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
                    >
                      <Download className="w-3 h-3" /> CSV
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportsTab;
