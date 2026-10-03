"use client";

import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "@/components/domain/metric-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { groupDestinations, downloadCsv, orderDay } from "@/components/dispatcher/operations/data";
import { useOrders } from "@/components/dispatcher/operations/use-orders";
import { Choice, DataGate, ModuleHeader, Notice, PagedTable, Panel, Status } from "@/components/dispatcher/operations/shared";
import { OutletEditor } from "@/components/dispatcher/outlets/OutletEditor";
import { fetchOutlets, weekdays, type OutletRecord } from "@/components/dispatcher/outlets/outlet-data";

function RegisteredDetails({ outlet }: { outlet: OutletRecord }) {
  return <Sheet><SheetTrigger asChild><Button variant="outline" aria-label={`View outlet ${outlet.code}`}>View</Button></SheetTrigger><SheetContent className="data-[side=right]:w-full overflow-y-auto sm:max-w-xl">
    <SheetHeader><SheetTitle>{outlet.name}</SheetTitle><SheetDescription>{outlet.code} · {outlet.active ? "Active" : "Inactive"}</SheetDescription></SheetHeader>
    <div className="space-y-5 px-4 pb-6 text-sm"><p>{outlet.address}{outlet.district ? ` · ${outlet.district}` : ""}</p>
      <section><h2 className="font-semibold">Contacts</h2>{outlet.contacts.length ? <ul className="mt-2 space-y-2">{outlet.contacts.map((contact) => <li key={contact.id ?? contact.name} className="rounded-md border border-border p-3"><span className="font-medium">{contact.name}</span>{contact.role && ` · ${contact.role}`}<div className="text-muted-foreground">{[contact.phone, contact.email].filter(Boolean).join(" · ")}</div></li>)}</ul> : <p className="text-muted-foreground">None recorded.</p>}</section>
      <section><h2 className="font-semibold">Receiving hours</h2>{outlet.receiving_windows.length ? <ul className="mt-2 space-y-1">{[...outlet.receiving_windows].sort((a, b) => a.weekday - b.weekday || a.opens_at.localeCompare(b.opens_at)).map((window) => <li key={window.id ?? `${window.weekday}-${window.opens_at}`}><span className="font-medium">{weekdays[window.weekday]}</span> {window.opens_at.slice(0, 5)}–{window.closes_at.slice(0, 5)}</li>)}</ul> : <p className="text-muted-foreground">None recorded.</p>}<p className="mt-2 text-xs text-muted-foreground">Times are local to this outlet. No time zone is stored.</p></section>
      <section><h2 className="font-semibold">Delivery restrictions</h2><p className="mt-2 whitespace-pre-wrap">{outlet.delivery_restrictions || "None recorded."}</p></section>
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
  const filtered = records.filter((o) => (activity === "all" || (activity === "active") === o.active) && [o.code, o.name, o.address, o.district].filter(Boolean).join(" ").toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="space-y-5" aria-label="Registered outlets">
    <ModuleHeader title="Outlets" description="Manage registered delivery outlets, contacts, receiving hours and access restrictions." loading={loading} refresh={refresh}>
      <Button onClick={() => setEditor("new")} disabled={loading || !!error}>Add outlet</Button>
      <Button variant="outline" disabled={loading || !!error || !filtered.length} onClick={() => downloadCsv("registered-outlets.csv", [["Code", "Name", "Address", "District", "Status", "Contacts", "Receiving windows", "Delivery restrictions"], ...filtered.map((o) => [o.code, o.name, o.address, o.district ?? "", o.active ? "Active" : "Inactive", o.contacts.map((c) => `${c.name}: ${c.phone || c.email}`).join("; "), o.receiving_windows.map((w) => `${weekdays[w.weekday]} ${w.opens_at.slice(0, 5)}-${w.closes_at.slice(0, 5)}`).join("; "), o.delivery_restrictions ?? ""])])}>Export CSV</Button>
    </ModuleHeader>
    <DataGate loading={loading} error={error} retry={refresh}>
      <div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Registered outlets" value={records.length} /><MetricCard label="Active outlets" value={records.filter((o) => o.active).length} /><MetricCard label="With receiving hours" value={records.filter((o) => o.receiving_windows.length).length} /></div>
      <div role="search" aria-label="Filter registered outlets" className="flex flex-wrap gap-3"><Input aria-label="Search registered outlets" placeholder="Search code, name, address…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="h-10 bg-card sm:max-w-sm" /><Choice label="Outlet activity" value={activity} onChange={(v) => { setActivity(v); setPage(1); }} options={[{ value: "all", label: "All outlets" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />{(search || activity !== "all") && <Button variant="ghost" onClick={() => { setSearch(""); setActivity("all"); setPage(1); }}>Clear filters</Button>}</div>
      <Panel title="Registered outlet directory"><PagedTable label="Registered outlets" columns={["Code", "Outlet", "Address", "Status", "Contacts", "Hours", "Action"]} page={page} onPage={setPage} empty={records.length ? "No outlets match your filters." : "No outlets registered yet."} rows={filtered.map((o) => ({ key: o.id, cells: [o.code, <span key="name" className="font-medium">{o.name}</span>, o.address, o.active ? "Active" : "Inactive", o.contacts.length, o.receiving_windows.length, <div key="actions" className="flex flex-wrap gap-2"><RegisteredDetails outlet={o} /><Button variant="outline" aria-label={`Edit outlet ${o.code}`} onClick={() => setEditor(o)}>Edit</Button></div>] }))} /></Panel>
    </DataGate>
    {editor && <OutletEditor outlet={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSaved={(saved) => { setRecords((items) => [...items.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name))); setPage(1); }} />}
  </section>;
}

type Destination = ReturnType<typeof groupDestinations>[number];

function DestinationDetails({ destination }: { destination: Destination }) {
  const [page, setPage] = useState(1);
  return <Sheet><SheetTrigger asChild><Button variant="outline" aria-label={`View ${destination.name}`}>View</Button></SheetTrigger><SheetContent className="data-[side=right]:w-full overflow-y-auto sm:max-w-xl">
    <SheetHeader><SheetTitle>{destination.name || "Unnamed customer"}</SheetTitle><SheetDescription>{destination.address || "Address not recorded"}</SheetDescription></SheetHeader>
    <div className="space-y-5 px-4 pb-6"><p className="text-xs text-muted-foreground">Grouped by customer name and delivery address. This is an order-derived destination, not a verified outlet record.</p>
      <dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-muted-foreground">Total orders</dt><dd className="font-semibold">{destination.orders.length}</dd></div><div><dt className="text-muted-foreground">Open orders</dt><dd className="font-semibold">{destination.open}</dd></div></dl>
      <h2 className="font-semibold">Order history</h2>
      <PagedTable label="Destination orders" columns={["Order", "Created", "Status"]} page={page} onPage={setPage} rows={destination.orders.map((order) => ({ key: order.id, cells: [order.order_number, orderDay(order.created_at), <Status key="status" value={order.status} />] }))} />
      <Notice>Brand, district, assigned depot, dock access, parking restrictions, and receiving windows are not recorded for these destinations yet.</Notice>
    </div>
  </SheetContent></Sheet>;
}

export default function OutletsPage() {
  const source = useOrders();
  const [search, setSearch] = useState("");
  const [activity, setActivity] = useState("all");
  const [page, setPage] = useState(1);
  const destinations = useMemo(() => groupDestinations(source.data), [source.data]);
  const filtered = destinations.filter((d) => `${d.name} ${d.address}`.toLowerCase().includes(search.trim().toLowerCase()) && (activity === "all" || (activity === "open" ? d.open > 0 : d.open === 0)));
  function clear() { setSearch(""); setActivity("all"); setPage(1); }
  return <div className="space-y-6">
    <RegisteredOutlets />
    <div className="border-t border-border pt-6"><ModuleHeader title="Order destinations" description="Explore names and addresses on existing orders that are not yet linked to registered outlet IDs." loading={source.loading} refresh={source.refresh}>
      <Button variant="outline" disabled={source.loading || !!source.error || !filtered.length} onClick={() => downloadCsv("outlet-destinations.csv", [["Customer", "Address", "Orders", "Open orders", "Delivered orders", "Last order date (Asia/Colombo)"], ...filtered.map((d) => [d.name, d.address, d.orders.length, d.open, d.delivered, d.lastOrder])])}>Export CSV</Button>
    </ModuleHeader>
    <Notice>These destinations are grouped from order text. They may correspond to registered outlets, but no link is stored on existing orders. Check and register each outlet separately to avoid merging unrelated destinations.</Notice>
    <DataGate loading={source.loading} error={source.error} retry={source.refresh}>
      <section aria-label="Destination summary" className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Recorded destinations" value={destinations.length} />
        <MetricCard label="With open orders" value={destinations.filter((d) => d.open > 0).length} />
        <MetricCard label="Orders represented" value={source.data.length} />
      </section>
      <div role="search" aria-label="Filter destinations" className="flex flex-wrap gap-3">
        <Input aria-label="Search destinations" placeholder="Search customer or address…" className="h-10 bg-card sm:max-w-sm" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Choice label="Order activity" value={activity} onChange={(v) => { setActivity(v); setPage(1); }} options={[{ value: "all", label: "All destinations" }, { value: "open", label: "With open orders" }, { value: "closed", label: "No open orders" }]} />
        {(search || activity !== "all") && <Button variant="ghost" onClick={clear}>Clear filters</Button>}
      </div>
      <Panel title="Destination Directory"><PagedTable label="Destinations" columns={["Customer", "Delivery address", "Orders", "Open", "Last order", "Action"]} page={page} onPage={setPage} empty={destinations.length ? "No destinations match your filters." : "No order destinations are recorded yet."}
        rows={filtered.map((d) => ({ key: d.key, cells: [<span key="name" className="font-semibold">{d.name || "Unnamed customer"}</span>, d.address || "Not recorded", d.orders.length, d.open, d.lastOrder, <DestinationDetails key={d.key} destination={d} />] }))} />
      </Panel>
    </DataGate>
    </div>
  </div>;
}
