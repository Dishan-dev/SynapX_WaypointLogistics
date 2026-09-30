"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Truck,
  Calendar,
  Package,
  Weight,
  Layers,
  ThermometerSnowflake,
  Sun,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Play,
  ArrowRight,
  WifiOff,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";
import { getLoadingTasks, startLoadingTask, LoadingTask } from "@/services/api";

export default function LoadingListPage() {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState("VEH001");
  const [taskDate, setTaskDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [tasks, setTasks] = useState<LoadingTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [cachedTime, setCachedTime] = useState<string | null>(null);
  const [startingTaskId, setStartingTaskId] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState<string>("ALL");

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const data = await getLoadingTasks(vehicleId, taskDate);
      setTasks(data);
      if (typeof window !== "undefined") {
        const time = localStorage.getItem(`cached_tasks_time_${vehicleId}_${taskDate}`);
        setCachedTime(time);
      }
    } catch {
      setIsError(true);
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(`cached_tasks_${vehicleId}_${taskDate}`);
        if (cached) {
          setTasks(JSON.parse(cached));
          const time = localStorage.getItem(`cached_tasks_time_${vehicleId}_${taskDate}`);
          setCachedTime(time);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [vehicleId, taskDate]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleStartLoading = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setStartingTaskId(taskId);
    try {
      // Mock loader ID if not in Keycloak session
      const loaderId = "e2b3c4d5-0000-0000-0000-000000000001";
      await startLoadingTask(taskId, loaderId);
      router.push(`/loader/loading/${taskId}`);
    } catch {
      // If error (e.g. offline), still allow navigating to item verification
      router.push(`/loader/loading/${taskId}`);
    } finally {
      setStartingTaskId(null);
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (brandFilter === "ALL") return true;
    return task.brand.toLowerCase() === brandFilter.toLowerCase();
  });

  const completedCount = tasks.filter(
    (t) => t.task_status === "completed" || t.status === "completed"
  ).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  // --- SCREEN 6: Degradation View if system is offline and no data cached ---
  if (isError && tasks.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 text-center shadow-lg space-y-5">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <WifiOff className="size-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              System Unavailable
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Could not load tasks from the depot server. Continue with your printed loading list. You can confirm loading here when connectivity returns.
            </p>
          </div>
          <button
            type="button"
            onClick={loadTasks}
            className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold shadow-xs transition-colors cursor-pointer text-base"
          >
            <RefreshCw className="size-4" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-24 font-sans antialiased">
      {/* Top Header / Vehicle selector */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 py-3.5 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Truck className="size-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Vehicle Loading List</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 font-mono font-medium">
                  {vehicleId}
                </span>
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Depot: Peliyagoda &bull; Route Sequence Enforced
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs">
              <Truck className="size-3.5 text-zinc-500" />
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="bg-transparent font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
              >
                <option value="VEH001">VEH001 (Colombo North)</option>
                <option value="VEH002">VEH002 (Colombo Central)</option>
                <option value="VEH003">VEH003 (Gampaha Link)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs">
              <Calendar className="size-3.5 text-zinc-500" />
              <input
                type="date"
                value={taskDate}
                onChange={(e) => setTaskDate(e.target.value)}
                className="bg-transparent font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 space-y-4">
        {/* Offline Warning Banner if using cached data */}
        {isError && cachedTime && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200 gap-3">
            <div className="flex items-center gap-2">
              <WifiOff className="size-4 shrink-0 text-amber-600" />
              <span>Offline mode active. Showing cached data from <strong>{cachedTime}</strong>.</span>
            </div>
            <button
              type="button"
              onClick={loadTasks}
              className="px-2.5 py-1 rounded-md bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 font-semibold cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-zinc-500" />
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Brand:</span>
            <div className="flex items-center gap-1.5">
              {["ALL", "Fresh", "Style", "Tech"].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBrandFilter(b)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    brandFilter === b
                      ? "bg-teal-700 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-zinc-500 font-medium">
            {filteredTasks.length} order{filteredTasks.length === 1 ? "" : "s"} scheduled
          </div>
        </div>

        {/* Task Cards List */}
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="size-7 animate-spin mx-auto text-teal-700" />
            <p className="text-sm font-medium text-zinc-500">Loading vehicle tasks...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="py-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-center p-8 space-y-2">
            <Package className="size-10 mx-auto text-zinc-400" />
            <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">No Orders for this Vehicle</h2>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              No active loading orders found for {vehicleId} on {taskDate}. Check another date or vehicle.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredTasks.map((task, idx) => {
              const currentStatus = task.task_status || task.status || "pending";
              const isPending = currentStatus === "pending";
              const isInProgress = currentStatus === "in_progress" || currentStatus === "loading";
              const isCompleted = currentStatus === "completed";
              const isShortfall = currentStatus === "shortfall_flagged";
              const taskId = task.task_id || task.id;

              return (
                <div
                  key={task.id || idx}
                  onClick={() => router.push(`/loader/loading/${taskId}`)}
                  className={`group relative bg-white dark:bg-zinc-900 border rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer ${
                    isShortfall
                      ? "border-amber-400 dark:border-amber-700/60 bg-amber-50/20"
                      : isCompleted
                      ? "border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/10"
                      : isInProgress
                      ? "border-blue-400 dark:border-blue-700/60 bg-blue-50/20"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-teal-500/50"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Outlet details & tags */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>
                        <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-teal-700 transition-colors">
                          {task.outlet_name || task.outlet_id}
                        </h2>
                        <span className="text-xs font-mono font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                          {task.outlet_id}
                        </span>

                        {/* Priority Badge */}
                        {task.is_high_priority && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                            HIGH PRIORITY
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {/* Brand Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-md font-semibold border ${
                            task.brand.toLowerCase() === "fresh"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : task.brand.toLowerCase() === "style"
                              ? "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"
                              : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                          }`}
                        >
                          {task.brand}
                        </span>

                        {/* Temp Badge */}
                        <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                          {task.temp_requirement === "chilled" ? (
                            <>
                              <ThermometerSnowflake className="size-3 text-sky-500" />
                              <span>❄️ Chilled</span>
                            </>
                          ) : (
                            <>
                              <Sun className="size-3 text-amber-500" />
                              <span>🌡️ Ambient</span>
                            </>
                          )}
                        </span>

                        {/* District */}
                        <span className="text-zinc-500">
                          &bull; District: <strong>{task.district}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Right: Status badge & Start action */}
                    <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                          <Clock className="size-3 text-zinc-500" />
                          Pending
                        </span>
                      )}
                      {isInProgress && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                          <RefreshCw className="size-3 text-blue-600 animate-spin" />
                          In Progress
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          Completed
                        </span>
                      )}
                      {isShortfall && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <AlertTriangle className="size-3 text-amber-600" />
                          Shortfall Flagged
                        </span>
                      )}

                      {/* Start Loading Button (Only if pending) */}
                      {isPending ? (
                        <button
                          type="button"
                          onClick={(e) => handleStartLoading(e, taskId)}
                          disabled={startingTaskId === taskId}
                          className="min-h-[44px] min-w-[120px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          <Play className="size-3.5 fill-current" />
                          <span>Start Loading</span>
                        </button>
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:bg-teal-700 group-hover:text-white transition-colors">
                          <ArrowRight className="size-4" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3 Stats Row */}
                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 grid grid-cols-3 gap-2 text-center sm:text-left">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center shrink-0">
                        <Package className="size-3.5" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Units</div>
                        <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {task.loaded_units !== null && task.loaded_units !== undefined
                            ? `${task.loaded_units} / ${task.order_units}`
                            : `${task.order_units} units`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center shrink-0">
                        <Weight className="size-3.5" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Weight</div>
                        <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {task.order_weight_kg ? `${task.order_weight_kg} kg` : "N/A"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center shrink-0">
                        <Layers className="size-3.5" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Volume</div>
                        <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {task.order_volume_m3 ? `${task.order_volume_m3} m³` : "N/A"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Sticky Bottom Progress Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 py-3 px-4 sm:px-6 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {completedCount} of {tasks.length} tasks complete
            </div>
            <span className="text-xs text-zinc-500 font-medium">({progressPercent}%)</span>
          </div>

          <div className="flex-1 max-w-xs bg-zinc-200 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-teal-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
