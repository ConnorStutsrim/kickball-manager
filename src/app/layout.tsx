import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kickball Manager",
  description: "Batting orders, fielding lineups, and stats for a rec kickball team.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* The app's own dark mode is class-based and nothing toggles it yet,
            so force light here rather than following next-themes' "system"
            default — otherwise toasts could mismatch an always-light app. */}
        <Toaster theme="light" />
      </body>
    </html>
  );
}
