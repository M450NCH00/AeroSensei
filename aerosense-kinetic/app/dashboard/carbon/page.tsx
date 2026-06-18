"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Leaf, TrendingUp, TrendingDown, ArrowLeftRight, Plus, X,
  ShoppingCart, Clock, Building2, FileText, BarChart3,
} from "lucide-react";
import axiosInstance from "../../api/axiosInstance";

interface EmissionReportResponse {
  id: number;
  companyId: number;
  companyName: string | null;
  sectorName: string | null;
  year: number;
  reportType: "MIDYEAR" | "FINAL";
  activityLevel: number;
  verifiedEmissions: number;
  parameters: Record<string, number> | null;
  submittedAt: string;
}

interface SectorInfo {
  id: number;
  name: string;
  formula?: string;
  activityFormula?: string;
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

interface OrderBookEntry {
  type: "sell" | "buy";
  pricePerCredit: number;
  totalCredits: number;
}

interface Listing {
  id: number;
  type: "sell" | "buy";
  sellerEmail: string | null;
  buyerEmail: string | null;
  creditsAmount: number;
  remainingCredits: number;
  pricePerCredit: number;
  totalPrice: number;
  status: string;
  createdAt: string;
}

interface Transaction {
  id: number;
  orderType: "buy" | "sell";
  amount: number;
  pricePerCredit: number;
  totalPrice: number;
  createdAt: string;
}

interface GovTransaction {
  id: number;
  sellerEmail: string;
  buyerEmail: string;
  amount: number;
  pricePerCredit: number;
  totalPrice: number;
  createdAt: string;
}

interface Balance {
  companyId: number;
  carbonCredits: number;
}

interface OhlcCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string;
}

export default function CarbonMarketPage() {
  const [userRole, setUserRole] = useState<string | null>(null);

  // Company state
  const [listings, setListings] = useState<OrderBookEntry[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [buyRequests, setBuyRequests] = useState<OrderBookEntry[]>([]);
  const [myBuyRequests, setMyBuyRequests] = useState<Listing[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);

  // Government state
  const [govTransactions, setGovTransactions] = useState<GovTransaction[]>([]);

  const [ohlcData, setOhlcData] = useState<OhlcCandle[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [range, setRange] = useState("1M");
  const [activeTab, setActiveTab] = useState<"market" | "activity" | "emission">("market");

  // Anchored to the latest compliance year with seeded data (2025 demo year;
  // 2022-2024 are settled history). The year dropdown shows 2022-2025.
  const currentYear = 2025;

  // Emission report state (company only)
  const [reportYear, setReportYear] = useState<number>(currentYear);
  const [reportType, setReportType] = useState<"MIDYEAR" | "FINAL">("FINAL");
  const [reportActivityLevel, setReportActivityLevel] = useState("");
  const [reportVerifiedEmissions, setReportVerifiedEmissions] = useState("");
  const [mySector, setMySector] = useState<SectorInfo | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [position, setPosition] = useState<CompliancePosition | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSubmitError, setReportSubmitError] = useState<string | null>(null);
  const [reportSubmitSuccess, setReportSubmitSuccess] = useState<string | null>(null);
  const [myReports, setMyReports] = useState<EmissionReportResponse[]>([]);
  const [myAllocations, setMyAllocations] = useState<AllocationResponse[]>([]);
  const [loadingReportData, setLoadingReportData] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [sellAmount, setSellAmount] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [buyBidPrice, setBuyBidPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGovernment = userRole === "Government";

  useEffect(() => {
    axiosInstance.get("/auth/me")
      .then((res: { data: { email: string; role: string } }) => setUserRole(res.data.role))
      .catch(() => {});
  }, []);

  const fetchAll = useCallback(async () => {
    if (userRole === null) return;

    const sharedFetches = [
      axiosInstance.get("/carbon/listings"),
      axiosInstance.get("/carbon/buy-requests"),
      axiosInstance.get(`/carbon/ohlc?range=${range}`),
    ];

    if (isGovernment) {
      const [listingsRes, buyRequestsRes, ohlcRes, govTxRes] =
        await Promise.allSettled([
          ...sharedFetches,
          axiosInstance.get("/carbon/gov/transactions"),
        ]);

      if (listingsRes.status === "fulfilled") setListings(listingsRes.value.data);
      else setError("Failed to load market data.");
      if (buyRequestsRes.status === "fulfilled") setBuyRequests(buyRequestsRes.value.data);
      if (ohlcRes.status === "fulfilled") setOhlcData(ohlcRes.value.data ?? []);
      if (govTxRes.status === "fulfilled") setGovTransactions(govTxRes.value.data);
    } else {
      const [listingsRes, buyRequestsRes, ohlcRes, myListingsRes, myBuyRequestsRes, txRes, balanceRes] =
        await Promise.allSettled([
          ...sharedFetches,
          axiosInstance.get("/carbon/my-listings"),
          axiosInstance.get("/carbon/my-buy-requests"),
          axiosInstance.get("/carbon/transactions"),
          axiosInstance.get("/carbon/balance"),
        ]);

      if (listingsRes.status === "fulfilled") setListings(listingsRes.value.data);
      else setError("Failed to load market data.");
      if (buyRequestsRes.status === "fulfilled") setBuyRequests(buyRequestsRes.value.data);
      if (ohlcRes.status === "fulfilled") setOhlcData(ohlcRes.value.data ?? []);
      if (myListingsRes.status === "fulfilled") setMyListings(myListingsRes.value.data);
      if (myBuyRequestsRes.status === "fulfilled") setMyBuyRequests(myBuyRequestsRes.value.data);
      if (txRes.status === "fulfilled") setTransactions(txRes.value.data);
      if (balanceRes.status === "fulfilled") setBalance(balanceRes.value.data);
    }
  }, [range, userRole, isGovernment]);

  useEffect(() => {
    if (userRole === null) return;
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, [fetchAll, userRole]);

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await axiosInstance.post("/carbon/listings", {
        creditsAmount: parseFloat(sellAmount),
        pricePerCredit: parseFloat(sellPrice),
      });
      setShowSellModal(false);
      setSellAmount("");
      setSellPrice("");
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data || "Failed to create listing.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateBuyRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await axiosInstance.post("/carbon/buy-requests", {
        creditsAmount: parseFloat(buyAmount),
        pricePerCredit: parseFloat(buyBidPrice),
      });
      setShowBuyModal(false);
      setBuyAmount("");
      setBuyBidPrice("");
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data || "Failed to place buy request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchEmissionData = useCallback(async () => {
    if (isGovernment || userRole === null) return;
    setLoadingReportData(true);
    try {
      const [reportsRes, allocsRes, sectorRes] = await Promise.allSettled([
        axiosInstance.get<EmissionReportResponse[]>("/allocations/report/my"),
        axiosInstance.get<AllocationResponse[]>("/allocations/my"),
        axiosInstance.get<SectorInfo>("/sectors/my"),
      ]);
      if (reportsRes.status === "fulfilled") setMyReports(reportsRes.value.data ?? []);
      if (allocsRes.status === "fulfilled") setMyAllocations(allocsRes.value.data ?? []);
      // /sectors/my returns 204 (empty) when the company has no sector assigned.
      if (sectorRes.status === "fulfilled") {
        const s = sectorRes.value.data as SectorInfo | "" | null;
        setMySector(s && (s as SectorInfo).id ? (s as SectorInfo) : null);
      }
    } catch {
      // non-fatal
    } finally {
      setLoadingReportData(false);
    }
  }, [isGovernment, userRole]);

  // Variables required by the company's sector formulas (union of {placeholders}).
  const requiredVars = useMemo(() => {
    const set = new Set<string>();
    const re = /\{([^}]+)\}/g;
    for (const f of [mySector?.formula, mySector?.activityFormula]) {
      if (!f) continue;
      let m;
      while ((m = re.exec(f)) !== null) set.add(m[1]);
    }
    return Array.from(set);
  }, [mySector]);

  useEffect(() => {
    if (activeTab === "emission" && !isGovernment) {
      fetchEmissionData();
    }
  }, [activeTab, fetchEmissionData, isGovernment]);

  // Compliance position + cycle phase for the selected reporting year.
  const fetchPosition = useCallback(async (year: number) => {
    if (isGovernment || userRole === null) return;
    try {
      const resp = await axiosInstance.get<CompliancePosition>(`/allocations/position/${year}`);
      setPosition(resp.data);
      // Default the report type to whichever window is currently open.
      if (resp.data.phase === "MIDYEAR_OPEN") setReportType("MIDYEAR");
      else if (resp.data.phase === "FINAL_OPEN") setReportType("FINAL");
    } catch {
      setPosition(null);
    }
  }, [isGovernment, userRole]);

  useEffect(() => {
    if (activeTab === "emission" && !isGovernment) {
      fetchPosition(reportYear);
    }
  }, [activeTab, reportYear, fetchPosition, isGovernment]);

  // Pre-fill form when the selected year+type matches an existing report
  useEffect(() => {
    const existing = myReports.find(r => r.year === reportYear && r.reportType === reportType);
    if (existing) {
      setReportActivityLevel(String(existing.activityLevel));
      setReportVerifiedEmissions(String(existing.verifiedEmissions));
      // Restore the raw per-variable inputs when available.
      if (existing.parameters) {
        const pv: Record<string, string> = {};
        Object.entries(existing.parameters).forEach(([k, v]) => { pv[k] = String(v); });
        setParamValues(pv);
      } else {
        setParamValues({});
      }
    } else {
      setReportActivityLevel("");
      setReportVerifiedEmissions("");
      setParamValues({});
    }
  }, [reportYear, reportType, myReports]);

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReport(true);
    setReportSubmitError(null);
    setReportSubmitSuccess(null);
    try {
      // With a sector, submit the raw input variables and let the server compute
      // emissions + activity from the sector formulas; otherwise send the totals.
      const payload: Record<string, unknown> = { year: reportYear, reportType };
      if (mySector) {
        const parameters: Record<string, number> = {};
        requiredVars.forEach(v => { parameters[v] = parseFloat(paramValues[v] ?? "") || 0; });
        payload.parameters = parameters;
      } else {
        payload.activityLevel = parseFloat(reportActivityLevel);
        payload.verifiedEmissions = parseFloat(reportVerifiedEmissions);
      }
      const resp = await axiosInstance.post<EmissionReportResponse>("/allocations/report", payload);
      const r = resp.data;
      const label = reportType === "MIDYEAR" ? "Mid-year" : "Final";
      setReportSubmitSuccess(
        mySector
          ? `${label} report for ${reportYear} submitted — emissions ${Number(r.verifiedEmissions).toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e over ${Number(r.activityLevel).toLocaleString(undefined, { maximumFractionDigits: 1 })} output.`
          : `${label} report for ${reportYear} submitted successfully.`
      );
      await Promise.all([fetchEmissionData(), fetchPosition(reportYear)]);
    } catch (err: any) {
      setReportSubmitError(err.response?.data?.message ?? err.response?.data ?? "Failed to submit report.");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await axiosInstance.delete(`/carbon/listings/${id}`);
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data || "Failed to cancel.");
    }
  };

  const totalSellVolume = listings.reduce((sum, l) => sum + l.totalCredits, 0);
  const totalBuyVolume = buyRequests.reduce((sum, r) => sum + r.totalCredits, 0);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const currentPrice = ohlcData.length > 0 ? ohlcData[ohlcData.length - 1].close : null;
  const firstOpen = ohlcData.length > 0 ? ohlcData[0].open : null;
  const priceChange = currentPrice != null && firstOpen != null ? +(currentPrice - firstOpen).toFixed(2) : null;
  const priceChangePct = priceChange != null && firstOpen ? +((priceChange / firstOpen) * 100).toFixed(2) : null;
  const totalTradeVolume = ohlcData.reduce((sum: number, c: OhlcCandle) => sum + c.volume, 0);
  const allHighs = ohlcData.map((c: OhlcCandle) => c.high);
  const allLows  = ohlcData.map((c: OhlcCandle) => c.low);
  const highAll  = allHighs.length > 0 ? Math.max(...allHighs) : null;
  const lowAll   = allLows.length  > 0 ? Math.min(...allLows)  : null;

  const CW = 800, CH = 220;
  const PAD_L = 10, PAD_R = 64, PAD_T = 20, PAD_B = 34;
  const BORDER_PAD = 24;
  const chartW = CW - PAD_L - PAD_R;
  const chartH = CH - PAD_T - PAD_B;
  const innerW = chartW - 2 * BORDER_PAD;
  const rawMin = allLows.length  > 0 ? Math.min(...allLows)  : 0;
  const rawMax = allHighs.length > 0 ? Math.max(...allHighs) : 1;
  const yPad = (rawMax - rawMin) * 0.15 || 0.5;
  const yMin = rawMin - yPad;
  const yMax = rawMax + yPad;
  const n = ohlcData.length;
  const cx = (i: number) => PAD_L + BORDER_PAD + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const cy = (price: number) => PAD_T + ((yMax - price) / (yMax - yMin)) * chartH;
  const spacing = n > 1 ? innerW / (n - 1) : innerW;
  const candleW = Math.max(2, Math.min(20, spacing * 0.75));
  const gridPrices = Array.from({ length: 5 }, (_: unknown, i: number) =>
    parseFloat((yMin + (i / 4) * (yMax - yMin)).toFixed(2))
  );
  const labelEvery = Math.max(1, Math.ceil(n / 7));

  const formatChartDate = (iso: string) => {
    const d = new Date(iso);
    if (range === "1D") return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (range === "5D") return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    if (range === "3Y") return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  return (
    <div className="p-8 min-h-screen bg-[#F8FAFC] flex flex-col gap-6 select-none">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#005A8C] tracking-tight flex items-center gap-2">
            <Leaf size={22} className="text-[#009B9E]" />
            Carbon Market
          </h1>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
            {isGovernment ? "Government Oversight Dashboard" : "Carbon Credit Trading Platform"}
          </p>
        </div>
        {!isGovernment && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBuyModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-[#F28C28] text-white text-sm font-bold rounded-2xl hover:bg-[#d4741a] transition-all shadow-sm hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
            >
              <ShoppingCart size={16} />
              Buy Request
            </button>
            <button
              onClick={() => setShowSellModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-[#009B9E] text-white text-sm font-bold rounded-2xl hover:bg-[#007d80] transition-all shadow-sm hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
            >
              <Plus size={16} />
              Sell Credits
            </button>
          </div>
        )}
        {isGovernment && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[#005A8C]/10 border border-[#005A8C]/20 rounded-2xl">
            <Building2 size={14} className="text-[#005A8C]" />
            <span className="text-xs font-bold text-[#005A8C] uppercase tracking-wider">Government</span>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm font-bold text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={16} /></button>
        </div>
      )}

      {/* Market Price Chart Hero */}
      <div className="bg-white border border-gray-200/60 rounded-[2rem] shadow-sm overflow-hidden">
        <div className="px-7 pt-6 pb-3 flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp size={10} className="text-[#009B9E]" />
              Carbon Credit · Market Price
            </p>
            <div className="flex items-end gap-4 mt-2">
              <p className="text-5xl font-black text-gray-900 tracking-tight tabular-nums">
                {hoveredIndex != null
                  ? `$${ohlcData[hoveredIndex].close.toFixed(2)}`
                  : currentPrice != null
                  ? `$${currentPrice.toFixed(2)}`
                  : "—"}
              </p>
              {priceChange != null && priceChangePct != null && hoveredIndex == null && (
                <div className={`flex items-center gap-1.5 mb-2 text-sm font-bold ${priceChange >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {priceChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span>{priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}</span>
                  <span className="text-xs font-semibold opacity-75">
                    ({priceChange >= 0 ? "+" : ""}{priceChangePct.toFixed(2)}%)
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 font-semibold mt-1">
              {hoveredIndex != null
                ? formatChartDate(ohlcData[hoveredIndex].timestamp)
                : "per tCO₂e · carbon credit"}
            </p>
          </div>
          <div className="flex gap-8 text-right">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">High</p>
              <p className="text-base font-black text-emerald-500 mt-0.5">
                {highAll != null ? `$${highAll.toFixed(2)}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Low</p>
              <p className="text-base font-black text-red-500 mt-0.5">
                {lowAll != null ? `$${lowAll.toFixed(2)}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Volume</p>
              <p className="text-base font-black text-gray-700 mt-0.5">{totalTradeVolume.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400 font-semibold">tCO₂e</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Trades</p>
              <p className="text-base font-black text-gray-700 mt-0.5">{ohlcData.length}</p>
            </div>
          </div>
        </div>

        <div className="px-7 pb-2 flex items-center justify-between">
          <div className="flex gap-1">
            {(["1D", "5D", "1M", "1Y", "3Y"] as const).map((r) => (
              <button
                key={r}
                onClick={() => { setRange(r); setHoveredIndex(null); }}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  range === r
                    ? "bg-[#005A8C] text-white"
                    : "text-gray-400 hover:text-[#005A8C] hover:bg-gray-50"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {hoveredIndex != null && (() => {
            const c = ohlcData[hoveredIndex];
            const isGreen = c.close >= c.open;
            return (
              <div className="flex gap-3 text-xs font-mono text-gray-500">
                <span>O <span className="text-gray-800 font-bold">${c.open.toFixed(2)}</span></span>
                <span>H <span className="text-emerald-500 font-bold">${c.high.toFixed(2)}</span></span>
                <span>L <span className="text-red-500 font-bold">${c.low.toFixed(2)}</span></span>
                <span>C <span className={`font-bold ${isGreen ? "text-emerald-500" : "text-red-500"}`}>${c.close.toFixed(2)}</span></span>
                <span>Vol <span className="text-gray-700 font-bold">{c.volume.toLocaleString()}</span></span>
              </div>
            );
          })()}
        </div>

        {ohlcData.length === 0 ? (
          <div className="h-44 flex items-center justify-center border-t border-gray-50">
            <p className="text-sm font-bold text-gray-300">No trade history for this range</p>
          </div>
        ) : (
          <div className="relative" onMouseLeave={() => setHoveredIndex(null)}>
            <svg
              viewBox={`0 0 ${CW} ${CH}`}
              className="w-full block"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const svgX = ((e.clientX - rect.left) / rect.width) * CW;
                let nearest = 0, minDist = Infinity;
                ohlcData.forEach((_: OhlcCandle, i: number) => {
                  const d = Math.abs(cx(i) - svgX);
                  if (d < minDist) { minDist = d; nearest = i; }
                });
                setHoveredIndex(nearest);
              }}
            >
              {gridPrices.map((price: number, i: number) => (
                <g key={i}>
                  <line x1={PAD_L} y1={cy(price)} x2={PAD_L + chartW} y2={cy(price)} stroke="#f3f4f6" strokeWidth="1" />
                  <text x={PAD_L + chartW + 6} y={cy(price) + 4} fontSize="10" fill="#9ca3af" fontWeight="600" fontFamily="system-ui">
                    ${price.toFixed(2)}
                  </text>
                </g>
              ))}

              {currentPrice != null && (
                <>
                  <line
                    x1={PAD_L} y1={cy(currentPrice)} x2={PAD_L + chartW} y2={cy(currentPrice)}
                    stroke="#005A8C" strokeWidth="1" strokeDasharray="4 3" opacity="0.35"
                  />
                  <rect x={PAD_L + chartW + 2} y={cy(currentPrice) - 9} width={58} height={18} rx="4" fill="#005A8C" />
                  <text x={PAD_L + chartW + 31} y={cy(currentPrice) + 4} textAnchor="middle" fontSize="10" fill="white" fontWeight="700" fontFamily="system-ui">
                    ${currentPrice.toFixed(2)}
                  </text>
                </>
              )}

              {hoveredIndex != null && range !== "1D" && (
                <rect
                  x={cx(hoveredIndex) - candleW / 2 - 4} y={PAD_T}
                  width={candleW + 8} height={chartH}
                  fill="#005A8C" opacity="0.06" rx="3"
                />
              )}

              {range === "1D" ? (
                <>
                  <defs>
                    <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#009B9E" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#009B9E" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={[
                      `M ${cx(0)} ${cy(ohlcData[0].close)}`,
                      ...ohlcData.slice(1).map((c: OhlcCandle, i: number) => `L ${cx(i + 1)} ${cy(c.close)}`),
                      `L ${cx(n - 1)} ${PAD_T + chartH}`,
                      `L ${cx(0)} ${PAD_T + chartH}`,
                      "Z",
                    ].join(" ")}
                    fill="url(#lineAreaGrad)"
                  />
                  <path
                    d={ohlcData.map((c: OhlcCandle, i: number) => `${i === 0 ? "M" : "L"} ${cx(i)} ${cy(c.close)}`).join(" ")}
                    fill="none" stroke="#009B9E" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
                  />
                  {ohlcData.map((c: OhlcCandle, i: number) => (
                    <circle
                      key={i} cx={cx(i)} cy={cy(c.close)}
                      r={hoveredIndex === i ? 5 : 3}
                      fill={hoveredIndex === i ? "#005A8C" : "#009B9E"}
                      stroke="white" strokeWidth="1.5"
                      opacity={hoveredIndex != null && hoveredIndex !== i ? 0.45 : 1}
                    />
                  ))}
                </>
              ) : (
                ohlcData.map((c: OhlcCandle, i: number) => {
                  const isGreen = c.close >= c.open;
                  const color = isGreen ? "#22c55e" : "#ef4444";
                  const bodyTop = cy(Math.max(c.open, c.close));
                  const bodyBot = cy(Math.min(c.open, c.close));
                  const bodyH = Math.max(1.5, bodyBot - bodyTop);
                  const x = cx(i);
                  return (
                    <g key={i} opacity={hoveredIndex != null && hoveredIndex !== i ? 0.45 : 1}>
                      <line x1={x} y1={cy(c.high)} x2={x} y2={cy(c.low)} stroke={color} strokeWidth="1.5" />
                      <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={color} rx="1.5" />
                    </g>
                  );
                })
              )}

              {hoveredIndex != null && (
                <line
                  x1={cx(hoveredIndex)} y1={PAD_T} x2={cx(hoveredIndex)} y2={PAD_T + chartH}
                  stroke="#6b7280" strokeWidth="1" strokeDasharray="4 3" opacity="0.3"
                />
              )}

              {ohlcData.map((c: OhlcCandle, i: number) => {
                if (i % labelEvery !== 0 && i !== n - 1) return null;
                return (
                  <text key={i} x={cx(i)} y={CH - 8} textAnchor="middle" fontSize="10" fill="#9ca3af" fontWeight="600" fontFamily="system-ui">
                    {formatChartDate(c.timestamp)}
                  </text>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {isGovernment ? (
          <>
            <div className="bg-white border border-gray-200/60 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sell Orders</p>
              <p className="text-2xl font-black text-[#009B9E] mt-1">{listings.length}</p>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">{totalSellVolume.toLocaleString()} tCO₂e available</p>
            </div>
            <div className="bg-white border border-gray-200/60 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Open Buy Requests</p>
              <p className="text-2xl font-black text-[#F28C28] mt-1">{buyRequests.length}</p>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">{totalBuyVolume.toLocaleString()} tCO₂e wanted</p>
            </div>
            <div className="bg-white border border-gray-200/60 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Transactions</p>
              <p className="text-2xl font-black text-gray-700 mt-1">{govTransactions.length}</p>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">all-time trades</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white border border-gray-200/60 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">My Credit Balance</p>
              <p className="text-2xl font-black text-[#005A8C] mt-1">
                {balance ? balance.carbonCredits.toLocaleString() : "—"}
              </p>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">tCO₂e</p>
            </div>
            <div className="bg-white border border-gray-200/60 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sell Orders</p>
              <p className="text-2xl font-black text-[#009B9E] mt-1">{listings.length}</p>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">{totalSellVolume.toLocaleString()} tCO₂e available</p>
            </div>
            <div className="bg-white border border-gray-200/60 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Open Buy Requests</p>
              <p className="text-2xl font-black text-[#F28C28] mt-1">{buyRequests.length}</p>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">{totalBuyVolume.toLocaleString()} tCO₂e wanted</p>
            </div>
            <div className="bg-white border border-gray-200/60 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">My Transactions</p>
              <p className="text-2xl font-black text-gray-700 mt-1">{transactions.length}</p>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">total trades</p>
            </div>
          </>
        )}
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-2 bg-white border border-gray-200/60 rounded-2xl p-1.5 w-fit shadow-sm">
        {(["market", "activity"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === tab
                ? "bg-[#005A8C] text-white shadow-sm"
                : "text-gray-500 hover:text-[#005A8C]"
            }`}
          >
            {tab === "market" ? "Marketplace" : isGovernment ? "All Transactions" : "My Activity"}
          </button>
        ))}
        {!isGovernment && (
          <button
            onClick={() => setActiveTab("emission")}
            className={`px-5 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === "emission"
                ? "bg-[#005A8C] text-white shadow-sm"
                : "text-gray-500 hover:text-[#005A8C]"
            }`}
          >
            Emission Report
          </button>
        )}
      </div>

      {/* Marketplace Tab */}
      {activeTab === "market" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200/60 rounded-[2rem] overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black text-base text-[#F28C28] flex items-center gap-2">
                <ShoppingCart size={16} />
                Buy Orders
              </h2>
              <span className="text-xs font-bold text-gray-400">{buyRequests.length} open</span>
            </div>
            <div className="px-5 py-2 grid grid-cols-2 border-b border-gray-50">
              <span className="text-[10px] font-bold text-[#F28C28] uppercase tracking-wider">Amount (tCO₂e)</span>
              <span className="text-[10px] font-bold text-[#F28C28] uppercase tracking-wider text-right">Bid Price</span>
            </div>
            {buyRequests.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-bold text-gray-300">No buy orders</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {[...buyRequests]
                  .sort((a, b) => b.pricePerCredit - a.pricePerCredit)
                  .map((req) => (
                    <div
                      key={`buy-${req.pricePerCredit}`}
                      className="px-5 py-3 grid grid-cols-2 items-center hover:bg-amber-50/40 transition-colors"
                    >
                      <span className="text-sm font-black text-[#F28C28]">{req.totalCredits.toLocaleString()}</span>
                      <span className="text-sm font-black text-gray-800 text-right">${req.pricePerCredit.toFixed(2)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200/60 rounded-[2rem] overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black text-base text-[#009B9E] flex items-center gap-2">
                <Leaf size={16} />
                Sell Orders
              </h2>
              <span className="text-xs font-bold text-gray-400">{listings.length} active</span>
            </div>
            <div className="px-5 py-2 grid grid-cols-2 border-b border-gray-50">
              <span className="text-[10px] font-bold text-[#009B9E] uppercase tracking-wider">Amount (tCO₂e)</span>
              <span className="text-[10px] font-bold text-[#009B9E] uppercase tracking-wider text-right">Ask Price</span>
            </div>
            {listings.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-bold text-gray-300">No sell orders</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {[...listings]
                  .sort((a, b) => a.pricePerCredit - b.pricePerCredit)
                  .map((listing) => (
                    <div
                      key={`sell-${listing.pricePerCredit}`}
                      className="px-5 py-3 grid grid-cols-2 items-center hover:bg-emerald-50/40 transition-colors"
                    >
                      <span className="text-sm font-black text-[#009B9E]">{listing.totalCredits.toLocaleString()}</span>
                      <span className="text-sm font-black text-gray-800 text-right">${listing.pricePerCredit.toFixed(2)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activity Tab — Government: all transactions / Company: my activity */}
      {activeTab === "activity" && (
        isGovernment ? (
          <div>
            <h2 className="font-black text-base text-gray-800 mb-3 flex items-center gap-2">
              <ArrowLeftRight size={16} className="text-[#005A8C]" />
              All Transactions
            </h2>
            {govTransactions.length === 0 ? (
              <div className="bg-white border border-gray-200/60 rounded-2xl p-8 text-center text-sm font-bold text-gray-400 shadow-sm">
                No transactions recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {govTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-white border border-gray-200/60 rounded-2xl p-4 shadow-sm flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-xl bg-[#005A8C]/10 flex items-center justify-center">
                        <ArrowLeftRight size={14} className="text-[#005A8C]" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-800">
                          {tx.amount.toLocaleString()} tCO₂e
                        </p>
                        <p className="text-xs text-gray-500 font-semibold mt-0.5">
                          <span className="text-[#009B9E]">{tx.sellerEmail}</span>
                          <span className="text-gray-300 mx-1.5">→</span>
                          <span className="text-[#F28C28]">{tx.buyerEmail}</span>
                        </p>
                        <p className="text-[10px] text-gray-400 font-semibold flex items-center gap-1 mt-0.5">
                          <Clock size={10} />
                          {formatDate(tx.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-gray-700">${tx.totalPrice.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                        ${tx.pricePerCredit.toFixed(2)}/credit
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* My Active Sell Listings */}
            <div>
              <h2 className="font-black text-base text-gray-800 mb-3 flex items-center gap-2">
                <TrendingUp size={16} className="text-[#009B9E]" />
                My Active Sell Listings
              </h2>
              {myListings.length === 0 ? (
                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 text-center text-sm font-bold text-gray-400 shadow-sm">
                  No active sell listings. Click "Sell Credits" to create one.
                </div>
              ) : (
                <div className="space-y-3">
                  {myListings.map((listing) => (
                    <div
                      key={listing.id}
                      className="bg-white border border-gray-200/60 rounded-2xl p-4 shadow-sm flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-xl bg-[#009B9E]/10 flex items-center justify-center">
                          <Leaf size={16} className="text-[#009B9E]" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-800">
                            {listing.remainingCredits.toLocaleString()} tCO₂e
                            <span className="text-xs font-normal text-gray-400 ml-2">
                              @ ${listing.pricePerCredit}/credit
                            </span>
                          </p>
                          <p className="text-xs text-gray-400 font-semibold mt-0.5">
                            Listed {formatDate(listing.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-black text-[#F28C28]">${listing.totalPrice.toLocaleString()}</p>
                        {(listing.status === "pending_matching" || listing.status === "active") && (
                          <button
                            onClick={() => handleCancel(listing.id)}
                            className="w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
                          >
                            <X size={13} className="text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* My Buy Requests */}
            <div>
              <h2 className="font-black text-base text-gray-800 mb-3 flex items-center gap-2">
                <ShoppingCart size={16} className="text-[#F28C28]" />
                My Buy Requests
              </h2>
              {myBuyRequests.length === 0 ? (
                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 text-center text-sm font-bold text-gray-400 shadow-sm">
                  No buy requests yet. Click "Buy Request" to place one.
                </div>
              ) : (
                <div className="space-y-3">
                  {myBuyRequests.map((req) => (
                    <div
                      key={req.id}
                      className="bg-white border border-gray-200/60 rounded-2xl p-4 shadow-sm flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-xl bg-[#F28C28]/10 flex items-center justify-center">
                          <ShoppingCart size={16} className="text-[#F28C28]" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-800">
                            {req.creditsAmount.toLocaleString()} tCO₂e
                            <span className="text-xs font-normal text-gray-400 ml-2">
                              @ bid ${req.pricePerCredit}/credit
                            </span>
                          </p>
                          <p className="text-xs text-gray-400 font-semibold mt-0.5">
                            {req.remainingCredits > 0
                              ? `${req.remainingCredits.toLocaleString()} tCO₂e unfilled`
                              : "Fully filled"}{" "}
                            · Placed {formatDate(req.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                            req.status === "filled"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : req.status === "cancelled"
                              ? "bg-red-50 text-red-700 border-red-100"
                              : "bg-amber-50 text-amber-700 border-amber-100"
                          }`}
                        >
                          {req.status.toUpperCase()}
                        </span>
                        {(req.status === "pending_matching" || req.status === "active") && (
                          <button
                            onClick={() => handleCancel(req.id)}
                            className="w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
                          >
                            <X size={13} className="text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Transaction History */}
            <div>
              <h2 className="font-black text-base text-gray-800 mb-3 flex items-center gap-2">
                <ArrowLeftRight size={16} className="text-[#005A8C]" />
                Transaction History
              </h2>
              {transactions.length === 0 ? (
                <div className="bg-white border border-gray-200/60 rounded-2xl p-8 text-center text-sm font-bold text-gray-400 shadow-sm">
                  No transactions yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="bg-white border border-gray-200/60 rounded-2xl p-4 shadow-sm flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tx.orderType === "buy" ? "bg-[#F28C28]/10" : "bg-[#009B9E]/10"}`}>
                          {tx.orderType === "buy"
                            ? <ShoppingCart size={14} className="text-[#F28C28]" />
                            : <TrendingUp size={14} className="text-[#009B9E]" />}
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-800">
                            <span className={`mr-2 text-xs font-extrabold uppercase ${tx.orderType === "buy" ? "text-[#F28C28]" : "text-[#009B9E]"}`}>
                              {tx.orderType}
                            </span>
                            {tx.amount.toLocaleString()} tCO₂e
                          </p>
                          <p className="text-[10px] text-gray-400 font-semibold flex items-center gap-1 mt-0.5">
                            <Clock size={10} />
                            {formatDate(tx.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-gray-700">${tx.totalPrice.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                          ${tx.pricePerCredit.toFixed(2)}/credit
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* Emission Report Tab — Company only */}
      {activeTab === "emission" && !isGovernment && (
        <div className="flex flex-col gap-6">
          {/* Submit Report Card */}
          <div className="bg-white border border-gray-200/60 rounded-[2rem] shadow-sm overflow-hidden">
            <div className="px-7 py-5 border-b border-gray-100 flex items-center gap-3">
              <FileText size={18} className="text-[#005A8C]" />
              <div>
                <h2 className="font-black text-base text-[#005A8C]">Submit Emission Report</h2>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                  Annual verified emissions for China ETS allocation
                </p>
              </div>
            </div>
            <div className="p-7">
              {reportSubmitError && (
                <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm font-bold text-red-700 flex justify-between items-center">
                  <span>{reportSubmitError}</span>
                  <button onClick={() => setReportSubmitError(null)} className="cursor-pointer"><X size={16} /></button>
                </div>
              )}
              {reportSubmitSuccess && (
                <div className="mb-5 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-sm font-bold text-emerald-700 flex justify-between items-center">
                  <span>{reportSubmitSuccess}</span>
                  <button onClick={() => setReportSubmitSuccess(null)} className="cursor-pointer"><X size={16} /></button>
                </div>
              )}
              <form onSubmit={handleSubmitReport} className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Reporting Year
                  </label>
                  <select
                    value={reportYear}
                    onChange={(e) => setReportYear(Number(e.target.value))}
                    className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all bg-white cursor-pointer"
                  >
                    {[0, 1, 2, 3].map((offset) => {
                      const y = currentYear - offset;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                  {myReports.find(r => r.year === reportYear && r.reportType === reportType) && (
                    <p className="text-[10px] font-bold text-[#F28C28] mt-1.5">
                      Existing {reportType === "MIDYEAR" ? "mid-year" : "final"} report found for {reportYear} — submitting will update it.
                    </p>
                  )}
                </div>

                {/* Report type — gated by the current compliance phase */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Report Type
                  </label>
                  <div className="flex gap-2">
                    {(["MIDYEAR", "FINAL"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setReportType(t)}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-xl border transition-all cursor-pointer ${
                          reportType === t
                            ? "bg-[#005A8C] text-white border-[#005A8C]"
                            : "bg-white text-gray-500 border-gray-200 hover:border-[#005A8C]/40"
                        }`}
                      >
                        {t === "MIDYEAR" ? "Mid-year (MRV)" : "Final (full year)"}
                      </button>
                    ))}
                  </div>
                  {position && (
                    <p className="text-[10px] font-bold mt-1.5 text-gray-400">
                      Cycle phase for {reportYear}: <span className="font-black text-gray-600">{position.phase}</span>
                      {position.phase === "MIDYEAR_OPEN" && " — mid-year reporting is open."}
                      {position.phase === "FINAL_OPEN" && " — final reporting is open."}
                      {position.phase !== "MIDYEAR_OPEN" && position.phase !== "FINAL_OPEN" &&
                        " — reporting is currently closed; submission will be rejected."}
                    </p>
                  )}
                  {reportType === "MIDYEAR" && (
                    <p className="text-[10px] font-semibold text-gray-400 mt-1">
                      Mid-year reports are informational (MRV) and do not change your credit balance.
                    </p>
                  )}
                </div>
                {mySector ? (
                  <>
                    <div className="p-3 bg-[#009B9E]/5 border border-[#009B9E]/10 rounded-xl">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sector</p>
                      <p className="text-sm font-black text-[#009B9E]">{mySector.name}</p>
                      <p className="text-[10px] font-semibold text-gray-400 mt-1">
                        Enter your activity data — emissions and activity level are computed from your sector formulas on submit.
                      </p>
                    </div>
                    {requiredVars.length === 0 ? (
                      <p className="text-sm font-semibold text-gray-400">Your sector has no formula variables defined.</p>
                    ) : (
                      requiredVars.map((v) => (
                        <div key={v}>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                            {v.replace(/_/g, " ")}
                          </label>
                          <input
                            type="number" min="0" step="0.0001" required
                            value={paramValues[v] ?? ""}
                            onChange={(e) => setParamValues({ ...paramValues, [v]: e.target.value })}
                            placeholder="0"
                            className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all"
                          />
                        </div>
                      ))
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                        Activity Level
                      </label>
                      <input
                        type="number" min="0.0001" step="0.0001" required
                        value={reportActivityLevel}
                        onChange={(e) => setReportActivityLevel(e.target.value)}
                        placeholder="e.g. 50000"
                        className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all"
                      />
                      <p className="text-[10px] font-semibold text-gray-400 mt-1">
                        Production output in your sector&apos;s unit. Assign a sector to report by formula variables instead.
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                        Verified Emissions (tCO₂e)
                      </label>
                      <input
                        type="number" min="0.0001" step="0.0001" required
                        value={reportVerifiedEmissions}
                        onChange={(e) => setReportVerifiedEmissions(e.target.value)}
                        placeholder="e.g. 12500.00"
                        className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all"
                      />
                    </div>
                    {reportActivityLevel && reportVerifiedEmissions && (
                      <div className="p-4 bg-[#005A8C]/5 border border-[#005A8C]/10 rounded-xl">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Implied Intensity
                        </p>
                        <p className="text-xl font-black text-[#005A8C] mt-0.5">
                          {(parseFloat(reportVerifiedEmissions) / parseFloat(reportActivityLevel)).toFixed(4)}
                        </p>
                        <p className="text-xs text-gray-400 font-semibold mt-0.5">tCO₂e per unit of output</p>
                      </div>
                    )}
                  </>
                )}
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="w-full py-3.5 bg-[#005A8C] text-white font-bold rounded-2xl hover:bg-[#004a73] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingReport ? "Submitting..." : `Submit ${reportYear} ${reportType === "MIDYEAR" ? "Mid-year" : "Final"} Report`}
                </button>
              </form>
            </div>
          </div>

          {/* Compliance Position */}
          <div className="bg-white border border-gray-200/60 rounded-[2rem] shadow-sm overflow-hidden">
            <div className="px-7 py-5 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Leaf size={18} className="text-[#009B9E]" />
                <div>
                  <h2 className="font-black text-base text-[#009B9E]">Compliance Position — {reportYear}</h2>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                    Allowances vs. verified emissions
                  </p>
                </div>
              </div>
              {position?.status && (
                <span className="text-[10px] font-extrabold text-gray-500 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full">
                  {position.status}
                </span>
              )}
            </div>
            <div className="p-7">
              {!position ? (
                <p className="text-sm font-bold text-gray-300">No compliance data for {reportYear} yet.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                    <div className="p-4 bg-gray-50/60 border border-gray-100 rounded-2xl">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pre-allocation</p>
                      <p className="text-lg font-black text-gray-800 mt-0.5">
                        {position.preAllocation != null ? Number(position.preAllocation).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50/60 border border-gray-100 rounded-2xl">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Final allocation</p>
                      <p className="text-lg font-black text-[#005A8C] mt-0.5">
                        {position.finalAllocation != null ? Number(position.finalAllocation).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50/60 border border-gray-100 rounded-2xl">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Verified emissions</p>
                      <p className="text-lg font-black text-gray-800 mt-0.5">
                        {position.verifiedEmissions != null ? Number(position.verifiedEmissions).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50/60 border border-gray-100 rounded-2xl">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current balance</p>
                      <p className="text-lg font-black text-gray-800 mt-0.5">
                        {position.totalBalance != null ? Number(position.totalBalance).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
                      </p>
                    </div>
                  </div>

                  {position.surplusDeficit != null && (
                    <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                      Number(position.surplusDeficit) >= 0
                        ? "bg-emerald-50 border-emerald-100"
                        : "bg-red-50 border-red-100"
                    }`}>
                      <div className="flex items-center gap-2">
                        {Number(position.surplusDeficit) >= 0
                          ? <TrendingUp size={18} className="text-emerald-600" />
                          : <TrendingDown size={18} className="text-red-600" />}
                        <span className={`text-sm font-black ${Number(position.surplusDeficit) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                          {Number(position.surplusDeficit) >= 0 ? "Surplus" : "Deficit"}: {Number(position.surplusDeficit) >= 0 ? "+" : ""}
                          {Number(position.surplusDeficit).toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e
                        </span>
                      </div>
                      <span className="text-xs font-bold text-gray-500">
                        {Number(position.surplusDeficit) >= 0
                          ? "Surplus carries forward to next year — or sell it on the market."
                          : "Buy credits to cover the shortfall before settlement."}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* My Allocation History */}
          <div>
            <h2 className="font-black text-base text-gray-800 mb-3 flex items-center gap-2">
              <BarChart3 size={16} className="text-[#009B9E]" />
              My Allocation History
            </h2>
            {loadingReportData ? (
              <div className="bg-white border border-gray-200/60 rounded-2xl p-8 text-center shadow-sm">
                <p className="text-sm font-bold text-gray-400">Loading...</p>
              </div>
            ) : myAllocations.length === 0 ? (
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
                  <span className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Allocated At</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {[...myAllocations].sort((a, b) => b.year - a.year).map((alloc) => {
                    const dev = alloc.deviationPct != null ? Number(alloc.deviationPct) : null;
                    const devColor = dev == null ? "text-gray-300" : dev < 0 ? "text-emerald-600" : dev > 0 ? "text-red-500" : "text-gray-500";
                    return (
                      <div key={alloc.id} className="px-5 py-4 grid grid-cols-12 gap-2 items-center hover:bg-gray-50/50 transition-colors">
                        <span className="col-span-1 text-sm font-black text-gray-800">{alloc.year}</span>
                        <span className="col-span-2 text-sm font-bold text-gray-700 text-right">
                          {alloc.verifiedEmissions != null ? Number(alloc.verifiedEmissions).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
                        </span>
                        <span className="col-span-2 text-sm font-black text-[#009B9E] text-right">
                          {alloc.allocationAmount != null ? Number(alloc.allocationAmount).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
                        </span>
                        <span className="col-span-2 text-sm font-bold text-gray-600 text-right tabular-nums">
                          {alloc.intensity != null ? Number(alloc.intensity).toFixed(4) : "—"}
                        </span>
                        <span className="col-span-2 text-sm font-bold text-gray-600 text-right tabular-nums">
                          {alloc.benchmarkIntensity != null ? Number(alloc.benchmarkIntensity).toFixed(4) : "—"}
                        </span>
                        <span className={`col-span-1 text-sm font-black text-right ${devColor}`}>
                          {dev == null ? "—" : `${dev > 0 ? "+" : ""}${dev.toFixed(2)}%`}
                        </span>
                        <span className="col-span-2 text-[10px] font-semibold text-gray-400 text-right">
                          {alloc.allocatedAt ? new Date(alloc.allocatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sell Credits Modal — Company only */}
      {showSellModal && !isGovernment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-md mx-4 border border-gray-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-black text-[#005A8C]">List Credits for Sale</h2>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                  Balance: {balance ? balance.carbonCredits.toLocaleString() : "—"} tCO₂e
                </p>
              </div>
              <button onClick={() => setShowSellModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleCreateListing} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Credits Amount (tCO₂e)
                </label>
                <input
                  type="number" min="1" step="0.01" required
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Price per Credit (USD)
                </label>
                <input
                  type="number" min="0.01" step="0.01" required
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="e.g. 12.50"
                  className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all"
                />
              </div>
              {sellAmount && sellPrice && (
                <div className="p-4 bg-[#005A8C]/5 border border-[#005A8C]/10 rounded-xl">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Listing Value</p>
                  <p className="text-xl font-black text-[#005A8C] mt-0.5">
                    ${(parseFloat(sellAmount || "0") * parseFloat(sellPrice || "0")).toLocaleString(undefined, {
                      minimumFractionDigits: 2, maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              )}
              <button
                type="submit" disabled={isSubmitting}
                className="w-full py-3.5 bg-[#009B9E] text-white font-bold rounded-2xl hover:bg-[#007d80] transition-all disabled:opacity-50 cursor-pointer mt-2"
              >
                {isSubmitting ? "Creating Listing..." : "List for Sale"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Buy Request Modal — Company only */}
      {showBuyModal && !isGovernment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-md mx-4 border border-gray-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-black text-[#F28C28]">Place Buy Request</h2>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                  Auto-matches cheapest sell orders ≤ your bid price
                </p>
              </div>
              <button onClick={() => setShowBuyModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleCreateBuyRequest} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Credits Wanted (tCO₂e)
                </label>
                <input
                  type="number" min="1" step="0.01" required
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  placeholder="e.g. 300"
                  className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#F28C28] focus:ring-2 focus:ring-[#F28C28]/10 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Bid Price per Credit (USD)
                </label>
                <input
                  type="number" min="0.01" step="0.01" required
                  value={buyBidPrice}
                  onChange={(e) => setBuyBidPrice(e.target.value)}
                  placeholder="e.g. 13.00"
                  className="w-full px-4 py-3 text-sm font-bold border border-gray-200 rounded-xl outline-none focus:border-[#F28C28] focus:ring-2 focus:ring-[#F28C28]/10 transition-all"
                />
              </div>
              {buyAmount && buyBidPrice && (
                <div className="p-4 bg-[#F28C28]/5 border border-[#F28C28]/10 rounded-xl">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Max Total Spend</p>
                  <p className="text-xl font-black text-[#F28C28] mt-0.5">
                    ${(parseFloat(buyAmount || "0") * parseFloat(buyBidPrice || "0")).toLocaleString(undefined, {
                      minimumFractionDigits: 2, maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              )}
              <button
                type="submit" disabled={isSubmitting}
                className="w-full py-3.5 bg-[#F28C28] text-white font-bold rounded-2xl hover:bg-[#d4741a] transition-all disabled:opacity-50 cursor-pointer mt-2"
              >
                {isSubmitting ? "Placing Request..." : "Place Buy Request"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
