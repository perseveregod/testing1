import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Haven: local safety alerts",
    short_name: "Haven",
    description: "Nearby incidents, community reports and alerts. No subscription.",
    start_url: "/",
    display: "standalone",
    // Shown as the splash background while the installed app opens.
    background_color: "#07080a",
    theme_color: "#07080a",
    orientation: "portrait",
    categories: ["news", "navigation", "lifestyle"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
