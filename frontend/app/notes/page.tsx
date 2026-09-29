"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Folder, FolderOpen, FileText, ChevronDown,
  Search, BookOpen, Clock, User, Star, Eye, X, Send,
  MessageSquare,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import type { NoteFolder, Note, NoteDetail, Review } from "@/types";
import toast from "react-hot-toast";
import NotebookLayout from "@/components/NotebookLayout";

/* ─── Star Rating Component ─────────────────────────────────────────────── */
function StarRating({
  rating,
  size = 14,
  interactive = false,
  onChange,
}: {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (r: number) => void;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = interactive ? star <= (hover || rating) : star <= Math.round(rating);
        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(star)}
            onMouseEnter={() => interactive && setHover(star)}
            onMouseLeave={() => interactive && setHover(0)}
            className="transition-all duration-150"
            style={{
              cursor: interactive ? "pointer" : "default",
              transform: interactive && hover === star ? "scale(1.2)" : "scale(1)",
              background: "none",
              border: "none",
              padding: 0,
            }}
          >
            <Star
              size={size}
              fill={filled ? "#fbbf24" : "transparent"}
              stroke={filled ? "#fbbf24" : "var(--text-muted)"}
              strokeWidth={1.5}
            />
          </button>
        );
      })}
    </div>
  );
}

/* ─── Preview / Detail Modal ────────────────────────────────────────────── */
function NoteDetailModal({
  noteId,
  onClose,
}: {
  noteId: number;
  onClose: () => void;
}) {
  const { user } = useAuthStore();
  const [detail, setDetail] = useState<NoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<NoteDetail>(`/api/notes/detail/${noteId}`);
      setDetail(data);
      // Pre-fill user's own review if exists
      if (user) {
        const myReview = data.reviews.find((r) => r.user_id === user.id);
        if (myReview) {
          setMyRating(myReview.rating);
          setMyComment(myReview.comment || "");
        }
      }
    } catch {
      toast.error("Failed to load note details.");
    } finally {
      setLoading(false);
    }
  }, [noteId, user]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  async function submitReview() {
    if (myRating === 0) {
      toast.error("Please select a star rating");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/api/notes/review/${noteId}`, {
        rating: myRating,
        comment: myComment.trim() || null,
      });
      toast.success("Review submitted!");
      await fetchDetail(); // refresh reviews
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  }

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isPdf = detail?.preview_url?.toLowerCase().includes(".pdf");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="glass rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ border: "1px solid var(--border-subtle)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(6,182,212,0.12)" }}>
              <Eye size={20} style={{ color: "var(--accent-cyan)" }} />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-lg truncate" style={{ color: "var(--text-primary)" }}>
                {loading ? "Loading..." : `${detail?.subject_code} — ${detail?.tag}`}
              </h2>
              {detail && (
                <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="flex items-center gap-1"><User size={11} /> {detail.uploader_name}</span>
                  <span>{detail.professor}</span>
                  {detail.review_count > 0 && (
                    <span className="flex items-center gap-1">
                      <StarRating rating={detail.avg_rating} size={11} />
                      <span style={{ color: "#fbbf24" }}>{detail.avg_rating}</span>
                      <span>({detail.review_count})</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X size={18} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : detail ? (
            <div className="flex flex-col lg:flex-row">
              {/* PDF Preview */}
              <div className="flex-1 min-h-[300px] lg:min-h-[400px]"
                style={{ borderRight: "1px solid var(--border-subtle)" }}>
                {detail.preview_url && isPdf ? (
                  <iframe
                    src={detail.preview_url}
                    title="Note Preview"
                    className="w-full h-full min-h-[400px] lg:min-h-[500px]"
                    style={{ border: "none", background: "#1a1a2e" }}
                  />
                ) : detail.preview_url ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
                    <FileText size={48} className="mb-4 opacity-40" style={{ color: "var(--text-muted)" }} />
                    <p className="font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                      Preview not available for this file type
                    </p>
                    <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                      Only PDF files can be previewed in the browser
                    </p>
                    <a
                      href={detail.preview_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                      style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)", color: "white" }}
                    >
                      Open File ↗
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full py-20">
                    <p style={{ color: "var(--text-muted)" }}>Preview unavailable</p>
                  </div>
                )}
              </div>

              {/* Reviews Panel */}
              <div className="w-full lg:w-[340px] flex flex-col flex-shrink-0">
                {/* Submit Review */}
                <div className="p-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                    Rate this note
                  </p>
                  <div className="flex items-center gap-3 mb-3">
                    <StarRating rating={myRating} size={22} interactive onChange={setMyRating} />
                    {myRating > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
                        {myRating}/5
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={myComment}
                      onChange={(e) => setMyComment(e.target.value)}
                      placeholder="Add a comment (optional)..."
                      maxLength={500}
                      className="flex-1 px-3 py-2 rounded-xl text-sm focus-ring transition-all"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border-subtle)",
                      }}
                      onKeyDown={(e) => e.key === "Enter" && submitReview()}
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={submitReview}
                      disabled={submitting || myRating === 0}
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all"
                      style={{ background: "linear-gradient(135deg, #8b5cf6, #a855f7)", color: "white" }}
                    >
                      {submitting
                        ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                        : <Send size={14} />
                      }
                    </motion.button>
                  </div>
                </div>

                {/* Reviews List */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare size={14} style={{ color: "var(--text-muted)" }} />
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      Reviews ({detail.review_count})
                    </p>
                  </div>
                  {detail.reviews.length === 0 ? (
                    <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
                      No reviews yet. Be the first!
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {detail.reviews.map((review) => (
                        <div key={review.id} className="p-3 rounded-xl"
                          style={{ background: "rgba(255,255,255,0.04)" }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                              {review.reviewer_name}
                            </span>
                            <StarRating rating={review.rating} size={10} />
                          </div>
                          {review.comment && (
                            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                              {review.comment}
                            </p>
                          )}
                          <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                            {new Date(review.created_at).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric",
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Main Notes Page ───────────────────────────────────────────────────── */
export default function NotesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState<number | null>(null);
  const [previewNoteId, setPreviewNoteId] = useState<number | null>(null);

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
    <NotebookLayout>
      <main className="max-w-4xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold mb-1 gradient-text-cyan">Notes Library</h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            All notes organized by subject. Click any note to preview & review.
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
              <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
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
                                className="flex items-center gap-3 p-3 rounded-xl group hover:bg-white/5 transition-colors cursor-pointer"
                                onClick={() => setPreviewNoteId(note.id)}
                              >
                                <FileText size={16} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
                                
                                {/* Note info */}
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

                                {/* Preview button */}
                                <motion.button
                                  id={`preview-note-${note.id}`}
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewNoteId(note.id);
                                  }}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all opacity-0 group-hover:opacity-100"
                                  style={{ background: "rgba(6,182,212,0.15)", color: "var(--accent-cyan)" }}
                                  title="Preview & Review"
                                >
                                  <Eye size={14} />
                                </motion.button>

                                {/* Download button */}
                                <motion.button
                                  id={`download-note-${note.id}`}
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(note);
                                  }}
                                  disabled={downloading === note.id}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                  style={{ background: "linear-gradient(135deg, #ff7a6b, #e85f50)", color: "white" }}
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

      {/* Preview + Review Modal */}
      <AnimatePresence>
        {previewNoteId !== null && (
          <NoteDetailModal
            noteId={previewNoteId}
            onClose={() => setPreviewNoteId(null)}
          />
        )}
      </AnimatePresence>
    </NotebookLayout>
  );
}
