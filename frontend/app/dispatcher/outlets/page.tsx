"use client";

import { useMemo, useState } from "react";
import { MetricCard } from "@/components/domain/metric-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { groupDestinations, downloadCsv, orderDay } from "@/components/dispatcher/operations/data";
import { useOrders } from "@/components/dispatcher/operations/use-orders";
import { Choice, DataGate, ModuleHeader, Notice, PagedTable, Panel, Status } from "@/components/dispatcher/operations/shared";

type Destination = ReturnType<typeof groupDestinations>[number];

function DestinationDetails({ destination }: { destination: Destination }) {
  const [page, setPage] = useState(1);
  return <Sheet><SheetTrigger asChild><Button variant="outline" aria-label={`View ${destination.name}`}>View</Button></SheetTrigger><SheetContent className="w-full overflow-y-auto sm:max-w-xl">
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
    <ModuleHeader title="Outlets" description="Explore delivery destinations and their existing order history." loading={source.loading} refresh={source.refresh}>
      <Button variant="outline" disabled={source.loading || !!source.error || !filtered.length} onClick={() => downloadCsv("outlet-destinations.csv", [["Customer", "Address", "Orders", "Open orders", "Delivered orders", "Last order date (Asia/Colombo)"], ...filtered.map((d) => [d.name, d.address, d.orders.length, d.open, d.delivered, d.lastOrder])])}>Export CSV</Button>
    </ModuleHeader>
    <Notice>This directory is derived from customer names and addresses on orders. Separate names or addresses remain separate destinations. Outlet registration and delivery constraints will be available when outlet records are added.</Notice>
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
  </div>;
}
