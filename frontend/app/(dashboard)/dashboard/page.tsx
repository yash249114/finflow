"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  Lock,
  Plus,
  HelpCircle,
  Brain,
  Upload,
  Eye,
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
import MetricCard from "@/components/dashboard/metric-card";
import AIInsightCard from "@/components/dashboard/ai-insight-card";
import FinancialHealth from "@/components/dashboard/financial-health";
import AmountBadge from "@/components/ui/amount-badge";
import CategoryBadge from "@/components/ui/category-badge";
import { staggerContainer, fadeSlideUp } from "@/lib/motion";

import { useAuth } from "@/lib/auth-context";
import { getAuthHeaders } from "@/lib/supabase";

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
        const authHeaders = await getAuthHeaders();

        const [summaryRes, txRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/transactions/summary`, {
            method: "GET",
            headers: authHeaders,
            credentials: "include",
          }),
          fetch(`${API_URL}/api/v1/transactions?limit=100`, {
            method: "GET",
            headers: authHeaders,
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

        if (user.plan === "pro") {
          try {
            const forecastRes = await fetch(`${API_URL}/api/v1/forecast?horizon=30`, {
              method: "GET",
              headers: authHeaders,
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

  const getChartData = () => {
    if (transactions.length === 0) return [];
    const dailyMap: Record<string, number> = {};
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

    if (user?.plan === "pro" && forecast.length > 0) {
      const lastHistDate = chartData.length > 0 ? new Date(chartData[chartData.length - 1].date) : new Date();

      forecast.forEach((f) => {
        if (new Date(f.date) > lastHistDate) {
          chartData.push({
            date: f.date,
            amount: 0,
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

  const CATEGORY_COLORS: Record<string, string> = {
    revenue: "#10B981",
    payroll: "#6366F1",
    infrastructure: "#8B5CF6",
    office: "#64748B",
    meals: "#F97316",
    marketing: "#EC4899",
    contractors: "#F59E0B",
    utilities: "#06B6D4",
    travel: "#818CF8",
    other: "#6B7280",
  };

  // Time-of-day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Financial health score (simple heuristic)
  const getHealthScore = () => {
    if (!summary) return 65;
    const ratio = summary.total_income > 0 ? summary.net_cash_flow / summary.total_income : 0;
    if (ratio > 0.3) return 92;
    if (ratio > 0.1) return 78;
    if (ratio > 0) return 62;
    if (ratio > -0.1) return 45;
    return 28;
  };

  const firstName = user?.full_name?.split(" ")[0] || "User";

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton header */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-8 w-56 rounded-xl shimmer" />
            <div className="h-4 w-36 rounded-lg shimmer" />
          </div>
          <div className="h-10 w-28 rounded-xl shimmer" />
        </div>

        {/* Skeleton cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl shimmer glass-card" />
          ))}
        </div>

        {/* Skeleton charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-[380px] rounded-2xl shimmer glass-card" />
          <div className="h-[380px] rounded-2xl shimmer glass-card" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card border-danger/20 rounded-2xl p-8 text-center max-w-lg mx-auto mt-16">
        <p className="text-sm font-semibold text-danger mb-3">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 btn-chrome rounded-xl text-white text-xs font-semibold transition-[background-color,border-color,box-shadow,color,opacity]"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-7"
    >
      {/* ─── Row 1: Command Header ─────────────────────── */}
      <motion.div variants={fadeSlideUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Here&apos;s your financial intelligence overview
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <Link
            href="/forecast"
            className="flex items-center space-x-1.5 rounded-xl btn-chrome px-3.5 py-2 text-xs font-semibold text-text-secondary hover:text-white transition-[background-color,border-color,box-shadow,color,opacity]"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Forecast</span>
          </Link>
          <Link
            href="/transactions"
            className="flex items-center space-x-1.5 rounded-xl bg-neural-blue hover:bg-neural-blue/90 text-white px-3.5 py-2 text-xs font-semibold transition-[background-color,border-color,box-shadow,color,opacity] shadow-lg shadow-neural-blue/20"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload CSV</span>
          </Link>
        </div>
      </motion.div>

      {/* ─── Row 2: Metric Cards ───────────────────────── */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard
            title="Net Cash Flow"
            value={Math.abs(summary.net_cash_flow)}
            prefix={summary.net_cash_flow >= 0 ? '$' : '-$'}
            trend={summary.net_cash_flow >= 0 ? "up" : "down"}
            trendLabel={summary.net_cash_flow >= 0 ? "Positive flow" : "Net deficit"}
            icon={summary.net_cash_flow >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
            formatAsCurrency
            delay={0}
          />
          <MetricCard
            title="Total Income"
            value={summary.total_income}
            prefix="$"
            trend="up"
            trendLabel="Inflow"
            icon={<ArrowDownCircle className="h-4 w-4 text-emerald-400" />}
            formatAsCurrency
            delay={0.08}
          />
          <MetricCard
            title="Total Expenses"
            value={Math.abs(summary.total_expenses)}
            prefix="$"
            trend="down"
            trendLabel={`Largest: ${summary.by_category?.[0]?.category || 'N/A'}`}
            icon={<ArrowUpCircle className="h-4 w-4 text-red-400" />}
            formatAsCurrency
            delay={0.16}
          />
          <MetricCard
            title="Transactions"
            value={summary.transaction_count}
            trend="neutral"
            trendLabel="This period"
            icon={<FileText className="h-4 w-4 text-neural-blue" />}
            delay={0.24}
          />
        </div>
      )}

      {/* ─── Row 3: Charts + Health Score ───────────────── */}
      <motion.div variants={fadeSlideUp} className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Cash Flow Chart */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-5 relative overflow-hidden h-[380px] flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-white">Cash Flow Trend</h3>
            <span className="rounded-full bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-semibold text-text-muted">
              Last 90 days
            </span>
          </div>
          {chartData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/[0.06] rounded-xl">
              <HelpCircle className="h-7 w-7 text-text-dim mb-2" />
              <p className="text-xs font-medium text-text-muted">No chart data available</p>
              <p className="text-[10px] text-text-dim mt-1">Upload a CSV to view trends</p>
            </div>
          ) : (
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cashFlowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false}
                    tickFormatter={(val) => new Date(val).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  />
                  <YAxis stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const formattedDate = new Date(data.date).toLocaleDateString("en-US", {
                          month: "long", day: "numeric", year: "numeric",
                        });
                        return (
                          <div className="glass-dropdown rounded-xl p-3 space-y-1 text-xs">
                            <p className="text-[10px] font-semibold text-text-muted uppercase">
                              {formattedDate}
                            </p>
                            {data.isForecast ? (
                              <div className="space-y-0.5">
                                <p className="text-sm font-bold text-neural-violet">Predicted: ${data.predicted}</p>
                                <p className="text-[10px] text-text-dim">Range: ${data.lower} – ${data.upper}</p>
                              </div>
                            ) : (
                              <p className="text-sm font-bold text-neural-blue">Net: ${data.amount}</p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                  <Area type="monotone" dataKey="amount" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill="url(#cashFlowGrad)" />
                  {user?.plan === "pro" && (
                    <Line type="monotone" dataKey="predicted" stroke="#8B5CF6" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                  )}
                  {user?.plan === "pro" && (
                    <Area type="monotone" dataKey="upper" stroke="none" fill="#8B5CF6" fillOpacity={0.06} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Pro Gate Overlay */}
          {user?.plan === "free" && chartData.length > 0 && (
            <div className="absolute inset-0 backdrop-blur-[2px] bg-gradient-to-t from-[#060608]/95 via-[#060608]/60 to-transparent flex items-center justify-center p-6 rounded-2xl">
              <div className="glass-card-elevated p-6 rounded-2xl text-center max-w-sm flex flex-col items-center">
                <Lock className="h-5 w-5 text-neural-blue mb-3" />
                <h4 className="text-sm font-bold text-white">Unlock 90-Day Forecasting</h4>
                <p className="text-[11px] text-text-muted mt-1.5 mb-4 leading-relaxed">
                  Predict cash flow, compute safety thresholds, and manage budget horizons.
                </p>
                <Link href="/settings/billing" className="rounded-xl bg-neural-blue hover:bg-neural-blue/90 text-white px-5 py-2.5 text-xs font-semibold transition-[background-color,border-color,box-shadow,color,opacity] shadow-lg shadow-neural-blue/25">
                  Upgrade to Pro
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Expense Donut */}
        <div className="glass-card rounded-2xl p-5 flex flex-col h-[380px]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-white">Expense Breakdown</h3>
          </div>
          {!summary || summary.by_category.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/[0.06] rounded-xl">
              <Plus className="h-7 w-7 text-text-dim mb-2 cursor-pointer hover:text-white transition-colors" onClick={() => router.push("/transactions")} />
              <p className="text-xs font-medium text-text-muted">No data yet</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="h-40 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={summary.by_category} dataKey="total" nameKey="category" cx="50%" cy="50%" innerRadius={46} outerRadius={68} paddingAngle={2}>
                      {summary.by_category.map((entry, index) => {
                        const color = CATEGORY_COLORS[entry.category.toLowerCase()] || CATEGORY_COLORS.other;
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Pie>
                    <Tooltip content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="glass-dropdown rounded-xl p-2.5 text-xs space-y-0.5">
                            <p className="font-bold text-white">{data.category}</p>
                            <p className="font-semibold text-red-400">
                              {Math.abs(data.total).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2 max-h-[120px] overflow-y-auto pr-1">
                {summary.by_category.slice(0, 5).map((entry) => {
                  const color = CATEGORY_COLORS[entry.category.toLowerCase()] || CATEGORY_COLORS.other;
                  return (
                    <div key={entry.category} className="flex justify-between items-center text-[11px]">
                      <div className="flex items-center space-x-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-text-secondary truncate max-w-[80px]">{entry.category}</span>
                      </div>
                      <div className="flex items-center space-x-2 font-mono">
                        <span className="text-text-muted">{entry.percentage.toFixed(0)}%</span>
                        <span className="text-white font-semibold">
                          {Math.abs(entry.total).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Health Score */}
        <FinancialHealth
          score={getHealthScore()}
          label="Financial Health"
          delay={0.3}
        />
      </motion.div>

      {/* ─── Row 4: AI Insights ────────────────────────── */}
      <motion.div variants={fadeSlideUp}>
        <div className="flex items-center space-x-2 mb-4">
          <Brain className="h-4 w-4 text-neural-violet" />
          <h3 className="text-sm font-bold text-white">FinFlow Intelligence</h3>
          <span className="rounded-full bg-neural-violet/10 border border-neural-violet/20 px-2 py-0.5 text-[9px] font-bold text-neural-violet uppercase tracking-wider">
            AI
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AIInsightCard
            title="Spending Velocity"
            description={summary ? `Your spending rate is ${summary.total_expenses < -5000 ? 'elevated' : 'within normal range'} compared to your income flow this period.` : "Upload transactions to unlock spending analysis."}
            type="insight"
            confidence={88}
            delay={0.1}
          />
          <AIInsightCard
            title="Runway Projection"
            description={summary && summary.net_cash_flow > 0 ? "At current burn rate, your projected runway exceeds 12 months. Cash position is strengthening." : "Net outflow detected. Consider reviewing discretionary spending categories."}
            type="prediction"
            confidence={74}
            delay={0.2}
          />
          <AIInsightCard
            title="Anomaly Detection"
            description={summary?.by_category?.length ? `${summary.by_category[0].category} accounts for ${summary.by_category[0].percentage.toFixed(0)}% of total spend — monitor for abnormal spikes.` : "No anomalies detected in current data set."}
            type="anomaly"
            confidence={91}
            delay={0.3}
          />
        </div>
      </motion.div>

      {/* ─── Row 5: Recent Transactions ────────────────── */}
      <motion.div variants={fadeSlideUp} className="glass-card rounded-2xl p-5">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-sm font-bold text-white">Recent Transactions</h3>
          <Link href="/transactions" className="text-xs font-semibold text-neural-blue hover:text-neural-blue/80 transition-colors">
            View all →
          </Link>
        </div>

        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-white/[0.06] rounded-xl">
            <FileText className="h-7 w-7 text-text-dim mb-2" />
            <p className="text-xs font-medium text-text-muted">No transactions found</p>
            <p className="text-[10px] text-text-dim mt-1">Upload a CSV to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {transactions.slice(0, 5).map((tx, i) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.06, duration: 0.3 }}
                className="flex justify-between items-center py-3 first:pt-0 last:pb-0 group"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-xs font-bold text-text-muted shrink-0 group-hover:bg-neural-blue/10 group-hover:text-neural-blue transition-colors">
                    {tx.category.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white" title={tx.description}>
                      {tx.description}
                    </p>
                    <div className="mt-0.5 flex items-center space-x-2">
                      <span className="text-[10px] text-text-muted">
                        {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <CategoryBadge category={tx.category} />
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <AmountBadge amount={tx.amount} />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
