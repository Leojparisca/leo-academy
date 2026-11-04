import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Leo Academy — Piano & Armonía",
    short_name: "Leo Academy",
    description:
      "Academia de piano y teoría musical offline-first. Sendero de niveles, laboratorio de sonido y juegos de oído.",
    id: "/",
    start_url: "/mapa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050B14",
    theme_color: "#050B14",
    lang: "es",
    dir: "ltr",
    categories: ["education", "music", "productivity"],
    icons: [
      {
        src: "/logo.jpg",
        sizes: "1024x1024",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: "/logo-512.jpg",
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Estudio",
        short_name: "Estudio",
        url: "/estudio",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Juegos",
        short_name: "Juegos",
        url: "/juegos",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
