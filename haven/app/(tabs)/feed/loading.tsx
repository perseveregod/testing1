import { PageHeader } from "@/components/nav/PageHeader";
import { RowSkeleton } from "@/components/ui/States";

// Shown the instant the Feed tab is tapped, while the server fetches the list.
export default function FeedLoading() {
  return (
    <main className="min-h-dvh pb-nav">
      <PageHeader title="Near you" large />
      <div className="mx-auto max-w-lg px-4">
        <div className="rounded-card bg-surface px-4">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </div>
    </main>
  );
}
