"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import type { WSMessage } from "@/types";
import toast from "react-hot-toast";
import { Trophy, Zap, Upload } from "lucide-react";

const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const wsProtocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || (isLocal || typeof window === "undefined" ? "ws://127.0.0.1:8000" : `${wsProtocol}//${window.location.host}/api/backend`);
const RECONNECT_DELAY_MS = 3000;

const BADGE_LABELS: Record<string, string> = {
  BEGINNER: "🥉 Beginner",
  INTERMEDIATE: "🥈 Intermediate",
  SOPHISTICATED: "🏆 Sophisticated",
};

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuthStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || !accessToken) return;

    let active = true;

    function connect() {
      if (!active || !user || !accessToken) return;
      const url = `${WS_BASE}/ws/${user.id}?token=${encodeURIComponent(accessToken)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          handleMessage(msg);
        } catch {
          /* ignore non-JSON */
        }
      };

      ws.onclose = () => {
        if (active) {
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      ws.onerror = () => ws.close();

      // Keepalive ping every 25s
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 25_000);

      ws.onclose = () => {
        clearInterval(ping);
        if (active) {
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };
    }

    connect();

    return () => {
      active = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [user?.id, accessToken]);

  return <>{children}</>;
}

function handleMessage(msg: WSMessage) {
  switch (msg.type) {
    case "upload_success":
      toast.success(
        `Note uploaded: ${msg.payload.subject_code} — ${msg.payload.tag}`,
        { icon: "📤", duration: 4000 }
      );
      break;
    case "badge_unlocked":
      toast.success(
        `Badge unlocked: ${BADGE_LABELS[msg.payload.badge_type as string] ?? msg.payload.badge_type}!`,
        { icon: "🏅", duration: 6000 }
      );
      break;
    case "streak_update":
      toast(
        `🔥 Streak: ${msg.payload.streak} day${Number(msg.payload.streak) !== 1 ? "s" : ""}!`,
        {
          icon: "🔥",
          duration: 3000,
          style: {
            background: "rgba(251,146,60,0.15)",
            border: "1px solid rgba(251,146,60,0.4)",
          },
        }
      );
      break;
  }
}
