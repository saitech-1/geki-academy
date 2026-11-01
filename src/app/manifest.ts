import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "GEKI Academy",
    short_name: "GEKI",
    description: "Your Kyokushin learning academy",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icons/geki-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/geki-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
