"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Download, RefreshCw, Loader2, FileArchive, DatabaseBackup } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import AuthGuard from "@/app/components/AuthGuard";

interface Backup {
  key: string;
  name: string;
  size: number;
  last_modified: string;
}

const AI_AGENT_URL = process.env.NEXT_PUBLIC_AI_AGENT_URL || "/agent";

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
};

const fmtDate = (v: string) =>
  v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function HistoricalDataPage() {
  const { hasRole } = useAuth();
  const isGov = hasRole("GOVERNMENT") || hasRole("ADMIN");

  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${AI_AGENT_URL}/backups`, {
        method: "GET",
        credentials: "include",
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error("You must be signed in as a government user to view backups.");
      }
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setBackups(data.backups || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load historical data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const backupNow = async () => {
    setBackingUp(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${AI_AGENT_URL}/backups/run`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error("Only government users can trigger a backup.");
      }
      if (!res.ok) throw new Error(`Backup failed: ${res.status}`);
      const data = await res.json();
      setNotice(
        data.status === "empty"
          ? "No data in the current window — nothing to back up."
          : `Backup created: ${data.name}`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backup failed.");
    } finally {
      setBackingUp(false);
    }
  };

  // Download via credentialed fetch -> blob, so the auth cookie is sent.
  const download = async (b: Backup) => {
    setDownloading(b.key);
    try {
      const res = await fetch(`${AI_AGENT_URL}/backups/download?key=${encodeURIComponent(b.key)}`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = b.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <AuthGuard>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Database className="w-6 h-6 text-[#005A8C]" />
              Historical Data
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Weekly archived sensor readings, compressed and stored in object storage.
              Download an archive to analyse historical air-quality data offline.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isGov && (
              <button
                onClick={backupNow}
                disabled={backingUp}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#005A8C] hover:bg-[#00476f] text-white text-sm font-medium disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {backingUp ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <DatabaseBackup className="w-4 h-4 shrink-0" />}
                {backingUp ? "Backing up…" : "Backup now"}
              </button>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <RefreshCw className="w-4 h-4 shrink-0" />}
              Refresh
            </button>
          </div>
        </div>

        {notice && <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">{notice}</div>}

        {!isGov && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm">
            Historical data archives are available to government users.
          </div>
        )}

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

        {!error && backups.length === 0 && !loading && (
          <div className="p-8 text-center text-gray-500 border border-dashed rounded-xl">
            No archives yet. The weekly backup job creates one file per week of sensor data.
          </div>
        )}

        {backups.length > 0 && (
          <div className="border rounded-xl overflow-hidden shadow-sm divide-y">
            {backups.map((b) => (
              <div key={b.key} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                <FileArchive className="w-5 h-5 text-[#005A8C] shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 truncate">{b.name}</div>
                  <div className="text-xs text-gray-500">
                    {fmtSize(b.size)} · {fmtDate(b.last_modified)}
                  </div>
                </div>
                <button
                  onClick={() => download(b)}
                  disabled={downloading === b.key}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#005A8C] hover:bg-[#00476f] text-white text-sm font-medium disabled:opacity-50 shrink-0"
                >
                  {downloading === b.key ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
