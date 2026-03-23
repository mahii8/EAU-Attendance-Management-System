import { useState, useEffect } from "react";
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
import {
  downloadReportApi,
  getOfferingsApi,
  getSemestersApi,
} from "@/api/axios";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

interface ReportsTabProps {
  courses: Course[];
}

const ReportsTab = ({ courses }: ReportsTabProps) => {
  const [activeReportTab, setActiveReportTab] = useState<
    "student" | "course" | "summary"
  >("student");
  const [selectedOffering, setSelectedOffering] = useState<string>("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loadingOfferings, setLoadingOfferings] = useState(false);

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

  const handleOfferingReport = async (
    format: "pdf" | "csv",
    type: "full" | "weekly",
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
      );
      toast.success("Report downloaded!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to download report");
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
              course offering.
            </p>
            <div className="flex items-end gap-4 flex-wrap">
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
            </div>

            {selectedOffering && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  onClick={() => handleOfferingReport("pdf", "full")}
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
                  onClick={() => handleOfferingReport("csv", "full")}
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
                  onClick={() => handleOfferingReport("pdf", "weekly")}
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

            {!selectedOffering && (
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
            </div>

            {selectedOffering && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  onClick={() => handleOfferingReport("pdf", "full")}
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
                  onClick={() => handleOfferingReport("csv", "full")}
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
                  onClick={() => handleOfferingReport("pdf", "weekly")}
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

            {!selectedOffering && (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a course to see report options</p>
              </div>
            )}
          </div>
        )}

        {/* Summary — all offerings */}
        {activeReportTab === "summary" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Download a full summary report across all course offerings.
            </p>
            {loadingOfferings && (
              <p className="text-sm text-muted-foreground">
                Loading offerings...
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {offerings.map((offering) => (
                <div
                  key={offering.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <BookOpen className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {offering.course_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Sec {offering.section_name} · Y{offering.section_year}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setDownloading(`pdf-${offering.id}`);
                        try {
                          await downloadReportApi(
                            "offering",
                            offering.id,
                            "pdf",
                            "full",
                          );
                          toast.success("Downloaded!");
                        } catch (err: any) {
                          toast.error(err?.message || "Failed");
                        } finally {
                          setDownloading(null);
                        }
                      }}
                      disabled={!!downloading}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all disabled:opacity-50"
                    >
                      <Download className="w-3 h-3" /> PDF
                    </button>
                    <button
                      onClick={async () => {
                        setDownloading(`csv-${offering.id}`);
                        try {
                          await downloadReportApi(
                            "offering",
                            offering.id,
                            "csv",
                            "full",
                          );
                          toast.success("Downloaded!");
                        } catch (err: any) {
                          toast.error(err?.message || "Failed");
                        } finally {
                          setDownloading(null);
                        }
                      }}
                      disabled={!!downloading}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all disabled:opacity-50"
                    >
                      <Download className="w-3 h-3" /> CSV
                    </button>
                  </div>
                </div>
              ))}
              {!loadingOfferings && offerings.length === 0 && (
                <div className="col-span-2 text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">
                    No course offerings found for current semester
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportsTab;
