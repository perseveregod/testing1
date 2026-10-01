import { ViewTransition } from "react";

// Wraps each page so route changes animate: a quick fade between tabs, a
// directional slide when drilling into or out of a detail screen.
// Navigations without a type (browser back, refresh) don't animate.
// `.page-root` gives every page an opaque surface above the always-mounted map.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const map = { tab: "tab", "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" };
  return (
    <ViewTransition enter={map} exit={map} default="none">
      <div className="page-root">{children}</div>
    </ViewTransition>
  );
}
