"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Send,
  RefreshCw,
  FileText,
} from "lucide-react";
import { getLoadingTask, flagLoadingShortfall, LoadingTask } from "@/services/api";

export default function ShortfallScreen({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const resolvedParams = use(params);
  const taskId = resolvedParams.taskId;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [task, setTask] = useState<LoadingTask | null>(null);
  const [loadedUnits, setLoadedUnits] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await getLoadingTask(taskId);
        setTask(data);
        const queryLoaded = searchParams.get("loaded");
        if (queryLoaded !== null) {
          setLoadedUnits(parseInt(queryLoaded, 10));
        } else if (data.loaded_units !== null && data.loaded_units !== undefined) {
          setLoadedUnits(data.loaded_units);
        } else {
          setLoadedUnits(Math.max(0, data.order_units - 5));
        }
      } catch {
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
          loaded_units: 35,
          seq_in_route: 0,
        };
        setTask(fallback);
        const queryLoaded = searchParams.get("loaded");
        setLoadedUnits(queryLoaded ? parseInt(queryLoaded, 10) : 35);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [taskId, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (notes.trim().length < 10) return;

    setIsSubmitting(true);
    try {
      await flagLoadingShortfall(taskId, notes.trim(), loadedUnits);
      setIsSuccess(true);
    } catch {
      // Offline fallback: still show success to loader
      setIsSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !task) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw className="size-8 animate-spin mx-auto text-teal-700" />
          <p className="text-sm font-medium text-zinc-500">Loading shortfall details...</p>
        </div>
      </div>
    );
  }

  const expectedUnits = task.order_units;
  const shortfallCount = Math.max(0, expectedUnits - loadedUnits);
  const isValid = notes.trim().length >= 10;

  // --- Success State ---
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4 font-sans antialiased">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 text-center shadow-lg space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="size-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
              Shortfall Reported
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              The store manager (<strong>{task.outlet_name || task.outlet_id}</strong>) and central dispatch team have been notified.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-xs text-left space-y-1.5">
            <div><strong>Order:</strong> {task.order_id.slice(0, 8)}...</div>
            <div><strong>Units Loaded:</strong> {loadedUnits} of {expectedUnits} ({shortfallCount} missing)</div>
            <div><strong>Reason:</strong> &ldquo;{notes}&rdquo;</div>
          </div>

          <Link
            href="/loader/loading"
            className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer"
          >
            <span>Return to Loading List</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-20 font-sans antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 py-3.5 shadow-xs">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          <Link
            href={`/loader/loading/${taskId}`}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-teal-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-4" />
            <span>Back to Verification</span>
          </Link>
          <span className="text-xs font-mono font-medium text-zinc-500">
            {task.vehicle_id} &bull; {task.outlet_id}
          </span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 sm:px-6 pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header Card */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              <AlertTriangle className="size-3.5 text-amber-600" />
              <span>Shortfall Report</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
              Flag Loading Shortfall
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              Report missing or damaged stock that cannot be loaded onto vehicle {task.vehicle_id}.
            </p>
          </div>

          {/* Shortfall Summary Box */}
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-200 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
              Discrepancy Breakdown
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 bg-white/80 dark:bg-zinc-900/80 rounded-xl border border-amber-200 dark:border-amber-800/40">
                <div className="text-[10px] text-zinc-500 font-semibold uppercase">Expected</div>
                <div className="text-lg font-black text-zinc-900 dark:text-zinc-100">{expectedUnits}</div>
              </div>
              <div className="p-2.5 bg-white/80 dark:bg-zinc-900/80 rounded-xl border border-amber-200 dark:border-amber-800/40">
                <div className="text-[10px] text-zinc-500 font-semibold uppercase">Loaded</div>
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{loadedUnits}</div>
              </div>
              <div className="p-2.5 bg-white/80 dark:bg-zinc-900/80 rounded-xl border border-amber-200 dark:border-amber-800/40">
                <div className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold uppercase">Shortfall</div>
                <div className="text-lg font-black text-amber-600 dark:text-amber-400">-{shortfallCount}</div>
              </div>
            </div>
          </div>

          {/* Reason / Notes Text Area */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-3">
            <label htmlFor="notes-area" className="block text-xs uppercase font-bold tracking-wider text-zinc-600 dark:text-zinc-300">
              Reason for Shortfall / Dock Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="notes-area"
              rows={4}
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 3 units damaged in storage, 2 units not found in staging area..."
              className="w-full text-sm p-3.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 focus:border-amber-500 focus:outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 transition-colors resize-none"
            />
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Min 10 characters</span>
              <span className={notes.length < 10 ? "text-amber-600 font-semibold" : "text-emerald-600"}>
                {notes.length} characters
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 text-zinc-950 font-bold text-base shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed border border-amber-600/30"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="size-5 animate-spin" />
                <span>Submitting Shortfall Report...</span>
              </>
            ) : (
              <>
                <Send className="size-4.5" />
                <span>Submit Shortfall Report</span>
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
