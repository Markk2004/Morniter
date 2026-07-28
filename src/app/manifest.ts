import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Project Monitor",
    short_name: "Monitor",
    description: "Read-only group telemetry monitor for cloud providers",
    id: "/monitor",
    start_url: "/monitor",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0a0d14",
    theme_color: "#0a0d14",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
