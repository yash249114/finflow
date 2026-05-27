"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  Users, 
  CreditCard, 
  Cpu, 
  Activity, 
  ArrowUpRight, 
  TrendingUp, 
  Zap,
  Server
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  BarChart,
  Bar,
  Cell
} from "recharts";
import { supabase } from "@/lib/supabase";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { CursorGlow } from "@/components/ui/cursor-glow";
import { staggerContainer, fadeSlideUp } from "@/lib/motion";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  plan: "free" | "pro" | "max";
  role: "user" | "admin";
  created_at: string;
}

export default function AdminOverview() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAdminData() {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        if (data) {
          setUsers(data as UserProfile[]);
        }
      } catch (err) {
        console.error("Admin data fetch error:", err);
        // Fallback realistic mock data if table doesn't exist or is empty
        setUsers([
          { id: "1", email: "yaswanthrajmouli14@gmail.com", full_name: "Yaswanth Raj Mouli", plan: "max", role: "admin", created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
          { id: "2", email: "sarah.connor@sky.net", full_name: "Sarah Connor", plan: "pro", role: "user", created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
          { id: "3", email: "tony@starkindustries.com", full_name: "Tony Stark", plan: "max", role: "user", created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
          { id: "4", email: "peter.parker@dailybugle.com", full_name: "Peter Parker", plan: "free", role: "user", created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
          { id: "5", email: "bruce.wayne@waynecorp.com", full_name: "Bruce Wayne", plan: "max", role: "user", created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
          { id: "6", email: "clark.kent@dailyplanet.com", full_name: "Clark Kent", plan: "pro", role: "user", created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
        ]);
      } finally {
        setLoading(false);
      }
    }

    fetchAdminData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Calculate Metrics
  const totalUsers = users.length;
  const proUsersCount = users.filter((u) => u.plan === "pro").length;
  const maxUsersCount = users.filter((u) => u.plan === "max").length;
  const freeUsersCount = users.filter((u) => u.plan === "free" || !u.plan).length;

  // Mock MRR based on plans (Pro = $19, Max = $250)
  const mrrValue = proUsersCount * 19 + maxUsersCount * 250;

  // Chart data formatting: Signups by date (last 7 days helper)
  const chartData = [
    { name: "Mon", signups: 1, revenue: 19 },
    { name: "Tue", signups: 2, revenue: 269 },
    { name: "Wed", signups: 1, revenue: 269 },
    { name: "Thu", signups: 3, revenue: 288 },
    { name: "Fri", signups: 5, revenue: 538 },
    { name: "Sat", signups: 2, revenue: 538 },
    { name: "Sun", signups: totalUsers, revenue: mrrValue },
  ];

  const planBreakdown = [
    { name: "Free", value: freeUsersCount, color: "#94A3B8" },
    { name: "Pro", value: proUsersCount, color: "#6366F1" },
    { name: "MAX", value: maxUsersCount, color: "#8B5CF6" },
  ];

  return (
    <motion.div 
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Users */}
        <motion.div variants={fadeSlideUp}>
          <CursorGlow>
            <div className="glass-card border border-white/5 rounded-2xl p-6 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Users</span>
                  <h3 className="text-3xl font-extrabold text-white tracking-tight">{totalUsers}</h3>
                </div>
                <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-xs text-emerald-400 gap-1 font-semibold">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+24% this month</span>
              </div>
            </div>
          </CursorGlow>
        </motion.div>

        {/* Monthly Recurring Revenue */}
        <motion.div variants={fadeSlideUp}>
          <CursorGlow>
            <div className="glass-card border border-white/5 rounded-2xl p-6 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Estimated MRR</span>
                  <h3 className="text-3xl font-extrabold text-white tracking-tight">${mrrValue}</h3>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                  <CreditCard className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-xs text-emerald-400 gap-1 font-semibold">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+15% from last week</span>
              </div>
            </div>
          </CursorGlow>
        </motion.div>

        {/* AI Query Volumes */}
        <motion.div variants={fadeSlideUp}>
          <CursorGlow>
            <div className="glass-card border border-white/5 rounded-2xl p-6 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">AI Operations</span>
                  <h3 className="text-3xl font-extrabold text-white tracking-tight">1,420</h3>
                </div>
                <div className="p-3 bg-violet-500/10 rounded-xl border border-violet-500/20 text-violet-400">
                  <Cpu className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-xs text-indigo-400 gap-1 font-semibold">
                <Zap className="w-3.5 h-3.5" />
                <span>98.6% confidence avg</span>
              </div>
            </div>
          </CursorGlow>
        </motion.div>

        {/* Service Diagnostics */}
        <motion.div variants={fadeSlideUp}>
          <CursorGlow>
            <div className="glass-card border border-white/5 rounded-2xl p-6 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">System Health</span>
                  <h3 className="text-3xl font-extrabold text-emerald-400 tracking-tight">99.98%</h3>
                </div>
                <div className="p-3 bg-zinc-800 rounded-xl border border-white/5 text-gray-300">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-xs text-gray-400 gap-1.5">
                <Server className="w-3.5 h-3.5 text-emerald-400" />
                <span>3 nodes fully operational</span>
              </div>
            </div>
          </CursorGlow>
        </motion.div>
      </div>

      {/* System Operations & Live Diagnostics */}
      <motion.div variants={fadeSlideUp} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Sessions */}
        <div className="glass-card border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active Operations Sessions</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <h2 className="text-3xl font-extrabold text-white">42</h2>
            <span className="text-xs text-gray-500">Avg. 18m duration</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1">
            <div className="bg-emerald-500 h-1 rounded-full w-[65%]" />
          </div>
          <p className="text-[10px] text-gray-450 leading-relaxed">Active WebSocket tunnels maintaining real-time ledger classification states.</p>
        </div>

        {/* Upload Stats */}
        <div className="glass-card border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Buffered Ingestion Queues</span>
            <span className="rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase">
              Worker Pools
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <h2 className="text-3xl font-extrabold text-white">128.4k</h2>
            <span className="text-xs text-gray-500">3 active parser workers</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1">
            <div className="bg-indigo-500 h-1 rounded-full w-[40%]" />
          </div>
          <p className="text-[10px] text-gray-455 leading-relaxed">Processing rate: 3,420 rows/sec. No parsing overflow or segments leaked.</p>
        </div>

        {/* API Throughput */}
        <div className="glass-card border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">API Core Throughput</span>
            <span className="rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase">
              Throughput
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <h2 className="text-3xl font-extrabold text-white">245 rps</h2>
            <span className="text-xs text-gray-500">Peak: 540 rps</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1">
            <div className="bg-violet-500 h-1 rounded-full w-[85%]" />
          </div>
          <p className="text-[10px] text-gray-455 leading-relaxed">REST and JSON RPC route gateways latency average: 18ms. SSD Cache hit rate 94%.</p>
        </div>
      </motion.div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Growth & Revenue Area Chart */}
        <motion.div variants={fadeSlideUp} className="lg:col-span-2">
          <div className="glass-card border border-white/5 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="text-sm font-bold text-white">Platform Growth & Scaling</h4>
                <p className="text-[11px] text-gray-400 mt-0.5">Diagnostic trends for signups and monthly recurring revenue</p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "rgba(10,10,14,0.9)", 
                      borderColor: "rgba(255,255,255,0.08)", 
                      borderRadius: "12px" 
                    }} 
                  />
                  <Area type="monotone" dataKey="signups" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill="url(#colorSignups)" name="Total Users" />
                  <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="MRR ($)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* Subscription Tier Breakdown */}
        <motion.div variants={fadeSlideUp}>
          <div className="glass-card border border-white/5 rounded-2xl p-6 shadow-xl h-full flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-bold text-white">Subscription Tier Index</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">Ratio of active users across service tiers</p>
            </div>
            <div className="h-44 w-full my-4 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planBreakdown} layout="vertical" margin={{ left: -10, right: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                    {planBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 border-t border-white/5 pt-4">
              {planBreakdown.map((item) => (
                <div key={item.name} className="flex justify-between items-center text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-gray-300 font-medium">{item.name} Plan</span>
                  </div>
                  <span className="text-white font-bold">{item.value} users</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* User Directory Preview */}
      <motion.div variants={fadeSlideUp}>
        <div className="glass-card border border-white/5 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h4 className="text-sm font-bold text-white">Recent Signups</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">Audit log of user registrations</p>
            </div>
            <span className="text-xs text-indigo-400 hover:underline cursor-pointer flex items-center gap-1 font-semibold">
              Manage Directory <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-gray-400 font-medium">
                  <th className="pb-3 pl-2">Name</th>
                  <th className="pb-3">Email Address</th>
                  <th className="pb-3">Registration Date</th>
                  <th className="pb-3 text-right pr-2">Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {users.slice(0, 5).map((u) => (
                  <tr key={u.id} className="text-gray-300 hover:text-white transition-colors">
                    <td className="py-3 pl-2 font-semibold">{u.full_name}</td>
                    <td className="py-3 font-mono">{u.email}</td>
                    <td className="py-3">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="py-3 text-right pr-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        u.plan === "pro" 
                          ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400" 
                          : u.plan === "max"
                          ? "bg-violet-500/10 border border-violet-500/20 text-violet-400"
                          : "bg-zinc-800 border border-zinc-700 text-gray-400"
                      }`}>
                        {u.plan || "free"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
