"use client";

import { Download, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnalysisCharts } from "@/components/AnalysisCharts";
import { ApplicationTable } from "@/components/ApplicationTable";
import { FiltersPanel } from "@/components/FiltersPanel";
import { SummaryCards } from "@/components/SummaryCards";
import {
  emptyFilters,
  filterApplications,
  getMonthlyStats,
  getRoleStats,
  getUniqueRoles,
  sortApplications,
  summarizeApplications,
} from "@/lib/calculations";
import { applicationsToCsv, parseCsv } from "@/lib/csv";
import {
  deleteRemoteApplication,
  fetchRemoteApplications,
  replaceRemoteApplications,
  upsertRemoteApplication,
} from "@/lib/applicationService";
import { sampleApplications } from "@/lib/sampleApplications";
import { isSupabaseConfigured } from "@/lib/supabase";
import type {
  Application,
  ApplicationFilters,
  SortDirection,
} from "@/lib/types";

const storageKey = "application-pass-rate-tracker:v1";

type SyncState = "loading" | "local" | "syncing" | "synced" | "error";

interface LocalStorageSnapshot {
  applications: Application[];
  hasStoredData: boolean;
}

function loadApplicationsFromStorage() {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return { applications: sampleApplications, hasStoredData: false };
    }

    const parsed = JSON.parse(stored);
    return {
      applications: Array.isArray(parsed)
        ? (parsed as Application[])
        : sampleApplications,
      hasStoredData: true,
    };
  } catch {
    return { applications: sampleApplications, hasStoredData: false };
  }
}

function saveApplicationsToStorage(applications: Application[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(applications));
  } catch {
    // Keep the app usable even when browser storage is unavailable.
  }
}

export function ApplicationManager() {
  const [applications, setApplications] =
    useState<Application[]>(sampleApplications);
  const [filters, setFilters] = useState<ApplicationFilters>(emptyFilters);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const applicationsRef = useRef<Application[]>(sampleApplications);
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;

    async function initializeApplications() {
      const localSnapshot: LocalStorageSnapshot = loadApplicationsFromStorage();

      if (!isSupabaseConfigured) {
        applicationsRef.current = localSnapshot.applications;
        setApplications(localSnapshot.applications);
        setSyncState("local");
        hydrated.current = true;
        return;
      }

      try {
        const remoteApplications = await fetchRemoteApplications();

        if (remoteApplications.length === 0 && localSnapshot.hasStoredData) {
          await replaceRemoteApplications(localSnapshot.applications);
          applicationsRef.current = localSnapshot.applications;
          setApplications(localSnapshot.applications);
        } else if (remoteApplications.length > 0) {
          applicationsRef.current = remoteApplications;
          setApplications(remoteApplications);
        } else {
          applicationsRef.current = localSnapshot.applications;
          setApplications(localSnapshot.applications);
        }

        if (active) setSyncState("synced");
      } catch {
        if (active) {
          applicationsRef.current = localSnapshot.applications;
          setApplications(localSnapshot.applications);
          setSyncState("error");
        }
      } finally {
        hydrated.current = true;
      }
    }

    void initializeApplications();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated.current) {
      saveApplicationsToStorage(applications);
    }
  }, [applications]);

  function setApplicationList(nextApplications: Application[]) {
    applicationsRef.current = nextApplications;
    setApplications(nextApplications);
  }

  async function sync(operation: () => Promise<void>) {
    if (!isSupabaseConfigured) return;

    setSyncState("syncing");
    try {
      await operation();
      setSyncState("synced");
    } catch {
      setSyncState("error");
    }
  }

  const filteredApplications = useMemo(
    () => filterApplications(applications, filters),
    [applications, filters],
  );

  const sortedApplications = useMemo(
    () => sortApplications(filteredApplications, sortDirection),
    [filteredApplications, sortDirection],
  );

  const summary = useMemo(
    () => summarizeApplications(filteredApplications),
    [filteredApplications],
  );

  const monthlyStats = useMemo(
    () => getMonthlyStats(filteredApplications),
    [filteredApplications],
  );

  const roleStats = useMemo(
    () => getRoleStats(filteredApplications),
    [filteredApplications],
  );

  const roles = useMemo(() => getUniqueRoles(applications), [applications]);

  function addApplication() {
    const today = new Date().toISOString().slice(0, 10);
    const application: Application = {
      id: crypto.randomUUID(),
      date: today,
      company: "",
      role: "",
      result: "미정",
      memo: "",
    };
    const nextApplications = [application, ...applicationsRef.current];
    setApplicationList(nextApplications);
    void sync(() => upsertRemoteApplication(application));
  }

  function updateApplication(id: string, patch: Partial<Application>) {
    const nextApplications = applicationsRef.current.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    );
    const updatedApplication = nextApplications.find((item) => item.id === id);
    setApplicationList(nextApplications);
    if (updatedApplication) {
      void sync(() => upsertRemoteApplication(updatedApplication));
    }
  }

  function deleteApplication(id: string) {
    setApplicationList(
      applicationsRef.current.filter((item) => item.id !== id),
    );
    void sync(() => deleteRemoteApplication(id));
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const imported = parseCsv(text);
    if (imported.length > 0) {
      setApplicationList(imported);
      setFilters(emptyFilters);
      void sync(() => replaceRemoteApplications(imported));
    }
  }

  function downloadCsv() {
    const csv = applicationsToCsv(applications);
    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "서류_지원_내역.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">
            2026년 서류 합격률
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-ink">
            지원 내역 관리
          </h1>
          <p className="mt-2 text-xs text-gray-500" aria-live="polite">
            {syncState === "loading" && "데이터 불러오는 중..."}
            {syncState === "local" && "이 브라우저에만 저장 중"}
            {syncState === "syncing" && "동기화 중..."}
            {syncState === "synced" && "PC·모바일 동기화됨"}
            {syncState === "error" && "동기화 실패 · 현재 브라우저에 임시 저장 중"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="text-button cursor-pointer">
            <Upload size={16} />
            CSV 업로드
            <input
              accept=".csv,text/csv"
              className="sr-only"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importCsv(file);
                event.target.value = "";
              }}
            />
          </label>
          <button className="text-button" onClick={downloadCsv} type="button">
            <Download size={16} />
            CSV 다운로드
          </button>
        </div>
      </header>

      <SummaryCards stats={summary} />
      <FiltersPanel
        filters={filters}
        roles={roles}
        onChange={setFilters}
        onReset={() => setFilters(emptyFilters)}
      />
      <AnalysisCharts monthlyStats={monthlyStats} roleStats={roleStats} />
      <ApplicationTable
        applications={sortedApplications}
        sortDirection={sortDirection}
        onAdd={addApplication}
        onDelete={deleteApplication}
        onSortDirectionChange={setSortDirection}
        onUpdate={updateApplication}
      />
    </main>
  );
}
