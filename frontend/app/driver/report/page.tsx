"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Signal, BatteryFull, Store, DoorClosed, PackageX,
  Ellipsis, Check, Map as MapIcon, Home, TriangleAlert, Layers
} from "lucide-react";
import { apiFetch, apiFetchUpload } from "@/lib/api";
import { useSyncContext } from "@/components/SyncProvider";

export default function ReportProblemPage() {
  const router = useRouter();
  const { enqueue, enqueueWithPhoto, online } = useSyncContext();
  const [offlinePhotoBlob, setOfflinePhotoBlob] = useState<Blob | null>(null);
  
  const [selectedIssue, setSelectedIssue] = useState("Outlet closed");
  const [notes, setNotes] = useState("");
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [currentStop, setCurrentStop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null); // local preview
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);          // server URL
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Photo is too large (max 10 MB).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Keep the raw file blob for offline queuing
    setOfflinePhotoBlob(file);

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPhotoDataUrl(objectUrl);
    setUploadError(null);
    setUploadingPhoto(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await apiFetchUpload<{ photo_url: string }>("/driver/upload/photo", formData);
      setPhotoUrl(result.photo_url);
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed. Please try again.");
      setPhotoDataUrl(null);
      setPhotoUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = () => {
    if (photoDataUrl) URL.revokeObjectURL(photoDataUrl);
    setPhotoDataUrl(null);
    setPhotoUrl(null);
    setUploadError(null);
    setOfflinePhotoBlob(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const issues = [
    { label: "Outlet closed", icon: Store, backendType: "customer_unavailable" },
    { label: "Access denied", icon: DoorClosed, backendType: "customer_unavailable" },
    { label: "Order mismatch", icon: PackageX, backendType: "damaged_goods" },
    { label: "Other", icon: Ellipsis, backendType: "other" },
  ];

  useEffect(() => {
    async function loadActiveTrip() {
      try {
        const trips = await apiFetch<any[]>("/driver/trips/today");
        const startedTrip = trips.find(t => t.status === "started");

        if (startedTrip) {
          const detail = await apiFetch<any>(`/driver/trips/${startedTrip.id}`);
          setActiveTrip(detail);

          // Coming from the outcome screen, the failed stop is passed explicitly
          const requestedStopId = new URLSearchParams(window.location.search).get("stop_id");
          const requestedStop = detail.stops?.find((s: any) => String(s.id) === requestedStopId);
          const activeStop = requestedStop ?? detail.stops
            ?.slice()
            .sort((a: any, b: any) => a.sequence - b.sequence)
            .find((s: any) => s.status === "pending" || s.status === "arrived");
          if (activeStop) {
            setCurrentStop(activeStop);
          }
        }
      } catch (error) {
        console.error("Failed to load active trip:", error);
      } finally {
        setLoading(false);
      }
    }
    loadActiveTrip();
  }, []);

  async function handleSubmit() {
    if (!activeTrip) return;
    setSubmitting(true);
    
    const issueConfig = issues.find(i => i.label === selectedIssue) || issues[3];
    const basePayload = {
      stop_id: currentStop ? currentStop.id : null,
      issue_type: issueConfig.backendType,
      description: notes || selectedIssue,
      photo_url: photoUrl ?? undefined,
    };

    // ── Offline path ──────────────────────────────────────────────────────────
    if (!online) {
      if (offlinePhotoBlob) {
        await enqueueWithPhoto(
          {
            action_type: "issue",
            trip_id: activeTrip.id,
            stop_id: currentStop?.id,
            payload: basePayload,
            label: selectedIssue,
          },
          offlinePhotoBlob
        );
      } else {
        await enqueue({
          action_type: "issue",
          trip_id: activeTrip.id,
          stop_id: currentStop?.id,
          payload: basePayload,
          label: selectedIssue,
        });
      }
      router.push("/driver/queue");
      return;
    }

    // ── Online path ───────────────────────────────────────────────────────────
    try {
      await apiFetch(`/driver/trips/${activeTrip.id}/issues`, {
        method: "POST",
        body: JSON.stringify(basePayload),
      });
      router.push("/driver/trip");
    } catch (error) {
      // Network error while online — queue for later
      await enqueue({
        action_type: "issue",
        trip_id: activeTrip.id,
        stop_id: currentStop?.id,
        payload: basePayload,
        label: selectedIssue,
      });
      console.error("Failed to submit issue, queued for sync:", error);
      router.push("/driver/queue");
    }
  }

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ backgroundColor: "#F2F5F8", fontFamily: "Inter, sans-serif" }}>
      
      {/* Header */}
      <div 
        className="flex flex-col w-full bg-white z-10"
        style={{ borderBottom: "1px solid #D9E1E8" }}
      >
        {/* Device status */}
        <div className="flex justify-between items-center px-5 h-[34px] w-full">
          <span className="text-[12px] font-semibold" style={{ color: "#12202E" }}>06:58</span>
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-normal" style={{ color: "#BDBDBD" }}>Online</span>
            <Signal size={16} color="#BDBDBD" />
            <BatteryFull size={18} color="#BDBDBD" />
          </div>
        </div>

        {/* Title bar */}
        <div className="flex px-5 py-2.5 items-center w-full">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[18px] font-bold leading-[1.25em]" style={{ color: "#12202E" }}>
              Report a problem
            </h1>
            <p className="text-[12px] font-normal leading-[1.45em]" style={{ color: "#5D6A78" }}>
              {loading ? "..." : activeTrip ? `Trip ${activeTrip.id} ${currentStop ? `· Stop ${currentStop.sequence}` : ''}` : "No Active Trip"}
            </p>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="flex flex-col flex-1 px-5 pt-[18px] pb-[100px] gap-3">
        
        {/* Delivery issues */}
        <div className="flex flex-col gap-2 w-full">
          <h2 className="font-bold text-[18px]" style={{ color: "#12202E" }}>Delivery issue</h2>
          
          <div className="flex flex-col gap-2.5 w-full">
            {issues.map((issue) => {
              const Icon = issue.icon;
              const isSelected = selectedIssue === issue.label;

              return (
                <div 
                  key={issue.label}
                  onClick={() => setSelectedIssue(issue.label)}
                  className="flex items-center justify-between p-[11px] rounded-xl cursor-pointer"
                  style={{
                    backgroundColor: isSelected ? "#EAF2FF" : "#FFFFFF",
                    border: `1px solid ${isSelected ? "#2167D5" : "#D9E1E8"}`,
                    boxShadow: "0px 5px 16px 0px rgba(22, 58, 95, 0.08)"
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={19} color="#12202E" />
                    <span 
                      className={`text-[14px] ${isSelected ? 'font-bold' : 'font-medium'}`} 
                      style={{ color: "#12202E" }}
                    >
                      {issue.label}
                    </span>
                  </div>
                  
                  <div 
                    className="flex justify-center items-center w-[19px] h-[19px] rounded-full"
                    style={{ 
                      backgroundColor: isSelected ? "#2167D5" : "#FFFFFF",
                      border: `2px solid ${isSelected ? "#2167D5" : "#D9E1E8"}`
                    }}
                  >
                    {isSelected && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Optional note */}
        <div className="flex flex-col gap-1 w-full mt-1">
          <label className="font-semibold text-[12px]" style={{ color: "#12202E" }}>Optional note</label>
          <textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full h-[120px] p-4 rounded bg-white outline-none resize-none font-normal text-[16px]"
            style={{ border: "1px solid #E0E0E0", color: "#4F4F4F" }}
            placeholder="Add details for dispatch…"
          />
        </div>

        {/* Hidden file input */}
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handlePhotoUpload} 
        />

        {/* Secondary action / Photo preview */}
        {uploadError && (
          <p className="text-red-500 text-[12px] font-medium mt-1">{uploadError}</p>
        )}

        {photoDataUrl ? (
          <div className="flex flex-col gap-2 mt-1">
            <label className="font-semibold text-[12px]" style={{ color: "#12202E" }}>
              {uploadingPhoto ? "Uploading…" : "Attached photo"}
            </label>
            <div className="relative w-full h-32 rounded-md overflow-hidden border border-[#E0E0E0]">
              <img src={photoDataUrl} alt="Attached" className="object-cover w-full h-full" />
              {/* Uploading overlay */}
              {uploadingPhoto && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <svg className="animate-spin h-7 w-7 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                </div>
              )}
              {/* Uploaded badge */}
              {!uploadingPhoto && photoUrl && (
                <div className="absolute bottom-2 left-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  ✓ Uploaded
                </div>
              )}
              <button
                onClick={removePhoto}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex justify-center items-center h-[40px] rounded-md mt-1"
            style={{ border: "1px solid #E5E5E2", backgroundColor: "#FFFFFF" }}
          >
            <span className="font-semibold text-[13px]" style={{ color: "#171A1F" }}>Add photo +</span>
          </button>
        )}

        {/* Primary action */}
        <div className="w-full mt-1">
          <button
            onClick={handleSubmit}
            disabled={submitting || !activeTrip || uploadingPhoto}
            className="w-full flex justify-center items-center h-[55px] rounded-lg text-white font-bold text-[16px] disabled:opacity-50"
            style={{ backgroundColor: "#092C4C" }}
          >
            {submitting ? "Submitting..." : uploadingPhoto ? "Waiting for photo…" : "Submit report"}
          </button>
        </div>
      </div>

      {/* Bottom Nav */}
      <div
        className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-8 py-2.5 bg-white z-50"
        style={{ borderTop: "1px solid #D9E1E8", boxShadow: "0px -8px 28px 0px rgba(11, 39, 67, 0.16)" }}
      >
        <Link href="/driver" className="flex flex-col items-center gap-1 w-[72px]">
          <Home size={22} color="#8793A0" />
          <span className="text-[10px] font-medium" style={{ color: "#8793A0" }}>Home</span>
        </Link>
        <Link href="/driver/trip" className="flex flex-col items-center gap-1 w-[72px]">
          <MapIcon size={22} color="#8793A0" />
          <span className="text-[10px] font-medium" style={{ color: "#8793A0" }}>Map</span>
        </Link>
        <Link href="/driver/report" className="flex flex-col items-center gap-1 w-[72px]">
          <TriangleAlert size={22} color="#163A5F" />
          <span className="text-[10px] font-bold" style={{ color: "#163A5F" }}>Report</span>
        </Link>
        <Link href="/driver/queue" className="flex flex-col items-center gap-1 w-[72px]">
          <Layers size={22} color="#5D6A78" />
          <span className="text-[10px] font-medium" style={{ color: "#5D6A78" }}>Queue</span>
        </Link>
      </div>
    </div>
  );
}
