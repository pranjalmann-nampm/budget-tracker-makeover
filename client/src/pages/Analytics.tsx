import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useCurrency } from "@/hooks/useCurrency";
import { DEFAULT_CATEGORIES } from "@shared/appTypes";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, BarChart3, PieChartIcon } from "lucide-react";

const CHART_COLORS = ["#f97316", "#3b82f6", "#a855f7", "#ef4444", "#ec4899", "#06b6d4", "#22c55e", "#6b7280", "#eab308", "#14b8a6"];

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("30");
  const { format } = useCurrency();

  const now = useMemo(() => Date.now(), []);
  const startDate = useMemo(() => now - parseInt(timeRange) * 24 * 60 * 60 * 1000, [timeRange, now]);

  const { data: dailyData } = trpc.analytics.dailyBalances.useQuery({ startDate, endDate: now });
  const { data: monthlyData } = trpc.analytics.monthlyTotals.useQuery({ months: 6 });
  const { data: categoryData } = trpc.analytics.categoryBreakdown.useQuery({ startDate, endDate: now });

  // Daily net balance line chart data
  const lineChartData = useMemo(() => {
    if (!dailyData || dailyData.length === 0) return [];
    let runningBalance = 0;
    return dailyData.map(d => {
      const inc = parseFloat(d.income);
      const exp = parseFloat(d.expense);
      runningBalance += inc - exp;
      return {
        date: d.day,
        balance: runningBalance,
        income: inc,
        expense: exp,
      };
    });
  }, [dailyData]);

  // Monthly bar chart data
  const barChartData = useMemo(() => {
    if (!monthlyData) return [];
    return monthlyData.map(m => {
      const parts = m.month.split("-");
      const label = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1).toLocaleString("en-US", { month: "short", year: "2-digit" });
      return {
        month: label,
        income: parseFloat(m.income),
        expense: parseFloat(m.expense),
      };
    });
  }, [monthlyData]);

  // Category doughnut data
  const pieChartData = useMemo(() => {
    if (!categoryData) return [];
    return categoryData.map((c, i) => {
      const cat = DEFAULT_CATEGORIES.find(dc => dc.name === c.category);
      return {
        name: c.category,
        value: parseFloat(c.total),
        color: cat?.color || CHART_COLORS[i % CHART_COLORS.length],
      };
    });
  }, [categoryData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-sm font-medium" style={{ color: p.color }}>
            {p.name}: {format(p.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Visual breakdown of your finances</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[160px] bg-secondary">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="180">Last 6 months</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Daily Net Balance Line Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Daily Net Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lineChartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="balance" name="Balance" stroke="var(--primary)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Income vs Expense Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Monthly Income vs Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {barChartData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown Doughnut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-primary" />
              Expense Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieChartData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No expense data</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                          <p className="text-sm font-medium">{d.name}</p>
                          <p className="text-xs text-muted-foreground">{format(d.value)}</p>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value: string) => <span className="text-foreground text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
