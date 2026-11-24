import type { MetadataRoute } from "next";

/** Web app manifest: name, colours and icons when PACA is added to a phone's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PACA — Professional Agile Certification, Africa",
    short_name: "PACA",
    description: "Membership, certification, study resources and Agile jobs for professionals in Africa.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0060cc",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
