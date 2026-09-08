"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, LayoutDashboard, Library, LogOut, NotebookPen, Upload } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthStore } from "@/store/useAuthStore";
import toast from "react-hot-toast";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Upload Notes", href: "/upload", icon: Upload },
  { label: "Browse Notes", href: "/notes", icon: Library },
];

export default function NotebookLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { clearAuth } = useAuthStore();
  const [turningTo, setTurningTo] = useState<string | null>(null);

  function navigate(href: string) {
    if (href === pathname || turningTo) return;
    setTurningTo(href);
    window.setTimeout(() => router.push(href), 380);
  }

  function handleLogout() {
    clearAuth();
    toast.success("Logged out successfully");
    navigate("/login");
  }

  return (
    <div className="notebook-page min-h-screen relative">
      <AnimatePresence>
        {turningTo && (
          <motion.div
            className="notebook-page-turn"
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.38, ease: "easeInOut" }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <div className="notebook-shell">
        <aside className="notebook-sidebar">
          <button className="notebook-brand" onClick={() => navigate("/dashboard")} aria-label="Go to dashboard">
            <span className="notebook-brand-mark"><BookOpen size={20} /></span>
            <span>Scholr</span>
          </button>

          <p className="notebook-sidebar-label">My workspace</p>
          <nav className="notebook-nav" aria-label="Main navigation">
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
              <button
                key={href}
                className={`notebook-nav-item ${pathname === href ? "active" : ""}`}
                onClick={() => navigate(href)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="notebook-sidebar-footer">
            <div className="notebook-sticker"><NotebookPen size={16} /> Keep learning</div>
            <button onClick={handleLogout} className="notebook-logout">
              <LogOut size={16} />
              <span>Log out</span>
            </button>
          </div>
        </aside>

        <div className="notebook-binding" aria-hidden="true">
          {Array.from({ length: 15 }, (_, index) => <span key={index} />)}
        </div>

        <main className="notebook-content">{children}</main>
      </div>
    </div>
  );
}
