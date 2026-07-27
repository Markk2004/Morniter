import type { Metadata } from "next";
import "./globals.css";
import PwaRegistration from "@/components/PwaRegistration";

export const metadata: Metadata = {
  title: "Project Monitor",
  description: "Read-only telemetry monitor for cloud services",
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
        {children}
      </body>
    </html>
  );
}
