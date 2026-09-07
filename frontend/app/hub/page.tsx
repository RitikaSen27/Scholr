"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Upload, Download, BookOpen, ArrowLeft, Zap, Users, Star } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

const stats = [
  { label: "Notes Uploaded", value: "12,400+", icon: <Upload size={16} /> },
  { label: "Active Students", value: "3,200+", icon: <Users size={16} /> },
  { label: "Subjects Covered", value: "850+", icon: <BookOpen size={16} /> },
];

export default function HubPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) return null;

  return (
    <div
      className="min-h-screen relative overflow-hidden flex flex-col"
      style={{ background: "var(--gradient-hero)" }}
    >
      {/* Background orbs */}
      <div className="orb w-[600px] h-[600px] bg-amber-700 -top-60 -right-60" />
      <div className="orb w-96 h-96 bg-rose-700 bottom-0 -left-20" />
      <div className="orb w-64 h-64 bg-rose-700 top-1/3 left-1/4" />

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: "linear-gradient(rgba(139,92,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 px-6 py-5 flex items-center justify-between max-w-6xl mx-auto w-full">
        <button
          id="hub-back-btn"
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-amber-400"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={16} />
          Dashboard
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #f5b942, #ff7a6b)" }}>
            <BookOpen size={16} className="text-white" />
          </div>
          <span className="font-bold gradient-text">Scholr</span>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-px flex-1 max-w-20" style={{ background: "linear-gradient(to right, transparent, rgba(139,92,246,0.5))" }} />
            <span className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ background: "rgba(139,92,246,0.15)", color: "var(--accent-purple)", border: "1px solid var(--border-accent)" }}>
              Knowledge Hub
            </span>
            <div className="h-px flex-1 max-w-20" style={{ background: "linear-gradient(to left, transparent, rgba(139,92,246,0.5))" }} />
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-black mb-4">
            <span className="gradient-text">Share.</span>{" "}
            <span style={{ color: "var(--text-primary)" }}>Learn.</span>{" "}
            <span className="gradient-text-cyan">Grow.</span>
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: "var(--text-secondary)" }}>
            Hello, <strong style={{ color: "var(--text-primary)" }}>{user.name.split(" ")[0]}</strong>! What would you like to do today?
          </p>
        </motion.div>

        {/* CTA Cards */}
        <div className="grid md:grid-cols-2 gap-6 w-full max-w-3xl mb-16">
          {/* Upload CTA */}
          <motion.button
            id="hub-upload-cta"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            whileHover={{ scale: 1.03, y: -5 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push("/upload")}
            className="group relative overflow-hidden rounded-3xl p-8 text-left cursor-pointer animated-border"
            style={{
              background: "rgba(139,92,246,0.08)",
              border: "1px solid rgba(139,92,246,0.2)",
            }}
          >
            {/* Card glow on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: "radial-gradient(circle at 50% 100%, rgba(139,92,246,0.15), transparent 60%)" }}
            />

            <div className="relative">
              <motion.div
                whileHover={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.5 }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 glow-purple"
                style={{ background: "linear-gradient(135deg, #f5b942, #d99a2b)" }}
              >
                <Upload size={30} className="text-white" />
              </motion.div>

              <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                Upload Notes
              </h2>
              <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                Share your handwritten or digital notes. Earn badges, build your streak, and help fellow students.
              </p>

              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--accent-purple)" }}>
                Start uploading
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  →
                </motion.span>
              </div>

              {/* Perks */}
              <div className="mt-4 flex flex-wrap gap-2">
                {["Earn badges", "Build streak", "+1 to community"].map((perk) => (
                  <span key={perk} className="text-xs px-2 py-1 rounded-full"
                    style={{ background: "rgba(139,92,246,0.15)", color: "rgba(167,139,250,0.9)" }}>
                    {perk}
                  </span>
                ))}
              </div>
            </div>
          </motion.button>

          {/* Download CTA */}
          <motion.button
            id="hub-download-cta"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            whileHover={{ scale: 1.03, y: -5 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push("/notes")}
            className="group relative overflow-hidden rounded-3xl p-8 text-left cursor-pointer"
            style={{
              background: "rgba(6,182,212,0.08)",
              border: "1px solid rgba(6,182,212,0.2)",
            }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: "radial-gradient(circle at 50% 100%, rgba(6,182,212,0.15), transparent 60%)" }}
            />

            <div className="relative">
              <motion.div
                whileHover={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.5 }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 glow-cyan"
                style={{ background: "linear-gradient(135deg, #ff7a6b, #e85f50)" }}
              >
                <Download size={30} className="text-white" />
              </motion.div>

              <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                Download Notes
              </h2>
              <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                Browse notes by subject, sorted latest first. Discover exactly what you need for your next exam.
              </p>

              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--accent-cyan)" }}>
                Browse library
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}
                >
                  →
                </motion.span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {["By subject", "Latest first", "Instant download"].map((perk) => (
                  <span key={perk} className="text-xs px-2 py-1 rounded-full"
                    style={{ background: "rgba(6,182,212,0.15)", color: "rgba(103,232,249,0.9)" }}>
                    {perk}
                  </span>
                ))}
              </div>
            </div>
          </motion.button>
        </div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-2xl px-8 py-5 flex flex-col sm:flex-row items-center gap-6 sm:gap-12"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(139,92,246,0.15)", color: "var(--accent-purple)" }}>
                {stat.icon}
              </div>
              <div>
                <p className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>{stat.value}</p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{stat.label}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
