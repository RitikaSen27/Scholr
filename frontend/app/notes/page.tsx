"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Folder, FolderOpen, FileText, ChevronDown, ArrowLeft,
  Search, BookOpen, Clock, User,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import type { NoteFolder, Note } from "@/types";
import toast from "react-hot-toast";

export default function NotesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    fetchNotes();
  }, [user]);

  async function fetchNotes() {
    setLoading(true);
    try {
      const { data } = await api.get<NoteFolder[]>("/api/notes/list");
      setFolders(data);
    } catch {
      toast.error("Failed to load notes.");
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
      toast.success(`Downloading ${note.upload_date} — ${note.tag}`);
    } catch {
      toast.error("Download failed. Please try again.");
    } finally {
      setDownloading(null);
    }
  }

  function toggleFolder(code: string) {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  // Filter
  const filtered = folders.filter(
    (f) =>
      f.subject_code.toLowerCase().includes(search.toLowerCase()) ||
      f.subject_name.toLowerCase().includes(search.toLowerCase())
  );

  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="orb w-96 h-96 bg-cyan-700 -top-20 -right-20 opacity-10" />

      {/* Nav */}
      <nav className="sticky top-0 z-50 glass border-b px-6 py-4" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button id="notes-back-btn" onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors" style={{ color: "var(--text-secondary)" }}>
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)" }}>
              <Download size={14} className="text-white" />
            </div>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Browse Notes</span>
          </div>
          <div className="ml-auto text-xs" style={{ color: "var(--text-secondary)" }}>
            {folders.length} subject{folders.length !== 1 ? "s" : ""}
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-1 gradient-text-cyan">Notes Library</h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            All notes organized by subject. Latest uploads always on top.
          </p>

          {/* Search */}
          <div className="relative mb-8">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              id="notes-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by subject code or name..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm focus-ring transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
              }}
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <BookOpen size={48} className="mx-auto mb-4 opacity-30" style={{ color: "var(--text-muted)" }} />
              <p className="font-semibold" style={{ color: "var(--text-secondary)" }}>
                {search ? "No subjects match your search" : "No notes uploaded yet"}
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                {!search && "Be the first to share!"}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {filtered.map((folder, i) => {
                const isOpen = openFolders.has(folder.subject_code);
                return (
                  <motion.div
                    key={folder.subject_code}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass rounded-2xl overflow-hidden"
                  >
                    {/* Folder header */}
                    <button
                      id={`folder-${folder.subject_code}`}
                      onClick={() => toggleFolder(folder.subject_code)}
                      className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/5 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(6,182,212,0.12)" }}>
                        {isOpen
                          ? <FolderOpen size={20} style={{ color: "var(--accent-cyan)" }} />
                          : <Folder size={20} style={{ color: "var(--accent-cyan)" }} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold font-mono text-sm" style={{ color: "var(--accent-cyan)" }}>
                          {folder.subject_code}
                        </p>
                        <p className="font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {folder.subject_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs px-2 py-1 rounded-full"
                          style={{ background: "rgba(6,182,212,0.12)", color: "var(--accent-cyan)" }}>
                          {folder.notes.length} note{folder.notes.length !== 1 ? "s" : ""}
                        </span>
                        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
                        </motion.div>
                      </div>
                    </button>

                    {/* Notes list */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          style={{ overflow: "hidden", borderTop: "1px solid var(--border-subtle)" }}
                        >
                          <div className="p-4 space-y-2">
                            {folder.notes.map((note, j) => (
                              <motion.div
                                key={note.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: j * 0.04 }}
                                className="flex items-center gap-3 p-3 rounded-xl group hover:bg-white/5 transition-colors"
                              >
                                <FileText size={16} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
                                
                                {/* Masked display: only date and tag */}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                                    {note.upload_date} — <span style={{ color: "var(--accent-purple)" }}>{note.tag}</span>
                                  </p>
                                  <div className="flex items-center gap-3 mt-0.5">
                                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                                      <User size={11} />
                                      {note.uploader_name}
                                    </span>
                                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                                      <Clock size={11} />
                                      {new Date(note.upload_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    </span>
                                  </div>
                                </div>

                                {/* Professor */}
                                <span className="text-xs px-2 py-0.5 rounded-full hidden sm:block"
                                  style={{ background: "rgba(139,92,246,0.1)", color: "rgba(167,139,250,0.8)" }}>
                                  {note.professor}
                                </span>

                                {/* Download button */}
                                <motion.button
                                  id={`download-note-${note.id}`}
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleDownload(note)}
                                  disabled={downloading === note.id}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                  style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white" }}
                                >
                                  {downloading === note.id
                                    ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                    : <Download size={14} />
                                  }
                                </motion.button>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
