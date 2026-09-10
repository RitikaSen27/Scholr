"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, IdCard, User, Building, BookOpen, GraduationCap,
  Mail, Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowRight,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import type { AuthResponse } from "@/types";
import toast from "react-hot-toast";

type Step = 1 | 2;

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [uploading, setUploading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  const [form, setForm] = useState({
    student_id: "",
    name: "",
    college: "",
    stream: "",
    year: "",
    email: "",
    password: "",
  });

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setOcrError(null);
    setUploading(true);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const { data } = await api.post<{ student_id: string }>("/api/ocr/extract-id", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((prev) => ({ ...prev, student_id: data.student_id }));
      toast.success(`Student ID detected: ${data.student_id}`);
      setStep(2);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Could not extract ID. Please try a clearer image.";
      setOcrError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  function continueWithManualId() {
    const studentId = Number(form.student_id);
    if (!Number.isInteger(studentId) || studentId < 1 || studentId > 100) {
      toast.error("Enter a Student ID from 1 to 100.");
      return;
    }
    setOcrError(null);
    setStep(2);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegistering(true);
    try {
      const { data } = await api.post<AuthResponse>("/api/auth/register", form);
      setAuth(data.user, data.access_token, data.refresh_token, true);
      toast.success("Account created! Welcome to Scholr 🎉");
      router.push("/dashboard");
    } catch (err: unknown) {
      const responseDetail = (err as {
        response?: { data?: { detail?: unknown } };
      })?.response?.data?.detail;
      const detail = typeof responseDetail === "string"
        ? responseDetail
        : Array.isArray(responseDetail) && typeof responseDetail[0] === "object" && responseDetail[0] !== null && "msg" in responseDetail[0]
          ? String((responseDetail[0] as { msg: unknown }).msg)
          : "";
      const msg = detail.toLowerCase().includes("student id") && detail.toLowerCase().includes("exist")
        ? "This Student ID already exists. Please use a different ID."
        : detail || "Registration failed. Please try again.";
      toast.error(msg);
    } finally {
      setRegistering(false);
    }
  }

  return (
    <main className="auth-page auth-page-tall">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="auth-card max-w-lg mx-auto"
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="auth-logo"><BookOpen size={26} /></div>
          <h1 className="font-display text-3xl font-bold" style={{ color: "#a94f36" }}>Create your account</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Create your student account
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-8">
          {([1, 2] as Step[]).map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`register-step-number w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= s ? "register-step-number-active" : "register-step-number-inactive"}`}
                style={{
                  background: step >= s ? "linear-gradient(135deg, #f5b942, #ff7a6b)" : "rgba(255,255,255,0.08)",
                  color: step >= s ? "white" : "#665b4e",
                }}
              >
                {step > s ? <CheckCircle size={16} /> : s}
              </div>
              <span className={`register-step-label ${step >= s ? "register-step-label-active" : ""}`}>
                {s === 1 ? "Upload ID" : "Profile details"}
              </span>
              {s === 1 && (
                <div
                  className="flex-1 h-0.5 rounded transition-all"
                  style={{ background: step > 1 ? "var(--accent-purple)" : "rgba(255,255,255,0.1)" }}
                />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div>
                <h2 className="font-display text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Upload Your Student ID Card
                </h2>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Our OCR will automatically extract your Student ID number.
                </p>
              </div>

              {/* Drop zone */}
              <motion.div
                id="id-card-dropzone"
                whileHover={{ scale: 1.01 }}
                onClick={() => fileRef.current?.click()}
                className="cursor-pointer rounded-2xl p-8 text-center transition-all animated-border"
                style={{
                  background: "rgba(139,92,246,0.05)",
                  border: "1px dashed rgba(139,92,246,0.4)",
                }}
              >
                {previewUrl ? (
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="ID card preview" className="max-h-40 mx-auto rounded-lg object-cover" />
                    {uploading && (
                      <p className="text-sm" style={{ color: "var(--accent-purple)" }}>
                        Extracting ID...
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: "rgba(139,92,246,0.15)" }}>
                      <IdCard size={28} style={{ color: "var(--accent-purple)" }} />
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                        Drag & drop or click to upload
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                        JPEG, PNG, WebP — max 10 MB
                      </p>
                    </div>
                  </div>
                )}

                {uploading && (
                  <div className="mt-4 flex justify-center">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </motion.div>

              <input
                ref={fileRef}
                id="id-card-file-input"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              <div className="register-or-divider" aria-label="Or enter your ID manually">
                <span>OR</span>
              </div>

              <div className="register-manual-id">
                <div>
                  <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    Enter your Student ID manually
                  </h3>
                  <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                    Use this option if you do not want to upload an ID card.
                  </p>
                </div>
                <InputField
                  id="manual-student-id"
                  label="Student ID (1–100)"
                  icon={<IdCard size={15} />}
                  value={form.student_id}
                  onChange={set("student_id")}
                  placeholder="e.g. 9 or 100"
                  type="number"
                  min={1}
                  max={100}
                  required
                />
                <button
                  id="continue-manual-id-btn"
                  type="button"
                  onClick={continueWithManualId}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
                  style={{ color: "#fffaf0", background: "#a94f36", boxShadow: "2px 3px 0 #7f3e2c" }}
                >
                  Continue with this ID
                </button>
              </div>

              {ocrError && (
                <div className="flex items-start gap-2 p-3 rounded-xl"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-400">{ocrError}</p>
                </div>
              )}

              {ocrError && (
                <button
                  id="skip-ocr-btn"
                  onClick={() => setStep(2)}
                  className="w-full py-2 rounded-xl text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
                >
                  Continue with the entered ID →
                </button>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.form
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleRegister}
              className="space-y-4"
            >
              <div>
                <h2 className="font-display text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Complete Your Profile
                </h2>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Student ID: <span className="font-mono text-amber-400">{form.student_id || "—"}</span>{" "}
                  (editable, 1–100)
                </p>
              </div>

              {/* Student ID can be corrected after OCR or entered manually. */}
              <InputField
                id="reg-student-id"
                label="Student ID"
                icon={<IdCard size={15} />}
                value={form.student_id}
                onChange={set("student_id")}
                placeholder="Enter 1–100"
                type="number"
                min={1}
                max={100}
                required
              />

              {/* Name */}
              <InputField id="reg-name" label="Full Name" icon={<User size={15} />} value={form.name}
                onChange={set("name")} placeholder="Debarghya Chakraborty" required />

              {/* College */}
              <InputField id="reg-college" label="College" icon={<Building size={15} />} value={form.college}
                onChange={set("college")} placeholder="IIT Bombay" required />

              {/* Stream + Year */}
              <div className="grid grid-cols-2 gap-3">
                <InputField id="reg-stream" label="Stream" icon={<GraduationCap size={15} />} value={form.stream}
                  onChange={set("stream")} placeholder="CSE" required />
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Year
                  </label>
                  <select
                    id="reg-year"
                    value={form.year}
                    onChange={set("year")}
                    required
                    className="w-full px-3 py-2.5 rounded-xl text-sm focus-ring transition-all"
                    style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)" }}
                  >
                    <option value="">Select</option>
                    {["1st", "2nd", "3rd", "4th", "5th"].map((y) => (
                      <option key={y} value={y}>{y} Year</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Email */}
              <InputField id="reg-email" label="Email" icon={<Mail size={15} />} type="email" value={form.email}
                onChange={set("email")} placeholder="you@college.edu" required />

              {/* Password */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                  <input
                    id="reg-password"
                    type={showPass ? "text" : "password"}
                    value={form.password}
                    onChange={set("password")}
                    required
                    minLength={8}
                    placeholder="Min 8 characters"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm focus-ring transition-all"
                    style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)" }}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-amber-400 transition-colors"
                    style={{ color: "var(--text-muted)" }}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <motion.button
                id="register-submit"
                type="submit"
                disabled={registering}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #f5b942, #ff7a6b)" }}
              >
                {registering ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload size={17} />
                    Create Account
                  </>
                )}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>

        <p className="text-center text-sm mt-6" style={{ color: "var(--text-secondary)" }}>
          Already have an account?{" "}
          <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--accent-purple)" }}>
            Sign in
          </Link>
        </p>
      </motion.div>
    </main>
  );
}

function InputField({
  id, label, icon, value, onChange, placeholder, type = "text", required, disabled, min, max,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
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
          type={type}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          min={min}
          max={max}
          placeholder={placeholder}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus-ring transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: disabled ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.06)",
            color: "var(--text-primary)",
            border: disabled ? "1px solid var(--border-accent)" : "1px solid var(--border-subtle)",
          }}
        />
      </div>
    </div>
  );
}
