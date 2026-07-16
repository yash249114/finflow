"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Sparkles, 
  TrendingUp, 
  Settings2, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Activity
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  LineChart,
  Line
} from "recharts";
import { toast } from "sonner";
import { fadeSlideUp } from "@/lib/motion";

interface ForecastChartData {
  date: string;
  actual: number | null;
  predicted: number;
  lower: number;
  upper: number;
}

interface ForecastChartSchema {
  type: "forecast_chart";
  title: string;
  data: ForecastChartData[];
}

interface SimulationVariable {
  name: string;
  key: string;
  value: number;
  min: number;
  max: number;
  unit: string;
}

interface FinancialSimulationSchema {
  type: "financial_simulation";
  title: string;
  variables: SimulationVariable[];
  starting_cash: number;
}

interface AnomalyItem {
  date: string;
  description: string;
  amount: number;
  category: string;
  severity: "high" | "medium" | "low";
  impact: string;
}

interface AnomalyInspectionSchema {
  type: "anomaly_inspection";
  title: string;
  anomalies: AnomalyItem[];
}

type WorkspaceSchema = ForecastChartSchema | FinancialSimulationSchema | AnomalyInspectionSchema;

interface WorkspaceRendererProps {
  schema: string; // The JSON schema block raw string extracted from LLM output
}

export function WorkspaceRenderer({ schema }: WorkspaceRendererProps) {
  const [parsed, setParsed] = useState<WorkspaceSchema | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Simulation variables state (dynamic override)
  const [simValues, setSimValues] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      if (!schema) return;
      const cleanJson = schema.trim().replace(/^```json/, "").replace(/```$/, "").trim();
      const obj = JSON.parse(cleanJson) as WorkspaceSchema;
      setParsed(obj);
      setError(null);

      // Initialize simulator values
      if (obj.type === "financial_simulation" && obj.variables) {
        const init: Record<string, number> = {};
        obj.variables.forEach((v: SimulationVariable) => {
          init[v.key] = v.value;
        });
        setSimValues(init);
      }
    } catch (err: unknown) {
      console.error("Failed to parse workspace JSON:", err);
      setError("Workspace rendering failed: invalid JSON schema payload.");
    }
  }, [schema]);

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-xs text-red-400 font-semibold">{error}</p>
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center text-gray-500 gap-3 border border-white/5 bg-zinc-950/20 rounded-2xl">
        <Activity className="w-8 h-8 text-indigo-500/50 animate-pulse" />
        <p className="text-xs">No active generated AI workspace panel present. Trigger one by asking the copilot for a runway forecast, cash simulation, or cost audit.</p>
      </div>
    );
  }

  // ─── 1. FORECAST CHART COMPONENT ──────────────────────────
  if (parsed.type === "forecast_chart") {
    return (
      <motion.div
        variants={fadeSlideUp}
        initial="hidden"
        animate="visible"
        className="glass-card-elevated border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6"
      >
        <div className="flex justify-between items-center">
          <div>
            <span className="rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Prediction Model
            </span>
            <h3 className="text-lg font-bold text-white mt-1.5">{parsed.title}</h3>
          </div>
          <TrendingUp className="w-5 h-5 text-indigo-400" />
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={parsed.data} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818CF8" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#818CF8" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorBounds" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c084fc" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#c084fc" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
              <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "rgba(10,10,14,0.9)", 
                  borderColor: "rgba(255,255,255,0.08)", 
                  borderRadius: "12px" 
                }} 
              />
              {/* Bounds Area (Confidence Interval) */}
              <Area type="monotone" dataKey="upper" stroke="none" fill="url(#colorBounds)" name="Upper Bound" />
              <Area type="monotone" dataKey="lower" stroke="none" fill="url(#colorBounds)" name="Lower Bound" />
              {/* Actual Line */}
              <Area type="monotone" dataKey="actual" stroke="#818CF8" strokeWidth={2} fillOpacity={1} fill="url(#colorActual)" name="Actual Cash" />
              {/* Forecasted Line */}
              <Line type="monotone" dataKey="predicted" stroke="#c084fc" strokeWidth={2.5} strokeDasharray="5 5" dot={false} name="Forecasted Cash" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex justify-between items-center text-xs text-gray-400 bg-white/5 border border-white/5 p-3 rounded-xl">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span>Simulated sequence forecast models.</span>
          </div>
          <span className="font-semibold text-white">Confidence Interval: 88%</span>
        </div>
      </motion.div>
    );
  }

  // ─── 2. FINANCIAL SIMULATION (Interactive variables) ──────
  if (parsed.type === "financial_simulation") {
    const handleSliderChange = (key: string, val: number) => {
      setSimValues(prev => ({ ...prev, [key]: val }));
    };

    // Calculate simulated runway length in months
    const burn = simValues["burn"] || 10000;
    const growth = simValues["growth"] || 5;
    const adspend = simValues["adspend"] || 0;
    const startingCash = parsed.starting_cash || 50000;

    // Adjusted burn taking growth and adspend offset
    const adjustedBurn = burn + adspend - (burn * (growth / 100));
    const finalBurn = adjustedBurn > 1000 ? adjustedBurn : 1000;
    const runwayMonths = startingCash / finalBurn;

    // Generate dynamic decay data for the simulation chart
    const simChartData = [];
    let remaining = startingCash;
    for (let m = 0; m <= 6; m++) {
      simChartData.push({
        month: `Month ${m}`,
        cash: Math.round(remaining > 0 ? remaining : 0)
      });
      remaining -= finalBurn;
    }

    return (
      <motion.div
        variants={fadeSlideUp}
        initial="hidden"
        animate="visible"
        className="glass-card-elevated border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6"
      >
        <div className="flex justify-between items-center">
          <div>
            <span className="rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Runway Sensitivity Simulator
            </span>
            <h3 className="text-lg font-bold text-white mt-1.5">{parsed.title}</h3>
          </div>
          <Settings2 className="w-5 h-5 text-violet-400" />
        </div>

        {/* Dynamic Runway Output Badge */}
        <div className="bg-zinc-950/60 border border-white/5 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Simulated Runway Length</span>
            <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400 mt-1">
              {runwayMonths > 36 ? "36+ months" : `${runwayMonths.toFixed(1)} months`}
            </h2>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Effective Monthly Burn</span>
            <p className="text-sm font-semibold text-white mt-1">${Math.round(finalBurn).toLocaleString()}/mo</p>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="space-y-4">
          {parsed.type === "financial_simulation" && parsed.variables.map((v: SimulationVariable) => {
            const currentVal = simValues[v.key] ?? v.value;
            return (
              <div key={v.key} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-gray-400">{v.name}</span>
                  <span className="text-white">
                    {v.unit === "$" ? `$${Math.round(currentVal).toLocaleString()}` : `${currentVal}${v.unit}`}
                  </span>
                </div>
                <input
                  type="range"
                  min={v.min}
                  max={v.max}
                  value={currentVal}
                  onChange={(e) => handleSliderChange(v.key, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-500 focus:outline-none"
                />
              </div>
            );
          })}
        </div>

        {/* Cash Decay Line Chart */}
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={simChartData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.2)" fontSize={9} tickLine={false} />
              <YAxis stroke="rgba(255,255,255,0.2)" fontSize={9} tickLine={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "rgba(10,10,14,0.95)", 
                  borderColor: "rgba(255,255,255,0.05)", 
                  borderRadius: "10px" 
                }} 
              />
              <Line type="monotone" dataKey="cash" stroke="#8b5cf6" strokeWidth={2} dot={true} name="Remaining Cash ($)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    );
  }

  // ─── 3. ANOMALY INSPECTION (Review / Action list) ────────
  if (parsed.type === "anomaly_inspection") {
    return (
      <motion.div
        variants={fadeSlideUp}
        initial="hidden"
        animate="visible"
        className="glass-card-elevated border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6"
      >
        <div className="flex justify-between items-center">
          <div>
            <span className="rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              AI Risk Leakage Audit
            </span>
            <h3 className="text-lg font-bold text-white mt-1.5">{parsed.title}</h3>
          </div>
          <AlertTriangle className="w-5 h-5 text-rose-400" />
        </div>

        <div className="space-y-3.5">
          {parsed.type === "anomaly_inspection" && parsed.anomalies.map((anom: AnomalyItem, i: number) => {
            const isHigh = anom.severity === "high";
            return (
              <div 
                key={i} 
                className="bg-zinc-950/40 border border-white/5 hover:border-white/10 rounded-xl p-4 transition-colors space-y-3"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        isHigh 
                          ? "bg-rose-500/10 border border-rose-500/25 text-rose-400" 
                          : "bg-amber-500/10 border border-amber-500/25 text-amber-400"
                      }`}>
                        {anom.severity} Risk
                      </span>
                      <span className="text-[10px] text-gray-500">{anom.date}</span>
                    </div>
                    <p className="text-xs font-semibold text-white mt-1.5 truncate">{anom.description}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{anom.impact}</p>
                  </div>
                  <span className="text-xs font-bold text-rose-400">
                    -${Math.abs(anom.amount).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.03]">
                  <button 
                    onClick={() => {
                      toast.success(`Flagged ${anom.description} for team audit`);
                    }}
                    className="flex items-center space-x-1 border border-white/5 bg-white/5 hover:bg-white/10 text-white rounded-lg px-2.5 py-1 text-[10px] font-bold transition-[background-color,border-color,box-shadow,color,opacity] cursor-pointer"
                  >
                    <XCircle className="w-3 h-3 text-rose-400" />
                    <span>Flag Issue</span>
                  </button>
                  <button 
                    onClick={() => {
                      toast.success(`Marked ${anom.description} as safe`);
                    }}
                    className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2.5 py-1 text-[10px] font-bold transition-[background-color,border-color,box-shadow,color,opacity] cursor-pointer"
                  >
                    <CheckCircle className="w-3 h-3" />
                    <span>Approve / Safe</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    );
  }

  return null;
}
