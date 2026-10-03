"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "@/components/domain/metric-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { downloadCsv } from "@/components/dispatcher/operations/data";
import { Choice, DataGate, ModuleHeader, Notice, PagedTable, Panel } from "@/components/dispatcher/operations/shared";
import { OutletEditor } from "@/components/dispatcher/outlets/OutletEditor";
import { fetchOutlets, weekdays, type OutletRecord } from "@/components/dispatcher/outlets/outlet-data";

function RegisteredDetails({ outlet }: { outlet: OutletRecord }) {
  return <Sheet><SheetTrigger asChild><Button variant="outline" aria-label={`View outlet ${outlet.code}`}>View</Button></SheetTrigger><SheetContent className="data-[side=right]:w-full overflow-y-auto sm:max-w-xl">
    <SheetHeader><SheetTitle>{outlet.name}</SheetTitle><SheetDescription>{outlet.code} · {outlet.active ? "Active" : "Inactive"}</SheetDescription></SheetHeader>
    <div className="space-y-5 px-4 pb-6 text-sm"><p>{outlet.address || "Address not recorded"}{outlet.district ? ` · ${outlet.district}` : ""}</p>
      <p className="text-muted-foreground">{outlet.brand} · {outlet.depot} · {outlet.dock_type.replaceAll("_", " ")}{outlet.van_only ? " · Vans only" : ""}</p>
      {outlet.updated_at === null && <Notice>This outlet is available from the existing loader directory. Contact lists and weekly hours can be added after the outlet profile migration is applied.</Notice>}
      <section><h2 className="font-semibold">Contacts</h2>{outlet.contacts.length ? <ul className="mt-2 space-y-2">{outlet.contacts.map((contact) => <li key={contact.id ?? contact.name} className="rounded-md border border-border p-3"><span className="font-medium">{contact.name}</span>{contact.role && ` · ${contact.role}`}<div className="text-muted-foreground">{[contact.phone, contact.email].filter(Boolean).join(" · ")}</div></li>)}</ul> : <p className="text-muted-foreground">None recorded.</p>}</section>
      <section><h2 className="font-semibold">Receiving hours</h2>{outlet.receiving_windows.length ? <ul className="mt-2 space-y-1">{[...outlet.receiving_windows].sort((a, b) => a.weekday - b.weekday || a.opens_at.localeCompare(b.opens_at)).map((window) => <li key={window.id ?? `${window.weekday}-${window.opens_at}`}><span className="font-medium">{weekdays[window.weekday]}</span> {window.opens_at.slice(0, 5)}–{window.closes_at.slice(0, 5)}</li>)}</ul> : <p className="text-muted-foreground">None recorded.</p>}<p className="mt-2 text-xs text-muted-foreground">Times are local to this outlet. No time zone is stored.</p></section>
      <section><h2 className="font-semibold">Delivery restrictions</h2><p className="mt-2 whitespace-pre-wrap">{outlet.delivery_restrictions || outlet.parking_constraint || "None recorded."}</p></section>
      {outlet.window_start && outlet.window_end && <p>Existing delivery window: {outlet.window_start.slice(0, 5)}–{outlet.window_end.slice(0, 5)}</p>}
    </div>
  </SheetContent></Sheet>;
}

function RegisteredOutlets() {
  const [records, setRecords] = useState<OutletRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState(0);
  const [editor, setEditor] = useState<OutletRecord | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [activity, setActivity] = useState("all");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    fetchOutlets(AbortSignal.any([controller.signal, AbortSignal.timeout(30000)])).then((outlets) => { if (!controller.signal.aborted) setRecords(outlets); }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Outlets could not be loaded."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [request]);
  function refresh() { setLoading(true); setError(null); setRequest((n) => n + 1); }
  const profileReady = records.length === 0 || records.some((outlet) => outlet.updated_at !== null);
  const filtered = records.filter((o) => (activity === "all" || o.active === null || (activity === "active") === o.active) && [o.code, o.name, o.address, o.district].filter(Boolean).join(" ").toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="space-y-5" aria-label="Registered outlets">
    <ModuleHeader title="Outlets" description="Manage registered delivery outlets, contacts, receiving hours and access restrictions." loading={loading} refresh={refresh}>
      <Button onClick={() => setEditor("new")} disabled={loading || !!error || !profileReady} title={!profileReady ? "Outlet profile migration is pending" : undefined}>Add outlet</Button>
      <Button variant="outline" disabled={loading || !!error || !filtered.length} onClick={() => downloadCsv("registered-outlets.csv", [["Code", "Name", "Address", "District", "Status", "Contacts", "Receiving windows", "Delivery restrictions"], ...filtered.map((o) => [o.code, o.name, o.address ?? "", o.district, o.active === null ? "Not recorded" : o.active ? "Active" : "Inactive", o.contacts.map((c) => `${c.name}: ${c.phone || c.email}`).join("; "), o.receiving_windows.map((w) => `${weekdays[w.weekday]} ${w.opens_at.slice(0, 5)}-${w.closes_at.slice(0, 5)}`).join("; "), o.delivery_restrictions ?? o.parking_constraint ?? ""])])}>Export CSV</Button>
    </ModuleHeader>
    <DataGate loading={loading} error={error} retry={refresh}>
      {!profileReady && <Notice>Showing the existing outlet directory. Add/edit, contacts, and weekly receiving hours require the outlet profile migration from the DB lead.</Notice>}
      <div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Registered outlets" value={records.length} /><MetricCard label="Active outlets" value={profileReady ? records.filter((o) => o.active === true).length : "—"} /><MetricCard label="With recorded hours" value={records.filter((o) => o.receiving_windows.length || (o.window_start && o.window_end)).length} /></div>
      <div role="search" aria-label="Filter registered outlets" className="flex flex-wrap gap-3"><Input aria-label="Search registered outlets" placeholder="Search code, name, address…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="h-10 bg-card sm:max-w-sm" />{profileReady && <Choice label="Outlet activity" value={activity} onChange={(v) => { setActivity(v); setPage(1); }} options={[{ value: "all", label: "All outlets" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />}{(search || activity !== "all") && <Button variant="ghost" onClick={() => { setSearch(""); setActivity("all"); setPage(1); }}>Clear filters</Button>}</div>
      <Panel title="Registered outlet directory"><PagedTable label="Registered outlets" columns={["Code", "Outlet", "District", "Status", "Contacts", "Hours", "Action"]} page={page} onPage={setPage} empty={records.length ? "No outlets match your filters." : "No outlets registered yet."} rows={filtered.map((o) => ({ key: o.id, cells: [o.code, <span key="name" className="font-medium">{o.name}</span>, o.district, o.active === null ? "Profile pending" : o.active ? "Active" : "Inactive", o.contacts.length, o.receiving_windows.length || (o.window_start && o.window_end ? 1 : 0), <div key="actions" className="flex flex-wrap gap-2"><RegisteredDetails outlet={o} /><Button variant="outline" aria-label={`Edit outlet ${o.code}`} disabled={o.updated_at === null} onClick={() => setEditor(o)}>Edit</Button></div>] }))} /></Panel>
    </DataGate>
    {editor && <OutletEditor outlet={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSaved={(saved) => { setRecords((items) => [...items.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name))); setPage(1); }} />}
  </section>;
}

export default function OutletsPage() {
  return <RegisteredOutlets />;
}
