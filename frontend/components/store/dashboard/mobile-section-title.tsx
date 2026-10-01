import Link from "next/link";

export function MobileSectionTitle({
  id,
  title,
  viewAllHref,
  trailing,
}: {
  id: string;
  title: string;
  viewAllHref?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 id={id} className="text-base font-bold text-primary">
        {title}
      </h2>
      {trailing}
      {viewAllHref && (
        <Link href={viewAllHref} className="flex min-h-11 items-center text-sm font-medium text-primary">
          View all<span className="sr-only"> {title.toLowerCase()}</span>
        </Link>
      )}
    </div>
  );
}
