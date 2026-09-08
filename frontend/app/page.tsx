"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, LogIn, UserPlus } from "lucide-react";

export default function RootPage() {
  return (
    <main className="landing-page">
      <div className="landing-doodle landing-doodle-one" aria-hidden="true">study & share</div>
      <div className="landing-doodle landing-doodle-two" aria-hidden="true">notes for everyone</div>

      <motion.section
        className="landing-content"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65 }}
      >
        <div className="landing-logo"><BookOpen size={42} /></div>
        <p className="landing-eyebrow">Your campus notebook</p>
        <h1>Scholr</h1>
        <p className="landing-description">
          A shared place for better notes, deeper learning, and helping your classmates succeed.
        </p>

        <div className="landing-actions">
          <Link href="/login" className="landing-primary-action">
            <LogIn size={18} />
            Log in
            <ArrowRight size={16} />
          </Link>
          <Link href="/register" className="landing-secondary-action">
            <UserPlus size={18} />
            Create an account
          </Link>
        </div>

        <p className="landing-note">Upload notes. Browse freely. Grow together.</p>
      </motion.section>
    </main>
  );
}
