import { cn } from "cn";
import { TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Figma table style: grey rounded header row with uppercase labels, 16px cell padding.
export function StoreTableHeader({ columns }: { columns: { label: string; className?: string }[] }) {
  return (
    <TableHeader className="[&_tr]:border-0">
      <TableRow className="bg-background hover:bg-background">
        {columns.map((column) => (
          <TableHead
            key={column.label}
            className={cn(
              "h-auto px-4 py-2 text-sm font-medium text-muted-foreground uppercase first:rounded-l-lg last:rounded-r-lg",
              column.className
            )}
          >
            {column.label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

export function StoreTableCell({ className, ...props }: React.ComponentProps<typeof TableCell>) {
  return <TableCell className={cn("p-4 text-sm text-foreground", className)} {...props} />;
}
