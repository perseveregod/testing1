import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center pt-safe pb-safe">
      <EmptyState
        icon={<Compass className="size-9" strokeWidth={1.5} aria-hidden />}
        title="Page not found"
        body="That link doesn't lead anywhere."
        action={<ButtonLink href="/">Back to map</ButtonLink>}
      />
    </main>
  );
}
