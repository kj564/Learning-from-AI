import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import Rehydrate from "@/components/Rehydrate";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bimo — Teman belajar AI untuk siswa Indonesia",
  description: "Upload materi, dapatkan rangkuman, flashcard, kuis, mindmap, podcast, dan chat AI — semua dalam satu tempat. Gratis selamanya, Pro mulai Rp 20 ribu.",
  icons: {
    icon: [
      { url: "/pelajarin-assets/img/favicon.ico", sizes: "any" },
      { url: "/pelajarin-assets/img/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/pelajarin-assets/img/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/pelajarin-assets/img/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <style>{`
          :root {
            --font-sans: ${GeistSans.style.fontFamily}, ui-sans-serif, system-ui, sans-serif;
            --font-mono: ${GeistMono.style.fontFamily}, ui-monospace, "Cascadia Code", monospace;
          }
        `}</style>
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <Rehydrate />
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
