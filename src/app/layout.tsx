import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import Rehydrate from "@/components/Rehydrate";
import "./globals.css";

export const metadata: Metadata = {
  title: "Z.ai - Advanced AI Chatbot & Agent powered by GLM-5.3-Flash",
  description: "Meet Z.ai, the AI assistant powered by GLM-5.3-Flash. Build websites, write code, handle long-horizon tasks, and get instant answers. Fast, smart, and reliable.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <style>{`
          :root {
            --font-sans: ${GeistSans.style.fontFamily}, ui-sans-serif, system-ui, sans-serif;
            --font-mono: ${GeistMono.style.fontFamily}, ui-monospace, "Cascadia Code", monospace;
          }
        `}</style>
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <Rehydrate />
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
