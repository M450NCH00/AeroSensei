"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Mail, AlertTriangle, ShieldAlert, RefreshCw, Loader2, Building2, Clock, RotateCcw,
  Search, ExternalLink,
} from "lucide-react";
import axiosInstance from "@/app/api/axiosInstance";
import { useAuth } from "@/app/context/AuthContext";
import AuthGuard from "@/app/components/AuthGuard";

interface MinistryDraft {
  ministry: string;
  recipient: string;
  subject: string;
  body: string;
}

interface Causes {
  query: string;
  reasons: string;
  sources: { title: string; url: string }[];
  researched_at: string;
  cached?: boolean;
}

interface Broadcast {
  id: string;
  level: "WARNING" | "BREACHED";
  timestamp: string;
  delivery: string;
  stats: {
    total_sensors: number | null;
    warning_sensors: number | null;
    breached_sensors: number | null;
    warning_pct: number | null;
    breached_pct: number | null;
  };
  causes?: Causes | null;
  drafts: MinistryDraft[];
}

const AI_AGENT_URL = process.env.NEXT_PUBLIC_AI_AGENT_URL || "http://localhost:5001";

// Minimal, safe Markdown rendering for the LLM's causes text: **bold**, bullet
// lists (- / *), and paragraphs. No HTML injection.
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    return m ? <strong key={i}>{m[1]}</strong> : <span key={i}>{part}</span>;
  });
}

function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      const items = bullets;
      blocks.push(
        <ul key={blocks.length} className="list-disc pl-5 space-y-1">
          {items.map((b, i) => (
            <li key={i}>{renderInline(b)}</li>
          ))}
        </ul>
      );
      bullets = [];
    }
  };
  text.split("\n").forEach((raw) => {
    const line = raw.trim();
    if (!line) return flush();
    const bm = line.match(/^[-*]\s+(.*)$/);
    if (bm) {
      bullets.push(bm[1]);
      return;
    }
    flush();
    blocks.push(<p key={blocks.length}>{renderInline(line)}</p>);
  });
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

const fmtTime = (v: string) =>
  v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function MinistryAlertsPage() {
  const { hasRole } = useAuth();
  const isGov = hasRole("GOVERNMENT") || hasRole("ADMIN");

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [demoMode, setDemoMode] = useState<string>("normal");
  const [demoBusy, setDemoBusy] = useState<string | null>(null);
  const [demoMsg, setDemoMsg] = useState<string | null>(null);

  const setEmissionMode = useCallback(async (mode: "warning" | "breached" | "normal") => {
    setDemoBusy(mode);
    setDemoMsg(null);
    try {
      await axiosInstance.post("/demo/emission-mode", { mode });
      setDemoMode(mode);
      setDemoMsg(
        mode === "normal"
          ? "Reset — sensors back to normal levels."
          : `All sensors now emitting ${mode.toUpperCase()} values. Ministry directives drafted below; the map updates within ~1 minute.`
      );
      // A forced WARNING/BREACHED emails the ministries immediately — refresh the
      // drafts so they show without waiting for the 30s poll.
      if (mode !== "normal") load();
    } catch {
      setDemoMsg("Failed to set emission mode (are you signed in as a government user?).");
    } finally {
      setDemoBusy(null);
    }
  }, []);

  useEffect(() => {
    axiosInstance
      .get<{ mode: string }>("/demo/emission-mode")
      .then((r) => setDemoMode(r.data?.mode || "normal"))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${AI_AGENT_URL}/ministry-alerts`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setBroadcasts(data.broadcasts || []);
    } catch {
      setError("Could not reach the AI agent. Is the service running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000); // refresh every 30s
    return () => clearInterval(t);
  }, [load]);

  return (
    <AuthGuard>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="w-6 h-6 text-blue-600" />
              Ministry Escalation Alerts
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              When ≥50% of Hanoi&apos;s live sensors are unhealthy, tailored directives are drafted
              for each ministry. (Demo mode: drafts are shown here instead of being emailed.)
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>

        {isGov && (
          <div className="mb-6 p-4 rounded-xl border bg-gray-50">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="text-sm font-semibold text-gray-800">
                Demo controls — force sensor emission level
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                current: {demoMode}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setEmissionMode("warning")}
                disabled={demoBusy !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {demoBusy === "warning" ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                All sensors → WARNING
              </button>
              <button
                onClick={() => setEmissionMode("breached")}
                disabled={demoBusy !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {demoBusy === "breached" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                All sensors → BREACHED
              </button>
              <button
                onClick={() => setEmissionMode("normal")}
                disabled={demoBusy !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-700 text-sm font-medium disabled:opacity-50"
              >
                {demoBusy === "normal" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Reset to normal
              </button>
            </div>
            {demoMsg && <div className="mt-3 text-sm text-gray-600">{demoMsg}</div>}
          </div>
        )}

        {!isGov && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm">
            These city-wide escalations are intended for government users.
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        {!error && broadcasts.length === 0 && !loading && (
          <div className="p-8 text-center text-gray-500 border border-dashed rounded-xl">
            No escalations yet. When half of Hanoi&apos;s sensors reach warning or breached level,
            the ministry directives will appear here.
          </div>
        )}

        <div className="space-y-8">
          {broadcasts.map((b) => {
            const breached = b.level === "BREACHED";
            return (
              <div key={b.id} className="border rounded-xl overflow-hidden shadow-sm">
                <div
                  className={`p-4 flex flex-wrap items-center gap-4 ${
                    breached ? "bg-red-50" : "bg-amber-50"
                  }`}
                >
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                      breached ? "bg-red-600 text-white" : "bg-amber-500 text-white"
                    }`}
                  >
                    {breached ? <ShieldAlert className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {b.level}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-gray-600">
                    <Clock className="w-4 h-4" /> {fmtTime(b.timestamp)}
                  </span>
                  <span className="text-sm text-gray-700">
                    {b.stats.breached_sensors ?? "—"}/{b.stats.total_sensors ?? "—"} breached
                    {" "}({b.stats.breached_pct ?? "—"}%) · warning-or-worse {b.stats.warning_pct ?? "—"}%
                  </span>
                  <span className="ml-auto text-xs uppercase tracking-wide text-gray-500">
                    {b.delivery === "sent" ? "emailed" : "draft (not sent)"}
                  </span>
                </div>

                {b.causes && (
                  <div className="p-4 border-b bg-blue-50/50">
                    <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-blue-900">
                      <Search className="w-4 h-4" />
                      Possible causes (web research)
                      {b.causes.cached && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase tracking-wide">
                          cached
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-700 mb-2">
                      <Markdown text={b.causes.reasons} />
                    </div>
                    {b.causes.sources.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {b.causes.sources.map((s, i) => (
                          <a
                            key={i}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{s.title || s.url}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="divide-y">
                  {b.drafts.map((d, i) => (
                    <div key={i} className="p-4">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Building2 className="w-4 h-4 text-gray-500" />
                        <span className="font-semibold text-gray-900">{d.ministry}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                          To: {d.recipient}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-gray-800 mb-1">{d.subject}</div>
                      <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans bg-gray-50 rounded-lg p-3">
                        {d.body}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AuthGuard>
  );
}
