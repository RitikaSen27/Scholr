import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import { WebSocketProvider } from "@/components/WebSocketProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Scholr — College Notes Sharing Platform",
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
      <body className={`${inter.variable} ${fraunces.variable} font-sans antialiased`} suppressHydrationWarning>
        <WebSocketProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#242a52",
                color: "#f4f1e8",
                border: "1px solid rgba(245,185,66,0.3)",
                borderRadius: "12px",
              },
              success: {
                iconTheme: { primary: "#f5b942", secondary: "#242a52" },
              },
            }}
          />
        </WebSocketProvider>
      </body>
    </html>
  );
}
