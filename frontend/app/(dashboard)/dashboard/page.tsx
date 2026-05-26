"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  TrendingDown,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  Lock,
  Plus,
  HelpCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import StatCard from "@/components/ui/stat-card";
import AmountBadge from "@/components/ui/amount-badge";
import CategoryBadge from "@/components/ui/category-badge";

import { useAuth } from "@/lib/auth-context";

interface CategorySummary {
  category: string;
  total: number;
  percentage: number;
}

interface TransactionSummary {
  net_cash_flow: number;
  total_income: number;
  total_expenses: number;
  by_category: CategorySummary[];
  transaction_count: number;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  source: string;
  created_at: string;
}

interface ForecastPoint {
  date: string;
  predicted: number;
  lower: number;
  upper: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1. Fetch summary & transactions in parallel
        const [summaryRes, txRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/transactions/summary`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          }),
          fetch(`${API_URL}/api/v1/transactions?limit=100`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          }),
        ]);

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setSummary(summaryData);
        }

        let fetchedTx: Transaction[] = [];
        if (txRes.ok) {
          const txData = await txRes.json();
          fetchedTx = txData.data || [];
          setTransactions(fetchedTx);
        }

        // 2. Fetch forecast if pro plan
        if (user.plan === "pro") {
          try {
            const forecastRes = await fetch(`${API_URL}/api/v1/forecast?horizon=30`, {
              method: "GET",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
            });
            if (forecastRes.ok) {
              const forecastData = await forecastRes.json();
              setForecast(forecastData.forecast || []);
            }
          } catch {
            // let forecast load fail silently
          }
        }
      } catch {
        setError("Failed to fetch dashboard data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [API_URL, user]);

  // Aggregate daily net data for chart
  const getChartData = () => {
    if (transactions.length === 0) return [];

    // Group transactions by date
    const dailyMap: Record<string, number> = {};
    
    // Sort chronological first
    const sortedTx = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    sortedTx.forEach((tx) => {
      const d = tx.date;
      dailyMap[d] = (dailyMap[d] || 0) + tx.amount;
    });

    const chartData = Object.keys(dailyMap).map((date) => ({
      date,
      amount: parseFloat(dailyMap[date].toFixed(2)),
    }));

    // If pro, append forecast points
    if (user?.plan === "pro" && forecast.length > 0) {
      const lastHistDate = chartData.length > 0 ? new Date(chartData[chartData.length - 1].date) : new Date();
      
      forecast.forEach((f) => {
        // Only append future predictions
        if (new Date(f.date) > lastHistDate) {
          chartData.push({
            date: f.date,
            amount: 0, // placeholder so area goes to 0
            // @ts-expect-error - dynamic ComposedChart data types for forecast line
            predicted: parseFloat(f.predicted.toFixed(2)),
            lower: parseFloat(f.lower.toFixed(2)),
            upper: parseFloat(f.upper.toFixed(2)),
            isForecast: true,
          });
        }
      });
    }

    return chartData;
  };

  const chartData = getChartData();

  // Category styling color configuration
  const CATEGORY_COLORS: Record<string, string> = {
    revenue: "#10B981", // emerald
    payroll: "#3B82F6", // blue
    infrastructure: "#8B5CF6", // violet
    office: "#64748B", // slate
    meals: "#F97316", // orange
    marketing: "#EC4899", // pink
    contractors: "#F59E0B", // amber
    utilities: "#06B6D4", // cyan
    travel: "#6366F1", // indigo
    other: "#9CA3AF", // gray
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-gray-900 border border-gray-800 rounded-lg" />
            <div className="h-4 w-32 bg-gray-900 border border-gray-800 rounded-lg" />
          </div>
          <div className="h-10 w-28 bg-gray-900 border border-gray-800 rounded-lg" />
        </div>

        {/* Stats card skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-900 border border-gray-800 rounded-xl" />
          ))}
        </div>

        {/* Chart skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[350px] bg-gray-900 border border-gray-800 rounded-xl" />
          <div className="h-[350px] bg-gray-900 border border-gray-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-xl p-6 text-center max-w-lg mx-auto mt-12">
        <p className="text-sm font-semibold text-danger">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-xs transition-colors"
        >
          Retry Load
        </button>
      </div>
    );
  }

  const latestExpense = summary?.by_category?.[0]?.category || "None";
  const firstName = user?.full_name?.split(" ")[0] || "User";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Row 1: Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-sm text-text-muted mt-1">
            Good morning, {firstName}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs text-text-muted bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg select-none">
            Date range: Last 30 days
          </span>
          <Link
            href="/transactions"
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-semibold transition-all shadow-lg shadow-blue-500/10 flex items-center"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Upload CSV
          </Link>
        </div>
      </div>

      {/* Row 2: Stat Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Net Cash Flow"
            value={summary.net_cash_flow.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            })}
            trend={summary.net_cash_flow >= 0 ? "up" : "down"}
            trendValue={summary.net_cash_flow >= 0 ? "positive" : "deficit"}
            icon={summary.net_cash_flow >= 0 ? <TrendingUp className="h-5 w-5 text-success" /> : <TrendingDown className="h-5 w-5 text-danger" />}
          />
          <StatCard
            title="Total Income"
            value={summary.total_income.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            })}
            trend="up"
            trendValue="inflow"
            icon={<ArrowDownCircle className="h-5 w-5 text-success" />}
          />
          <StatCard
            title="Total Expenses"
            value={summary.total_expenses.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            })}
            trend="down"
            trendValue="outflow"
            subtitle={`Largest: ${latestExpense}`}
            icon={<ArrowUpCircle className="h-5 w-5 text-danger" />}
          />
          <StatCard
            title="Transactions"
            value={summary.transaction_count}
            subtitle="Uploaded this period"
            icon={<FileText className="h-5 w-5 text-primary" />}
          />
        </div>
      )}

      {/* Row 3: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composed Chart */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6 relative overflow-hidden flex flex-col justify-between shadow-lg h-[400px]">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white">Cash Flow Trend</h3>
              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-semibold text-text-muted">
                Last 90 days
              </span>
            </div>
            {chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 border border-dashed border-gray-800 rounded-xl">
                <HelpCircle className="h-8 w-8 text-gray-700 mb-2" />
                <p className="text-sm font-medium text-text-muted">No chart data available</p>
                <p className="text-xs text-gray-600 mt-1">Upload a CSV to view trends</p>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cashFlowGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#6B7280"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      }}
                    />
                    <YAxis
                      stroke="#6B7280"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `$${val}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const formattedDate = new Date(data.date).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          });

                          return (
                            <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 shadow-2xl space-y-1">
                              <p className="text-[10px] font-semibold text-text-muted uppercase">
                                {formattedDate}
                              </p>
                              {data.isForecast ? (
                                <div className="space-y-0.5">
                                  <p className="text-sm font-bold text-violet-400">
                                    Predicted: ${data.predicted}
                                  </p>
                                  <p className="text-[10px] font-medium text-gray-500">
                                    Range: ${data.lower} – ${data.upper}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-sm font-bold text-blue-400">
                                  Net Amount: ${data.amount}
                                </p>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />
                    
                    {/* Historical Area */}
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#cashFlowGradient)"
                    />

                    {/* Forecast Dash Line */}
                    {user?.plan === "pro" && (
                      <Line
                        type="monotone"
                        dataKey="predicted"
                        stroke="#8B5CF6"
                        strokeWidth={2}
                        strokeDasharray="6 3"
                        dot={false}
                      />
                    )}

                    {/* Forecast Confidence area */}
                    {user?.plan === "pro" && (
                      <Area
                        type="monotone"
                        dataKey="upper"
                        stroke="none"
                        fill="#8B5CF6"
                        fillOpacity={0.08}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Plan Gate Overlay for Free Plan */}
          {user?.plan === "free" && chartData.length > 0 && (
            <div className="absolute inset-0 backdrop-blur-[2px] bg-gradient-to-t from-gray-950/90 via-gray-950/70 to-transparent flex items-center justify-center p-6">
              <div className="bg-gray-950/90 border border-gray-800 p-6 rounded-xl text-center max-w-sm shadow-2xl flex flex-col items-center">
                <Lock className="h-5 w-5 text-blue-400 mb-3" />
                <h4 className="text-sm font-bold text-white">Unlock 90-Day Forecasting</h4>
                <p className="text-xs text-text-muted mt-1 mb-4 leading-relaxed">
                  Predict cash flow, compute safety thresholds, and manage budget horizons.
                </p>
                <Link
                  href="/settings/billing"
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold transition-all shadow-md"
                >
                  Upgrade to Pro
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Donut Chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col justify-between shadow-lg h-[400px]">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white">Expense Breakdown</h3>
              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-semibold text-text-muted">
                Donut
              </span>
            </div>

            {!summary || summary.by_category.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 border border-dashed border-gray-800 rounded-xl">
                <Plus className="h-8 w-8 text-gray-700 mb-2 cursor-pointer" onClick={() => router.push("/transactions")} />
                <p className="text-sm font-medium text-text-muted">No transaction data yet</p>
                <p className="text-xs text-gray-600 mt-1">Upload a CSV to view breakdown</p>
                <button
                  onClick={() => router.push("/transactions")}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs transition-colors"
                >
                  Upload CSV
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Recharts Pie */}
                <div className="h-44 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary.by_category}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={2}
                      >
                        {summary.by_category.map((entry, index) => {
                          const catName = entry.category.toLowerCase();
                          const color = CATEGORY_COLORS[catName] || CATEGORY_COLORS.other;
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-gray-950 border border-gray-800 rounded-xl p-2.5 shadow-2xl text-xs space-y-1">
                                <p className="font-bold text-white">{data.category}</p>
                                <p className="font-semibold text-danger">
                                  {Math.abs(data.total).toLocaleString("en-US", {
                                    style: "currency",
                                    currency: "USD",
                                  })}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Custom Legends (Top 4) */}
                <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                  {summary.by_category.slice(0, 4).map((entry) => {
                    const catName = entry.category.toLowerCase();
                    const color = CATEGORY_COLORS[catName] || CATEGORY_COLORS.other;
                    return (
                      <div key={entry.category} className="flex justify-between items-center text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-gray-300 truncate max-w-[100px]">{entry.category}</span>
                        </div>
                        <div className="flex items-center space-x-2 font-mono">
                          <span className="text-text-muted">{entry.percentage.toFixed(0)}%</span>
                          <span className="text-text-primary">
                            {Math.abs(entry.total).toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {summary.by_category.length > 4 && (
                    <p className="text-[10px] text-center text-text-muted italic pt-1">
                      + {summary.by_category.length - 4} more categories
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Recent Transactions */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-base font-bold text-white">Recent Transactions</h3>
          <Link
            href="/transactions"
            className="text-xs font-semibold text-primary hover:underline"
          >
            View all →
          </Link>
        </div>

        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-gray-800 rounded-xl">
            <FileText className="h-8 w-8 text-gray-700 mb-2" />
            <p className="text-sm font-medium text-text-muted">No transactions found</p>
            <p className="text-xs text-gray-600 mt-1">Upload a CSV to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {transactions.slice(0, 5).map((tx) => (
              <div key={tx.id} className="flex justify-between items-center py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-center space-x-4 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-xs shrink-0 select-none">
                    {tx.category.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white" title={tx.description}>
                      {tx.description}
                    </p>
                    <div className="mt-1 flex items-center space-x-2">
                      <span className="text-[10px] text-text-muted">
                        {new Date(tx.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <CategoryBadge category={tx.category} />
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <AmountBadge amount={tx.amount} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
