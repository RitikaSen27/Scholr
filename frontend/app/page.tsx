"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ArrowLeft, BookOpen, Hash, ChevronRight,
  Loader2, Sparkles, X, FileText,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import type { SubjectSearchResult } from "@/types";
import toast from "react-hot-toast";

export default function SearchPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SubjectSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    inputRef.current?.focus();
  }, [user]);

  // Debounced search — fires 400 ms after the user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setSearched(false); return; }

    debounceRef.current = setTimeout(() => {
      doSearch(query.trim());
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  async function doSearch(q: string) {
    setLoading(true);
    setSearched(false);
    try {
      const { data } = await api.get<SubjectSearchResult[]>("/api/notes/search", {
        params: { q },
      });
      setResults(data);
    } catch {
      toast.error("Search failed. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  function openSubject(code: string) {
    router.push(`/notes/subject/${encodeURIComponent(code)}`);
  }

  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Background orbs */}
      <div className="orb w-[500px] h-[500px] bg-purple-700 -top-40 -left-40 opacity-10" />
      <div className="orb w-80 h-80 bg-cyan-700 bottom-0 right-0 opacity-10" />

      {/* Nav */}
      <nav
        className="sticky top-0 z-50 glass border-b px-6 py-4"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            id="search-back-btn"
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}
            >
              <Search size={14} className="text-white" />
            </div>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              Find Notes
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          {/* Header */}
          <div className="text-center mb-10">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}
            >
              <Sparkles size={28} className="text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold gradient-text mb-2">Microfilter Search</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Enter a paper code to see all notes uploaded under it
            </p>
          </div>

          {/* Search Input */}
          <div className="relative mb-8">
            <div
              className="absolute inset-0 rounded-2xl opacity-30"
              style={{
                background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                filter: "blur(12px)",
              }}
            />
            <div className="relative flex items-center">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10"
                style={{ color: query ? "var(--accent-purple)" : "var(--text-muted)" }}
              />
              <input
                ref={inputRef}
                id="microfilter-search-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter paper code, e.g. CS301"
                className="w-full pl-12 pr-12 py-4 rounded-2xl text-sm focus-ring transition-all font-medium"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  color: "var(--text-primary)",
                  border: "1px solid rgba(139,92,246,0.3)",
                  backdropFilter: "blur(12px)",
                }}
              />
              {query && (
                <button
                  onClick={() => { setQuery(""); setResults([]); setSearched(false); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Hint chips */}
          {!query && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-wrap gap-2 justify-center mb-8"
            >
              {["Mathematics", "Physics", "CS301", "Data Structures", "English"].map((hint) => (
                <button
                  key={hint}
                  onClick={() => setQuery(hint)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all hover:scale-105"
                  style={{
                    background: "rgba(139,92,246,0.1)",
                    color: "var(--accent-purple)",
                    border: "1px solid rgba(139,92,246,0.2)",
                  }}
                >
                  <Hash size={11} />
                  {hint}
                </button>
              ))}
            </motion.div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <Loader2 size={28} style={{ color: "var(--accent-purple)" }} />
              </motion.div>
            </div>
          )}

          {/* Results */}
          <AnimatePresence mode="wait">
            {!loading && searched && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {results.length === 0 ? (
                  <div className="text-center py-16">
                    <BookOpen
                      size={48}
                      className="mx-auto mb-4 opacity-30"
                      style={{ color: "var(--text-muted)" }}
                    />
                    <p className="font-semibold" style={{ color: "var(--text-secondary)" }}>
                      No subjects found for &ldquo;{query}&rdquo;
                    </p>
                    <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                      Check the paper code and try again
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs mb-4 font-medium" style={{ color: "var(--text-muted)" }}>
                      {results.length} subject{results.length !== 1 ? "s" : ""} found
                    </p>
                    <div className="space-y-3">
                      {results.map((result, i) => (
                        <motion.button
                          key={result.subject_code}
                          id={`search-result-${result.subject_code}`}
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() => openSubject(result.subject_code)}
                          className="w-full group flex items-center gap-4 p-4 rounded-2xl text-left transition-all hover:scale-[1.01]"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                          whileHover={{ borderColor: "rgba(139,92,246,0.4)" }}
                        >
                          {/* Icon */}
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: "rgba(139,92,246,0.12)" }}
                          >
                            <FileText size={20} style={{ color: "var(--accent-purple)" }} />
                          </div>

                          {/* Text */}
                          <div className="flex-1 min-w-0">
                            <p
                              className="font-bold font-mono text-sm mb-0.5"
                              style={{ color: "var(--accent-cyan)" }}
                            >
                              {result.subject_code}
                            </p>
                            <p
                              className="font-medium truncate"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {result.subject_name}
                            </p>
                          </div>

                          {/* Note count badge + arrow */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span
                              className="text-xs px-2 py-1 rounded-full"
                              style={{
                                background: "rgba(6,182,212,0.12)",
                                color: "var(--accent-cyan)",
                              }}
                            >
                              {result.note_count} note{result.note_count !== 1 ? "s" : ""}
                            </span>
                            <ChevronRight
                              size={16}
                              className="opacity-40 group-hover:opacity-100 transition-opacity"
                              style={{ color: "var(--accent-purple)" }}
                            />
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state before any search */}
          {!loading && !searched && !query && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Start typing a paper code to find its notes
              </p>
            </motion.div>
          )}

        </motion.div>
      </main>
    </div>
  );
}
