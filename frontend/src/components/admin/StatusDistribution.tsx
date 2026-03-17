import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface StatusDistributionProps {
  present: number;
  late: number;
  exempted: number;
  absent: number;
}

const STATUS_COLORS = {
  Present:  "#608B50",  // requested shade
  Late:     "#facc15",  // yellow-400
  Exempted: "#64748b",  // slate-500
  Absent:   "#ef4444",  // red-500
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const { name, value } = payload[0];
    const total = payload[0].payload.total;
    return (
      <div
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 12,
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full inline-block"
            style={{ backgroundColor: STATUS_COLORS[name as keyof typeof STATUS_COLORS] }}
          />
          <span className="font-semibold">{name}</span>
        </div>
        <p className="text-muted-foreground mt-0.5">
          {value} records ({total > 0 ? Math.round((value / total) * 100) : 0}%)
        </p>
      </div>
    );
  }
  return null;
};

const StatusDistribution = ({ present, late, exempted, absent }: StatusDistributionProps) => {
  const total = present + late + exempted + absent;

  const data = [
    { name: "Present",  value: present,  total, color: STATUS_COLORS.Present },
    { name: "Late",     value: late,     total, color: STATUS_COLORS.Late },
    { name: "Exempted", value: exempted, total, color: STATUS_COLORS.Exempted },
    { name: "Absent",   value: absent,   total, color: STATUS_COLORS.Absent },
  ].filter((d) => d.value > 0);

  const hasData = total > 0;

  return (
    <Card className="shadow-card border-border/50 animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base">Status Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-52">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No attendance data
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
          {Object.entries(STATUS_COLORS).map(([name, color]) => {
            const item = data.find((d) => d.name === name);
            const count = item?.value ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={name} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-muted-foreground truncate">{name}</span>
                <span className="font-semibold ml-auto">{pct}%</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatusDistribution;
