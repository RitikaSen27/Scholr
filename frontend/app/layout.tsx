import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import { WebSocketProvider } from "@/components/WebSocketProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "NoteVault — College Notes Sharing Platform",
  description:
    "Upload, discover, and share college notes. Earn badges, build streaks, and ace your exams.",
  keywords: ["college notes", "study materials", "note sharing", "academic"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <WebSocketProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#1a1a2e",
                color: "#e2e8f0",
                border: "1px solid rgba(139,92,246,0.3)",
                borderRadius: "12px",
              },
              success: {
                iconTheme: { primary: "#8b5cf6", secondary: "#1a1a2e" },
              },
            }}
          />
        </WebSocketProvider>
      </body>
    </html>
  );
}
