import { notFound } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";
import { CategoryIcon } from "@/components/incident/CategoryIcon";

/** Dev-only contact sheet for the animated icons. */
export default function IconsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="grid grid-cols-3 gap-6 p-6 pt-12">
      {CATEGORIES.map((c) => (
        <div key={c.id} className="flex flex-col items-center gap-3">
          <CategoryIcon category={c.id} size="xl" animated glow />
          <CategoryIcon category={c.id} size="md" />
          <span className="text-[12px] text-muted">{c.short}</span>
        </div>
      ))}
    </main>
  );
}
