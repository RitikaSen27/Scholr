"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

export default function RootPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    const destination = user ? "/dashboard" : "/login";
    const timeout = window.setTimeout(() => router.replace(destination), 1500);
    return () => window.clearTimeout(timeout);
  }, [router, user]);

  return (
    <main className="splash-page" aria-label="Loading Scholr">
      <motion.section
        className="splash-content"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <motion.div
          className="splash-logo"
          animate={{ rotate: [-4, 4, -4] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <BookOpen size={42} />
        </motion.div>
        <p className="splash-eyebrow">Your campus notebook</p>
        <h1>Scholr</h1>
        <div className="splash-rule" />
      </motion.section>
    </main>
  );
}
