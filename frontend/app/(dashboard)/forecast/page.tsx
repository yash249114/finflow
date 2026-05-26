"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Lock,
  TrendingUp,
  TrendingDown,
  Info,
  AlertTriangle,
  Lightbulb,
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
} from "recharts";
import LoadingSpinner from "@/components/ui/loading-spinner";
import AmountBadge from "@/components/ui/amount-badge";
import { useAuth } from "@/lib/auth-context";

interface ForecastPoint {
  date: string;
  predicted: number;
  lower: number;
  upper: number;
}

interface ForecastSummary {
  expected_net: number;
  trend: string;
  confidence: string;
}

interface ForecastResponse {
  forecast: ForecastPoint[];
  summary: ForecastSummary;
}

interface Transaction {
  id: string;
  date: string;
  amount: number;
}

export default function ForecastPage() {
  const { user } = useAuth();
  const plan = (user?.plan || "free") as "free" | "pro";
  const [horizon, setHorizon] = useState<30 | 60 | 90>(30);
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [summary, setSummary] = useState<ForecastSummary | null>(null);
  const [historical, setHistorical] = useState<Transaction[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<"cached" | "live">("live");

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // Check plan status and load historical transactions if pro
  useEffect(() => {
    if (!user) return;

    if (user.plan === "pro") {
      const fetchHistorical = async () => {
        setLoading(true);
        setError(null);
        try {
          const txRes = await fetch(`${API_URL}/api/v1/transactions?limit=100`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });
          if (txRes.ok) {
            const txData = await txRes.json();
            setHistorical(txData.data || []);
          }
        } catch {
          setError("Could not retrieve transaction history.");
        } finally {
          setLoading(false);
        }
      };
      fetchHistorical();
    } else {
      setLoading(false);
    }
  }, [API_URL, user]);

  // Fetch forecast data when plan='pro' or horizon updates
  useEffect(() => {
    if (plan !== "pro") return;

    const fetchForecast = async () => {
      setForecastLoading(true);
      const startFetch = Date.now();
      try {
        const res = await fetch(`${API_URL}/api/v1/forecast?horizon=${horizon}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (res.ok) {
          const data: ForecastResponse = await res.json();
          setForecast(data.forecast || []);
          setSummary(data.summary);
          
          // If response took less than 15ms, it was served from Redis cache
          const duration = Date.now() - startFetch;
          setCacheStatus(duration < 15 ? "cached" : "live");
        } else {
          const errData = await res.json();
          setError(errData.error || "Failed to load forecasting metrics.");
        }
      } catch {
        setError("Error connecting to forecast server.");
      } finally {
        setForecastLoading(false);
      }
    };

    fetchForecast();
  }, [plan, horizon, API_URL]);

  interface ComposedChartPoint {
    date: string;
    historicalAmount?: number;
    predicted?: number;
    lower?: number;
    upper?: number;
    isForecast?: boolean;
  }

  const getComposedChartData = () => {
    const chartData: ComposedChartPoint[] = [];

    // Group historical transactions by date (last 60 days)
    const dailyMap: Record<string, number> = {};
    const sortedHist = [...historical].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    sortedHist.forEach((tx) => {
      dailyMap[tx.date] = (dailyMap[tx.date] || 0) + tx.amount;
    });

    // Populate historical points
    Object.keys(dailyMap).forEach((date) => {
      chartData.push({
        date,
        historicalAmount: parseFloat(dailyMap[date].toFixed(2)),
      });
    });

    // Append forecast points
    forecast.forEach((f) => {
      chartData.push({
        date: f.date,
        predicted: parseFloat(f.predicted.toFixed(2)),
        lower: parseFloat(f.lower.toFixed(2)),
        upper: parseFloat(f.upper.toFixed(2)),
        isForecast: true,
      });
    });

    return chartData;
  };

  const chartData = getComposedChartData();

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // IF FREE PLAN: Render lock promotional page
  if (plan === "free") {
    return (
      <div className="space-y-8 animate-fade-in max-w-4xl mx-auto py-12">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center relative overflow-hidden shadow-2xl flex flex-col items-center">
          <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mb-6 border border-blue-500/20">
            <Lock className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Cash Flow Forecasting</h1>
          <p className="text-base text-text-muted mt-2 max-w-md">
            Predict your financial future with AI. Analyze seasonal trends and project safety horizons.
          </p>

          {/* Blur preview mockup */}
          <div className="w-full h-40 bg-gray-950/40 rounded-xl my-8 border border-gray-850 relative overflow-hidden flex items-end justify-between px-10 pt-10 select-none opacity-40 blur-[2px]">
            <div className="w-10 bg-blue-500/25 rounded-t h-[40%]" />
            <div className="w-10 bg-blue-500/35 rounded-t h-[55%]" />
            <div className="w-10 bg-blue-500/30 rounded-t h-[45%]" />
            {/* Forecast dash lines */}
            <div className="w-10 border-t-2 border-dashed border-violet-500 h-[60%] flex items-end"><div className="w-full bg-violet-500/10 h-full rounded-t" /></div>
            <div className="w-10 border-t-2 border-dashed border-violet-500 h-[70%] flex items-end"><div className="w-full bg-violet-500/10 h-full rounded-t" /></div>
            <div className="w-10 border-t-2 border-dashed border-violet-500 h-[65%] flex items-end"><div className="w-full bg-violet-500/10 h-full rounded-t" /></div>
          </div>

          {/* Features check grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl text-left border-y border-gray-850 py-6 mb-8 w-full">
            <div className="flex items-center space-x-2.5 text-sm text-gray-300">
              <span className="text-success font-bold">✓</span>
              <span>30, 60, and 90-day forecasts</span>
            </div>
            <div className="flex items-center space-x-2.5 text-sm text-gray-300">
              <span className="text-success font-bold">✓</span>
              <span>Confidence interval bands</span>
            </div>
            <div className="flex items-center space-x-2.5 text-sm text-gray-300">
              <span className="text-success font-bold">✓</span>
              <span>Trend analysis (Improving/Declining)</span>
            </div>
            <div className="flex items-center space-x-2.5 text-sm text-gray-300">
              <span className="text-success font-bold">✓</span>
              <span>AI-powered Holt-Winters algorithm</span>
            </div>
            <div className="flex items-center space-x-2.5 text-sm text-gray-300">
              <span className="text-success font-bold">✓</span>
              <span>Redis-cached for instant loads</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 w-full justify-center">
            <Link
              href="/settings/billing"
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 text-sm transition-all shadow-lg shadow-blue-500/20"
            >
              Upgrade to Pro — $19/month
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl border border-gray-700 hover:bg-gray-800 text-text-muted font-semibold px-8 py-3.5 text-sm transition-all"
            >
              Learn more about Pro
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Find peak and trough forecast points
  const getPeakTrough = () => {
    if (forecast.length === 0) return { peak: null, trough: null };
    let peak = forecast[0];
    let trough = forecast[0];
    forecast.forEach((f) => {
      if (f.predicted > peak.predicted) peak = f;
      if (f.predicted < trough.predicted) trough = f;
    });
    return { peak, trough };
  };

  const { peak, trough } = getPeakTrough();

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header and tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Cash Flow Forecast</h1>
          <p className="text-sm text-text-muted mt-1">
            Triple exponential smoothing prediction engine
          </p>
        </div>

        {/* Tab buttons */}
        <div className="flex bg-gray-950 border border-gray-800 p-1 rounded-xl">
          {([30, 60, 90] as const).map((days) => (
            <button
              key={days}
              onClick={() => setHorizon(days)}
              disabled={forecastLoading}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                horizon === days
                  ? "bg-gray-900 text-white border border-gray-800 shadow"
                  : "text-text-muted hover:text-white"
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* Summary Pills */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Expected net pill */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex justify-between items-center shadow">
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase">Expected Net (End of Horizon)</p>
              <div className="mt-1">
                <AmountBadge amount={summary.expected_net} className="text-lg" />
              </div>
            </div>
          </div>

          {/* Trend pill */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex justify-between items-center shadow">
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase">Computed Trend</p>
              <div className="mt-1 flex items-center space-x-1.5">
                {summary.trend === "improving" ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-success" />
                    <span className="text-sm font-semibold capitalize text-success">{summary.trend}</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-4 w-4 text-danger" />
                    <span className="text-sm font-semibold capitalize text-danger">{summary.trend}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Confidence dots */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex justify-between items-center shadow">
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase">Model Confidence</p>
              <div className="mt-2 flex items-center space-x-1">
                {[1, 2, 3].map((dot) => {
                  const isActive =
                    (summary.confidence === "low" && dot === 1) ||
                    (summary.confidence === "medium" && dot <= 2) ||
                    (summary.confidence === "high" && dot <= 3);

                  return (
                    <span
                      key={dot}
                      className={`h-2 w-2 rounded-full ${
                        isActive ? "bg-violet-500" : "bg-gray-800"
                      }`}
                    />
                  );
                })}
                <span className="text-xs font-semibold capitalize text-text-primary ml-2">
                  {summary.confidence}
                </span>
              </div>
            </div>
          </div>

          {/* Cache status pill */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex justify-between items-center shadow">
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase">Response Origin</p>
              <div className="mt-1 flex items-center space-x-1.5 text-sm font-semibold text-white">
                {cacheStatus === "cached" ? (
                  <>
                    <span className="text-amber-400">⚡</span>
                    <span className="text-amber-400">Cached (Redis)</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span className="text-blue-400">Live (Computed)</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-base font-bold text-white mb-6">Forecast Overview</h3>

        {forecastLoading ? (
          <div className="h-80 w-full flex items-center justify-center">
            <LoadingSpinner size="md" />
          </div>
        ) : error ? (
          <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-center">
            <p className="text-sm font-semibold text-danger">{error}</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertTriangle className="h-8 w-8 text-gray-700 mb-2" />
            <p className="text-sm font-semibold text-text-muted">No forecasting logs generated</p>
          </div>
        ) : (
          <div className="h-80 w-full select-none">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="histGradient" x1="0" y1="0" x2="0" y2="1">
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
                              Net Amount: ${data.historicalAmount}
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                
                {/* Historical Area */}
                <Area
                  type="monotone"
                  dataKey="historicalAmount"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#histGradient)"
                />

                {/* Forecast Confidence area */}
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="none"
                  fill="#8B5CF6"
                  fillOpacity={0.08}
                />

                {/* Forecast line */}
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#8B5CF6"
                  strokeWidth={2.5}
                  strokeDasharray="6 3"
                  dot={false}
                />

                {/* Reference lines */}
                <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />
                {forecast.length > 0 && (
                  <ReferenceLine
                    x={forecast[0].date}
                    stroke="#6B7280"
                    strokeDasharray="4 4"
                    label={{ value: "Today", fill: "#9CA3AF", fontSize: 9, position: "top" }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Grid of Table and Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Day-by-Day Forecast table */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-base font-bold text-white mb-6">Day-by-Day Forecast</h3>

          <div className="overflow-y-auto max-h-96 pr-2 border border-gray-800 rounded-lg">
            <table className="min-w-full text-left text-xs divide-y divide-gray-800">
              <thead className="bg-gray-950 text-text-muted uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Predicted Net</th>
                  <th className="px-4 py-3">Lower Bound</th>
                  <th className="px-4 py-3">Upper Bound</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-850">
                {forecast.map((f) => {
                  const isPeak = peak && f.date === peak.date;
                  const isTrough = trough && f.date === trough.date;

                  return (
                    <tr
                      key={f.date}
                      className={`hover:bg-gray-800/20 transition-colors ${
                        isPeak
                          ? "bg-success/5 text-success font-semibold"
                          : isTrough
                          ? "bg-danger/5 text-danger font-semibold"
                          : "text-gray-300"
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(f.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {isPeak && <span className="ml-2 text-[9px] bg-success/20 px-1 py-0.5 rounded text-success uppercase">Peak</span>}
                        {isTrough && <span className="ml-2 text-[9px] bg-danger/20 px-1 py-0.5 rounded text-danger uppercase">Trough</span>}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {f.predicted.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                      </td>
                      <td className="px-4 py-3 font-mono text-text-muted">
                        {f.lower.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                      </td>
                      <td className="px-4 py-3 font-mono text-text-muted">
                        {f.upper.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Insights Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-6">
              <Lightbulb className="h-5 w-5 text-amber-400 shrink-0" />
              <h3 className="text-base font-bold text-white">AI Forecast Insights</h3>
            </div>

            {summary && peak && trough ? (
              <div className="space-y-4 text-xs leading-relaxed text-gray-300">
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-850 space-y-2">
                  <div className="flex items-start space-x-2">
                    <span className="text-primary mt-0.5">•</span>
                    <p>
                      Your highest net balance day is predicted on{" "}
                      <span className="font-bold text-white">
                        {new Date(peak.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>{" "}
                      with an influx of{" "}
                      <span className="text-success font-semibold font-mono">
                        +${peak.predicted.toFixed(0)}
                      </span>.
                    </p>
                  </div>

                  <div className="flex items-start space-x-2">
                    <span className="text-primary mt-0.5">•</span>
                    <p>
                      Your lowest net balance day is predicted on{" "}
                      <span className="font-bold text-white">
                        {new Date(trough.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>{" "}
                      with a deficit of{" "}
                      <span className="text-danger font-semibold font-mono">
                        -${Math.abs(trough.predicted).toFixed(0)}
                      </span>.
                    </p>
                  </div>

                  <div className="flex items-start space-x-2">
                    <span className="text-primary mt-0.5">•</span>
                    <p>
                      Expected net change over the next {horizon} days is{" "}
                      <span className={`font-semibold font-mono ${summary.expected_net >= 0 ? "text-success" : "text-danger"}`}>
                        {summary.expected_net >= 0 ? "+" : "-"}
                        ${Math.abs(summary.expected_net).toFixed(0)}
                      </span>.
                    </p>
                  </div>

                  <div className="flex items-start space-x-2">
                    <span className="text-primary mt-0.5">•</span>
                    <p>
                      The computed cash flow trend is{" "}
                      <span className={`font-bold capitalize ${summary.trend === "improving" ? "text-success" : "text-danger"}`}>
                        {summary.trend}
                      </span>{" "}
                      based on historical analysis.
                    </p>
                  </div>
                </div>

                <p className="text-[10px] text-text-muted leading-relaxed italic">
                  * Predictions generated using Holt-Winters seasonal algorithms trained on the last 90 days of transactions. Model confidence is rated {summary.confidence}.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10">
                <Info className="h-6 w-6 text-gray-700 mb-2" />
                <p className="text-xs text-text-muted">No insights generated</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
