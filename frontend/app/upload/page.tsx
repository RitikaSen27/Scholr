"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Upload, FileText, User, Tag, BookOpen,
  CheckCircle, AlertCircle,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import type { UploadResponse } from "@/types";
import toast from "react-hot-toast";
import NotebookLayout from "@/components/NotebookLayout";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export default function UploadPage() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<UploadResponse | null>(null);

  const [form, setForm] = useState({
    subject_code: "",
    subject_name: "",
    professor: "",
    tag: "",
  });

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) return null;

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && ALLOWED_TYPES.includes(dropped.type)) {
      setFile(dropped);
    } else {
      toast.error("Only PDF, DOC, or DOCX files are allowed.");
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Please select a file to upload.");

    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("subject_code", form.subject_code.toUpperCase());
    fd.append("subject_name", form.subject_name);
    fd.append("professor", form.professor);
    fd.append("tag", form.tag);

    try {
      const { data } = await api.post<UploadResponse>("/api/notes/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSuccess(data);
      updateUser({
        total_uploads: user!.total_uploads + 1,
        current_streak: data.streak,
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Upload failed. Please try again.";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  if (success) {
    return (
      <NotebookLayout>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md mx-auto px-6 py-20 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: "rgba(16,185,129,0.15)", border: "2px solid rgba(16,185,129,0.4)" }}
          >
            <CheckCircle size={36} className="text-emerald-400" />
          </motion.div>

          <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            Note Uploaded! 🎉
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            {success.message}
          </p>

          {success.new_badges.length > 0 && (
            <div className="mb-4 p-3 rounded-xl"
              style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)" }}>
              <p className="text-sm font-semibold text-yellow-400 mb-2">🏅 New Badge{success.new_badges.length > 1 ? "s" : ""} Unlocked!</p>
              {success.new_badges.map((b) => (
                <p key={b.badge_type} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {b.badge_type}
                </p>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              onClick={() => { setSuccess(null); setFile(null); setForm({ subject_code: "", subject_name: "", professor: "", tag: "" }); }}
              className="w-full py-3 rounded-xl font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #f5b942, #ff7a6b)" }}
            >
              Upload Another
            </motion.button>
            <button
              onClick={() => router.push("/notes")}
              className="w-full py-3 rounded-xl font-semibold transition-colors"
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
            >
              Browse Notes
            </button>
          </div>
        </motion.div>
      </NotebookLayout>
    );
  }

  return (
    <NotebookLayout>
      <main className="max-w-2xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold mb-1 gradient-text">Upload Notes</h1>
          <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
            Share your knowledge. Help your peers succeed.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Drop zone */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                Note File
              </label>
              <motion.div
                id="upload-dropzone"
                onDragEnter={() => setDragging(true)}
                onDragLeave={() => setDragging(false)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                whileHover={{ scale: 1.01 }}
                onClick={() => document.getElementById("file-picker")?.click()}
                className="cursor-pointer rounded-2xl p-8 text-center transition-all"
                style={{
                  background: dragging ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.03)",
                  border: `2px dashed ${dragging ? "rgba(139,92,246,0.6)" : "rgba(255,255,255,0.12)"}`,
                }}
              >
                {file ? (
                  <div className="flex items-center gap-3 justify-center">
                    <FileText size={24} style={{ color: "var(--accent-purple)" }} />
                    <div className="text-left">
                      <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{file.name}</p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <CheckCircle size={18} className="text-emerald-400 ml-auto" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="mx-auto w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(139,92,246,0.12)" }}>
                      <Upload size={22} style={{ color: "var(--accent-purple)" }} />
                    </div>
                    <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                      Drop file here or click to browse
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      PDF, DOC, DOCX — max 50 MB
                    </p>
                  </div>
                )}
              </motion.div>
              <input
                id="file-picker"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={onFileChange}
                className="hidden"
              />
            </div>

            {/* Form fields */}
            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormInput id="subject-code" label="Subject Code" icon={<BookOpen size={15} />}
                  value={form.subject_code} onChange={set("subject_code")}
                  placeholder="DSC2022" required transform="uppercase" />
                <FormInput id="subject-name" label="Subject Name" icon={<BookOpen size={15} />}
                  value={form.subject_name} onChange={set("subject_name")}
                  placeholder="Data Structures" required />
              </div>
              <FormInput id="professor" label="Professor Name" icon={<User size={15} />}
                value={form.professor} onChange={set("professor")}
                placeholder="Prof. Sharma" required />
              <FormInput id="tag" label="Tag" icon={<Tag size={15} />}
                value={form.tag} onChange={set("tag")}
                placeholder="M2 L2" required />
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 p-4 rounded-xl"
              style={{ background: "rgba(139,92,246,0.06)", border: "1px solid var(--border-accent)" }}>
              <AlertCircle size={16} style={{ color: "var(--accent-purple)", marginTop: 2 }} />
              <div className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
                <p>Uploading a note counts towards your streak and badge progress.</p>
                <p>Your original filename will be masked — only the date and tag are shown publicly.</p>
              </div>
            </div>

            <motion.button
              id="upload-submit-btn"
              type="submit"
              disabled={uploading || !file}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
              style={{ background: "linear-gradient(135deg, #f5b942, #ff7a6b)" }}
            >
              {uploading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Upload size={18} />
                  Upload Note
                </>
              )}
            </motion.button>
          </form>
        </motion.div>
      </main>
    </NotebookLayout>
  );
}

function FormInput({
  id, label, icon, value, onChange, placeholder, required, transform,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  transform?: "uppercase";
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
          {icon}
        </span>
        <input
          id={id}
          type="text"
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          style={{
            textTransform: transform,
            background: "rgba(255,255,255,0.06)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)",
          }}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus-ring transition-all"
        />
      </div>
    </div>
  );
}
