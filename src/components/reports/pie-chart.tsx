"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

/**
 * Slice palette, in token order. CSS `var(--chart-*)` keeps every theme in
 * sync; callers can still pass explicit `Cell` fills for branded one-offs.
 */
const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--info)",
  "var(--warning)",
  "var(--success)",
];

interface PieChartProps<T> {
  data: T[];
  nameKey: keyof T;
  valueKey: keyof T;
  height?: number;
  showLegend?: boolean;
  innerRadius?: number;
  outerRadius?: number;
}

export function PieChart<T extends Record<string, unknown>>({
  data,
  nameKey,
  valueKey,
  height = 300,
  showLegend = true,
  innerRadius = 60,
  outerRadius = 100,
}: PieChartProps<T>) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          dataKey={valueKey as string}
          nameKey={nameKey as string}
          label={({ name, percent }) =>
            `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
          }
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${String(entry[nameKey] ?? index)}`}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            borderColor: "hsl(var(--border))",
            borderRadius: "8px",
          }}
        />
        {showLegend && (
          <Legend layout="horizontal" verticalAlign="bottom" align="center" />
        )}
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}
