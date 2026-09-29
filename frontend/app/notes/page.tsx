"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, FileText, ArrowLeft, Clock, User,
  BookOpen, Flag, CheckCircle, Loader2,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import type { NoteFolder, Note, ReportResponse } from "@/types";
import toast from "react-hot-toast";

export default function SubjectNotesPage() {
  const router = useRouter();
  const params = useParams();
  const subjectCode = decodeURIComponent(params.code as string);
  const { user } = useAuthStore();

  const [folder, setFolder] = useState<NoteFolder | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [reporting, setReporting] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    fetchSubjectNotes();
  }, [user]);

  async function fetchSubjectNotes() {
    setLoading(true);
    try {
      const { data } = await api.get<NoteFolder>(`/api/notes/subject/${encodeURIComponent(subjectCode)}`);
      setFolder(data);
    } catch {
      toast.error("Failed to load notes for this subject.");
      router.back();
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(note: Note) {
    setDownloading(note.id);
    try {
      const { data } = await api.get<{ download_url: string; expires_in: number }>(
        `/api/notes/download/${note.id}`
      );
      window.open(data.download_url, "_blank");
      toast.success("Download started!");
    } catch {
      toast.error("Download failed. Please try again.");
    } finally {
      setDownloading(null);
    }
  }

  async function handleReport(note: Note) {
    if (reporting === note.id) return;
    setReporting(note.id);
    try {
      const { data } = await api.post<ReportResponse>(`/api/notes/${note.id}/report`);
      toast.success(data.message);
      // Update local state optimistically
      setFolder((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          notes: data.report_count >= 3
            ? prev.notes.filter((n) => n.id !== note.id)   // auto-removed
            : prev.notes.map((n) =>
                n.id === note.id
                  ? { ...n, reported_by_me: true, report_count: data.report_count }
                  : n
              ),
        };
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Could not submit report.";
      toast.error(msg);
    } finally {
      setReporting(null);
    }
  }

  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="orb w-96 h-96 bg-cyan-700 -top-20 -right-20 opacity-10" />

      {/* Nav */}
      <nav
        className="sticky top-0 z-50 glass border-b px-6 py-4"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button
            id="subject-back-btn"
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)" }}
            >
              <BookOpen size={14} className="text-white" />
            </div>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {subjectCode}
            </span>
          </div>
          {folder && (
            <div className="ml-auto text-xs" style={{ color: "var(--text-secondary)" }}>
              {folder.notes.length} note{folder.notes.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10 relative z-10">
        {loading ? (
          <div className="flex justify-center py-24">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <Loader2 size={32} style={{ color: "var(--accent-cyan)" }} />
            </motion.div>
          </div>
        ) : folder ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold gradient-text-cyan mb-1">
                {folder.subject_name}
              </h1>
              <p className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
                {folder.subject_code}
              </p>
            </div>

            {/* Notes list */}
            <div className="space-y-3">
              <AnimatePresence>
                {folder.notes.map((note, i) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.04 }}
                    className="group flex items-center gap-4 p-4 rounded-2xl transition-all"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {/* File icon */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(6,182,212,0.1)" }}
                    >
                      <FileText size={18} style={{ color: "var(--accent-cyan)" }} />
                    </div>

                    {/* Note info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                        {note.upload_date} —{" "}
                        <span style={{ color: "var(--accent-purple)" }}>{note.tag}</span>
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span
                          className="flex items-center gap-1 text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <User size={11} />
                          {note.uploader_name}
                        </span>
                        <span
                          className="flex items-center gap-1 text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <Clock size={11} />
                          {new Date(note.upload_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full hidden sm:inline-block"
                          style={{
                            background: "rgba(139,92,246,0.1)",
                            color: "rgba(167,139,250,0.8)",
                          }}
                        >
                          {note.professor}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Report button */}
                      <motion.button
                        id={`report-note-${note.id}`}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleReport(note)}
                        disabled={note.reported_by_me || reporting === note.id}
                        title={
                          note.reported_by_me
                            ? "Already reported"
                            : `Report this note (${note.report_count}/3 reports)`
                        }
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                        style={{
                          background: note.reported_by_me
                            ? "rgba(239,68,68,0.15)"
                            : "rgba(255,255,255,0.05)",
                          color: note.reported_by_me
                            ? "rgba(248,113,113,0.8)"
                            : "var(--text-muted)",
                          opacity: note.reported_by_me ? 1 : undefined,
                          cursor: note.reported_by_me ? "default" : "pointer",
                        }}
                      >
                        {reporting === note.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : note.reported_by_me ? (
                          <CheckCircle size={14} />
                        ) : (
                          <Flag size={14} />
                        )}
                      </motion.button>

                      {/* Download button */}
                      <motion.button
                        id={`download-note-${note.id}`}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDownload(note)}
                        disabled={downloading === note.id}
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-50"
                        style={{
                          background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                          color: "white",
                        }}
                      >
                        {downloading === note.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Download size={14} />
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {folder.notes.length === 0 && (
                <div className="text-center py-16">
                  <BookOpen
                    size={48}
                    className="mx-auto mb-4 opacity-30"
                    style={{ color: "var(--text-muted)" }}
                  />
                  <p style={{ color: "var(--text-secondary)" }}>No notes available for this subject.</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </main>
    </div>
  );
}
