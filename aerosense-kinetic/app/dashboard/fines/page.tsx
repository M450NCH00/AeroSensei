"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Gavel, X, Loader2, ShieldAlert, MapPin,
  Building2, CheckCircle2, Ban, Receipt, Sparkles,
} from "lucide-react";
import axiosInstance from "@/app/api/axiosInstance";
import { useAuth } from "@/app/context/AuthContext";
import AuthGuard from "@/app/components/AuthGuard";

interface PmAlert {
  id: number;
  siteId: number | null;
  siteName: string | null;
  companyId: number | null;
  companyName: string | null;
  pmType: string | null;
  measuredValue: number | null;
  thresholdValue: number | null;
  alertLevel: string | null;
  alertDate: string | null;
  triggeredAt: string | null;
  resolvedAt: string | null;
  note: string | null;
  fined: boolean;
}

interface Fine {
  id: number;
  alertId: number | null;
  siteId: number | null;
  siteName: string | null;
  companyId: number | null;
  companyName: string | null;
  amount: number;
  reason: string | null;
  status: string;
  issuedBy: string | null;
  issuedAt: string | null;
}

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const fmtMoney = (v: number) =>
  v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export default function FinesPage() {
  const { hasRole } = useAuth();
  const isGov = hasRole("GOVERNMENT") || hasRole("ADMIN");
  const isCompany = hasRole("COMPANY");

  const [activeTab, setActiveTab] = useState<"breaches" | "fines">("breaches");
  const [alerts, setAlerts] = useState<PmAlert[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Demo: run the daily PM evaluation now and auto-fine breaches.
  const [evaluating, setEvaluating] = useState(false);
  const [evalMsg, setEvalMsg] = useState<string | null>(null);

  // Impose-fine modal
  const [fineTarget, setFineTarget] = useState<PmAlert | null>(null);
  const [fineAmount, setFineAmount] = useState("");
  const [fineReason, setFineReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    // Government sees all alerts/fines; a company sees only its own (scoped server-side).
    const [alertsUrl, finesUrl] = isGov
      ? ["/alerts", "/alerts/fines"]
      : ["/alerts/my", "/alerts/fines/my"];
    try {
      const [a, f] = await Promise.all([
        axiosInstance.get<PmAlert[]>(alertsUrl),
        axiosInstance.get<Fine[]>(finesUrl),
      ]);
      setAlerts(a.data || []);
      setFines(f.data || []);
    } catch (e: any) {
      setError(e.response?.data?.message ?? "Failed to load alerts.");
    } finally {
      setLoading(false);
    }
  };

  // Demo: evaluate today's PM readings now (writes alerts for today) and auto-fine
  // every BREACHED, un-fined alert — no waiting for the midnight cron.
  const runEvaluateNow = async () => {
    setEvaluating(true);
    setEvalMsg(null);
    setError(null);
    try {
      const res = await axiosInstance.post<{ alertsWritten: number; finesIssued: number }>("/alerts/evaluate-now");
      const { alertsWritten, finesIssued } = res.data;
      setEvalMsg(`Evaluation complete — ${alertsWritten} alert(s) recorded for today, ${finesIssued} fine(s) issued.`);
      await fetchAll();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg ?? "Failed to run the evaluation.");
    } finally {
      setEvaluating(false);
    }
  };

  useEffect(() => {
    if (isGov || isCompany) fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGov, isCompany]);

  const openFineModal = (alert: PmAlert) => {
    setFineTarget(alert);
    // Suggest a default penalty scaled by how far over the threshold it ran.
    const over = alert.measuredValue != null && alert.thresholdValue != null
      ? Math.max(0, Number(alert.measuredValue) - Number(alert.thresholdValue))
      : 0;
    setFineAmount(over > 0 ? String(Math.round(over) * 100) : "1000");
    setFineReason(
      `PM breach at ${alert.siteName ?? "site"}: ` +
      `${alert.pmType?.toUpperCase() ?? "PM"} measured ${alert.measuredValue ?? "?"} µg/m³ ` +
      `against a ${alert.thresholdValue ?? "?"} µg/m³ threshold (${alert.alertLevel ?? "warning"}).`
    );
    setModalError(null);
  };

  const submitFine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fineTarget) return;
    const amount = parseFloat(fineAmount);
    if (isNaN(amount) || amount < 0) {
      setModalError("Enter a valid fine amount (0 or greater).");
      return;
    }
    setSubmitting(true);
    setModalError(null);
    try {
      await axiosInstance.post(`/alerts/${fineTarget.id}/fine`, { amount, reason: fineReason });
      setFineTarget(null);
      await fetchAll();
      setActiveTab("fines");
    } catch (err: any) {
      setModalError(err.response?.data?.message ?? "Failed to impose fine.");
    } finally {
      setSubmitting(false);
    }
  };

  const breachCount = useMemo(() => alerts.filter((a) => !a.fined).length, [alerts]);

  if (!isGov && !isCompany) {
    return (
      <AuthGuard>
        <div className="p-8 min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <div className="bg-white border border-gray-200/60 rounded-[2rem] shadow-sm p-10 text-center max-w-md">
            <ShieldAlert size={32} className="text-[#F28C28] mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-600">Access restricted</p>
            <p className="text-xs text-gray-400 font-semibold mt-1">
              This page is available to regulators and registered companies.
            </p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  const levelStyle = (level: string | null) =>
    (level ?? "").toUpperCase() === "BREACHED"
      ? "bg-red-50 text-red-600 border-red-100"
      : "bg-amber-50 text-amber-600 border-amber-100";

  const statusStyle = (status: string) => {
    switch (status) {
      case "paid": return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case "cancelled": return "bg-gray-100 text-gray-500 border-gray-200";
      default: return "bg-[#005A8C]/8 text-[#005A8C] border-[#005A8C]/15";
    }
  };

  return (
    <AuthGuard>
      <div className="p-8 min-h-screen bg-[#F8FAFC] flex flex-col gap-6 select-none">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#005A8C] tracking-tight flex items-center gap-2">
              <Gavel size={22} className="text-[#009B9E]" />
              {isGov ? "Enforcement & Fines" : "My Alerts & Fines"}
            </h1>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
              {isGov ? "PM Breach Alerts & Penalties" : "Your Sites' PM Breaches & Penalties"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isGov && (
              <button
                onClick={runEvaluateNow}
                disabled={evaluating}
                title="Demo: evaluate today's PM readings now and auto-issue fines for breaches"
                className="flex items-center gap-2 px-4 py-2.5 bg-[#009B9E] text-white text-sm font-bold rounded-xl hover:bg-[#007d80] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {evaluating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {evaluating ? "Evaluating…" : "Evaluate today (demo)"}
              </button>
            )}
            {loading && <Loader2 size={18} className="text-gray-300 animate-spin" />}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm font-bold text-red-700 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="cursor-pointer"><X size={16} /></button>
          </div>
        )}

        {evalMsg && (
          <div className="p-4 bg-[#009B9E]/5 border border-[#009B9E]/20 rounded-2xl text-sm font-bold text-[#007d80] flex justify-between items-center">
            <span className="flex items-center gap-2"><Sparkles size={15} className="shrink-0" />{evalMsg}</span>
            <button onClick={() => setEvalMsg(null)} className="cursor-pointer"><X size={16} /></button>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: "Open breaches", value: breachCount, icon: AlertTriangle, color: "text-[#F28C28]" },
            { label: "Total alerts", value: alerts.length, icon: ShieldAlert, color: "text-[#005A8C]" },
            { label: "Fines issued", value: fines.length, icon: Receipt, color: "text-[#009B9E]" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white border border-gray-200/60 rounded-2xl p-5 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
                <Icon size={18} className={color} />
              </div>
              <div>
                <p className="text-2xl font-black text-gray-800">{value}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-white border border-gray-200/60 rounded-2xl p-1.5 w-fit shadow-sm">
          {(["breaches", "fines"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === tab ? "bg-[#005A8C] text-white shadow-sm" : "text-gray-500 hover:text-[#005A8C]"
              }`}
            >
              {tab === "breaches" ? "Breach Alerts" : "Issued Fines"}
            </button>
          ))}
        </div>

        {/* ── Breaches Tab ── */}
        {activeTab === "breaches" && (
          loading ? (
            <Skeleton text="Loading breach alerts..." />
          ) : alerts.length === 0 ? (
            <Empty icon={CheckCircle2} title="No PM breaches recorded." subtitle={isGov ? "Alerts appear here when a site's average exceeds its threshold." : "Good news — none of your sites have breached their PM thresholds."} />
          ) : (
            <div className="bg-white border border-gray-200/60 rounded-[2rem] overflow-hidden shadow-sm">
              <div className="px-5 py-3 grid grid-cols-12 gap-2 border-b border-gray-100">
                <span className="col-span-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Site / Company</span>
                <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">PM Type</span>
                <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Measured / Threshold</span>
                <span className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Level</span>
                <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Triggered</span>
                <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">{isGov ? "Action" : "Status"}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {alerts.map((a) => (
                  <div key={a.id} className="px-5 py-4 grid grid-cols-12 gap-2 items-center hover:bg-gray-50/50 transition-colors">
                    <div className="col-span-3 min-w-0">
                      <p className="text-sm font-black text-gray-800 truncate flex items-center gap-1.5">
                        <MapPin size={13} className="text-[#009B9E] shrink-0" />
                        {a.siteName ?? "Unknown site"}
                      </p>
                      <p className="text-[11px] font-semibold text-gray-400 truncate flex items-center gap-1 mt-0.5">
                        <Building2 size={11} className="shrink-0" />
                        {a.companyName ?? "Unassigned company"}
                      </p>
                    </div>
                    <span className="col-span-2 text-sm font-bold text-gray-600 uppercase">{a.pmType ?? "—"}</span>
                    <div className="col-span-2 text-right">
                      <span className="text-sm font-black text-red-600">{a.measuredValue ?? "—"}</span>
                      <span className="text-xs font-semibold text-gray-400"> / {a.thresholdValue ?? "—"}</span>
                      <p className="text-[9px] font-bold text-gray-300 uppercase tracking-wider">µg/m³</p>
                    </div>
                    <div className="col-span-1">
                      <span className={`text-[9px] font-extrabold px-2 py-1 rounded-full border uppercase ${levelStyle(a.alertLevel)}`}>
                        {a.alertLevel ?? "—"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs font-semibold text-gray-500">{fmtDate(a.triggeredAt)}</p>
                      {a.alertDate && (
                        <p className="text-[10px] font-bold text-gray-400">for {a.alertDate}</p>
                      )}
                    </div>
                    <div className="col-span-2 flex justify-end">
                      {a.fined ? (
                        <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={12} /> Fined
                        </span>
                      ) : isGov ? (
                        <button
                          onClick={() => openFineModal(a)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-[#F28C28] text-white text-xs font-bold rounded-xl hover:bg-[#d97818] transition-all shadow-sm cursor-pointer"
                        >
                          <Gavel size={13} /> Impose Fine
                        </button>
                      ) : (
                        <span className="text-[10px] font-extrabold text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
                          No fine
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* ── Fines Tab ── */}
        {activeTab === "fines" && (
          loading ? (
            <Skeleton text="Loading fines..." />
          ) : fines.length === 0 ? (
            <Empty icon={Receipt} title="No fines issued yet." subtitle={isGov ? "Impose a fine from the Breach Alerts tab." : "No fines have been issued against your company."} />
          ) : (
            <div className="bg-white border border-gray-200/60 rounded-[2rem] overflow-hidden shadow-sm">
              <div className="px-5 py-3 grid grid-cols-12 gap-2 border-b border-gray-100">
                <span className="col-span-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Site / Company</span>
                <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Amount</span>
                <span className="col-span-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reason</span>
                <span className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</span>
                <span className="col-span-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Issued</span>
              </div>
              <div className="divide-y divide-gray-50">
                {fines.map((f) => (
                  <div key={f.id} className="px-5 py-4 grid grid-cols-12 gap-2 items-center hover:bg-gray-50/50 transition-colors">
                    <div className="col-span-3 min-w-0">
                      <p className="text-sm font-black text-gray-800 truncate flex items-center gap-1.5">
                        <MapPin size={13} className="text-[#009B9E] shrink-0" />
                        {f.siteName ?? "Unknown site"}
                      </p>
                      <p className="text-[11px] font-semibold text-gray-400 truncate flex items-center gap-1 mt-0.5">
                        <Building2 size={11} className="shrink-0" />
                        {f.companyName ?? "Unassigned company"}
                      </p>
                    </div>
                    <span className="col-span-2 text-sm font-black text-[#005A8C] text-right">{fmtMoney(Number(f.amount))}</span>
                    <span className="col-span-3 text-xs font-semibold text-gray-500 truncate" title={f.reason ?? ""}>{f.reason ?? "—"}</span>
                    <div className="col-span-1">
                      <span className={`text-[9px] font-extrabold px-2 py-1 rounded-full border uppercase flex items-center gap-1 w-fit ${statusStyle(f.status)}`}>
                        {f.status === "cancelled" ? <Ban size={10} /> : f.status === "paid" ? <CheckCircle2 size={10} /> : null}
                        {f.status}
                      </span>
                    </div>
                    <div className="col-span-3">
                      <p className="text-xs font-semibold text-gray-500">{fmtDate(f.issuedAt)}</p>
                      {f.issuedBy && <p className="text-[10px] font-semibold text-gray-300 truncate">by {f.issuedBy}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {/* Impose-fine modal */}
      {fineTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !submitting && setFineTarget(null)}>
          <div className="bg-white rounded-[2rem] shadow-xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-7 py-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#F28C28]/10 flex items-center justify-center">
                  <Gavel size={18} className="text-[#F28C28]" />
                </div>
                <div>
                  <h2 className="font-black text-base text-[#005A8C]">Impose Fine</h2>
                  <p className="text-[11px] font-semibold text-gray-400">
                    {fineTarget.companyName ?? "Unassigned company"} · {fineTarget.siteName ?? "site"}
                  </p>
                </div>
              </div>
              <button onClick={() => !submitting && setFineTarget(null)} className="cursor-pointer text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={submitFine} className="p-7 space-y-5">
              <div className="p-4 bg-red-50/60 border border-red-100 rounded-2xl flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{fineTarget.pmType?.toUpperCase() ?? "PM"} breach</span>
                <span className="text-sm font-black text-red-600">
                  {fineTarget.measuredValue ?? "—"} <span className="text-gray-400 font-bold">/ {fineTarget.thresholdValue ?? "—"} µg/m³</span>
                </span>
              </div>

              {modalError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-700">{modalError}</div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Fine Amount (USD)</label>
                <input
                  type="number" min="0" step="0.01" required value={fineAmount}
                  onChange={(e) => setFineAmount(e.target.value)}
                  className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Reason</label>
                <textarea
                  rows={3} value={fineReason} onChange={(e) => setFineReason(e.target.value)}
                  className="w-full px-4 py-3 text-sm font-semibold border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setFineTarget(null)} disabled={submitting}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-all disabled:opacity-50 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-3 bg-[#F28C28] text-white font-bold rounded-2xl hover:bg-[#d97818] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Gavel size={16} />}
                  {submitting ? "Issuing..." : "Issue Fine"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}

function Skeleton({ text }: { text: string }) {
  return (
    <div className="bg-white border border-gray-200/60 rounded-2xl p-8 text-center shadow-sm">
      <p className="text-sm font-bold text-gray-400">{text}</p>
    </div>
  );
}

function Empty({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="bg-white border border-gray-200/60 rounded-2xl p-10 text-center shadow-sm">
      <Icon size={32} className="text-gray-200 mx-auto mb-3" />
      <p className="text-sm font-bold text-gray-400">{title}</p>
      <p className="text-xs text-gray-300 font-semibold mt-1">{subtitle}</p>
    </div>
  );
}
