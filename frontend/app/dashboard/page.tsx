"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Upload, Download, Flame, Trophy, BookOpen, LogOut,
  User, Building, GraduationCap, Calendar, Star, Lock, TrendingUp,
  LayoutDashboard, Library, NotebookPen,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import api from "@/lib/api";
import type { User as UserType, BadgeType } from "@/types";
import toast from "react-hot-toast";

const BADGE_CONFIG: Record<BadgeType, {
  label: string; icon: string; color: string; glow: string;
  threshold: string; description: string;
}> = {
  BEGINNER: {
    label: "Beginner", icon: "🥉", color: "#cd7f32",
    glow: "rgba(205,127,50,0.4)", threshold: "5 uploads",
    description: "Upload 5 notes",
  },
  INTERMEDIATE: {
    label: "Intermediate", icon: "🥈", color: "#c0c0c0",
    glow: "rgba(192,192,192,0.4)", threshold: "50 uploads",
    description: "Upload 50 notes",
  },
  SOPHISTICATED: {
    label: "Sophisticated", icon: "🏆", color: "#ffd700",
    glow: "rgba(255,215,0,0.4)", threshold: "100-day streak",
    description: "Maintain a 100-day streak",
  },
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, clearAuth, updateUser } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  // Guard: redirect if not authenticated
  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  // Refresh user data from backend on mount
  useEffect(() => {
    if (!user) return;
    setRefreshing(true);
    api.get<UserType>("/api/auth/me")
      .then(({ data }) => updateUser(data))
      .catch(() => {/* silent */})
      .finally(() => setRefreshing(false));
  }, []);

  if (!user) return null;

  function handleLogout() {
    clearAuth();
    toast.success("Logged out successfully");
    router.push("/login");
  }

  const earnedBadgeTypes = new Set(user.badges.map((b) => b.badge_type));

  // Progress calculations
  const beginnerProgress = Math.min((user.total_uploads / 5) * 100, 100);
  const intermediateProgress = Math.min((user.total_uploads / 50) * 100, 100);
  const sophisticatedProgress = Math.min((user.current_streak / 100) * 100, 100);

  const PROGRESS: Record<BadgeType, number> = {
    BEGINNER: beginnerProgress,
    INTERMEDIATE: intermediateProgress,
    SOPHISTICATED: sophisticatedProgress,
  };
  const PROGRESS_LABEL: Record<BadgeType, string> = {
    BEGINNER: `${user.total_uploads}/5 uploads`,
    INTERMEDIATE: `${user.total_uploads}/50 uploads`,
    SOPHISTICATED: `${user.current_streak}/100 day streak`,
  };

  return (
    <div className="notebook-page min-h-screen relative">
      <div className="notebook-shell">
        <aside className="notebook-sidebar">
          <div className="notebook-brand">
            <div className="notebook-brand-mark"><BookOpen size={20} /></div>
            <span>Scholr</span>
          </div>

          <p className="notebook-sidebar-label">My workspace</p>
          <nav className="notebook-nav" aria-label="Main navigation">
            {[
              { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
              { label: "Upload Notes", href: "/upload", icon: Upload },
              { label: "Browse Notes", href: "/notes", icon: Library },
            ].map(({ label, href, icon: Icon }) => (
              <button
                key={href}
                className={`notebook-nav-item ${href === "/dashboard" ? "active" : ""}`}
                onClick={() => router.push(href)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="notebook-sidebar-footer">
            <div className="notebook-sticker"><NotebookPen size={16} /> Keep learning</div>
            <button id="logout-btn" onClick={handleLogout} className="notebook-logout">
              <LogOut size={16} />
              <span>Log out</span>
            </button>
          </div>
        </aside>

        <div className="notebook-binding" aria-hidden="true">
          {Array.from({ length: 15 }, (_, index) => <span key={index} />)}
        </div>

        <main className="notebook-content max-w-6xl px-6 py-10 space-y-10">
        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-4xl font-bold">
            Welcome back, <span className="gradient-text">{user.name.split(" ")[0]}</span> 👋
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {user.college} · {user.stream} · {user.year} Year
          </p>
        </motion.div>

        {/* Stat Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
        >
          {[
            { icon: <User size={18} />, label: "Name", value: user.name.split(" ")[0], color: "#f5b942" },
            { icon: <Building size={18} />, label: "College", value: user.college.split(" ")[0], color: "#ff7a6b" },
            { icon: <GraduationCap size={18} />, label: "Stream", value: user.stream, color: "#ff7a6b" },
            { icon: <Calendar size={18} />, label: "Year", value: `${user.year} Year`, color: "#f59e0b" },
            { icon: <Upload size={18} />, label: "Uploads", value: user.total_uploads, color: "#10b981" },
            { icon: <Download size={18} />, label: "Downloads", value: user.total_downloads, color: "#6366f1" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              whileHover={{ scale: 1.03, y: -2 }}
              className="glass rounded-2xl p-4 flex flex-col gap-2"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${stat.color}22`, color: stat.color }}>
                {stat.icon}
              </div>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{stat.label}</p>
              <p className="font-bold text-lg truncate" style={{ color: "var(--text-primary)" }}>
                {stat.value}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Streak + Badges Row */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Streak Tracker */}
          <motion.div
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(251,146,60,0.15)" }}>
                <Flame size={20} className="text-orange-400" />
              </div>
              <div>
                <h2 className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>Daily Streak</h2>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Upload every day to keep it alive</p>
              </div>
            </div>

            <div className="flex items-end gap-3 mb-4">
              <span className="text-6xl font-black" style={{
                background: "linear-gradient(135deg, #f97316, #fbbf24)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                {user.current_streak}
              </span>
              <span className="text-lg font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>days</span>
            </div>

            {user.last_upload_date && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Last upload: {new Date(user.last_upload_date).toLocaleDateString("en-US", {
                  weekday: "long", year: "numeric", month: "long", day: "numeric",
                })}
              </p>
            )}

            {/* Mini streak bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>
                <span>Progress to Sophisticated</span>
                <span>{user.current_streak}/100</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((user.current_streak / 100) * 100, 100)}%` }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
                  className="h-full rounded-full shimmer-bar"
                />
              </div>
            </div>
          </motion.div>

          {/* Quick actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-6 flex flex-col justify-between"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(139,92,246,0.15)" }}>
                <TrendingUp size={20} style={{ color: "var(--accent-purple)" }} />
              </div>
              <div>
                <h2 className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>Quick Actions</h2>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Jump right in</p>
              </div>
            </div>

            <div className="space-y-3">
              <motion.button
                id="dashboard-upload-btn"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/upload")}
                className="w-full py-3 rounded-xl font-semibold text-white flex items-center gap-3 px-4 transition-all"
                style={{ background: "linear-gradient(135deg, #f5b942, #ff7a6b)" }}
              >
                <Upload size={18} />
                Upload Notes
              </motion.button>
              <motion.button
                id="dashboard-browse-btn"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/notes")}
                className="w-full py-3 rounded-xl font-semibold flex items-center gap-3 px-4 transition-all"
                style={{ background: "rgba(139,92,246,0.1)", color: "var(--accent-purple)", border: "1px solid var(--border-accent)" }}
              >
                <Download size={18} />
                Browse Notes
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(255,215,0,0.12)" }}>
              <Trophy size={20} className="text-yellow-400" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold" style={{ color: "var(--text-primary)" }}>Achievements</h2>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {earnedBadgeTypes.size}/3 badges unlocked
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {(Object.entries(BADGE_CONFIG) as [BadgeType, typeof BADGE_CONFIG[BadgeType]][]).map(([type, cfg], i) => {
              const earned = earnedBadgeTypes.has(type);
              const progress = PROGRESS[type];
              const progressLabel = PROGRESS_LABEL[type];

              return (
                <motion.div
                  key={type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  whileHover={{ scale: 1.02, y: -3 }}
                  className="glass rounded-2xl p-6 relative overflow-hidden transition-all"
                  style={{
                    border: earned ? `1px solid ${cfg.color}44` : "1px solid var(--border-subtle)",
                    boxShadow: earned ? `0 0 20px ${cfg.glow}` : "none",
                  }}
                >
                  {/* Earned glow background */}
                  {earned && (
                    <div className="absolute inset-0 opacity-5"
                      style={{ background: `radial-gradient(circle at 50% 0%, ${cfg.color}, transparent 70%)` }} />
                  )}

                  <div className="relative">
                    {/* Badge icon */}
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className={`text-5xl transition-all ${!earned ? "badge-locked" : "float-animation"}`}
                        style={{ filter: earned ? `drop-shadow(0 0 12px ${cfg.glow})` : undefined }}
                      >
                        {cfg.icon}
                      </div>
                      {earned ? (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                          style={{ background: `${cfg.color}22`, color: cfg.color }}>
                          <Star size={11} fill="currentColor" />
                          Earned
                        </div>
                      ) : (
                        <Lock size={16} style={{ color: "var(--text-muted)" }} />
                      )}
                    </div>

                    <h3 className="font-bold text-lg mb-0.5" style={{ color: earned ? cfg.color : "var(--text-secondary)" }}>
                      {cfg.label}
                    </h3>
                    <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                      {cfg.description}
                    </p>

                    {!earned && (
                      <div>
                        <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>
                          <span>{progressLabel}</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 + i * 0.1 }}
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${cfg.color}88, ${cfg.color})` }}
                          />
                        </div>
                      </div>
                    )}

                    {earned && (
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Unlocked {new Date(user.badges.find((b) => b.badge_type === type)!.unlocked_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
        </main>
      </div>
    </div>
  );
}
