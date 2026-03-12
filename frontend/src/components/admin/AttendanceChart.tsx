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
import axios from "@/api/axios";

const CustomXAxisTick = ({ x, y, payload }: any) => {
  const [hovered, setHovered] = useState(false);
  const fullName = payload.fullName || payload.value;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="middle"
        fill={hovered ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
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

const AttendanceChart = () => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const coursesRes = await axios.get("/courses/");
        const courses = coursesRes.data;

        const data = await Promise.all(
          courses.map(async (course: any) => {
            const summaryRes = await axios.get(
              `/courses/${course.id}/summary/`,
            );
            const summary = summaryRes.data.summary || [];

            const present = summary.filter(
              (s: any) => s.status === "safe",
            ).length;
            const warning = summary.filter(
              (s: any) => s.status === "warning",
            ).length;
            const atRisk = summary.filter(
              (s: any) => s.status === "at_risk",
            ).length;

            return {
              name:
                course.name.length > 10
                  ? course.name.substring(0, 10) + "..."
                  : course.name,
              fullName: course.name,
              Present: present,
              Warning: warning,
              "At Risk": atRisk,
            };
          }),
        );

        setChartData(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const renderCustomTick = (props: any) => {
    const fullName = chartData.find(
      (d) => d.name === props.payload.value,
    )?.fullName;
    return (
      <CustomXAxisTick {...props} payload={{ ...props.payload, fullName }} />
    );
  };

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base">
          Attendance Status by Course
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            Loading chart...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 10, left: -20, bottom: 40 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis dataKey="name" tick={renderCustomTick} interval={0} />
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
                formatter={(value, name, props) => [
                  value,
                  props.payload.fullName ? `${name}` : name,
                ]}
              />
              <Legend
                wrapperStyle={{
                  fontSize: "12px",
                  paddingTop: "32px",
                  marginTop: "16px",
                }}
              />
              <Bar
                dataKey="Present"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="Warning"
                fill="hsl(var(--secondary))"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="At Risk"
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
