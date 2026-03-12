import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface StatusDistributionProps {
  safe: number;
  warning: number;
  atRisk: number;
}

const StatusDistribution = ({ safe, warning, atRisk }: StatusDistributionProps) => {
  const total = (safe || 1) + warning + atRisk;
  const data = [
    { name: "Present", value: safe || 1, color: "hsl(var(--eau-green))" },
    { name: "Late", value: warning, color: "hsl(var(--eau-mustard))" },
    { name: "Excused", value: Math.round(atRisk / 2) || 0, color: "hsl(var(--muted-foreground))" },
    { name: "Unexcused", value: atRisk, color: "hsl(var(--primary))" },
  ];

  return (
    <Card className="shadow-card border-border/50 animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base">Status Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                formatter={(value: number) => [`${Math.round((value / total) * 100)}%`, ""]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2 text-xs">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-muted-foreground">{item.name}</span>
              <span className="font-semibold ml-auto">{Math.round((item.value / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatusDistribution;
