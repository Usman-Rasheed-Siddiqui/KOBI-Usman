import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: { default: "KOBI - Find your next contribution", template: "%s · KOBI" },
  description: "An intelligent collaboration discovery layer for open-source software, hardware, events and teams.",
  icons: {
    icon: "/brand/kobi-icon-180.png",
    apple: "/brand/kobi-icon-180.png",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f7f2" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="bg-grid"><AppShell>{children}</AppShell></body></html>;
}
