"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Settings2, Plus, X, Pencil, Trash2, FlaskConical,
  Building2, TrendingUp, TrendingDown, Users, ChevronDown, Check, Loader2,
  BarChart3, FileText, RefreshCw, Leaf,
} from "lucide-react";
import axiosInstance from "@/app/api/axiosInstance";
import { useAuth } from "@/app/context/AuthContext";
import AuthGuard from "@/app/components/AuthGuard";

interface EmissionReportResponse {
  id: number;
  companyId: number;
  companyName: string | null;
  sectorName: string | null;
  year: number;
  reportType?: "MIDYEAR" | "FINAL";
  activityLevel: number;
  verifiedEmissions: number;
  parameters?: Record<string, number> | null;
  submittedAt: string;
}

interface CompliancePosition {
  companyId: number;
  year: number;
  phase: string;
  status: string | null;
  preAllocation: number | null;
  finalAllocation: number | null;
  verifiedEmissions: number | null;
  totalBalance: number | null;
  surplusDeficit: number | null;
}

interface AllocationResponse {
  id: number;
  companyId: number;
  companyName: string | null;
  sectorName: string | null;
  year: number;
  preAllocation: number | null;
  verifiedEmissions: number | null;
  activityLevel: number | null;
  intensity: number | null;
  benchmarkIntensity: number | null;
  deviationPct: number | null;
  allocationAmount: number | null;
  surplusDeficit: number | null;
  status: string | null;
  allocatedAt: string | null;
}

interface ComplianceCycle {
  year: number;
  phase: "PENDING" | "PRE_ALLOCATED" | "MIDYEAR_OPEN" | "FINAL_OPEN" | "ALLOCATED" | "SETTLED";
  preAllocatedAt: string | null;
  midyearOpenedAt: string | null;
  finalOpenedAt: string | null;
  allocatedAt: string | null;
  settledAt: string | null;
}

// Ordered phases + the government action that advances out of each.
const CYCLE_STEPS: { phase: ComplianceCycle["phase"]; label: string; action: string; next: string }[] = [
  { phase: "PENDING",       label: "Pending",        action: "pre-allocate", next: "Pre-allocate (70% of prior year)" },
  { phase: "PRE_ALLOCATED", label: "Pre-allocated",  action: "open-midyear", next: "Open Mid-year Reporting" },
  { phase: "MIDYEAR_OPEN",  label: "Mid-year open",  action: "open-final",   next: "Open Final Reporting" },
  { phase: "FINAL_OPEN",    label: "Final open",     action: "finalize",     next: "Finalize Allocation" },
  { phase: "ALLOCATED",     label: "Allocated",      action: "settle",       next: "Settle & Deduct" },
  { phase: "SETTLED",       label: "Settled",        action: "",             next: "" },
];

interface Sector {
  id?: number;
  name: string;
  formula?: string;          // emissions formula
  activityFormula?: string;  // activity-level / output formula
  description?: string;
}

interface CompanyHistoryEntry {
  year: number;
  verifiedEmissions: number;
  activityLevel: number;
  submittedAt: string;
  benchmarkIntensity: number | null;
}

interface CompanyOverview {
  companyId: number;
  email: string;
  companyName: string | null;
  currentCredits: number;
  monthlyChange: number;
  sectorId: number | null;
  sectorName: string | null;
}

export default function CarbonCreditPage() {
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<"sectors" | "companies" | "allocations">("companies");

  // Sectors state
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loadingSectors, setLoadingSectors] = useState(false);
  const [editing, setEditing] = useState<Sector | null>(null);
  const [showEval, setShowEval] = useState<Sector | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [evalResult, setEvalResult] = useState<{ emission: number; activity: number | null } | null>(null);

  // Companies state
  const [companies, setCompanies] = useState<CompanyOverview[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [assigningCompanyId, setAssigningCompanyId] = useState<number | null>(null);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState<string | null>(null);

  // Company-view state
  const [companyCycle, setCompanyCycle] = useState<ComplianceCycle | null>(null);
  const [companyMySector, setCompanyMySector] = useState<Sector | null>(null);
  const [companyPosition, setCompanyPosition] = useState<CompliancePosition | null>(null);
  const [companyMyReports, setCompanyMyReports] = useState<EmissionReportResponse[]>([]);
  const [companyMyAllocations, setCompanyMyAllocations] = useState<AllocationResponse[]>([]);
  const [companyReportType, setCompanyReportType] = useState<"MIDYEAR" | "FINAL">("FINAL");
  const [companyParamValues, setCompanyParamValues] = useState<Record<string, string>>({});
  const [companyActivityLevel, setCompanyActivityLevel] = useState("");
  const [companyVerifiedEmissions, setCompanyVerifiedEmissions] = useState("");
  const [isSubmittingCompanyReport, setIsSubmittingCompanyReport] = useState(false);
  const [companyReportError, setCompanyReportError] = useState<string | null>(null);
  const [companyReportSuccess, setCompanyReportSuccess] = useState<string | null>(null);
  const [loadingCompanyData, setLoadingCompanyData] = useState(false);

  // Allocations state
  // Anchored to the latest compliance year that has seeded data (2025 is the
  // live demo year; 2022-2024 are settled history). The dropdowns show 2022-2025.
  const currentYear = 2025;

  // Companies may only submit a report for the current open compliance year (the
  // year the government has a cycle running for). The compliance-position viewer
  // below uses its own year so companies can still browse past-year history.
  const [positionYear, setPositionYear] = useState<number>(currentYear);

  const [companiesYear, setCompaniesYear] = useState<number>(currentYear);
  const [companiesReports, setCompaniesReports] = useState<EmissionReportResponse[]>([]);
  const [loadingCompaniesReports, setLoadingCompaniesReports] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);
  const [companyHistory, setCompanyHistory] = useState<Record<number, CompanyHistoryEntry[]>>({});
  const [allocYear, setAllocYear] = useState<number>(currentYear);
  const [allReports, setAllReports] = useState<EmissionReportResponse[]>([]);
  const [allocResults, setAllocResults] = useState<AllocationResponse[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingAllocs, setLoadingAllocs] = useState(false);
  const [cycle, setCycle] = useState<ComplianceCycle | null>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [allocError, setAllocError] = useState<string | null>(null);
  const [allocSuccess, setAllocSuccess] = useState<string | null>(null);

  useEffect(() => { fetchSectors(); }, []);
  useEffect(() => {
    if (activeTab === "companies") {
      fetchCompanies();
      fetchCompaniesReports(companiesYear);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, companiesYear]);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const sortedSectors = [...sectors].sort((a, b) => a.name.localeCompare(b.name));

  const fetchSectors = async () => {
    setLoadingSectors(true);
    try {
      const resp = await axiosInstance.get<Sector[]>('/sectors');
      setSectors(resp.data || []);
    } catch (e) {
      console.error(e);
    } finally { setLoadingSectors(false); }
  };

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const resp = await axiosInstance.get<CompanyOverview[]>('/sectors/companies');
      setCompanies(resp.data || []);
    } catch (e) {
      console.error(e);
    } finally { setLoadingCompanies(false); }
  };

  const fetchCompaniesReports = async (year: number) => {
    setLoadingCompaniesReports(true);
    try {
      const resp = await axiosInstance.get<EmissionReportResponse[]>(`/allocations/reports/${year}`);
      setCompaniesReports(resp.data || []);
    } catch {
      setCompaniesReports([]);
    } finally { setLoadingCompaniesReports(false); }
  };

  const fetchCompanyHistory = async (companyId: number) => {
    if (companyHistory[companyId]) return;
    try {
      const years = [0, 1, 2, 3].map((o) => currentYear - o);
      const [reportResults, allocResults] = await Promise.all([
        Promise.allSettled(years.map((y) => axiosInstance.get<EmissionReportResponse[]>(`/allocations/reports/${y}`))),
        Promise.allSettled(years.map((y) => axiosInstance.get<AllocationResponse[]>(`/allocations/results/${y}`))),
      ]);
      const history: CompanyHistoryEntry[] = [];
      reportResults.forEach((res, i) => {
        if (res.status !== "fulfilled") return;
        const report = (res.value.data || []).find((r) => r.companyId === companyId);
        if (!report) return;
        const allocRes = allocResults[i];
        const alloc = allocRes.status === "fulfilled"
          ? (allocRes.value.data || []).find((a) => a.companyId === companyId)
          : undefined;
        history.push({
          year: report.year,
          verifiedEmissions: report.verifiedEmissions,
          activityLevel: report.activityLevel,
          submittedAt: report.submittedAt,
          benchmarkIntensity: alloc ? Number(alloc.benchmarkIntensity) : null,
        });
      });
      setCompanyHistory((prev) => ({ ...prev, [companyId]: history }));
    } catch {
      // non-fatal
    }
  };

  const fetchAllReports = async (year: number) => {
    setLoadingReports(true);
    try {
      const resp = await axiosInstance.get<EmissionReportResponse[]>(`/allocations/reports/${year}`);
      setAllReports(resp.data || []);
    } catch (e) {
      console.error(e);
    } finally { setLoadingReports(false); }
  };

  const fetchAllocs = async (year: number) => {
    setLoadingAllocs(true);
    try {
      const resp = await axiosInstance.get<AllocationResponse[]>(`/allocations/results/${year}`);
      setAllocResults(resp.data || []);
    } catch (e) {
      console.error(e);
    } finally { setLoadingAllocs(false); }
  };

  const fetchCycle = async (year: number) => {
    try {
      const resp = await axiosInstance.get<ComplianceCycle>(`/allocations/cycle/${year}`);
      setCycle(resp.data);
    } catch {
      setCycle(null);
    }
  };

  // Advance the compliance cycle one phase via the matching government endpoint.
  const runCycleAction = async (action: string, label: string) => {
    setRunningAction(action);
    setAllocError(null);
    setAllocSuccess(null);
    try {
      const resp = await axiosInstance.post<ComplianceCycle>(`/allocations/cycle/${allocYear}/${action}`);
      setCycle(resp.data);
      setAllocSuccess(`${label} completed for ${allocYear}. Cycle is now ${resp.data.phase}.`);
      // Refresh ledger views affected by the action.
      await Promise.all([fetchAllReports(allocYear), fetchAllocs(allocYear)]);
    } catch (e: any) {
      setAllocError(e.response?.data?.message ?? e.response?.data ?? `Failed to ${label.toLowerCase()}.`);
    } finally { setRunningAction(null); }
  };

  useEffect(() => {
    if (activeTab === "allocations") {
      fetchCycle(allocYear);
      fetchAllReports(allocYear);
      fetchAllocs(allocYear);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, allocYear]);

  const saveSector = async (s: Sector) => {
    try {
      if (s.id) {
        await axiosInstance.put(`/sectors/${s.id}`, s);
      } else {
        await axiosInstance.post(`/sectors`, s);
      }
      setEditing(null);
      await fetchSectors();
    } catch (e) { console.error(e); }
  };

  const removeSector = async (id?: number) => {
    if (!id) return;
    if (!confirm('Delete this sector?')) return;
    await axiosInstance.delete(`/sectors/${id}`);
    fetchSectors();
  };

  const openEval = (s: Sector) => {
    setShowEval(s);
    setEvalResult(null);
    const keys = new Set<string>();
    const regex = /\{([^}]+)\}/g;
    let m;
    // Collect parameters from both the emission and activity formulas.
    for (const f of [s.formula, s.activityFormula]) {
      if (!f) continue;
      while ((m = regex.exec(f)) !== null) keys.add(m[1]);
    }
    const obj: Record<string, string> = {};
    keys.forEach(k => obj[k] = '');
    setParams(obj);
  };

  const evaluate = async () => {
    if (!showEval) return;
    try {
      const finalParams: Record<string, number> = {};
      Object.entries(params).forEach(([k, v]) => finalParams[k] = Number(v));
      const resp = await axiosInstance.post(`/sectors/${showEval.id}/evaluate`, { parameters: finalParams });
      setEvalResult({
        emission: resp.data?.emissionResult ?? 0,
        activity: resp.data?.activityResult ?? null,
      });
    } catch (e) {
      console.error(e);
      setError('Evaluation failed');
    }
  };

  const assignSector = async (companyId: number, sectorId: number | null) => {
    setAssigningCompanyId(companyId);
    try {
      await axiosInstance.patch(`/sectors/companies/${companyId}`, { sectorId });
      setCompanies(prev => prev.map(c => {
        if (c.companyId !== companyId) return c;
        const sector = sectors.find(s => s.id === sectorId);
        return { ...c, sectorId: sectorId, sectorName: sector?.name ?? null };
      }));
    } catch (e) {
      console.error(e);
      setError('Failed to assign sector');
    } finally {
      setAssigningCompanyId(null);
    }
  };

  // ── Company-view helpers ──────────────────────────────────────────────────

  const requiredCompanyVars = useMemo(() => {
    const set = new Set<string>();
    const re = /\{([^}]+)\}/g;
    for (const f of [companyMySector?.formula, companyMySector?.activityFormula]) {
      if (!f) continue;
      let m;
      while ((m = re.exec(f)) !== null) set.add(m[1]);
    }
    return Array.from(set);
  }, [companyMySector]);

  const fetchCompanyData = async () => {
    setLoadingCompanyData(true);
    try {
      const [cycleRes, reportsRes, allocsRes, sectorRes] = await Promise.allSettled([
        axiosInstance.get<ComplianceCycle>(`/allocations/cycle/${currentYear}`),
        axiosInstance.get<EmissionReportResponse[]>('/allocations/report/my'),
        axiosInstance.get<AllocationResponse[]>('/allocations/my'),
        axiosInstance.get<Sector>('/sectors/my'),
      ]);
      if (cycleRes.status === 'fulfilled') {
        const cycle = cycleRes.value.data;
        setCompanyCycle(cycle);
        if (cycle.phase === 'MIDYEAR_OPEN') setCompanyReportType('MIDYEAR');
        else if (cycle.phase === 'FINAL_OPEN') setCompanyReportType('FINAL');
      }
      if (reportsRes.status === 'fulfilled') setCompanyMyReports(reportsRes.value.data ?? []);
      if (allocsRes.status === 'fulfilled') setCompanyMyAllocations(allocsRes.value.data ?? []);
      if (sectorRes.status === 'fulfilled') {
        const s = sectorRes.value.data as Sector | '' | null;
        setCompanyMySector(s && (s as Sector).id ? (s as Sector) : null);
      }
    } catch { /* non-fatal */ } finally {
      setLoadingCompanyData(false);
    }
  };

  const fetchCompanyPosition = async (year: number) => {
    try {
      const resp = await axiosInstance.get<CompliancePosition>(`/allocations/position/${year}`);
      setCompanyPosition(resp.data);
    } catch {
      setCompanyPosition(null);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (hasRole('COMPANY')) { fetchCompanyData(); } }, []);

  useEffect(() => {
    if (hasRole('COMPANY')) fetchCompanyPosition(positionYear);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionYear]);

  useEffect(() => {
    const existing = companyMyReports.find(r => r.year === currentYear && r.reportType === companyReportType);
    if (existing) {
      setCompanyActivityLevel(String(existing.activityLevel));
      setCompanyVerifiedEmissions(String(existing.verifiedEmissions));
      if (existing.parameters) {
        const pv: Record<string, string> = {};
        Object.entries(existing.parameters).forEach(([k, v]) => { pv[k] = String(v); });
        setCompanyParamValues(pv);
      } else {
        setCompanyParamValues({});
      }
    } else {
      setCompanyActivityLevel("");
      setCompanyVerifiedEmissions("");
      setCompanyParamValues({});
    }
  }, [companyReportType, companyMyReports]);

  const handleCompanySubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingCompanyReport(true);
    setCompanyReportError(null);
    setCompanyReportSuccess(null);
    try {
      const payload: Record<string, unknown> = { year: currentYear, reportType: companyReportType };
      if (companyMySector) {
        const parameters: Record<string, number> = {};
        requiredCompanyVars.forEach(v => { parameters[v] = parseFloat(companyParamValues[v] ?? '') || 0; });
        payload.parameters = parameters;
      } else {
        payload.activityLevel = parseFloat(companyActivityLevel);
        payload.verifiedEmissions = parseFloat(companyVerifiedEmissions);
      }
      const resp = await axiosInstance.post<EmissionReportResponse>('/allocations/report', payload);
      const r = resp.data;
      const label = companyReportType === 'MIDYEAR' ? 'Mid-year' : 'Final';
      setCompanyReportSuccess(
        companyMySector
          ? `${label} report for ${currentYear} submitted — ${Number(r.verifiedEmissions).toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e over ${Number(r.activityLevel).toLocaleString(undefined, { maximumFractionDigits: 1 })} output.`
          : `${label} report for ${currentYear} submitted successfully.`
      );
      setPositionYear(currentYear);
      await Promise.all([fetchCompanyData(), fetchCompanyPosition(currentYear)]);
    } catch (err: any) {
      setCompanyReportError(err.response?.data?.message ?? err.response?.data ?? 'Failed to submit report.');
    } finally {
      setIsSubmittingCompanyReport(false);
    }
  };

  // ── Company view (non-government users) ──────────────────────────────────

  if (!hasRole('GOVERNMENT') && !hasRole('ADMIN')) {
    const canSubmit = companyCycle?.phase === 'MIDYEAR_OPEN' || companyCycle?.phase === 'FINAL_OPEN';
    const curStepIdx = CYCLE_STEPS.findIndex(s => s.phase === (companyCycle?.phase ?? 'PENDING'));

    return (
      <AuthGuard>
        <div className="p-8 min-h-screen bg-[#F8FAFC] flex flex-col gap-6 select-none">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-[#005A8C] tracking-tight flex items-center gap-2">
                <Leaf size={22} className="text-[#009B9E]" />
                Carbon Credit
              </h1>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                Compliance &amp; Emission Reporting
              </p>
            </div>
            {loadingCompanyData && <Loader2 size={18} className="text-gray-300 animate-spin" />}
          </div>

          {/* Phase Status */}
          <div className="bg-white border border-gray-200/60 rounded-[2rem] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <RefreshCw size={15} className="text-[#005A8C]" />
              <span className="text-sm font-black text-[#005A8C]">Compliance Cycle {currentYear}</span>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-1 flex-wrap">
                {CYCLE_STEPS.map((step, i) => {
                  const done = curStepIdx > i;
                  const active = curStepIdx === i;
                  return (
                    <div key={step.phase} className="flex items-center gap-1">
                      <span className={`text-[11px] font-black px-3 py-1.5 rounded-full border transition-colors ${
                        active ? 'bg-[#005A8C] text-white border-[#005A8C]'
                        : done ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : 'bg-gray-50 text-gray-400 border-gray-100'
                      }`}>
                        {done && <Check size={11} className="inline mr-1 -mt-0.5" />}{step.label}
                      </span>
                      {i < CYCLE_STEPS.length - 1 && <ChevronDown size={12} className="text-gray-300 -rotate-90" />}
                    </div>
                  );
                })}
              </div>
              <div className={`px-4 py-3 rounded-2xl border text-sm font-bold ${
                canSubmit ? 'bg-[#009B9E]/5 border-[#009B9E]/20 text-[#009B9E]' : 'bg-gray-50 border-gray-100 text-gray-500'
              }`}>
                {companyCycle?.phase === 'PENDING' && 'Reporting is not yet open. Waiting for government pre-allocation.'}
                {companyCycle?.phase === 'PRE_ALLOCATED' && 'Pre-allocation completed. Waiting for mid-year reporting window to open.'}
                {companyCycle?.phase === 'MIDYEAR_OPEN' && 'Mid-year reporting window is open — submit your mid-year emission report below.'}
                {companyCycle?.phase === 'FINAL_OPEN' && 'Final reporting window is open — submit your final annual emission report below.'}
                {companyCycle?.phase === 'ALLOCATED' && 'Final allocations have been calculated. Waiting for settlement.'}
                {companyCycle?.phase === 'SETTLED' && 'The compliance cycle for this year has been settled. Any surplus has been carried forward.'}
                {!companyCycle && 'No compliance cycle data available for this year yet.'}
              </div>
            </div>
          </div>

          {/* Submit Report — only when window is open */}
          {canSubmit && (
            <div className="bg-white border border-gray-200/60 rounded-[2rem] shadow-sm overflow-hidden">
              <div className="px-7 py-5 border-b border-gray-100 flex items-center gap-3">
                <FileText size={18} className="text-[#005A8C]" />
                <div>
                  <h2 className="font-black text-base text-[#005A8C]">Submit Emission Report</h2>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                    {companyCycle?.phase === 'MIDYEAR_OPEN' ? 'Mid-year (MRV) report' : 'Final annual report'}
                  </p>
                </div>
                {companyMySector && (
                  <span className="ml-auto text-xs font-bold text-[#009B9E] bg-[#009B9E]/8 px-3 py-1.5 rounded-xl">
                    {companyMySector.name}
                  </span>
                )}
              </div>
              <div className="p-7">
                {companyReportError && (
                  <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm font-bold text-red-700 flex justify-between items-center">
                    <span>{companyReportError}</span>
                    <button onClick={() => setCompanyReportError(null)} className="cursor-pointer"><X size={16} /></button>
                  </div>
                )}
                {companyReportSuccess && (
                  <div className="mb-5 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-sm font-bold text-emerald-700 flex justify-between items-center">
                    <span>{companyReportSuccess}</span>
                    <button onClick={() => setCompanyReportSuccess(null)} className="cursor-pointer"><X size={16} /></button>
                  </div>
                )}
                <form onSubmit={handleCompanySubmitReport} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Reporting Year</label>
                      <div className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-700 flex items-center justify-between">
                        <span>{currentYear}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current cycle</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Report Type</label>
                      <div className="flex gap-2">
                        {(['MIDYEAR', 'FINAL'] as const).map((t) => {
                          const available = (t === 'MIDYEAR' && companyCycle?.phase === 'MIDYEAR_OPEN') || (t === 'FINAL' && companyCycle?.phase === 'FINAL_OPEN');
                          return (
                            <button
                              key={t} type="button"
                              onClick={() => available && setCompanyReportType(t)}
                              disabled={!available}
                              className={`flex-1 py-2.5 text-sm font-bold rounded-xl border transition-all ${
                                companyReportType === t ? 'bg-[#005A8C] text-white border-[#005A8C]'
                                : available ? 'bg-white text-gray-500 border-gray-200 hover:border-[#005A8C]/40 cursor-pointer'
                                : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                              }`}
                            >
                              {t === 'MIDYEAR' ? 'Mid-year' : 'Final'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {companyMyReports.find(r => r.year === currentYear && r.reportType === companyReportType) && (
                    <p className="text-[10px] font-bold text-[#F28C28]">
                      Existing {companyReportType === 'MIDYEAR' ? 'mid-year' : 'final'} report found for {currentYear} — submitting will update it.
                    </p>
                  )}

                  {companyMySector ? (
                    <>
                      <div className="p-3 bg-[#009B9E]/5 border border-[#009B9E]/10 rounded-xl">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sector</p>
                        <p className="text-sm font-black text-[#009B9E]">{companyMySector.name}</p>
                        {companyMySector.description && (
                          <p className="text-[10px] font-semibold text-gray-400 mt-1">{companyMySector.description}</p>
                        )}
                        <p className="text-[10px] font-semibold text-gray-400 mt-1">
                          Enter your activity data below — emissions and activity level are computed from your sector formulas on submit.
                        </p>
                      </div>
                      {companyMySector.formula && (
                        <div className="bg-[#F8FAFC] border border-gray-100 rounded-2xl px-5 py-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Emissions Formula</p>
                          <p className="text-sm font-black text-[#005A8C] font-mono">{companyMySector.formula}</p>
                        </div>
                      )}
                      {companyMySector.activityFormula && (
                        <div className="bg-[#F8FAFC] border border-gray-100 rounded-2xl px-5 py-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Activity Formula</p>
                          <p className="text-sm font-black text-[#009B9E] font-mono">{companyMySector.activityFormula}</p>
                        </div>
                      )}
                      {requiredCompanyVars.length === 0 ? (
                        <p className="text-sm font-semibold text-gray-400">Your sector has no formula variables defined.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          {requiredCompanyVars.map((v) => (
                            <div key={v}>
                              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                                {v.replace(/_/g, ' ')}
                              </label>
                              <input
                                type="number" min="0" step="0.0001" required
                                value={companyParamValues[v] ?? ''}
                                onChange={(e) => setCompanyParamValues({ ...companyParamValues, [v]: e.target.value })}
                                placeholder="0"
                                className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">No sector assigned</p>
                        <p className="text-xs font-semibold text-amber-700 mt-1">
                          You have no sector assigned. Enter your totals directly below, or contact your administrator to assign a sector.
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Activity Level</label>
                        <input
                          type="number" min="0.0001" step="0.0001" required
                          value={companyActivityLevel}
                          onChange={(e) => setCompanyActivityLevel(e.target.value)}
                          placeholder="e.g. 50000"
                          className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all"
                        />
                        <p className="text-[10px] font-semibold text-gray-400 mt-1">Production output in your sector&apos;s unit.</p>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Verified Emissions (tCO₂e)</label>
                        <input
                          type="number" min="0.0001" step="0.0001" required
                          value={companyVerifiedEmissions}
                          onChange={(e) => setCompanyVerifiedEmissions(e.target.value)}
                          placeholder="e.g. 12500.00"
                          className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all"
                        />
                      </div>
                      {companyActivityLevel && companyVerifiedEmissions && (
                        <div className="p-4 bg-[#005A8C]/5 border border-[#005A8C]/10 rounded-xl">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Implied Intensity</p>
                          <p className="text-xl font-black text-[#005A8C] mt-0.5">
                            {(parseFloat(companyVerifiedEmissions) / parseFloat(companyActivityLevel)).toFixed(4)}
                          </p>
                          <p className="text-xs text-gray-400 font-semibold mt-0.5">tCO₂e per unit of output</p>
                        </div>
                      )}
                    </>
                  )}

                  <button
                    type="submit" disabled={isSubmittingCompanyReport}
                    className="w-full py-3.5 bg-[#005A8C] text-white font-bold rounded-2xl hover:bg-[#004a73] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingCompanyReport ? 'Submitting...' : `Submit ${currentYear} ${companyReportType === 'MIDYEAR' ? 'Mid-year' : 'Final'} Report`}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Compliance Position */}
          <div className="bg-white border border-gray-200/60 rounded-[2rem] shadow-sm overflow-hidden">
            <div className="px-7 py-5 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Leaf size={18} className="text-[#009B9E]" />
                <div>
                  <h2 className="font-black text-base text-[#009B9E]">Compliance Position — {positionYear}</h2>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Allowances vs. verified emissions</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {companyPosition?.status && (
                  <span className="text-[10px] font-extrabold text-gray-500 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full">
                    {companyPosition.status}
                  </span>
                )}
                <select
                  value={positionYear}
                  onChange={(e) => setPositionYear(Number(e.target.value))}
                  className="px-3 py-1.5 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all bg-white cursor-pointer"
                >
                  {[0, 1, 2, 3].map((offset) => {
                    const y = currentYear - offset;
                    return <option key={y} value={y}>{y}</option>;
                  })}
                </select>
              </div>
            </div>
            <div className="p-7">
              {!companyPosition ? (
                <p className="text-sm font-bold text-gray-300">No compliance data for {positionYear} yet.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                    {[
                      { label: 'Pre-allocation', value: companyPosition.preAllocation, color: 'text-gray-800' },
                      { label: 'Final allocation', value: companyPosition.finalAllocation, color: 'text-[#005A8C]' },
                      { label: 'Verified emissions', value: companyPosition.verifiedEmissions, color: 'text-gray-800' },
                      { label: 'Current balance', value: companyPosition.totalBalance, color: 'text-gray-800' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="p-4 bg-gray-50/60 border border-gray-100 rounded-2xl">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                        <p className={`text-lg font-black mt-0.5 ${color}`}>
                          {value != null ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}
                        </p>
                        <p className="text-[10px] text-gray-400 font-semibold">tCO₂e</p>
                      </div>
                    ))}
                  </div>
                  {companyPosition.surplusDeficit != null && (
                    <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                      Number(companyPosition.surplusDeficit) >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'
                    }`}>
                      <div className="flex items-center gap-2">
                        {Number(companyPosition.surplusDeficit) >= 0
                          ? <TrendingUp size={18} className="text-emerald-600" />
                          : <TrendingDown size={18} className="text-red-600" />}
                        <span className={`text-sm font-black ${Number(companyPosition.surplusDeficit) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {Number(companyPosition.surplusDeficit) >= 0 ? 'Surplus' : 'Deficit'}: {Number(companyPosition.surplusDeficit) >= 0 ? '+' : ''}
                          {Number(companyPosition.surplusDeficit).toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e
                        </span>
                      </div>
                      <span className="text-xs font-bold text-gray-500">
                        {Number(companyPosition.surplusDeficit) >= 0
                          ? 'Surplus carries forward — or sell it on the market.'
                          : 'Buy credits to cover the shortfall before settlement.'}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Allocation History */}
          <div>
            <h2 className="font-black text-base text-gray-800 mb-3 flex items-center gap-2">
              <BarChart3 size={16} className="text-[#009B9E]" />
              My Allocation History
            </h2>
            {loadingCompanyData ? (
              <div className="bg-white border border-gray-200/60 rounded-2xl p-8 text-center shadow-sm">
                <p className="text-sm font-bold text-gray-400">Loading...</p>
              </div>
            ) : companyMyAllocations.length === 0 ? (
              <div className="bg-white border border-gray-200/60 rounded-2xl p-8 text-center shadow-sm">
                <p className="text-sm font-bold text-gray-300">No allocations yet. Submit a report and wait for government calculation.</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200/60 rounded-[2rem] overflow-hidden shadow-sm">
                <div className="px-5 py-3 grid grid-cols-12 gap-2 border-b border-gray-100">
                  <span className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Year</span>
                  <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Emissions</span>
                  <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Allocation</span>
                  <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Intensity</span>
                  <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Benchmark</span>
                  <span className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Dev%</span>
                  <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Status</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {[...companyMyAllocations].sort((a, b) => b.year - a.year).map((alloc) => {
                    const dev = alloc.deviationPct != null ? Number(alloc.deviationPct) : null;
                    const devColor = dev == null ? 'text-gray-300' : dev < 0 ? 'text-emerald-600' : dev > 0 ? 'text-red-500' : 'text-gray-500';
                    return (
                      <div key={alloc.id} className="px-5 py-4 grid grid-cols-12 gap-2 items-center hover:bg-gray-50/50 transition-colors">
                        <span className="col-span-1 text-sm font-black text-gray-800">{alloc.year}</span>
                        <span className="col-span-2 text-sm font-bold text-gray-700 text-right">
                          {alloc.verifiedEmissions != null ? Number(alloc.verifiedEmissions).toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}
                        </span>
                        <span className="col-span-2 text-sm font-black text-[#009B9E] text-right">
                          {alloc.allocationAmount != null ? Number(alloc.allocationAmount).toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}
                        </span>
                        <span className="col-span-2 text-sm font-bold text-gray-600 text-right tabular-nums">
                          {alloc.intensity != null ? Number(alloc.intensity).toFixed(4) : '—'}
                        </span>
                        <span className="col-span-2 text-sm font-bold text-gray-600 text-right tabular-nums">
                          {alloc.benchmarkIntensity != null ? Number(alloc.benchmarkIntensity).toFixed(4) : '—'}
                        </span>
                        <span className={`col-span-1 text-sm font-black text-right ${devColor}`}>
                          {dev == null ? '—' : `${dev > 0 ? '+' : ''}${dev.toFixed(2)}%`}
                        </span>
                        <div className="col-span-2 flex justify-end">
                          <span className="text-[9px] font-extrabold text-gray-500 bg-gray-50 border border-gray-100 px-2 py-1 rounded-full">
                            {alloc.status ?? '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="p-8 min-h-screen bg-[#F8FAFC] flex flex-col gap-6 select-none">

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#005A8C] tracking-tight flex items-center gap-2">
              <Settings2 size={22} className="text-[#009B9E]" />
              Carbon Credit Management
            </h1>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
              Sector Definitions &amp; Company Oversight
            </p>
          </div>
          {activeTab === "sectors" && (
            <button
              onClick={() => setEditing({ name: '', formula: '', activityFormula: '', description: '' })}
              className="flex items-center gap-2 px-5 py-3 bg-[#009B9E] text-white text-sm font-bold rounded-2xl hover:bg-[#007d80] transition-all shadow-sm hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
            >
              <Plus size={16} />
              New Sector
            </button>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm font-bold text-red-700 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="cursor-pointer"><X size={16} /></button>
          </div>
        )}

        {/* Tab Toggle */}
        <div className="flex gap-2 bg-white border border-gray-200/60 rounded-2xl p-1.5 w-fit shadow-sm">
          {(["companies", "sectors", "allocations"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === tab
                  ? "bg-[#005A8C] text-white shadow-sm"
                  : "text-gray-500 hover:text-[#005A8C]"
              }`}
            >
              {tab === "companies" ? "Companies" : tab === "sectors" ? "Sector Formulas" : "Phases"}
            </button>
          ))}
        </div>

        {/* ── Sectors Tab ── */}
        {activeTab === "sectors" && (
          loadingSectors ? (
            <div className="bg-white border border-gray-200/60 rounded-2xl p-8 text-center shadow-sm">
              <p className="text-sm font-bold text-gray-400">Loading sectors...</p>
            </div>
          ) : sectors.length === 0 ? (
            <div className="bg-white border border-gray-200/60 rounded-2xl p-10 text-center shadow-sm">
              <Settings2 size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-400">No sectors defined yet.</p>
              <p className="text-xs text-gray-300 font-semibold mt-1">Click &ldquo;New Sector&rdquo; to get started.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200/60 rounded-[2rem] overflow-hidden shadow-sm">
              <div className="px-5 py-3 grid grid-cols-12 gap-2 border-b border-gray-100">
                <span className="col-span-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sector</span>
                <span className="col-span-5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Formulas (emission / activity)</span>
                <span className="col-span-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Description</span>
                <span className="col-span-1" />
              </div>
              <div className="divide-y divide-gray-50">
                {sortedSectors.map(s => (
                  <div key={s.id} className="px-5 py-4 grid grid-cols-12 gap-2 items-center hover:bg-gray-50/60 transition-colors">
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-8 h-8 shrink-0 rounded-xl bg-[#005A8C]/10 flex items-center justify-center">
                        <Settings2 size={14} className="text-[#005A8C]" />
                      </div>
                      <p className="text-sm font-black text-gray-800 truncate">{s.name}</p>
                    </div>
                    <div className="col-span-5 flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[8px] font-black text-[#009B9E] uppercase tracking-wider shrink-0 w-12">Emission</span>
                        {s.formula ? (
                          <code className="text-xs font-mono text-[#009B9E] bg-[#009B9E]/8 px-2 py-1 rounded-lg break-all">
                            {s.formula}
                          </code>
                        ) : (
                          <span className="text-xs text-gray-300 font-semibold">—</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[8px] font-black text-[#005A8C] uppercase tracking-wider shrink-0 w-12">Activity</span>
                        {s.activityFormula ? (
                          <code className="text-xs font-mono text-[#005A8C] bg-[#005A8C]/8 px-2 py-1 rounded-lg break-all">
                            {s.activityFormula}
                          </code>
                        ) : (
                          <span className="text-xs text-gray-300 font-semibold">—</span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-3">
                      <p className="text-xs text-gray-500 font-semibold truncate">{s.description || '—'}</p>
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEval(s)}
                        className="w-7 h-7 rounded-lg bg-[#F28C28]/10 hover:bg-[#F28C28]/20 flex items-center justify-center transition-colors cursor-pointer"
                        title="Evaluate"
                      >
                        <FlaskConical size={13} className="text-[#F28C28]" />
                      </button>
                      <button
                        onClick={() => setEditing(s)}
                        className="w-7 h-7 rounded-lg bg-[#005A8C]/10 hover:bg-[#005A8C]/20 flex items-center justify-center transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Pencil size={13} className="text-[#005A8C]" />
                      </button>
                      <button
                        onClick={() => removeSector(s.id)}
                        className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={13} className="text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* ── Companies Tab ── */}
        {activeTab === "companies" && (
          loadingCompanies ? (
            <div className="bg-white border border-gray-200/60 rounded-2xl p-8 text-center shadow-sm">
              <p className="text-sm font-bold text-gray-400">Loading companies...</p>
            </div>
          ) : companies.length === 0 ? (
            <div className="bg-white border border-gray-200/60 rounded-2xl p-10 text-center shadow-sm">
              <Users size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-400">No registered companies found.</p>
            </div>
          ) : (
            <div ref={dropdownRef} className="bg-white border border-gray-200/60 rounded-[2rem] overflow-hidden shadow-sm">
              {/* Header row with year selector */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {companies.length} companies
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Consumption year</span>
                  <select
                    value={companiesYear}
                    onChange={(e) => {
                      setCompaniesYear(Number(e.target.value));
                      setExpandedHistoryId(null);
                      setCompanyHistory({});
                    }}
                    className="px-3 py-1.5 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all bg-white cursor-pointer"
                  >
                    {[0, 1, 2, 3].map((offset) => {
                      const y = currentYear - offset;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                </div>
              </div>

              <div className="px-6 py-3 grid grid-cols-12 gap-4 border-b border-gray-100 bg-gray-50/40">
                <span className="col-span-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Company</span>
                <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sector</span>
                <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Current Credits</span>
                <span className="col-span-2 text-[10px] font-bold text-[#F28C28] uppercase tracking-wider text-right">
                  {companiesYear} Consumption
                </span>
                <span className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">History</span>
                <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Change Sector</span>
              </div>

              <div className="divide-y divide-gray-50">
                {[...companies].sort((a, b) => (a.companyName ?? a.email).localeCompare(b.companyName ?? b.email)).map(company => {
                  const isOpen = openDropdown === company.companyId;
                  const isAssigning = assigningCompanyId === company.companyId;
                  const isHistoryOpen = expandedHistoryId === company.companyId;
                  const report = companiesReports.find((r) => r.companyId === company.companyId);
                  const consumption = report ? Number(report.verifiedEmissions) : null;
                  const history = companyHistory[company.companyId];

                  return (
                    <div key={company.companyId}>
                      <div className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-gray-50/40 transition-colors">
                        {/* Company */}
                        <div className="col-span-3 flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 shrink-0 rounded-xl bg-[#005A8C]/10 flex items-center justify-center">
                            <Building2 size={15} className="text-[#005A8C]" />
                          </div>
                          <div className="min-w-0">
                            {company.companyName ? (
                              <>
                                <p className="text-sm font-black text-gray-800 truncate">{company.companyName}</p>
                                <p className="text-[10px] text-gray-400 font-semibold truncate">{company.email}</p>
                              </>
                            ) : (
                              <p className="text-sm font-bold text-gray-700 truncate">{company.email}</p>
                            )}
                          </div>
                        </div>

                        {/* Sector */}
                        <div className="col-span-2 flex items-center">
                          {company.sectorName ? (
                            <span className="text-xs font-bold text-[#009B9E] bg-[#009B9E]/8 px-2.5 py-1 rounded-lg truncate block w-fit max-w-full">
                              {company.sectorName}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300 font-semibold">—</span>
                          )}
                        </div>

                        {/* Current Credits */}
                        <div className="col-span-2 text-right">
                          <p className="text-sm font-black text-gray-800">
                            {Number(company.currentCredits).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-gray-400 font-semibold">tCO₂e</p>
                        </div>

                        {/* Consumption for selected year */}
                        <div className="col-span-2 text-right">
                          {loadingCompaniesReports ? (
                            <Loader2 size={14} className="text-gray-300 animate-spin ml-auto" />
                          ) : consumption != null ? (
                            <>
                              <p className="text-sm font-black text-[#F28C28]">
                                {consumption.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                              </p>
                              <p className="text-[10px] text-gray-400 font-semibold">tCO₂e</p>
                            </>
                          ) : (
                            <span className="text-xs font-bold text-gray-300">
                              {companiesYear >= currentYear ? "Pending" : "No report"}
                            </span>
                          )}
                        </div>

                        {/* History toggle */}
                        <div className="col-span-1 flex justify-center">
                          <button
                            onClick={() => {
                              if (!isHistoryOpen) fetchCompanyHistory(company.companyId);
                              setExpandedHistoryId(isHistoryOpen ? null : company.companyId);
                            }}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isHistoryOpen ? "bg-[#005A8C]/10 text-[#005A8C]" : "hover:bg-gray-100 text-gray-400"
                            }`}
                            title="View consumption history"
                          >
                            <BarChart3 size={15} />
                          </button>
                        </div>

                        {/* Sector assignment dropdown */}
                        <div className="col-span-2 relative">
                          <button
                            disabled={isAssigning}
                            onClick={() => setOpenDropdown(isOpen ? null : company.companyId)}
                            className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                              company.sectorId
                                ? "border-[#009B9E]/40 bg-[#009B9E]/5 hover:border-[#009B9E]/60"
                                : "border-gray-200 bg-gray-50 hover:border-gray-300"
                            } ${isAssigning ? "opacity-50 cursor-wait" : ""} ${isOpen ? "ring-2 ring-[#009B9E]/20 border-[#009B9E]/60" : ""}`}
                          >
                            <span className={`text-xs font-bold truncate ${company.sectorId ? "text-[#009B9E]" : "text-gray-400"}`}>
                              {isAssigning ? "Saving..." : company.sectorId ? "Change" : "Assign"}
                            </span>
                            {isAssigning
                              ? <Loader2 size={13} className="text-gray-400 animate-spin shrink-0" />
                              : <ChevronDown size={13} className={`shrink-0 transition-transform text-gray-400 ${isOpen ? "rotate-180" : ""}`} />
                            }
                          </button>

                          {isOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl z-20 overflow-hidden">
                              <div className="px-3 pt-3 pb-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Assign Sector</p>
                              </div>
                              <div className="px-2 pb-2 max-h-56 overflow-y-auto">
                                <button
                                  onClick={() => { assignSector(company.companyId, null); setOpenDropdown(null); }}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                    !company.sectorId ? "bg-gray-100 text-gray-600" : "text-gray-400 hover:bg-gray-50"
                                  }`}
                                >
                                  <span>Unassigned</span>
                                  {!company.sectorId && <Check size={12} className="text-gray-500" />}
                                </button>
                                {sortedSectors.map(s => (
                                  <button
                                    key={s.id}
                                    onClick={() => { assignSector(company.companyId, s.id!); setOpenDropdown(null); }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                      company.sectorId === s.id
                                        ? "bg-[#009B9E]/10 text-[#009B9E]"
                                        : "text-gray-700 hover:bg-gray-50"
                                    }`}
                                  >
                                    <span>{s.name}</span>
                                    {company.sectorId === s.id && <Check size={12} className="text-[#009B9E]" />}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Inline history panel */}
                      {isHistoryOpen && (
                        <div className="mx-6 mb-4 border border-[#005A8C]/10 rounded-2xl overflow-hidden bg-[#005A8C]/3">
                          <div className="px-5 py-3 border-b border-[#005A8C]/10 flex items-center gap-2 bg-[#005A8C]/5">
                            <BarChart3 size={13} className="text-[#005A8C]" />
                            <span className="text-xs font-black text-[#005A8C] uppercase tracking-wider">
                              {company.companyName ?? company.email} — Consumption History
                            </span>
                          </div>
                          {!history ? (
                            <div className="p-5 flex items-center justify-center gap-2">
                              <Loader2 size={14} className="animate-spin text-gray-400" />
                              <p className="text-xs font-bold text-gray-400">Loading...</p>
                            </div>
                          ) : history.length === 0 ? (
                            <div className="p-5 text-center">
                              <p className="text-xs font-bold text-gray-400">No historical consumption data found.</p>
                            </div>
                          ) : (
                            <div>
                              <div className="px-5 py-2 grid grid-cols-6 gap-3 border-b border-[#005A8C]/10">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Year</span>
                                <span className="text-[10px] font-bold text-[#F28C28] uppercase tracking-wider text-right">Consumption (tCO₂e)</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Activity Level</span>
                                <span className="text-[10px] font-bold text-[#009B9E] uppercase tracking-wider text-right">Intensity</span>
                                <span className="text-[10px] font-bold text-[#005A8C] uppercase tracking-wider text-right">Sector Avg</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Submitted</span>
                              </div>
                              <div className="divide-y divide-[#005A8C]/5">
                                {[...history].sort((a, b) => b.year - a.year).map((h) => {
                                  const intensity = Number(h.activityLevel) > 0
                                    ? Number(h.verifiedEmissions) / Number(h.activityLevel)
                                    : null;
                                  const vsAvg = intensity != null && h.benchmarkIntensity != null
                                    ? intensity - h.benchmarkIntensity
                                    : null;
                                  return (
                                    <div key={h.year} className="px-5 py-3 grid grid-cols-6 gap-3 items-center">
                                      <span className="text-sm font-black text-gray-700">{h.year}</span>
                                      <span className="text-sm font-black text-[#F28C28] text-right tabular-nums">
                                        {Number(h.verifiedEmissions).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                      </span>
                                      <span className="text-sm font-bold text-gray-500 text-right tabular-nums">
                                        {Number(h.activityLevel).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                      </span>
                                      <span className="text-sm font-bold text-[#009B9E] text-right tabular-nums">
                                        {intensity != null ? intensity.toFixed(4) : "—"}
                                      </span>
                                      <div className="text-right">
                                        {h.benchmarkIntensity != null ? (
                                          <>
                                            <p className="text-sm font-bold text-[#005A8C] tabular-nums">
                                              {h.benchmarkIntensity.toFixed(4)}
                                            </p>
                                            {vsAvg != null && (
                                              <p className={`text-[10px] font-bold tabular-nums ${vsAvg > 0 ? "text-red-500" : "text-emerald-500"}`}>
                                                {vsAvg > 0 ? "+" : ""}{vsAvg.toFixed(4)}
                                              </p>
                                            )}
                                          </>
                                        ) : (
                                          <span className="text-xs font-bold text-gray-300">—</span>
                                        )}
                                      </div>
                                      <span className="text-[10px] font-semibold text-gray-400 text-right">
                                        {new Date(h.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* ── Allocations Tab ── */}
        {activeTab === "allocations" && (
          <div className="flex flex-col gap-6">

            {/* Formula Reference Card */}
            <div className="bg-white border border-gray-200/60 rounded-[2rem] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <FileText size={15} className="text-[#005A8C]" />
                <span className="text-sm font-black text-[#005A8C]">Vietnam ETS Allocation Formula</span>
              </div>
              <div className="px-6 py-5 grid grid-cols-3 gap-6">

                {/* Step 1 */}
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Step 1 — Sector Benchmark</p>
                  <code className="text-xs font-mono text-[#009B9E] bg-[#009B9E]/6 px-3 py-2 rounded-xl leading-relaxed">
                    benchmark = Σ emissions / Σ activity
                  </code>
                  <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">
                    Sum all verified emissions divided by sum of all activity levels across companies in the same sector.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Step 2 — Deviation</p>
                  <code className="text-xs font-mono text-[#009B9E] bg-[#009B9E]/6 px-3 py-2 rounded-xl leading-relaxed">
                    intensity = emissions / activity{"\n"}
                    deviation = (intensity − benchmark) / benchmark
                  </code>
                  <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">
                    Negative deviation = cleaner than sector average. Positive = dirtier.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Step 3 — Allocation</p>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-start gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider shrink-0 mt-0.5">Best</span>
                      <code className="text-[10px] font-mono text-emerald-700">
                        deviation &lt; −20% → emissions × 1.03
                      </code>
                    </div>
                    <div className="flex items-start gap-2 px-3 py-1.5 bg-[#005A8C]/5 border border-[#005A8C]/10 rounded-xl">
                      <span className="text-[10px] font-black text-[#005A8C] uppercase tracking-wider shrink-0 mt-0.5">Mid</span>
                      <code className="text-[10px] font-mono text-[#005A8C]">
                        |deviation| ≤ 20% → emissions × (1 − deviation × 0.15)
                      </code>
                    </div>
                    <div className="flex items-start gap-2 px-3 py-1.5 bg-red-50 border border-red-100 rounded-xl">
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-wider shrink-0 mt-0.5">Worst</span>
                      <code className="text-[10px] font-mono text-red-600">
                        deviation &gt; 20% → emissions × 0.97
                      </code>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Compliance Cycle Control Panel */}
            <div className="bg-white border border-gray-200/60 rounded-[2rem] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <RefreshCw size={15} className="text-[#005A8C]" />
                  <span className="text-sm font-black text-[#005A8C]">Compliance Cycle</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Year</label>
                  <select
                    value={allocYear}
                    onChange={(e) => setAllocYear(Number(e.target.value))}
                    className="px-4 py-2 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all bg-white cursor-pointer"
                  >
                    {[0, 1, 2, 3].map((offset) => {
                      const y = currentYear - offset;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                </div>
              </div>

              <div className="px-6 py-5 flex flex-col gap-5">
                {/* Phase stepper */}
                <div className="flex items-center gap-1 flex-wrap">
                  {CYCLE_STEPS.map((step, i) => {
                    const curIdx = CYCLE_STEPS.findIndex((s) => s.phase === cycle?.phase);
                    const done = curIdx > i;
                    const active = curIdx === i;
                    return (
                      <div key={step.phase} className="flex items-center gap-1">
                        <span className={`text-[11px] font-black px-3 py-1.5 rounded-full border transition-colors ${
                          active ? "bg-[#005A8C] text-white border-[#005A8C]"
                          : done ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                          : "bg-gray-50 text-gray-400 border-gray-100"
                        }`}>
                          {done && <Check size={11} className="inline mr-1 -mt-0.5" />}{step.label}
                        </span>
                        {i < CYCLE_STEPS.length - 1 && <ChevronDown size={12} className="text-gray-300 -rotate-90" />}
                      </div>
                    );
                  })}
                </div>

                {/* Next action button */}
                {(() => {
                  const current = CYCLE_STEPS.find((s) => s.phase === (cycle?.phase ?? "PENDING"));
                  if (!current || !current.action) {
                    return (
                      <p className="text-xs font-bold text-emerald-600">
                        Compliance cycle for {allocYear} is settled. Real emissions were deducted; any surplus carried forward to the next year.
                      </p>
                    );
                  }
                  return (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => runCycleAction(current.action, current.next)}
                        disabled={runningAction !== null}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#009B9E] text-white text-sm font-bold rounded-2xl hover:bg-[#007d80] transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        {runningAction === current.action
                          ? <><Loader2 size={15} className="animate-spin" /> Working...</>
                          : <><RefreshCw size={15} /> {current.next}</>
                        }
                      </button>
                      <span className="text-[11px] font-semibold text-gray-400">
                        Current phase: <span className="font-black text-gray-600">{cycle?.phase ?? "PENDING"}</span>
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {allocError && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm font-bold text-red-700 flex justify-between items-center">
                <span>{allocError}</span>
                <button onClick={() => setAllocError(null)} className="cursor-pointer"><X size={16} /></button>
              </div>
            )}
            {allocSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-sm font-bold text-emerald-700 flex justify-between items-center">
                <span>{allocSuccess}</span>
                <button onClick={() => setAllocSuccess(null)} className="cursor-pointer"><X size={16} /></button>
              </div>
            )}

            {/* Submitted Emission Reports */}
            <div>
              <h2 className="font-black text-base text-gray-800 mb-3 flex items-center gap-2">
                <FileText size={16} className="text-[#005A8C]" />
                Submitted Emission Reports — {allocYear}
              </h2>
              {loadingReports ? (
                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 text-center shadow-sm">
                  <p className="text-sm font-bold text-gray-400">Loading reports...</p>
                </div>
              ) : allReports.length === 0 ? (
                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 text-center shadow-sm">
                  <p className="text-sm font-bold text-gray-300">No emission reports submitted for {allocYear}.</p>
                </div>
              ) : (
                <div className="bg-white border border-gray-200/60 rounded-[2rem] overflow-hidden shadow-sm">
                  <div className="px-6 py-3 grid grid-cols-12 gap-3 border-b border-gray-100">
                    <span className="col-span-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Company</span>
                    <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sector</span>
                    <span className="col-span-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Activity Level</span>
                    <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Emissions (tCO₂e)</span>
                    <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Submitted</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {allReports.map((r) => (
                      <div key={r.id} className="px-6 py-4 grid grid-cols-12 gap-3 items-center hover:bg-gray-50/40 transition-colors">
                        <div className="col-span-3 flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 shrink-0 rounded-xl bg-[#005A8C]/10 flex items-center justify-center">
                            <Building2 size={14} className="text-[#005A8C]" />
                          </div>
                          <p className="text-sm font-black text-gray-800 truncate">
                            {r.companyName ?? `Company #${r.companyId}`}
                          </p>
                        </div>
                        <div className="col-span-2">
                          {r.sectorName ? (
                            <span className="text-xs font-bold text-[#009B9E] bg-[#009B9E]/8 px-2.5 py-1 rounded-lg">
                              {r.sectorName}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300 font-semibold">—</span>
                          )}
                        </div>
                        <div className="col-span-3 text-right">
                          <span className="text-sm font-bold text-gray-700">
                            {Number(r.activityLevel).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-sm font-black text-gray-800">
                            {Number(r.verifiedEmissions).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                          </span>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-[10px] font-semibold text-gray-400">
                            {new Date(r.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Allocation Results */}
            <div>
              <h2 className="font-black text-base text-gray-800 mb-3 flex items-center gap-2">
                <BarChart3 size={16} className="text-[#009B9E]" />
                Allocation Results — {allocYear}
              </h2>
              {loadingAllocs ? (
                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 text-center shadow-sm">
                  <p className="text-sm font-bold text-gray-400">Loading results...</p>
                </div>
              ) : allocResults.length === 0 ? (
                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 text-center shadow-sm">
                  <p className="text-sm font-bold text-gray-300">
                    No compliance ledger for {allocYear} yet. Run &ldquo;Pre-allocate&rdquo; above to start the cycle.
                  </p>
                </div>
              ) : (
                <div className="bg-white border border-gray-200/60 rounded-[2rem] overflow-hidden shadow-sm">
                  <div className="px-6 py-3 grid grid-cols-12 gap-2 border-b border-gray-100">
                    <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Company</span>
                    <span className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Sector Benchmark</span>
                    <span className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Co. Efficiency</span>
                    <span className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Deviation</span>
                    <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Pre-alloc</span>
                    <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Final alloc</span>
                    <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Surplus / Deficit</span>
                    <span className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Status</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {[...allocResults].sort((a, b) => (a.companyName ?? "").localeCompare(b.companyName ?? "")).map((alloc) => {
                      const dev = alloc.deviationPct != null ? Number(alloc.deviationPct) : null;
                      const devBg = dev == null
                        ? "bg-gray-50 text-gray-400 border-gray-100"
                        : dev < 0
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                        : dev > 0
                        ? "bg-red-50 text-red-600 border-red-100"
                        : "bg-gray-50 text-gray-500 border-gray-100";
                      const sd = alloc.surplusDeficit != null ? Number(alloc.surplusDeficit) : null;
                      return (
                        <div key={alloc.id} className="px-6 py-4 grid grid-cols-12 gap-2 items-center hover:bg-gray-50/40 transition-colors">
                          <div className="col-span-2 flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 shrink-0 rounded-xl bg-[#005A8C]/10 flex items-center justify-center">
                              <Building2 size={14} className="text-[#005A8C]" />
                            </div>
                            <p className="text-sm font-black text-gray-800 truncate">
                              {alloc.companyName ?? `Company #${alloc.companyId}`}
                            </p>
                          </div>
                          <div className="col-span-1 text-right">
                            <span className="text-xs font-bold text-gray-500 tabular-nums">
                              {alloc.benchmarkIntensity != null ? Number(alloc.benchmarkIntensity).toFixed(4) : "—"}
                            </span>
                          </div>
                          <div className="col-span-1 text-right">
                            <span className="text-xs font-bold text-gray-700 tabular-nums">
                              {alloc.intensity != null ? Number(alloc.intensity).toFixed(4) : "—"}
                            </span>
                          </div>
                          <div className="col-span-1 flex justify-end">
                            {dev == null ? (
                              <span className="text-xs text-gray-300 font-semibold">—</span>
                            ) : (
                              <span className={`text-[11px] font-extrabold px-2 py-1 rounded-full border ${devBg}`}>
                                {dev > 0 ? "+" : ""}{dev.toFixed(1)}%
                              </span>
                            )}
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-xs font-bold text-gray-500 tabular-nums">
                              {alloc.preAllocation != null ? Number(alloc.preAllocation).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
                            </span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-sm font-black text-[#005A8C]">
                              {alloc.allocationAmount != null ? Number(alloc.allocationAmount).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
                            </span>
                          </div>
                          <div className="col-span-2 text-right">
                            {sd == null ? (
                              <span className="text-xs text-gray-300 font-semibold">—</span>
                            ) : (
                              <span className={`text-sm font-black ${sd >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {sd >= 0 ? "+" : ""}{sd.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                              </span>
                            )}
                          </div>
                          <div className="col-span-1 flex justify-end min-w-0">
                            <span title={alloc.status ?? undefined} className="text-[9px] font-extrabold text-gray-500 bg-gray-50 border border-gray-100 px-2 py-1 rounded-full truncate max-w-full">
                              {alloc.status ?? "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Edit / Create Sector Modal */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-md mx-4 border border-gray-100">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-black text-[#005A8C]">
                    {editing.id ? 'Edit Sector' : 'Create Sector'}
                  </h2>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                    Carbon credit formula definition
                  </p>
                </div>
                <button onClick={() => setEditing(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Name</label>
                  <input
                    className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all"
                    value={editing.name}
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                    placeholder="e.g. Manufacturing"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Emission Formula</label>
                  <input
                    className="w-full px-4 py-3 text-sm font-mono border border-gray-200 rounded-xl outline-none focus:border-[#009B9E] focus:ring-2 focus:ring-[#009B9E]/10 transition-all"
                    value={editing.formula}
                    onChange={e => setEditing({ ...editing, formula: e.target.value })}
                    placeholder="e.g. {energy} * 0.233 + {fuel} * 2.68"
                  />
                  <p className="text-[10px] text-gray-400 font-semibold mt-1">Computes emissions (tCO₂e). Use {`{variable}`} syntax.</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Activity Formula</label>
                  <input
                    className="w-full px-4 py-3 text-sm font-mono border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all"
                    value={editing.activityFormula ?? ''}
                    onChange={e => setEditing({ ...editing, activityFormula: e.target.value })}
                    placeholder="e.g. {crude_steel_tonnes}"
                  />
                  <p className="text-[10px] text-gray-400 font-semibold mt-1">Computes the activity level (output) — the denominator of intensity.</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Description</label>
                  <textarea
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all resize-none"
                    rows={3}
                    value={editing.description}
                    onChange={e => setEditing({ ...editing, description: e.target.value })}
                    placeholder="Brief description of this sector..."
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => saveSector(editing)}
                    className="flex-1 py-3.5 bg-[#009B9E] text-white font-bold rounded-2xl hover:bg-[#007d80] transition-all cursor-pointer"
                  >
                    {editing.id ? 'Save Changes' : 'Create Sector'}
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="px-6 py-3.5 text-gray-500 font-bold rounded-2xl hover:bg-gray-100 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Evaluate Modal */}
        {showEval && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-md mx-4 border border-gray-100">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-black text-[#F28C28]">Evaluate Formula</h2>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">{showEval.name}</p>
                </div>
                <button onClick={() => setShowEval(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              <div className="p-4 bg-[#F28C28]/5 border border-[#F28C28]/10 rounded-xl mb-5 flex flex-col gap-3">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Emission Formula</p>
                  <code className="text-sm font-mono text-[#009B9E] break-all">{showEval.formula || '—'}</code>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Activity Formula</p>
                  <code className="text-sm font-mono text-[#005A8C] break-all">{showEval.activityFormula || '—'}</code>
                </div>
              </div>

              <div className="space-y-4">
                {Object.keys(params).length === 0 ? (
                  <p className="text-sm font-semibold text-gray-400 text-center py-2">No parameters found in formula.</p>
                ) : (
                  Object.entries(params).map(([k, v]) => (
                    <div key={k}>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">{k}</label>
                      <input
                        type="number"
                        className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#F28C28] focus:ring-2 focus:ring-[#F28C28]/10 transition-all"
                        value={v}
                        onChange={e => setParams({ ...params, [k]: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                  ))
                )}
              </div>

              {evalResult !== null && (
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="p-4 bg-[#009B9E]/5 border border-[#009B9E]/10 rounded-xl">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Emissions</p>
                    <p className="text-lg font-black text-[#009B9E] mt-0.5">
                      {evalResult.emission.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </p>
                    <p className="text-[10px] text-gray-400 font-semibold">tCO₂e</p>
                  </div>
                  <div className="p-4 bg-[#005A8C]/5 border border-[#005A8C]/10 rounded-xl">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Activity</p>
                    <p className="text-lg font-black text-[#005A8C] mt-0.5">
                      {evalResult.activity != null ? evalResult.activity.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
                    </p>
                    <p className="text-[10px] text-gray-400 font-semibold">output units</p>
                  </div>
                  <div className="p-4 bg-[#F28C28]/5 border border-[#F28C28]/10 rounded-xl">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Intensity</p>
                    <p className="text-lg font-black text-[#F28C28] mt-0.5">
                      {evalResult.activity != null && evalResult.activity !== 0
                        ? (evalResult.emission / evalResult.activity).toFixed(4)
                        : "—"}
                    </p>
                    <p className="text-[10px] text-gray-400 font-semibold">tCO₂e / unit</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={evaluate}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-[#F28C28] text-white font-bold rounded-2xl hover:bg-[#d4741a] transition-all cursor-pointer"
                >
                  <FlaskConical size={16} />
                  Evaluate
                </button>
                <button
                  onClick={() => setShowEval(null)}
                  className="px-6 py-3.5 text-gray-500 font-bold rounded-2xl hover:bg-gray-100 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AuthGuard>
  );
}
