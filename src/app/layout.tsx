import type { Metadata, Viewport } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/system/service-worker-registrar";

const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Leo Academy — Piano, teoría y armonía",
    template: "%s · Leo Academy",
  },
  description:
    "Academia de piano y teoría musical. Un sendero de niveles, un laboratorio de sonido y juegos de oído, ritmo y armonía. Funciona sin conexión.",
  applicationName: "Leo Academy",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Leo Academy",
  },
  formatDetection: { telephone: false, email: false, address: false },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "Leo Academy",
    title: "Leo Academy — El sendero del zafiro",
    description:
      "Piano, teoría y armonía en una academia táctil que suena incluso sin luz.",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Leo Academy — piano, teoría y armonía",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Leo Academy — El sendero del zafiro",
    description:
      "Piano, teoría y armonía en una academia táctil que suena incluso sin luz.",
    images: ["/og.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  colorScheme: "dark",
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#050B14" }],
};

const unpluggedBootstrap = `try{if(window.localStorage.getItem('leo.unplugged')==='true'){document.documentElement.dataset.unplugged='true'}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${sans.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-abyss text-ivory antialiased">
        <script
          dangerouslySetInnerHTML={{ __html: unpluggedBootstrap }}
          suppressHydrationWarning
        />
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
