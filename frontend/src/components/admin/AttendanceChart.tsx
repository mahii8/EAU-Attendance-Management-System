import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getProgrammesApi,
  getSectionsApi,
  getSemestersApi,
  getOfferingsApi,
  getAttendanceApi,
} from "@/api/axios";
import { format, startOfWeek, endOfWeek } from "date-fns";

interface Programme {
  id: number;
  name: string;
  duration_years: number;
}
interface Section {
  id: number;
  name: string;
  year: number;
}
interface Semester {
  id: number;
  label: string;
  is_current: boolean;
}

const AttendanceChart = () => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [filterProgramme, setFilterProgramme] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [years, setYears] = useState<number[]>([]);
  const [filterYear, setFilterYear] = useState("1");
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Date range — default to current week
  const [startDate, setStartDate] = useState(
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState(
    format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
  );

  // Load programmes and semesters on mount
  useEffect(() => {
    Promise.all([getProgrammesApi(), getSemestersApi()]).then(
      ([progRes, semRes]) => {
        setProgrammes(progRes.data);
        if (progRes.data.length > 0) {
          setFilterProgramme(String(progRes.data[0].id));
        }
        const sems = semRes.data || [];
        setSemesters(sems);
        const current = sems.find((s: Semester) => s.is_current);
        if (current) setFilterSemester(String(current.id));
      },
    );
  }, []);

  // When programme or semester changes — update year list and load sections
  useEffect(() => {
    if (!filterProgramme) return;
    const prog = programmes.find((p) => p.id === parseInt(filterProgramme));
    if (prog)
      setYears(Array.from({ length: prog.duration_years }, (_, i) => i + 1));

    if (!filterSemester) return;
    getSectionsApi({
      programme: parseInt(filterProgramme),
      year: parseInt(filterYear),
      semester: parseInt(filterSemester),
    }).then((res) => {
      setSections(res.data);
      setFilterSection("");
    });
  }, [filterProgramme, filterYear, filterSemester]);

  // Fetch chart data when filters change
  useEffect(() => {
    if (!filterProgramme || !filterSemester) return;
    fetchChartData();
  }, [
    filterProgramme,
    filterYear,
    filterSection,
    filterSemester,
    startDate,
    endDate,
  ]);

  const fetchChartData = async () => {
    setLoading(true);
    try {
      // Get offerings for the selected filters
      const offeringParams: any = {
        semester: filterSemester,
        programme: filterProgramme,
      };
      if (filterSection) offeringParams.section = filterSection;

      const offeringsRes = await getOfferingsApi(offeringParams);
      const offerings = offeringsRes.data
        .filter(
          (o: any) => !filterYear || o.section_year === parseInt(filterYear),
        )
        .slice(0, 8);

      const data = await Promise.all(
        offerings.map(async (offering: any) => {
          const attendanceParams: any = {
            offering: offering.id,
          };
          const attendanceRes = await getAttendanceApi(attendanceParams);
          const records = attendanceRes.data.filter((r: any) => {
            const d = r.date;
            return d >= startDate && d <= endDate;
          });

          const present = records.filter(
            (r: any) => r.status === "present",
          ).length;
          const late = records.filter((r: any) => r.status === "late").length;
          const excused = records.filter(
            (r: any) => r.status === "excused",
          ).length;
          const unexcused = records.filter(
            (r: any) => r.status === "unexcused",
          ).length;

          return {
            name:
              offering.course_name.length > 12
                ? offering.course_name.substring(0, 12) + "..."
                : offering.course_name,
            fullName: offering.course_name,
            Present: present,
            Late: late,
            Excused: excused,
            Absent: unexcused,
          };
        }),
      );

      setChartData(
        data.filter((d) => d.Present + d.Late + d.Excused + d.Absent > 0),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const setCurrentWeek = () => {
    setStartDate(
      format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
    );
    setEndDate(
      format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
    );
    setShowDatePicker(false);
  };

  const setLastWeek = () => {
    const lastWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 });
    setStartDate(format(lastWeekStart, "yyyy-MM-dd"));
    setEndDate(format(lastWeekEnd, "yyyy-MM-dd"));
    setShowDatePicker(false);
  };

  const CustomXAxisTick = ({ x, y, payload }: any) => {
    const [hovered, setHovered] = useState(false);
    const fullName = chartData.find((d) => d.name === payload.value)?.fullName;
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={16}
          textAnchor="middle"
          fill={
            hovered ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"
          }
          fontSize={11}
          style={{ cursor: "pointer", transition: "fill 0.2s" }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {payload.value}
        </text>
        {hovered && (
          <g>
            <rect
              x={-70}
              y={24}
              width={140}
              height={24}
              rx={4}
              fill="hsl(var(--foreground))"
              opacity={0.9}
            />
            <text
              x={0}
              y={40}
              textAnchor="middle"
              fill="hsl(var(--background))"
              fontSize={11}
              fontWeight={500}
            >
              {fullName}
            </text>
          </g>
        )}
      </g>
    );
  };

  const dateRangeLabel = `${format(new Date(startDate), "MMM d")} – ${format(new Date(endDate), "MMM d, yyyy")}`;

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="font-display text-base">
              Attendance Status by Course
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dateRangeLabel}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {/* Semester filter */}
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="border border-input rounded-lg px-2 py-1 text-xs bg-background outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Semesters</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} {s.is_current ? "✓" : ""}
                </option>
              ))}
            </select>

            {/* Programme filter */}
            <select
              value={filterProgramme}
              onChange={(e) => setFilterProgramme(e.target.value)}
              className="border border-input rounded-lg px-2 py-1 text-xs bg-background outline-none focus:ring-2 focus:ring-ring"
            >
              {programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name.replace("BSc ", "")}
                </option>
              ))}
            </select>

            {/* Year filter */}
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="border border-input rounded-lg px-2 py-1 text-xs bg-background outline-none focus:ring-2 focus:ring-ring"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>

            {/* Section filter */}
            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="border border-input rounded-lg px-2 py-1 text-xs bg-background outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Sections</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  Section {s.name}
                </option>
              ))}
            </select>

            {/* Date range picker */}
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex items-center gap-1.5 border border-input rounded-lg px-2 py-1 text-xs bg-background hover:bg-muted transition-colors"
              >
                📅 {dateRangeLabel}
              </button>

              {showDatePicker && (
                <div className="absolute right-0 top-8 z-50 bg-card border border-border rounded-xl shadow-lg p-4 w-72">
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={setCurrentWeek}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                    >
                      This Week
                    </button>
                    <button
                      onClick={setLastWeek}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors font-medium"
                    >
                      Last Week
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        From
                      </p>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full border border-input rounded-lg px-3 py-1.5 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        To
                      </p>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full border border-input rounded-lg px-3 py-1.5 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <button
                      onClick={() => setShowDatePicker(false)}
                      className="w-full mt-1 text-xs py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            Loading chart...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            No attendance data for selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 10, left: -20, bottom: 40 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="name"
                tick={(props) => <CustomXAxisTick {...props} />}
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "32px" }} />
              <Bar
                dataKey="Present"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="Late"
                fill="hsl(var(--secondary))"
                radius={[4, 4, 0, 0]}
              />
              <Bar dataKey="Excused" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey="Absent"
                fill="hsl(var(--destructive))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default AttendanceChart;
