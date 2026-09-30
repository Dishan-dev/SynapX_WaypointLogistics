"use client";

import React, { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Weight,
  Layers,
  ThermometerSnowflake,
  Sun,
  CheckCircle2,
  AlertTriangle,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  Check,
} from "lucide-react";
import {
  getLoadingTask,
  updateLoadingItem,
  completeLoadingTask,
  LoadingTask,
} from "@/services/api";

export default function ItemVerificationPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const resolvedParams = use(params);
  const taskId = resolvedParams.taskId;
  const router = useRouter();

  const [task, setTask] = useState<LoadingTask | null>(null);
  const [loadedUnits, setLoadedUnits] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await getLoadingTask(taskId);
        setTask(data);
        const initialUnits =
          data.loaded_units !== null && data.loaded_units !== undefined
            ? data.loaded_units
            : data.order_units;
        setLoadedUnits(initialUnits);
      } catch {
        // Fallback demo mock if task is local / mocked
        const fallback: LoadingTask = {
          id: taskId,
          order_id: "a1b2c3d4-0000-0000-0000-000000000001",
          vehicle_id: "VEH001",
          outlet_id: "OUT001",
          outlet_name: "Colombo Fresh - Pettah",
          brand: "Fresh",
          district: "Colombo",
          temp_requirement: "chilled",
          order_units: 40,
          order_weight_kg: 120.5,
          order_volume_m3: 0.8,
          is_high_priority: false,
          status: "in_progress",
          loaded_units: 40,
          seq_in_route: 0,
        };
        setTask(fallback);
        setLoadedUnits(fallback.order_units);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [taskId]);

  // Debounced auto-save on units change
  const handleUnitsChange = (newVal: number) => {
    const val = Math.max(0, isNaN(newVal) ? 0 : newVal);
    setLoadedUnits(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await updateLoadingItem(taskId, val);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch (e) {
        console.error("Auto-save failed:", e);
      } finally {
        setIsSaving(false);
      }
    }, 500);
  };

  const handleConfirmComplete = async () => {
    setIsCompleting(true);
    try {
      await completeLoadingTask(taskId);
      router.push("/loader/loading");
    } catch {
      // In offline/mock mode, redirect
      router.push("/loader/loading");
    } finally {
      setIsCompleting(false);
    }
  };

  if (isLoading || !task) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw className="size-8 animate-spin mx-auto text-teal-700" />
          <p className="text-sm font-medium text-zinc-500">Loading order verification...</p>
        </div>
      </div>
    );
  }

  const expectedUnits = task.order_units;
  const isMatch = loadedUnits === expectedUnits;
  const isShortfall = loadedUnits < expectedUnits;
  const isOver = loadedUnits > expectedUnits;
  const isClosed = task.status === "completed" || task.status === "shortfall_flagged";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-20 font-sans antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 py-3.5 shadow-xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <Link
            href="/loader/loading"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-teal-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-4" />
            <span>Back to Loading List</span>
          </Link>

          <div className="flex items-center gap-2">
            {isSaving && (
              <span className="text-xs text-zinc-500 flex items-center gap-1 font-medium">
                <RefreshCw className="size-3 animate-spin" />
                Saving...
              </span>
            )}
            {saveSuccess && (
              <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                <Check className="size-3" />
                Saved
              </span>
            )}
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {task.vehicle_id}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Read-Only notice if closed */}
        {isClosed && (
          <div
            className={`p-4 rounded-2xl border text-sm flex items-center gap-3 ${
              task.status === "completed"
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
            }`}
          >
            {task.status === "completed" ? (
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="size-5 shrink-0 text-amber-600" />
            )}
            <div>
              <strong>
                {task.status === "completed"
                  ? "This task is marked as Completed."
                  : "This task has a Shortfall Reported."}
              </strong>
              <div className="text-xs mt-0.5 opacity-90">
                {task.shortfall_notes ? `Notes: ${task.shortfall_notes}` : "Verified and recorded."}
              </div>
            </div>
          </div>
        )}

        {/* Order Summary Card */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase font-bold tracking-wider text-teal-700 dark:text-teal-400">
                Item Verification
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">
                {task.outlet_name || task.outlet_id}
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Outlet Code: <strong>{task.outlet_id}</strong> &bull; Order: {task.order_id.slice(0, 8)}...
              </p>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                task.brand.toLowerCase() === "fresh"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                  : task.brand.toLowerCase() === "style"
                  ? "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"
                  : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
              }`}
            >
              {task.brand}
            </span>
          </div>

          {/* Expected Summary Specs */}
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/60 text-center">
            <div>
              <div className="text-[10px] font-semibold text-zinc-500 uppercase">Expected Units</div>
              <div className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
                {task.order_units}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-zinc-500 uppercase">Weight</div>
              <div className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
                {task.order_weight_kg ? `${task.order_weight_kg} kg` : "N/A"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-zinc-500 uppercase">Temperature</div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-center gap-1 mt-1">
                {task.temp_requirement === "chilled" ? (
                  <>
                    <ThermometerSnowflake className="size-3.5 text-sky-500" />
                    <span>Chilled</span>
                  </>
                ) : (
                  <>
                    <Sun className="size-3.5 text-amber-500" />
                    <span>Ambient</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Big Quantity Input Section */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-xs text-center space-y-6">
          <div className="space-y-1">
            <label htmlFor="units-input" className="text-xs uppercase font-bold tracking-wider text-zinc-500">
              Units Physically Loaded
            </label>
            <p className="text-xs text-zinc-400">
              Count and verify the cartons / crates staged for vehicle {task.vehicle_id}
            </p>
          </div>

          {/* Stepper + Big Numeric Input */}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={isClosed || loadedUnits <= 0}
              onClick={() => handleUnitsChange(loadedUnits - 1)}
              aria-label="Decrease units"
              className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center disabled:opacity-40 transition-colors cursor-pointer text-xl font-bold shadow-xs"
            >
              <Minus className="size-6" />
            </button>

            <div className="relative">
              <input
                id="units-input"
                type="number"
                min="0"
                disabled={isClosed}
                value={loadedUnits}
                onChange={(e) => handleUnitsChange(parseInt(e.target.value, 10))}
                className="w-36 sm:w-44 text-center text-4xl sm:text-5xl font-black py-4 rounded-2xl border-2 border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 focus:border-teal-600 focus:outline-none text-zinc-900 dark:text-zinc-100 transition-colors shadow-inner"
              />
            </div>

            <button
              type="button"
              disabled={isClosed}
              onClick={() => handleUnitsChange(loadedUnits + 1)}
              aria-label="Increase units"
              className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center disabled:opacity-40 transition-colors cursor-pointer text-xl font-bold shadow-xs"
            >
              <Plus className="size-6" />
            </button>
          </div>

          {/* Live Comparison Badge */}
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
              isMatch
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : isShortfall
                ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                : "bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
            }`}
          >
            {isMatch ? (
              <>
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span>Loaded: {loadedUnits} / Expected: {expectedUnits} (Complete Match)</span>
              </>
            ) : isShortfall ? (
              <>
                <AlertTriangle className="size-4 text-amber-600" />
                <span>Loaded: {loadedUnits} / Expected: {expectedUnits} (Shortfall: {expectedUnits - loadedUnits} units)</span>
              </>
            ) : (
              <>
                <ShieldCheck className="size-4 text-purple-600" />
                <span>Loaded: {loadedUnits} / Expected: {expectedUnits} (Over-allocated)</span>
              </>
            )}
          </div>
        </section>

        {/* Action Buttons Section */}
        {!isClosed && (
          <section className="space-y-3 pt-2">
            {/* Confirm Loading Complete (Enabled only if 100% matched) */}
            <button
              type="button"
              disabled={!isMatch || isCompleting}
              onClick={handleConfirmComplete}
              className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-teal-700 hover:bg-teal-800 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 text-white font-bold text-base shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isCompleting ? (
                <>
                  <RefreshCw className="size-5 animate-spin" />
                  <span>Marking Task Complete...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-5" />
                  <span>Confirm Loading Complete</span>
                </>
              )}
            </button>

            {/* Flag Shortfall (Visible when loaded < expected) */}
            {isShortfall && (
              <button
                type="button"
                onClick={() => router.push(`/loader/loading/${taskId}/shortfall?loaded=${loadedUnits}`)}
                className="w-full min-h-[50px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-sm shadow-xs transition-colors cursor-pointer border border-amber-600/30"
              >
                <AlertTriangle className="size-4.5" />
                <span>Flag Shortfall ({expectedUnits - loadedUnits} items missing) &rarr;</span>
              </button>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
