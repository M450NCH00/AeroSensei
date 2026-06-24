"use client";

import { useEffect, useState } from "react";
import { Settings, User, Building2, Leaf, BarChart3, Loader2, ShieldCheck, KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import AuthGuard from "@/app/components/AuthGuard";
import axiosInstance from "@/app/api/axiosInstance";

interface Balance {
  companyId: number;
  carbonCredits: number;
}

interface SectorInfo {
  id: number;
  name: string;
  formula?: string;
  activityFormula?: string;
  description?: string;
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

type Tab = "profile" | "security" | "company";

const PHASE_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PRE_ALLOCATED: "Pre-allocated",
  MIDYEAR_OPEN: "Mid-year Open",
  FINAL_OPEN: "Final Open",
  ALLOCATED: "Allocated",
  SETTLED: "Settled",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-gray-100 last:border-0">
      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</span>
      <span className="text-sm font-bold text-gray-700 text-right">{value}</span>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-[#F8FAFC] border border-gray-100 rounded-2xl p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[#005A8C]">{icon}<span className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</span></div>
      <div className="text-xl font-black text-[#005A8C]">{value}</div>
      {sub && <div className="text-xs font-semibold text-gray-400">{sub}</div>}
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold uppercase tracking-wider text-gray-400">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 pr-11 rounded-2xl border border-gray-200 bg-[#F8FAFC] text-sm font-bold text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-[#005A8C] focus:ring-2 focus:ring-[#005A8C]/10 transition-all"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#005A8C] transition-colors cursor-pointer"
          tabIndex={-1}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "Uppercase", ok: /[A-Z]/.test(password) },
    { label: "Number", ok: /[0-9]/.test(password) },
    { label: "Symbol", ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const bar = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-emerald-400"][score - 1] ?? "bg-gray-200";
  return (
    <div className="flex flex-col gap-2 mt-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? bar : "bg-gray-100"}`} />
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        {checks.map((c) => (
          <span key={c.label} className={`text-xs font-bold flex items-center gap-1 ${c.ok ? "text-emerald-500" : "text-gray-300"}`}>
            <CheckCircle2 size={11} /> {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, isLoading: authLoading, hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const isCompany = hasRole("company");

  // Company data
  const [balance, setBalance] = useState<Balance | null>(null);
  const [sector, setSector] = useState<SectorInfo | null>(null);
  const [position, setPosition] = useState<CompliancePosition | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(false);

  // Change password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!isCompany || activeTab !== "company") return;
    setLoadingCompany(true);
    Promise.all([
      axiosInstance.get<Balance>("/carbon/balance").catch(() => null),
      axiosInstance.get<SectorInfo>("/sectors/my").catch(() => null),
      axiosInstance.get<CompliancePosition>(`/allocations/position/${currentYear}`).catch(() => null),
    ]).then(([bal, sec, pos]) => {
      setBalance(bal?.data ?? null);
      setSector(sec?.data ?? null);
      setPosition(pos?.data ?? null);
    }).finally(() => setLoadingCompany(false));
  }, [isCompany, activeTab, currentYear]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSuccess(null);
    setPwError(null);

    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }

    setPwSubmitting(true);
    try {
      await axiosInstance.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      setPwSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwError(err.response?.data ?? "Failed to change password. Please try again.");
    } finally {
      setPwSubmitting(false);
    }
  };

  const roles = Array.isArray(user?.role) ? user.role : user?.role ? [user.role] : [];

  const tabs: { id: Tab; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "security", label: "Security" },
    ...(isCompany ? [{ id: "company" as Tab, label: "Company" }] : []),
  ];

  return (
    <AuthGuard>
      <div className="p-8 min-h-screen bg-[#F8FAFC] flex flex-col gap-6 select-none">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#005A8C] tracking-tight flex items-center gap-2">
              <Settings size={22} className="text-[#009B9E]" />
              Settings
            </h1>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
              Account &amp; Preferences
            </p>
          </div>
          {authLoading && <Loader2 size={18} className="text-gray-300 animate-spin" />}
        </div>

        {/* Tab Toggle */}
        <div className="flex gap-2 bg-white border border-gray-200/60 rounded-2xl p-1.5 w-fit shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-[#005A8C] text-white shadow-sm"
                  : "text-gray-500 hover:text-[#005A8C]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="flex flex-col gap-4">
            <div className="bg-white border border-gray-200/60 rounded-[2rem] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <User size={15} className="text-[#005A8C]" />
                <span className="text-sm font-black text-[#005A8C]">Account Details</span>
              </div>
              <div className="px-6 py-2">
                <InfoRow
                  label="Email"
                  value={
                    authLoading ? (
                      <Loader2 size={14} className="animate-spin text-gray-300" />
                    ) : (
                      user?.email ?? "—"
                    )
                  }
                />
                <InfoRow
                  label="Role"
                  value={
                    authLoading ? (
                      <Loader2 size={14} className="animate-spin text-gray-300" />
                    ) : roles.length > 0 ? (
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        {roles.map((r) => (
                          <span
                            key={r}
                            className="text-xs font-black px-3 py-1 rounded-full bg-[#005A8C]/8 text-[#005A8C] border border-[#005A8C]/10"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )
                  }
                />
                <InfoRow
                  label="Status"
                  value={
                    <span className="text-xs font-black px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                      Active
                    </span>
                  }
                />
              </div>
            </div>

            {(user?.permissions ?? []).length > 0 && (
              <div className="bg-white border border-gray-200/60 rounded-[2rem] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                  <ShieldCheck size={15} className="text-[#005A8C]" />
                  <span className="text-sm font-black text-[#005A8C]">Permissions</span>
                </div>
                <div className="px-6 py-5 flex flex-wrap gap-2">
                  {(user?.permissions ?? []).map((p) => (
                    <span
                      key={p}
                      className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#009B9E]/8 text-[#009B9E] border border-[#009B9E]/10"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Security Tab */}
        {activeTab === "security" && (
          <div className="flex flex-col gap-4">
            <div className="bg-white border border-gray-200/60 rounded-[2rem] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <KeyRound size={15} className="text-[#005A8C]" />
                <span className="text-sm font-black text-[#005A8C]">Change Password</span>
              </div>
              <form onSubmit={handleChangePassword} className="px-6 py-6 flex flex-col gap-5">

                {pwSuccess && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-sm font-bold text-emerald-600">
                    <CheckCircle2 size={16} className="shrink-0" />
                    {pwSuccess}
                  </div>
                )}

                {pwError && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm font-bold text-red-600">
                    <AlertCircle size={16} className="shrink-0" />
                    {pwError}
                  </div>
                )}

                <PasswordField
                  id="current-password"
                  label="Current Password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  placeholder="Enter your current password"
                />

                <div className="flex flex-col gap-1.5">
                  <PasswordField
                    id="new-password"
                    label="New Password"
                    value={newPassword}
                    onChange={(v) => { setNewPassword(v); setPwError(null); setPwSuccess(null); }}
                    placeholder="Enter a new password"
                  />
                  <PasswordStrength password={newPassword} />
                </div>

                <PasswordField
                  id="confirm-password"
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChange={(v) => { setConfirmPassword(v); setPwError(null); setPwSuccess(null); }}
                  placeholder="Re-enter your new password"
                />

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={pwSubmitting || !currentPassword || !newPassword || !confirmPassword}
                    className="flex items-center gap-2 px-6 py-3 bg-[#005A8C] text-white font-bold text-sm rounded-2xl hover:bg-[#00426b] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {pwSubmitting && <Loader2 size={15} className="animate-spin" />}
                    {pwSubmitting ? "Saving…" : "Update Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Company Tab */}
        {activeTab === "company" && isCompany && (
          <div className="flex flex-col gap-4">
            {loadingCompany ? (
              <div className="flex justify-center py-16">
                <Loader2 size={24} className="animate-spin text-gray-300" />
              </div>
            ) : (
              <>
                <div className="bg-white border border-gray-200/60 rounded-[2rem] shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                    <Building2 size={15} className="text-[#005A8C]" />
                    <span className="text-sm font-black text-[#005A8C]">Company Account</span>
                  </div>
                  <div className="px-6 py-2">
                    <InfoRow label="Email" value={user?.email ?? "—"} />
                    <InfoRow
                      label="Account ID"
                      value={balance?.companyId != null ? `#${balance.companyId}` : "—"}
                    />
                    <InfoRow
                      label="Assigned Sector"
                      value={
                        sector ? (
                          <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#009B9E]/8 text-[#009B9E] border border-[#009B9E]/10">
                            {sector.name}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-gray-400">Not assigned</span>
                        )
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard
                    icon={<Leaf size={16} />}
                    label="Carbon Credits"
                    value={
                      balance != null
                        ? balance.carbonCredits.toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : "—"
                    }
                    sub="Current balance"
                  />
                  <StatCard
                    icon={<BarChart3 size={16} />}
                    label="Verified Emissions"
                    value={
                      position?.verifiedEmissions != null
                        ? `${Number(position.verifiedEmissions).toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e`
                        : "—"
                    }
                    sub={`Year ${currentYear}`}
                  />
                  <StatCard
                    icon={<BarChart3 size={16} />}
                    label="Surplus / Deficit"
                    value={
                      position?.surplusDeficit != null ? (
                        <span className={position.surplusDeficit >= 0 ? "text-emerald-600" : "text-red-500"}>
                          {position.surplusDeficit >= 0 ? "+" : ""}
                          {Number(position.surplusDeficit).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                    sub="Compliance position"
                  />
                </div>

                {position && (
                  <div className="bg-white border border-gray-200/60 rounded-[2rem] shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                      <BarChart3 size={15} className="text-[#005A8C]" />
                      <span className="text-sm font-black text-[#005A8C]">
                        Compliance Cycle {position.year}
                      </span>
                      <span className={`ml-auto text-xs font-black px-3 py-1 rounded-full border ${
                        position.phase === "SETTLED"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                          : "bg-[#005A8C] text-white border-[#005A8C]"
                      }`}>
                        {PHASE_LABELS[position.phase] ?? position.phase}
                      </span>
                    </div>
                    <div className="px-6 py-2">
                      <InfoRow
                        label="Pre-allocation"
                        value={
                          position.preAllocation != null
                            ? `${Number(position.preAllocation).toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e`
                            : "—"
                        }
                      />
                      <InfoRow
                        label="Final Allocation"
                        value={
                          position.finalAllocation != null
                            ? `${Number(position.finalAllocation).toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e`
                            : "—"
                        }
                      />
                      <InfoRow
                        label="Total Balance"
                        value={
                          position.totalBalance != null
                            ? `${Number(position.totalBalance).toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e`
                            : "—"
                        }
                      />
                      <InfoRow
                        label="Compliance Status"
                        value={
                          position.status ? (
                            <span className={`text-xs font-black px-3 py-1 rounded-full border ${
                              position.status === "SURPLUS"
                                ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                : position.status === "DEFICIT"
                                ? "bg-red-50 text-red-500 border-red-100"
                                : "bg-gray-50 text-gray-500 border-gray-100"
                            }`}>
                              {position.status}
                            </span>
                          ) : (
                            "—"
                          )
                        }
                      />
                    </div>
                  </div>
                )}

                {sector?.formula && (
                  <div className="bg-white border border-gray-200/60 rounded-[2rem] shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                      <Leaf size={15} className="text-[#005A8C]" />
                      <span className="text-sm font-black text-[#005A8C]">Sector: {sector.name}</span>
                    </div>
                    <div className="px-6 py-5 flex flex-col gap-3">
                      {sector.description && (
                        <p className="text-sm font-semibold text-gray-500">{sector.description}</p>
                      )}
                      <div className="bg-[#F8FAFC] border border-gray-100 rounded-2xl px-5 py-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Emissions Formula</p>
                        <p className="text-sm font-black text-[#005A8C] font-mono">{sector.formula}</p>
                      </div>
                      {sector.activityFormula && (
                        <div className="bg-[#F8FAFC] border border-gray-100 rounded-2xl px-5 py-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Activity Formula</p>
                          <p className="text-sm font-black text-[#009B9E] font-mono">{sector.activityFormula}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </AuthGuard>
  );
}
