import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegistration from "@/components/PwaRegistration";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";

export const metadata: Metadata = {
  title: "Project Monitor",
  description: "Read-only telemetry monitor for cloud services",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Project Monitor",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0d14",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-[#0a0d14] text-slate-100 antialiased">
      <body className="min-h-full flex flex-col">
        <PwaRegistration />
        <PwaInstallPrompt />
        {children}
      </body>
    </html>
  );
}
