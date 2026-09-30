"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { StorePill } from "@/components/store/status-pill";
import { StoreTableCell, StoreTableHeader } from "@/components/store/store-table";
import {
  CATALOGUE_DEPOT,
  CATALOGUE_UPDATED_AT,
  type CatalogueItem,
  type TemperatureClass,
} from "@/components/store/mock-data";
import { QuantityStepper } from "@/components/store/new-request/quantity-stepper";

type StorageFilter = "all" | TemperatureClass;

export const temperatureLabel: Record<TemperatureClass, string> = { chilled: "Chilled", ambient: "Ambient" };

export function TemperaturePill({ value }: { value: TemperatureClass }) {
  return <StorePill tone={value === "chilled" ? "info" : "neutral"}>{temperatureLabel[value]}</StorePill>;
}

function StockText({ item }: { item: CatalogueItem }) {
  if (item.stock === "out") {
    return (
      <span className="flex flex-col gap-2">
        <span className="font-medium text-destructive">Out of stock</span>
        {item.restockEta && (
          <span className="text-muted-foreground">Restock ETA {format(parseISO(item.restockEta), "d MMM")}</span>
        )}
      </span>
    );
  }
  if (item.stock === "low") {
    return (
      <span className="flex flex-col gap-2">
        <span className="font-medium text-warning-muted-foreground">Low stock</span>
        {item.stockLeft !== undefined && (
          <span className="text-muted-foreground">
            {item.stockLeft} {item.unitLabel.toLowerCase()} left
          </span>
        )}
      </span>
    );
  }
  return <span className="font-medium text-success">In stock</span>;
}

const stockShort = (item: CatalogueItem) =>
  item.stock === "out" ? "Out of stock" : item.stock === "low" ? "Low stock" : "In stock";

export function AddItemPicker({
  open,
  onOpenChange,
  catalogue,
  selected,
  onConfirm,
  requestLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogue: CatalogueItem[];
  /** Items already in the request, sku → quantity. */
  selected: Record<string, number>;
  /** Called with the full sku → quantity map after "Add to Request". */
  onConfirm: (items: Record<string, number>) => void;
  requestLabel: string;
}) {
  const isMobile = useIsMobile();
  const title = isMobile ? "Add Item" : "Add Item to Request";
  const description = `Search the depot catalogue and add items to ${requestLabel}`;

  const body = (
    <PickerBody
      catalogue={catalogue}
      selected={selected}
      compact={isMobile}
      onCancel={() => onOpenChange(false)}
      onConfirm={(items) => {
        onConfirm(items);
        onOpenChange(false);
      }}
    />
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90svh] gap-4 rounded-t-2xl p-4">
          <SheetHeader className="p-0">
            <SheetTitle className="text-xl font-semibold text-primary">{title}</SheetTitle>
            <SheetDescription className="sr-only">{description}</SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92svh] flex-col gap-6 rounded-2xl p-6 sm:max-w-[920px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

// Mounted fresh each time the picker opens, so its working copy starts from the current request.
function PickerBody({
  catalogue,
  selected,
  compact,
  onCancel,
  onConfirm,
}: {
  catalogue: CatalogueItem[];
  selected: Record<string, number>;
  compact: boolean;
  onCancel: () => void;
  onConfirm: (items: Record<string, number>) => void;
}) {
  const [search, setSearch] = useState("");
  const [storage, setStorage] = useState<StorageFilter>("all");
  const [quantities, setQuantities] = useState<Record<string, number>>(() => ({ ...selected }));
  const [added, setAdded] = useState<Set<string>>(() => new Set(Object.keys(selected)));

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return catalogue.filter(
      (item) =>
        (storage === "all" || item.temperatureClass === storage) &&
        (!query ||
          item.itemName.toLowerCase().includes(query) ||
          item.sku.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query))
    );
  }, [catalogue, search, storage]);

  const newlyAdded = [...added].filter((sku) => !(sku in selected)).length;

  const addItem = (item: CatalogueItem) => {
    setQuantities((current) => ({ ...current, [item.sku]: Math.max(1, current[item.sku] ?? 0) }));
    setAdded((current) => new Set(current).add(item.sku));
  };

  const confirm = () => {
    const result: Record<string, number> = {};
    for (const sku of added) result[sku] = Math.max(1, quantities[sku] ?? 1);
    onConfirm(result);
  };

  const notify = (item: CatalogueItem) =>
    toast.success(`We'll notify you when ${item.itemName} is back in stock.`);

  const action = (item: CatalogueItem) => {
    if (added.has(item.sku)) return <StorePill tone="success">Added</StorePill>;
    if (item.stock === "out") {
      return (
        <span className="flex flex-col items-start gap-2">
          <Button variant="outline" disabled className="h-11 border-2 border-primary px-4 text-base font-bold md:h-10">
            Unavailable
          </Button>
          <button
            type="button"
            onClick={() => notify(item)}
            className="min-h-11 text-sm font-bold text-primary underline-offset-4 hover:underline md:min-h-0"
          >
            Notify me<span className="sr-only"> when {item.itemName} is back</span>
          </button>
        </span>
      );
    }
    return (
      <Button
        variant="outline"
        onClick={() => addItem(item)}
        className="h-11 border-2 border-primary px-4 text-base font-bold md:h-10"
      >
        Add<span className="sr-only"> {item.itemName}</span>
      </Button>
    );
  };

  return (
    <>
      <div className="relative">
        <Label htmlFor="catalogue-search" className="sr-only">
          Search by item name, SKU or category
        </Label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="catalogue-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={compact ? "Search item, SKU or category" : "Search by item name, SKU or category"}
          className="h-12 bg-card pl-10 text-base md:text-base"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Storage" className="flex gap-2">
          {(["all", "chilled", "ambient"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={storage === value}
              onClick={() => setStorage(value)}
              className={cn(
                "min-h-11 rounded-md border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9",
                storage === value
                  ? "border-primary bg-primary font-bold text-primary-foreground"
                  : "border-input bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {value === "all" ? (compact ? "All" : "All Items") : temperatureLabel[value]}
            </button>
          ))}
        </div>
        {!compact && (
          <p className="text-sm text-muted-foreground">
            Stock shown for {CATALOGUE_DEPOT} · updated {CATALOGUE_UPDATED_AT}
          </p>
        )}
      </div>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No items match your search.</p>
        ) : compact ? (
          <ul className="divide-y divide-border">
            {visible.map((item) => (
              <li key={item.sku} className="flex items-center justify-between gap-3 py-4">
                <div className="flex min-w-0 flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">{item.itemName}</span>
                  <span className="text-sm text-muted-foreground">
                    {item.sku} · {temperatureLabel[item.temperatureClass]} · {stockShort(item)}
                  </span>
                </div>
                <div className="shrink-0">{action(item)}</div>
              </li>
            ))}
          </ul>
        ) : (
          <Table>
            <StoreTableHeader
              columns={[
                { label: "Item" },
                { label: "SKU" },
                { label: "Storage" },
                { label: "Depot Stock" },
                { label: "Quantity" },
                { label: "Action", className: "text-transparent select-none" },
              ]}
            />
            <TableBody>
              {visible.map((item) => (
                <TableRow key={item.sku} className="hover:bg-transparent">
                  <StoreTableCell className="whitespace-normal">
                    <span className="block font-medium">{item.itemName}</span>
                    <span className="mt-2 block text-muted-foreground">{item.category}</span>
                  </StoreTableCell>
                  <StoreTableCell>{item.sku}</StoreTableCell>
                  <StoreTableCell>
                    <TemperaturePill value={item.temperatureClass} />
                  </StoreTableCell>
                  <StoreTableCell>
                    <StockText item={item} />
                  </StoreTableCell>
                  <StoreTableCell>
                    <QuantityStepper
                      label={`Quantity for ${item.itemName}`}
                      value={quantities[item.sku] ?? 0}
                      min={added.has(item.sku) ? 1 : 0}
                      disabled={item.stock === "out"}
                      onChange={(value) => setQuantities((current) => ({ ...current, [item.sku]: value }))}
                    />
                  </StoreTableCell>
                  <StoreTableCell>{action(item)}</StoreTableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {compact ? (
        <Button onClick={confirm} className="h-11 w-full text-base font-bold">
          Add to Request ({newlyAdded})
        </Button>
      ) : (
        <DialogFooter className="flex-row items-center justify-between gap-4 sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Low-stock items may be sent short. You&apos;ll see a dispatcher note if that happens.
          </p>
          <div className="flex shrink-0 gap-4">
            <Button variant="outline" onClick={onCancel} className="h-10 border-2 border-primary px-4 text-base font-bold">
              Cancel
            </Button>
            <Button onClick={confirm} className="h-10 px-4 text-base font-bold">
              Add to Request ({newlyAdded})
            </Button>
          </div>
        </DialogFooter>
      )}
    </>
  );
}
