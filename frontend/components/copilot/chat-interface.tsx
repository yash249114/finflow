"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, 
  Sparkles, 
  ArrowUpRight, 
  AlertTriangle, 
  Crown, 
  ThumbsUp, 
  ThumbsDown,
  User
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import Logo from "@/components/ui/logo";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: Date;
  confidence?: number; // 0 - 100
  planUpgradeAction?: boolean;
  lowConfidenceAction?: boolean;
}

const SUGGESTIONS = [
  "Why did my cash flow drop this month?",
  "What is my projected runway?",
  "Which subscriptions are wasteful?",
  "Show spending anomalies",
];

const PRESET_ANSWERS: Record<string, { text: string; confidence: number; lowConfidence?: boolean }> = {
  "Why did my cash flow drop this month?": {
    text: "According to your recent transaction log, cash flow fell by 14% primarily due to a 34% spike in infrastructure costs (AWS/Vercel) combined with delayed payments from three major client invoices. I recommend checking your invoice collection flow.",
    confidence: 94
  },
  "What is my projected runway?": {
    text: "At your current average monthly burn rate of $12,450, your projected cash runway is approximately 8.4 months. Upgrading your cash balances or lowering cloud costs would extend this to 10+ months.",
    confidence: 88
  },
  "Which subscriptions are wasteful?": {
    text: "I detected two duplicate SaaS subscriptions: You are paying for both Slack Pro and Microsoft Teams simultaneously. In addition, there is a dormant Notion account that has seen 0 logins in the past 45 days. Consolidating these could save you $320/month.",
    confidence: 92
  },
  "Show spending anomalies": {
    text: "Anomaly Detected: On May 24th, there was a charge of $1,850 from 'Supabase, Inc.' which is 240% higher than your average monthly database cost of $540. It appears to be an auto-scaling capacity charge.",
    confidence: 96
  }
};

export default function ChatInterface() {
  const { user } = useAuth();
  const plan = user?.plan || "free";
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text: `Hello ${user?.full_name || 'there'}! I am your FinFlow AI Financial Copilot. Ask me anything about your runway, burn rates, transactions, or financial health.`,
      timestamp: new Date(),
      confidence: 100
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messageCount, setMessageCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const streamBotResponse = (question: string) => {
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);

      // Check presets first
      const matched = Object.keys(PRESET_ANSWERS).find(k => k.toLowerCase().includes(question.toLowerCase()) || question.toLowerCase().includes(k.toLowerCase()));
      
      let replyText = "";
      let confidence = 85;
      let isLowConfidence = false;

      if (matched) {
        replyText = PRESET_ANSWERS[matched].text;
        confidence = PRESET_ANSWERS[matched].confidence;
      } else {
        // Evaluate simulated query
        if (question.toLowerCase().includes("connect") || question.toLowerCase().includes("bank") || question.toLowerCase().includes("stripe")) {
          replyText = "I see you're asking about direct external accounting integrations. Currently, my models are running in read-only sandbox mode. For real-time API syncing, you need human verification.";
          confidence = 54;
          isLowConfidence = true;
        } else {
          replyText = `Based on your FinFlow profile, your average transaction value is $240 and the net flow is positive. Could you specify what exact details about '${question}' you would like me to compile?`;
          confidence = 74;
        }
      }

      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: "ai",
          text: replyText,
          timestamp: new Date(),
          confidence,
          lowConfidenceAction: isLowConfidence
        }
      ]);
    }, 1500);
  };

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;

    // Check tier limits for FREE users
    if (plan === "free" && messageCount >= 3) {
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: "user",
          text,
          timestamp: new Date()
        },
        {
          id: Math.random().toString(),
          sender: "ai",
          text: "You have reached your Free Plan limit of 3 Copilot messages. Upgrade to Pro for unlimited AI-native financial planning and forecasting.",
          timestamp: new Date(),
          planUpgradeAction: true
        }
      ]);
      setInputValue("");
      return;
    }

    // Add user message
    const newMsg: Message = {
      id: Math.random().toString(),
      sender: "user",
      text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMsg]);
    setInputValue("");
    setMessageCount(c => c + 1);

    // Stream AI response
    streamBotResponse(text);
  };

  const handleEscalate = () => {
    toast.success("Request sent! An SLA analyst will review this financial query and contact you within 6 hours.");
    setMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: "ai",
        text: "Human Escalation Approved. A Support Specialist will review this thread and message your profile email.",
        timestamp: new Date(),
        confidence: 100
      }
    ]);
  };

  return (
    <div className="glass-panel border border-white/5 rounded-2xl h-[70vh] flex flex-col justify-between overflow-hidden shadow-2xl relative">
      {/* Copilot Tier Header */}
      <div className="bg-zinc-950/80 border-b border-white/5 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <Logo size={18} glow />
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              FinFlow Intelligence 
              {plan === "max" ? (
                <span className="rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase flex items-center gap-0.5">
                  <Crown className="w-2.5 h-2.5" /> Max Mode
                </span>
              ) : plan === "pro" ? (
                <span className="rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                  Pro Mode
                </span>
              ) : (
                <span className="rounded bg-zinc-800 text-gray-400 border border-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                  Free Version
                </span>
              )}
            </h4>
            <p className="text-[10px] text-gray-500">
              {plan === "free" ? "Limited to 3 queries" : "High confidence financial reasoning engine"}
            </p>
          </div>
        </div>

        {plan === "free" && (
          <a
            href="/settings/billing"
            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 bg-indigo-500/10 rounded-lg px-2.5 py-1 transition-colors uppercase tracking-wider"
          >
            Upgrade to Pro
          </a>
        )}
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-950/10">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isBot = msg.sender === "ai";
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-3 max-w-[85%] ${isBot ? "" : "ml-auto flex-row-reverse"}`}
              >
                {/* Avatar Icon */}
                <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center border text-xs font-bold ${
                  isBot 
                    ? "bg-zinc-900 border-indigo-500/30 text-indigo-400" 
                    : "bg-gradient-to-br from-indigo-600 to-violet-600 border-indigo-500 text-white"
                }`}>
                  {isBot ? <Sparkles className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                </div>

                {/* Bubble Body */}
                <div className="space-y-1">
                  <div className={`p-4 rounded-2xl text-xs leading-relaxed ${
                    isBot 
                      ? "glass-card border border-white/5 text-gray-200" 
                      : "bg-indigo-600/90 text-white border border-indigo-500/40 rounded-tr-none"
                  }`}>
                    {msg.text}

                    {/* Plan upgrade call-to-action button */}
                    {msg.planUpgradeAction && (
                      <div className="mt-3">
                        <a
                          href="/settings/billing"
                          className="inline-flex items-center space-x-1 bg-white text-indigo-950 rounded-lg px-3 py-1.5 font-bold hover:bg-gray-100 transition-colors uppercase tracking-wider"
                        >
                          <span>Go Pro</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* Low Confidence Escalation Button */}
                    {msg.lowConfidenceAction && (
                      <div className="mt-3 border-t border-white/5 pt-3 space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>AI confidence is low due to sandbox limits.</span>
                        </div>
                        <button
                          onClick={handleEscalate}
                          className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 rounded-lg px-3 py-1.5 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          Escalate to Support Analyst
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Confidence tag for bot responses */}
                  {isBot && msg.confidence !== undefined && (
                    <div className="flex items-center space-x-2 text-[10px] text-gray-500 pl-1">
                      <span className={`font-semibold ${msg.confidence < 60 ? 'text-amber-500' : 'text-indigo-400'}`}>
                        Confidence: {msg.confidence}%
                      </span>
                      <span>•</span>
                      <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>•</span>
                      <button className="hover:text-white" title="Helpful"><ThumbsUp className="w-3 h-3" /></button>
                      <button className="hover:text-white" title="Unhelpful"><ThumbsDown className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-zinc-900 border border-indigo-500/30 text-indigo-400 flex items-center justify-center text-xs">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div className="glass-card border border-white/5 p-4 rounded-2xl flex items-center space-x-1.5">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      {messages.length === 1 && !isTyping && (
        <div className="px-6 py-2 border-t border-white/5 flex flex-wrap gap-2 bg-zinc-950/20">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSendMessage(s)}
              className="bg-white/5 border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/5 text-gray-300 hover:text-white rounded-lg px-3 py-1.5 text-xs transition-colors flex items-center gap-1 cursor-pointer font-medium"
            >
              <span>{s}</span>
              <ArrowUpRight className="w-3 h-3 text-gray-500" />
            </button>
          ))}
        </div>
      )}

      {/* Message Input Controls */}
      <div className="p-4 border-t border-white/5 bg-zinc-950/60 flex gap-2 items-center">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage(inputValue)}
          placeholder={
            plan === "free" && messageCount >= 3 
              ? "Free plan limit reached..." 
              : "Ask anything about your platform finances..."
          }
          disabled={plan === "free" && messageCount >= 3}
          className="flex-1 input-premium rounded-xl px-4 py-3 text-xs focus:outline-none placeholder-gray-500"
        />
        <button
          onClick={() => handleSendMessage(inputValue)}
          disabled={!inputValue.trim() || (plan === "free" && messageCount >= 3)}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white rounded-xl p-3 transition-colors shrink-0 cursor-pointer shadow-lg shadow-indigo-500/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
