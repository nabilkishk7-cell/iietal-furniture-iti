import { useItemImageUrl } from "@/lib/data";
import { cn } from "@/lib/utils";

/** صورة الصنف — تعرض بديلًا واضحًا عند عدم وجود صورة */
export function ItemImage({
  path,
  name,
  className,
}: {
  path: string | null;
  name: string;
  className?: string | undefined;
}) {
  const { data: url } = useItemImageUrl(path);
  if (!url) {
    return (
      <div
        className={cn(
          "grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-dashed border-border bg-muted text-[10px] text-muted-foreground",
          className,
        )}
      >
        بلا صورة
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={`صورة الصنف ${name}`}
      loading="lazy"
      className={cn("h-12 w-12 shrink-0 rounded-lg border border-border object-cover", className)}
    />
  );
}
