"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "@/components/domain/metric-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Choice, DataGate, ModuleHeader, Notice, PagedTable, Panel } from "@/components/dispatcher/operations/shared";
import { downloadCsv } from "@/components/dispatcher/operations/data";
import { exceptionDate, fetchShipments, shipmentExceptions, type ShipmentRecord } from "@/components/dispatcher/operations/exceptions";

type Exception = ReturnType<typeof shipmentExceptions>[number];

function ExceptionDetails({ item }: { item: Exception }) {
  const s = item.shipment;
  const trip = s.dispatch_trip;
  return <Sheet><SheetTrigger asChild><Button variant="outline" aria-label={`View ${s.tracking_number}`}>View</Button></SheetTrigger><SheetContent className="w-full overflow-y-auto sm:max-w-xl">
    <SheetHeader><SheetTitle>{s.tracking_number}</SheetTitle><SheetDescription>{item.label}</SheetDescription></SheetHeader>
    <div className="space-y-5 px-4 pb-6"><p className="text-sm">{item.reason}</p>
      <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">{[
        ["Order ID", s.order_id], ["Shipment status", s.status.replaceAll("_", " ")], ["Last known location", s.current_location || "Not recorded"], ["Last shipment update", exceptionDate(s.last_updated)],
        ["Trip", trip?.trip_code || "Not assigned"], ["Driver", trip?.driver_name || "Not recorded"], ["Vehicle", trip?.vehicle_number || "Not recorded"], ["Trip destination", trip?.destination || "Not recorded"], ["Trip ETA", exceptionDate(trip?.estimated_arrival)], ["Actual trip arrival", exceptionDate(trip?.actual_arrival)],
      ].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-words font-medium">{value}</dd></div>)}</dl>
      <Notice>Times use Asia/Colombo. Last update is a shipment update time, not the time an exception began. Contact the driver through your existing process. Acknowledgements, owners, notes, and resolution history are not stored yet.</Notice>
    </div>
  </SheetContent></Sheet>;
}

export default function ExceptionsPage() {
  const [data, setData] = useState<ShipmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<number | null>(null);
  const [request, setRequest] = useState(0);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    fetchShipments(AbortSignal.any([controller.signal, AbortSignal.timeout(30000)])).then((records) => {
      if (!controller.signal.aborted) { setData(records); setChecked(Date.now()); }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Shipments could not be loaded.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [request]);
  function refresh() { setLoading(true); setError(null); setRequest((n) => n + 1); }
  const exceptions = shipmentExceptions(data, checked ?? 0);
  const filtered = exceptions.filter(({ shipment: s, kind: type }) => (kind === "all" || kind === type) && [s.tracking_number, String(s.order_id), s.current_location, s.dispatch_trip?.trip_code, s.dispatch_trip?.driver_name, s.dispatch_trip?.vehicle_number, s.dispatch_trip?.destination].filter(Boolean).join(" ").toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="space-y-6">
    <ModuleHeader title="Exceptions" description="Review failed shipments and trip arrival risks from current shipment records." loading={loading} refresh={refresh}>
      <Button variant="outline" disabled={loading || !!error || !filtered.length} onClick={() => downloadCsv("shipment-exceptions.csv", [["Tracking number", "Order ID", "Exception", "Shipment status", "Trip", "Driver", "Vehicle", "Last location", "Trip ETA (Asia/Colombo)", "Last update (Asia/Colombo)", "Checked at (UTC)"], ...filtered.map(({ shipment: s, label }) => [s.tracking_number, s.order_id, label, s.status, s.dispatch_trip?.trip_code ?? "", s.dispatch_trip?.driver_name ?? "", s.dispatch_trip?.vehicle_number ?? "", s.current_location ?? "", exceptionDate(s.dispatch_trip?.estimated_arrival), exceptionDate(s.last_updated), new Date(checked!).toISOString()])])}>Export CSV</Button>
    </ModuleHeader>
    <Notice>This is a read-only snapshot, checked on refresh. Failed status takes priority over a passed trip ETA. Missing ETAs are not treated as late. Exception ownership, resolution, temperature incidents, and loading shortfalls need additional data.</Notice>
    <DataGate loading={loading} error={error} retry={refresh}>
      <section aria-label="Exception summary" className="grid gap-4 sm:grid-cols-3"><MetricCard label="Shipments checked" value={data.length} /><MetricCard label="Failed shipments" value={exceptions.filter((e) => e.kind === "failed").length} /><MetricCard label="Trip ETA passed" value={exceptions.filter((e) => e.kind === "eta").length} /></section>
      <p className="text-xs text-muted-foreground">Checked at {checked ? exceptionDate(new Date(checked).toISOString()) : "—"} (Asia/Colombo). Counts represent shipments, not unique trips.</p>
      <div role="search" aria-label="Filter exceptions" className="flex flex-wrap gap-3">
        <Input aria-label="Search exceptions" placeholder="Search tracking, order ID, trip, driver…" className="h-10 bg-card sm:max-w-sm" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Choice label="Exception type" value={kind} options={[{ value: "all", label: "All exceptions" }, { value: "failed", label: "Failed shipment" }, { value: "eta", label: "Trip ETA passed" }]} onChange={(v) => { setKind(v); setPage(1); }} />
        {(search || kind !== "all") && <Button variant="ghost" onClick={() => { setSearch(""); setKind("all"); setPage(1); }}>Clear filters</Button>}
      </div>
      <Panel title="Shipment exceptions"><PagedTable label="Exceptions" page={page} onPage={setPage} columns={["Shipment / order ID", "Exception", "Trip / vehicle", "Driver", "Last update", "Action"]} empty={!data.length ? "No shipments are recorded yet." : !exceptions.length ? "No failed shipments or passed trip ETAs found in this snapshot." : "No exceptions match your filters."} rows={filtered.map((item) => ({ key: item.shipment.id, cells: [<div key="reference" className="font-medium">{item.shipment.tracking_number}<p className="text-xs text-muted-foreground">Order ID {item.shipment.order_id}</p></div>, <Badge key="type" className={`border-0 ${item.kind === "failed" ? "bg-destructive-muted text-destructive" : "bg-warning-muted text-warning"}`}>{item.label}</Badge>, <div key="trip">{item.shipment.dispatch_trip?.trip_code || "Not assigned"}<p className="text-xs text-muted-foreground">{item.shipment.dispatch_trip?.vehicle_number}</p></div>, item.shipment.dispatch_trip?.driver_name || "Not recorded", exceptionDate(item.shipment.last_updated), <ExceptionDetails key="details" item={item} />] }))} /></Panel>
    </DataGate>
  </div>;
}
