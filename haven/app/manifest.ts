import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Haven: local safety alerts",
    short_name: "Haven",
    description: "Nearby incidents, community reports and alerts. No subscription.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0d13",
    theme_color: "#0a0d13",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
