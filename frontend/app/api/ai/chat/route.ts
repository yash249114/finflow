import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

// System prompt to instruct LLMs to generate structured schemas for workspaces when appropriate.
const SYSTEM_PROMPT = `You are the FinFlow AI CFO and Financial Reasoning Engine. 
You provide intelligent financial runway analysis, transaction diagnostics, and forecasts.

CRITICAL: When requested to show forecasts, simulations, charts, or anomaly scans, you MUST output a structured JSON block inside a single \`\`\`json ... \`\`\` code fence. This block will render dynamically as an interactive Claude-like Artifact workspace.

The JSON schema must follow one of these structures:

1. For Runway Forecast charts:
{
  "type": "forecast_chart",
  "title": "Runway Cash Flow Projection",
  "data": [
    { "date": "Jan", "actual": 45000, "predicted": 45000, "lower": 45000, "upper": 45000 },
    { "date": "Feb", "actual": 42000, "predicted": 42000, "lower": 40000, "upper": 44000 },
    { "date": "Mar", "actual": null, "predicted": 39000, "lower": 35000, "upper": 42000 }
  ]
}

2. For Variable Scenarios & Financial Simulations:
{
  "type": "financial_simulation",
  "title": "Runway Sensitivity Optimizer",
  "variables": [
    { "name": "Monthly Burn Rate", "key": "burn", "value": 12000, "min": 5000, "max": 30000, "unit": "$" },
    { "name": "Monthly Sales Growth", "key": "growth", "value": 8, "min": -10, "max": 40, "unit": "%" }
  ],
  "starting_cash": 85000
}

3. For Anomaly audits:
{
  "type": "anomaly_inspection",
  "title": "Dormant SaaS & Cost Anomalies Audit",
  "anomalies": [
    { "date": "2026-05-24", "description": "AWS Cloud-scaling Capacity Overrun", "amount": -1850, "category": "Infrastructure", "severity": "high", "impact": "Spiked 240% over average" },
    { "date": "2026-05-20", "description": "Duplicate Microsoft Teams License", "amount": -120, "category": "Software", "severity": "medium", "impact": "Slack Pro already active" }
  ]
}

Ensure your normal response answers the user's questions clearly, and place the JSON block at the end of the text. Do not generate raw React components.`;

export async function POST(req: NextRequest) {
  try {
    const { message, history, userId, plan } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // 1. Quota Checking using Upstash Redis if configured
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const today = new Date().toISOString().split("T")[0];

    if (plan === "free" && redisUrl && redisToken && userId) {
      try {
        const countKey = `quota:user:${userId.slice(0, 8)}:date:${today}`;
        const checkUrl = `${redisUrl.replace(/\/+$/, '')}/get/${encodeURIComponent(countKey)}`;
        const authHeader = `Bearer ${redisToken}`;
        const checkRes = await fetch(checkUrl, {
          headers: { Authorization: authHeader },
        });

        if (checkRes.ok) {
          const val = await checkRes.json();
          const count = val.result ? parseInt(val.result, 10) : 0;
          if (count >= 10) {
            return NextResponse.json({
              text: "You have reached your Free Plan daily limit of 10 prompts. Upgrade to Pro for infinite queries.",
              limitReached: true,
            });
          }

          const incrUrl = `${redisUrl.replace(/\/+$/, '')}/incr/${encodeURIComponent(countKey)}`;
          const ttlUrl = `${redisUrl.replace(/\/+$/, '')}/expire/${encodeURIComponent(countKey)}/86400`;
          await Promise.all([
            fetch(incrUrl, { headers: { Authorization: authHeader } }),
            fetch(ttlUrl, { headers: { Authorization: authHeader } }),
          ]);
        }
      } catch (redisErr) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Upstash Redis quota check failed (non-fatal):", redisErr);
        }
      }
    }

    // 2. Load API keys & determine model routing
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    let textResponse = "";

    // 3. Fallback to mock simulation mode if no API keys are loaded
    if (!geminiKey && !openaiKey && !anthropicKey) {
      
      const q = message.toLowerCase();
      if (q.includes("forecast") || q.includes("runway") || q.includes("prediction")) {
        textResponse = `Based on your recent ledger history, here is your runway forecast model. I have computed a standard sequence forecast model across your net cash flow. You can inspect the dynamic chart details in the generated workspace panel on the right.

\`\`\`json
{
  "type": "forecast_chart",
  "title": "90-Day Cash Runway Projection",
  "data": [
    { "date": "Apr 2026", "actual": 68000, "predicted": 68000, "lower": 68000, "upper": 68000 },
    { "date": "May 2026 (Now)", "actual": 55430, "predicted": 55430, "lower": 55430, "upper": 55430 },
    { "date": "Jun 2026", "actual": null, "predicted": 48200, "lower": 44000, "upper": 52000 },
    { "date": "Jul 2026", "actual": null, "predicted": 42100, "lower": 36000, "upper": 48000 },
    { "date": "Aug 2026", "actual": null, "predicted": 35900, "lower": 28000, "upper": 43800 }
  ]
}
\`\`\``;
      } else if (q.includes("simulate") || q.includes("burn") || q.includes("variable") || q.includes("adjust")) {
        textResponse = `Here is your variable cash runway sensitivity simulation model. You can modify variables like monthly burn rate and sales growth directly using the slider inputs in the right panel to test optimization scenarios.

\`\`\`json
{
  "type": "financial_simulation",
  "title": "Interactive Runway Sensitivity Simulator",
  "variables": [
    { "name": "Fixed Monthly Burn Rate", "key": "burn", "value": 11500, "min": 4000, "max": 25000, "unit": "$" },
    { "name": "Monthly Sales Growth", "key": "growth", "value": 12, "min": -15, "max": 50, "unit": "%" },
    { "name": "Ad Spend Budget", "key": "adspend", "value": 2500, "min": 0, "max": 10000, "unit": "$" }
  ],
  "starting_cash": 55430
}
\`\`\``;
      } else if (q.includes("anomaly") || q.includes("waste") || q.includes("aws") || q.includes("teams")) {
        textResponse = `I have audited your transaction statement history and found several cost anomalies and duplicate subscriptions. Consolidating these will help stretch your monthly burn. Review details in the audit panel on the right.

\`\`\`json
{
  "type": "anomaly_inspection",
  "title": "FinFlow Expense Leakage Audit",
  "anomalies": [
    { "date": "2026-05-24", "description": "Supabase DB Auto-scaling spike", "amount": -1850, "category": "Infrastructure", "severity": "high", "impact": "240% higher than average $540 base" },
    { "date": "2026-05-21", "description": "Notion Enterprise (Inactive users)", "amount": -220, "category": "Software", "severity": "medium", "impact": "11 out of 15 members inactive last 30 days" },
    { "date": "2026-05-18", "description": "Double Billing - Slack Technologies", "amount": -180, "category": "Software", "severity": "medium", "impact": "Linked to two separate company cards" }
  ]
}
\`\`\``;
      } else {
        textResponse = `I am running in simulated sandbox mode. Here is a baseline projection for your business finances. If you want me to analyze anomalies or build a forecast, type 'show forecast' or 'run runway simulation'. Let me know how I can assist you with your SMB ledger analytics.`;
      }

      return NextResponse.json({ text: textResponse });
    }

    // 4. Implement Provider Routing and Failover Engine
    let completed = false;

    // Route 1: Anthropic (Claude 3.5 Sonnet) - Gated for Max / fallback for Pro
    if (plan === "max" && anthropicKey && !completed) {
      try {
        const messagesInput = history.map((h: ChatMessage) => ({
          role: h.sender === "user" ? "user" : "assistant",
          content: h.text,
        }));
        messagesInput.push({ role: "user", content: message });

        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 2000,
            system: SYSTEM_PROMPT,
            messages: messagesInput,
          }),
        });

        if (anthropicRes.ok) {
          const resJson = await anthropicRes.json();
          textResponse = resJson.content[0].text;
          completed = true;
        } else {
          console.warn("[AI API Route] Anthropic call failed, attempting fallback...");
        }
      } catch (err) {
        console.warn("[AI API Route] Anthropic call encountered error, attempting fallback...", err);
      }
    }

    // Route 2: OpenAI (GPT-4o or GPT-4o-mini) - Gated for Pro/Max
    if ((plan === "pro" || plan === "max") && openaiKey && !completed) {
      try {
        const messagesInput = [
          { role: "system", content: SYSTEM_PROMPT },
          ...history.map((h: ChatMessage) => ({
            role: h.sender === "user" ? "user" : "assistant",
            content: h.text,
          })),
          { role: "user", content: message },
        ];

        const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: plan === "max" ? "gpt-4o" : "gpt-4o-mini",
            messages: messagesInput,
            max_tokens: 1500,
            temperature: 0.2,
          }),
        });

        if (openAiRes.ok) {
          const resJson = await openAiRes.json();
          textResponse = resJson.choices[0].message.content;
          completed = true;
        } else {
          console.warn("[AI API Route] OpenAI call failed, attempting fallback...");
        }
      } catch (err) {
        console.warn("[AI API Route] OpenAI call encountered error, attempting fallback...", err);
      }
    }

    // Route 3: Gemini Flash (via Google Generative Language REST Endpoint) - Pro/Max only
    if (geminiKey && !completed && (plan === "pro" || plan === "max")) {
      try {
        
        // Format chat history for Gemini's contents schema
        const contentsInput = [];
        
        // Add history
        history.forEach((h: ChatMessage) => {
          contentsInput.push({
            role: h.sender === "user" ? "user" : "model",
            parts: [{ text: h.text }]
          });
        });
        
        // Add new message
        contentsInput.push({
          role: "user",
          parts: [{ text: SYSTEM_PROMPT + "\n\nUser Question: " + message }]
        });

        const geminiUrl = new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent');
        geminiUrl.searchParams.set('key', geminiKey);
        const geminiRes = await fetch(geminiUrl.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: contentsInput,
            generationConfig: {
              maxOutputTokens: 1500,
              temperature: 0.2,
            }
          }),
        });

        if (geminiRes.ok) {
          const resJson = await geminiRes.json();
          textResponse = resJson.candidates[0].content.parts[0].text;
          completed = true;
        } else {
          await geminiRes.text();
          console.error("[AI API Route] Gemini call failed (non-fatal):", geminiRes.status);
        }
      } catch {
        console.error("[AI API Route] Gemini call error (non-fatal):");
      }
    }

    if (!completed) {
      return NextResponse.json({ error: "Failed to fetch response from all AI providers" }, { status: 502 });
    }

    return NextResponse.json({ text: textResponse });
  } catch (err: unknown) {
    console.error("AI API handler error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
