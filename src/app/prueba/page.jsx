"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Loader2,
  Sparkles,
  User,
  Bot,
  AlertCircle,
  Trash2,
  Terminal,
  Cpu,
  Activity,
  ShieldCheck,
  ChevronRight,
  Lightbulb,
  Info,
  ChevronDown,
  Zap,
  Database,
  Lock,
  Radio,
  BarChart3,
  CircleDot,
  ArrowUpRight,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ─── TYPEWRITER ──────────────────────────────────────────────────────────────
function Typewriter({ text, speed = 8, chunkSize = 18, onUpdate, onComplete }) {
  const [displayedText, setDisplayedText] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timeout = setTimeout(() => {
        // Escribe N caracteres por tick en lugar de 1 → mucho más rápido
        const nextIndex = Math.min(index + chunkSize, text.length);
        setDisplayedText(text.slice(0, nextIndex));
        setIndex(nextIndex);
        if (onUpdate) onUpdate();
      }, speed);
      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [index, text, speed, chunkSize, onUpdate, onComplete]);

  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayedText}</ReactMarkdown>;
}

// ─── ANIMATED GRID BACKGROUND ────────────────────────────────────────────────
function GridBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Grid base */}
      <div className="absolute inset-0 grid-bg" />

      {/* Glowing orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Scan line */}
      <div className="scanline" />

      {/* Corner decorations */}
      <div className="corner-tl" />
      <div className="corner-br" />
    </div>
  );
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
function StatusBadge({ label, value, color = "emerald" }) {
  return (
    <div className={`status-badge status-${color}`}>
      <span className="status-dot" />
      <div>
        <span className="status-label">{label}</span>
        <span className="status-value">{value}</span>
      </div>
    </div>
  );
}

// ─── METRIC CARD ─────────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, sub }) {
  return (
    <div className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <div className="metric-value">{value}</div>
        <div className="metric-label">{label}</div>
        {sub && <div className="metric-sub">{sub}</div>}
      </div>
    </div>
  );
}

// ─── SUGGESTION CARD ──────────────────────────────────────────────────────────
function SuggestionCard({ item, onClick, align = "left" }) {
  return (
    <button onClick={onClick} className={`suggestion-card suggestion-${align}`}>
      <div className="suggestion-glow" />
      <div className="suggestion-inner">
        <div className="suggestion-icon">{item.icon}</div>
        <div className={`suggestion-text ${align === "right" ? "text-right" : ""}`}>
          <span className="suggestion-title">{item.title}</span>
          <p className="suggestion-q">"{item.q}"</p>
        </div>
        <ArrowUpRight className="suggestion-arrow" />
      </div>
    </button>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AntigravityPruebaPage() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedModel, setSelectedModel] = useState("gemini-3.1-flash-lite");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [tick, setTick] = useState(0);

  const scrollRef = useRef(null);
  const modelMenuRef = useRef(null);

  // Clock tick for live indicators
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const availableModels = [
    { id: "gemini-3.1-flash-lite", name: "3.1 Flash Lite", rpd: "500", accent: "emerald" },
    { id: "gemini-3.5-flash", name: "3.5 Flash", rpd: "20", accent: "rose" },
    { id: "gemini-2.5-flash", name: "2.5 Flash", rpd: "20", accent: "blue" },
    { id: "gemma-4-31b", name: "Gemma 4 31B", rpd: "1.5K", accent: "amber" },
  ];

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => { scrollToBottom(); }, [messages, loading]);

  useEffect(() => {
    const handler = (e) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target))
        setShowModelMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const userMessage = prompt.trim();
    if (!userMessage || loading) return;

    const newMessages = [
      ...messages,
      { role: "user", content: userMessage, timestamp: new Date().toLocaleTimeString() },
    ];
    setMessages(newMessages);
    setPrompt("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userMessage,
          model: selectedModel,
          // Enviamos el historial ANTES del mensaje actual para que el modelo
          // tenga contexto de la conversación ("de esas plazas", "ese empleado", etc.)
          // Solo enviamos role y content, sin los campos de UI (timestamp, isNew)
          history: messages.map(({ role, content }) => ({ role, content })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error de conexión");

      setMessages([
        ...newMessages,
        {
          role: "bot",
          content: data.response,
          timestamp: new Date().toLocaleTimeString(),
          isNew: true,
        },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  const exampleQuestions = [
    { title: "Personal Activo", q: "¿Quién es el empleado 00020260554?", icon: <User className="w-3.5 h-3.5" /> },
    { title: "Estatus de Plaza", q: "Analizar estatus de plaza 12345", icon: <Cpu className="w-3.5 h-3.5" /> },
    { title: "Bajas Recientes", q: "¿Por qué motivo se dio de baja a Juan Pérez?", icon: <Info className="w-3.5 h-3.5" /> },
    { title: "Control de Gestión", q: "Detalles del determinante 800", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { title: "Fecha de Vacancia", q: "¿Desde cuándo está vacante la posición 555?", icon: <Activity className="w-3.5 h-3.5" /> },
  ];

  const currentModel = availableModels.find((m) => m.id === selectedModel);
  const now = new Date();

  return (
    <>
      {/* ── GLOBAL STYLES ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        /* ─ Reset base ─ */
        .prueba-root * { box-sizing: border-box; }
        .prueba-root { font-family: 'Inter', sans-serif; }

        /* ─ Grid background ─ */
        .grid-bg {
          background-image:
            linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent);
        }

        /* ─ Orbs ─ */
        .orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.35; }
        .orb-1 {
          width: 500px; height: 500px;
          top: -120px; left: -120px;
          background: radial-gradient(circle, #fda4af 0%, #fb7185 40%, transparent 70%);
          animation: orbFloat1 12s ease-in-out infinite;
        }
        .orb-2 {
          width: 400px; height: 400px;
          bottom: -80px; right: -80px;
          background: radial-gradient(circle, #a5b4fc 0%, #818cf8 40%, transparent 70%);
          animation: orbFloat2 15s ease-in-out infinite;
        }
        .orb-3 {
          width: 300px; height: 300px;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle, #fde68a 0%, #fbbf24 40%, transparent 70%);
          opacity: 0.15;
          animation: orbFloat3 20s ease-in-out infinite;
        }
        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, 30px) scale(1.05); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, -40px) scale(1.08); }
        }
        @keyframes orbFloat3 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.15; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.08; }
        }

        /* ─ Scanline ─ */
        .scanline {
          position: absolute; inset: 0;
          background: linear-gradient(transparent 50%, rgba(99,102,241,0.015) 50%);
          background-size: 100% 4px;
          pointer-events: none;
          animation: scanMove 8s linear infinite;
        }
        @keyframes scanMove {
          0% { background-position: 0 0; }
          100% { background-position: 0 100%; }
        }

        /* ─ Corners ─ */
        .corner-tl, .corner-br {
          position: absolute; width: 120px; height: 120px;
          pointer-events: none;
        }
        .corner-tl {
          top: 24px; left: 24px;
          border-top: 2px solid rgba(99,102,241,0.2);
          border-left: 2px solid rgba(99,102,241,0.2);
          border-radius: 8px 0 0 0;
        }
        .corner-br {
          bottom: 24px; right: 24px;
          border-bottom: 2px solid rgba(99,102,241,0.2);
          border-right: 2px solid rgba(99,102,241,0.2);
          border-radius: 0 0 8px 0;
        }

        /* ─ Status badge ─ */
        .status-badge {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 12px;
          background: rgba(255,255,255,0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.9);
          border-radius: 100px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .status-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.2);
          animation: pulse 2s ease-in-out infinite;
        }
        .status-badge-rose .status-dot { background: #f43f5e; box-shadow: 0 0 0 3px rgba(244,63,94,0.2); }
        .status-badge-blue .status-dot { background: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.2); }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .status-label {
          display: block; font-size: 9px; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8;
          font-family: 'JetBrains Mono', monospace;
        }
        .status-value {
          display: block; font-size: 11px; font-weight: 700;
          color: #1e293b; font-family: 'JetBrains Mono', monospace;
        }

        /* ─ Metric card ─ */
        .metric-card {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px;
          background: rgba(255,255,255,0.6);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.9);
          border-radius: 14px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.05);
          transition: all 0.2s;
        }
        .metric-card:hover { background: rgba(255,255,255,0.85); transform: translateY(-1px); }
        .metric-icon {
          width: 34px; height: 34px; border-radius: 10px;
          background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
          display: flex; align-items: center; justify-content: center;
          color: #6366f1; flex-shrink: 0;
        }
        .metric-value { font-size: 15px; font-weight: 800; color: #0f172a; line-height: 1; }
        .metric-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin-top: 2px; }
        .metric-sub { font-size: 9px; color: #10b981; font-weight: 600; margin-top: 1px; font-family: 'JetBrains Mono', monospace; }

        /* ─ Header ─ */
        .cmd-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px;
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.95);
          border-radius: 20px;
          box-shadow:
            0 1px 0 rgba(255,255,255,0.8) inset,
            0 8px 32px rgba(0,0,0,0.06),
            0 2px 8px rgba(99,102,241,0.08);
          position: relative;
          z-index: 100;
        }
        .cmd-header::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(99,102,241,0.4), rgba(244,63,94,0.4), transparent);
        }
        .header-brand {
          display: flex; align-items: center; gap: 14px;
        }
        .brand-icon {
          width: 42px; height: 42px; border-radius: 12px;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(15,23,42,0.25), 0 0 0 1px rgba(255,255,255,0.1) inset;
          position: relative; overflow: hidden;
        }
        .brand-icon::after {
          content: '';
          position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          animation: shimmer 3s ease-in-out infinite;
        }
        @keyframes shimmer { 0% { left: -100%; } 100% { left: 100%; } }
        .brand-tag {
          font-size: 9px; font-weight: 800; letter-spacing: 0.12em;
          text-transform: uppercase; color: #6366f1;
          font-family: 'JetBrains Mono', monospace;
          display: flex; align-items: center; gap: 6px;
        }
        .live-indicator {
          display: flex; gap: 3px; align-items: center;
        }
        .live-dot {
          width: 5px; height: 5px; border-radius: 50%; background: #10b981;
          animation: livePulse 1s ease-in-out infinite;
        }
        .live-dot:nth-child(2) { animation-delay: 0.2s; }
        .live-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes livePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }
        .brand-title {
          font-size: 17px; font-weight: 800; color: #0f172a; letter-spacing: -0.03em; line-height: 1;
        }

        /* ─ Model selector ─ */
        .model-selector {
          padding: 0 20px; border-left: 1px solid rgba(226,232,240,0.8); border-right: 1px solid rgba(226,232,240,0.8);
          display: flex; gap: 20px;
        }
        .model-field { display: flex; flex-direction: column; }
        .field-label {
          font-size: 8px; font-weight: 800; text-transform: uppercase;
          letter-spacing: 0.1em; color: #94a3b8;
          font-family: 'JetBrains Mono', monospace;
        }
        .model-btn {
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 700; color: #0f172a;
          background: none; border: none; cursor: pointer; padding: 0;
          font-family: 'JetBrains Mono', monospace;
          transition: color 0.2s;
        }
        .model-btn:hover { color: #6366f1; }
        .model-accent-emerald { color: #059669; }
        .model-accent-rose { color: #f43f5e; }
        .model-accent-blue { color: #6366f1; }
        .model-accent-amber { color: #d97706; }

        .model-dropdown {
          position: absolute; top: calc(100% + 10px); left: 0;
          min-width: 200px;
          background: rgba(255,255,255,0.98);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(226,232,240,0.9);
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.08);
          overflow: hidden; padding: 8px;
          z-index: 9999;
          animation: dropIn 0.15s ease-out;
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .dropdown-item {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; padding: 8px 12px; border-radius: 10px;
          background: none; border: none; cursor: pointer;
          transition: all 0.15s;
          gap: 8px;
        }
        .dropdown-item:hover { background: #f8fafc; }
        .dropdown-item.active { background: rgba(99,102,241,0.06); }
        .dropdown-item-name { font-size: 12px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
        .dropdown-item-rpd {
          font-size: 9px; color: #94a3b8; font-family: 'JetBrains Mono', monospace;
          background: #f1f5f9; padding: 2px 6px; border-radius: 100px;
        }

        /* ─ Suggestion cards ─ */
        .suggestion-card {
          position: relative; width: 100%; text-align: left;
          padding: 12px 14px;
          background: rgba(255,255,255,0.55);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.9);
          border-radius: 16px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.05);
          cursor: pointer; overflow: hidden;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .suggestion-card:hover {
          background: rgba(255,255,255,0.9);
          transform: translateY(-3px) scale(1.01);
          box-shadow: 0 12px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(99,102,241,0.1);
        }
        .suggestion-glow {
          position: absolute; inset: 0; opacity: 0;
          background: radial-gradient(circle at 50% 0%, rgba(99,102,241,0.1), transparent 70%);
          transition: opacity 0.3s;
          pointer-events: none;
        }
        .suggestion-card:hover .suggestion-glow { opacity: 1; }
        .suggestion-inner { display: flex; align-items: center; gap: 10px; position: relative; }
        .suggestion-icon {
          flex-shrink: 0; width: 30px; height: 30px; border-radius: 9px;
          background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
          display: flex; align-items: center; justify-content: center;
          color: #6366f1;
          transition: all 0.2s;
        }
        .suggestion-card:hover .suggestion-icon {
          background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(99,102,241,0.06));
        }
        .suggestion-text { flex: 1; min-width: 0; }
        .suggestion-title {
          display: block; font-size: 9px; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.08em; color: #6366f1;
          font-family: 'JetBrains Mono', monospace;
        }
        .suggestion-q {
          font-size: 10px; font-weight: 600; color: #334155;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          margin: 2px 0 0 0; font-style: italic;
        }
        .suggestion-right .suggestion-text { text-align: right; }
        .suggestion-arrow {
          width: 12px; height: 12px; color: #cbd5e1; flex-shrink: 0;
          transition: all 0.2s;
        }
        .suggestion-card:hover .suggestion-arrow { color: #6366f1; transform: translate(2px, -2px); }
        .suggestions-label {
          display: flex; align-items: center; gap: 6px; padding: 0 4px; margin-bottom: 8px;
        }
        .suggestions-label-text {
          font-size: 9px; font-weight: 800; text-transform: uppercase;
          letter-spacing: 0.1em; color: #94a3b8;
          font-family: 'JetBrains Mono', monospace;
        }

        /* ─ Chat area ─ */
        .chat-panel {
          flex: 1;
          background: rgba(255,255,255,0.65);
          backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.95);
          border-radius: 24px;
          box-shadow:
            0 1px 0 rgba(255,255,255,0.9) inset,
            0 12px 40px rgba(0,0,0,0.07),
            0 2px 8px rgba(99,102,241,0.06);
          display: flex; flex-direction: column; overflow: hidden;
          position: relative;
        }
        .chat-panel::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent 0%, #6366f1 30%, #f43f5e 60%, transparent 100%);
          opacity: 0.6;
        }

        /* ─ Empty state ─ */
        .empty-state {
          height: 100%; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center; gap: 24px; padding: 48px 24px;
        }
        .empty-bot-ring {
          position: relative;
        }
        .empty-bot-ring::before {
          content: '';
          position: absolute; inset: -12px; border-radius: 50%;
          border: 1px dashed rgba(99,102,241,0.2);
          animation: spinSlow 20s linear infinite;
        }
        .empty-bot-ring::after {
          content: '';
          position: absolute; inset: -24px; border-radius: 50%;
          border: 1px dashed rgba(244,63,94,0.15);
          animation: spinSlow 30s linear infinite reverse;
        }
        @keyframes spinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .empty-bot-icon {
          width: 80px; height: 80px; border-radius: 28px;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 12px 40px rgba(15,23,42,0.3), 0 0 0 1px rgba(255,255,255,0.1) inset;
          position: relative;
        }
        .empty-title {
          font-size: 20px; font-weight: 900; color: #0f172a;
          letter-spacing: -0.04em; text-transform: uppercase;
        }
        .empty-sub { font-size: 12px; color: #64748b; line-height: 1.7; max-width: 260px; }
        .empty-chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
        .empty-chip {
          display: flex; align-items: center; gap: 4px;
          padding: 4px 10px; border-radius: 100px;
          background: rgba(99,102,241,0.06);
          border: 1px solid rgba(99,102,241,0.12);
          font-size: 9px; font-weight: 700; color: #6366f1;
          text-transform: uppercase; letter-spacing: 0.06em;
          font-family: 'JetBrains Mono', monospace;
        }

        /* ─ Messages ─ */
        .msg-wrap { display: flex; flex-direction: column; }
        .msg-wrap-user { align-items: flex-end; }
        .msg-wrap-bot { align-items: flex-start; }
        .msg-meta {
          display: flex; align-items: center; gap: 6px;
          padding: 0 8px; margin-bottom: 4px;
        }
        .msg-time { font-size: 9px; font-family: 'JetBrains Mono', monospace; color: #94a3b8; }
        .msg-role {
          font-size: 9px; font-weight: 800; text-transform: uppercase;
          letter-spacing: 0.1em; font-family: 'JetBrains Mono', monospace;
        }
        .msg-role-user { color: #d97706; }
        .msg-role-bot { color: #6366f1; }

        .msg-bubble {
          padding: 14px 18px; border-radius: 18px;
          border: 1px solid;
          box-shadow: 0 2px 12px rgba(0,0,0,0.05);
          transition: box-shadow 0.2s;
        }
        .msg-bubble:hover { box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .msg-bubble-user {
          background: linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(252,211,77,0.06) 100%);
          border-color: rgba(251,191,36,0.25);
          border-radius: 18px 4px 18px 18px;
          max-width: 78%;
        }
        .msg-bubble-bot {
          background: rgba(255,255,255,0.85);
          border-color: rgba(226,232,240,0.8);
          border-radius: 4px 18px 18px 18px;
          max-width: 94%;
        }
        .msg-content-user {
          display: flex; align-items: center; gap: 8px;
          font-size: 13px; font-weight: 600; color: #1e293b;
          font-family: 'JetBrains Mono', monospace;
        }

        /* ─ Loading state ─ */
        .loading-wrap { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
        .loading-tag {
          display: flex; align-items: center; gap: 6px; padding: 0 8px;
          font-size: 9px; font-weight: 800; text-transform: uppercase;
          letter-spacing: 0.1em; color: #6366f1; font-family: 'JetBrains Mono', monospace;
        }
        .loading-bubble {
          background: rgba(255,255,255,0.9);
          border: 1px solid rgba(226,232,240,0.8);
          border-radius: 4px 18px 18px 18px;
          padding: 20px 24px; max-width: 340px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
          position: relative; overflow: hidden;
          display: flex; flex-direction: column; gap: 16px;
        }
        .loading-dots { display: flex; gap: 6px; align-items: center; }
        .loading-dot {
          width: 8px; height: 8px; border-radius: 50%;
          animation: dotBounce 0.8s ease-in-out infinite;
        }
        .loading-dot:nth-child(1) { background: #6366f1; animation-delay: 0s; }
        .loading-dot:nth-child(2) { background: #f43f5e; animation-delay: 0.15s; }
        .loading-dot:nth-child(3) { background: #f59e0b; animation-delay: 0.3s; }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0) scale(1); }
          40% { transform: translateY(-8px) scale(1.1); }
        }
        .loading-text {
          font-size: 10px; font-weight: 600; color: #64748b;
          font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.06em;
        }
        .loading-bar-track {
          width: 100%; height: 2px; background: #f1f5f9; border-radius: 100px; overflow: hidden;
        }
        .loading-bar {
          height: 100%;
          background: linear-gradient(90deg, #6366f1, #f43f5e, #f59e0b);
          background-size: 200% 100%;
          animation: barSlide 2s ease-in-out infinite, barColor 3s linear infinite;
          border-radius: 100px;
        }
        @keyframes barSlide {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 70%; margin-left: 15%; }
          100% { width: 0%; margin-left: 100%; }
        }
        @keyframes barColor {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .loading-scan {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(90deg, transparent, rgba(99,102,241,0.06), transparent);
          animation: scanX 1.5s linear infinite;
        }
        @keyframes scanX { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

        /* ─ Error ─ */
        .error-bar {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 16px; margin: 0 16px 16px;
          background: rgba(254,242,242,0.9);
          border: 1px solid rgba(252,165,165,0.4);
          border-radius: 12px; font-size: 11px; color: #dc2626; font-weight: 600;
        }

        /* ─ Input area ─ */
        .input-area {
          padding: 16px 20px;
          background: rgba(255,255,255,0.8);
          backdrop-filter: blur(16px);
          border-top: 1px solid rgba(226,232,240,0.6);
        }
        .input-form { position: relative; max-width: 100%; }
        .input-glow {
          position: absolute; inset: -2px; border-radius: 22px;
          background: linear-gradient(90deg, rgba(99,102,241,0.15), rgba(244,63,94,0.1), rgba(99,102,241,0.15));
          opacity: 0; transition: opacity 0.3s; pointer-events: none;
          filter: blur(6px);
        }
        .input-form:focus-within .input-glow { opacity: 1; }
        .input-wrap {
          position: relative; display: flex; align-items: center;
          background: rgba(255,255,255,0.95);
          border: 1px solid rgba(226,232,240,0.8);
          border-radius: 18px; overflow: hidden;
          transition: all 0.25s;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        }
        .input-wrap:focus-within {
          border-color: rgba(99,102,241,0.4);
          box-shadow: 0 0 0 4px rgba(99,102,241,0.08), 0 4px 20px rgba(0,0,0,0.06);
        }
        .input-icon { padding: 0 12px 0 18px; color: #94a3b8; transition: color 0.2s; flex-shrink: 0; }
        .input-wrap:focus-within .input-icon { color: #6366f1; }
        .input-field {
          flex: 1; background: transparent; border: none; outline: none;
          padding: 16px 0; font-size: 13px; font-weight: 600; color: #0f172a;
          font-family: 'JetBrains Mono', monospace;
        }
        .input-field::placeholder { color: #94a3b8; font-weight: 500; font-family: 'Inter', sans-serif; }
        .input-field:disabled { opacity: 0.5; }
        .input-submit {
          margin: 6px; padding: 10px 18px;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: white; border: none; border-radius: 12px;
          cursor: pointer; display: flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 700;
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 4px 12px rgba(15,23,42,0.25);
          white-space: nowrap;
        }
        .input-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, #1e293b 0%, #312e81 100%);
          transform: scale(1.03);
          box-shadow: 0 6px 20px rgba(99,102,241,0.3);
        }
        .input-submit:active:not(:disabled) { transform: scale(0.97); }
        .input-submit:disabled { opacity: 0.35; cursor: not-allowed; }
        .input-footer {
          display: flex; align-items: center; gap: 8px;
          margin-top: 10px; padding: 0 4px;
        }
        .input-footer-chip {
          display: flex; align-items: center; gap: 4px;
          font-size: 9px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: #64748b;
          font-family: 'JetBrains Mono', monospace;
        }
        .input-footer-divider { flex: 1; height: 1px; background: rgba(226,232,240,0.6); }
        .input-footer-tag {
          font-size: 9px; font-weight: 700; color: #94a3b8;
          font-family: 'JetBrains Mono', monospace; letter-spacing: 0.08em;
        }

        /* ─ Clear button ─ */
        .clear-btn {
          padding: 8px 10px; border-radius: 12px;
          background: transparent; border: 1px solid transparent; cursor: pointer;
          color: #94a3b8; transition: all 0.2s; display: flex; align-items: center; gap: 6px;
          font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
          font-family: 'JetBrains Mono', monospace;
        }
        .clear-btn:hover {
          background: rgba(244,63,94,0.06); border-color: rgba(244,63,94,0.15); color: #f43f5e;
        }

        /* ─ Scrollbar ─ */
        .chat-scroll::-webkit-scrollbar { width: 4px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.15); border-radius: 10px; }
        .chat-scroll::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.35); }

        /* ─ Prose markdown ─ */
        .bot-prose { font-size: 13px; line-height: 1.8; color: #1e293b; }
        .bot-prose p { margin: 0 0 8px 0; }
        .bot-prose p:last-child { margin: 0; }
        .bot-prose pre {
          background: #0f172a !important; border-radius: 12px;
          padding: 16px !important; overflow-x: auto;
          border: 1px solid rgba(255,255,255,0.06);
          margin: 10px 0;
        }
        .bot-prose code {
          font-family: 'JetBrains Mono', monospace; font-size: 0.85em;
          color: #a78bfa; font-weight: 600;
          background: rgba(99,102,241,0.08); padding: 1px 5px; border-radius: 4px;
        }
        .bot-prose pre code { background: none; color: #e2e8f0; padding: 0; }
        .bot-prose strong { color: #0f172a; font-weight: 800; }
        .bot-prose ul { padding-left: 16px; }
        .bot-prose ul li::marker { color: #6366f1; }
        .bot-prose ol li::marker { color: #6366f1; font-weight: 700; }
        .bot-prose blockquote {
          border-left: 3px solid #6366f1; margin: 0; padding: 8px 14px;
          background: rgba(99,102,241,0.04); border-radius: 0 8px 8px 0;
          color: #475569;
        }
        .bot-prose table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .bot-prose th {
          background: rgba(99,102,241,0.06); color: #0f172a; font-weight: 800;
          padding: 8px 12px; text-align: left; border-bottom: 2px solid rgba(99,102,241,0.15);
        }
        .bot-prose td { padding: 7px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
        .bot-prose tr:hover td { background: rgba(99,102,241,0.03); }
        .bot-prose hr { border: none; border-top: 1px solid #e2e8f0; margin: 12px 0; }

        /* ─ Responsive ─ */
        @media (max-width: 1279px) {
          .side-panel { display: none !important; }
        }
        @media (max-width: 767px) {
          .model-selector { display: none !important; }
        }
      `}</style>

      <div
        className="prueba-root"
        style={{
          minHeight: "calc(100vh - 9rem)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "24px 16px",
          position: "relative",
          background: "transparent",
          overflow: "hidden",
        }}
      >
        <GridBackground />

        {/* ── LEFT SUGGESTIONS ── */}
        <div
          className="side-panel"
          style={{
            position: "fixed",
            left: "20px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "220px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            zIndex: 20,
          }}
        >
          <div className="suggestions-label">
            <Lightbulb style={{ width: 12, height: 12, color: "#d97706" }} />
            <span className="suggestions-label-text">Sugerencias</span>
          </div>
          {exampleQuestions.slice(0, 3).map((item, i) => (
            <SuggestionCard key={i} item={item} onClick={() => setPrompt(item.q)} align="left" />
          ))}
        </div>

        {/* ── RIGHT SUGGESTIONS ── */}
        <div
          className="side-panel"
          style={{
            position: "fixed",
            right: "20px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "220px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            zIndex: 20,
          }}
        >
          <div className="suggestions-label" style={{ justifyContent: "flex-end" }}>
            <span className="suggestions-label-text">Análisis</span>
            <Terminal style={{ width: 12, height: 12, color: "#f43f5e" }} />
          </div>
          {exampleQuestions.slice(3).map((item, i) => (
            <SuggestionCard key={i} item={item} onClick={() => setPrompt(item.q)} align="right" />
          ))}
        </div>

        {/* ── MAIN LAYOUT ── */}
        <div
          style={{
            maxWidth: "900px",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            height: "82vh",
            gap: "16px",
            position: "relative",
            zIndex: 10,
          }}
        >
          {/* ── HEADER ── */}
          <div className="cmd-header">
            {/* Brand */}
            <div className="header-brand">
              <div className="brand-icon">
                <Cpu style={{ width: 20, height: 20, color: "#fff" }} />
              </div>
              <div>
                <div className="brand-tag">
                  <span>RH Ai</span>
                  <div className="live-indicator">
                    <div className="live-dot" />
                    <div className="live-dot" />
                    <div className="live-dot" />
                  </div>
                </div>
                <div className="brand-title">Inteligencia Artifical para Recursos Humanos</div>
              </div>
            </div>

            {/* Model selector */}
            <div className="model-selector" ref={modelMenuRef} style={{ position: "relative" }}>
              <div className="model-field">
                <span className="field-label">Modelo Activo</span>
                <button
                  className="model-btn"
                  onClick={() => setShowModelMenu(!showModelMenu)}
                >
                  <span className={`model-accent-${currentModel?.accent}`}>
                    {currentModel?.name}
                  </span>
                  <ChevronDown
                    style={{
                      width: 12,
                      height: 12,
                      transition: "transform 0.2s",
                      transform: showModelMenu ? "rotate(180deg)" : "rotate(0deg)",
                      color: "#94a3b8",
                    }}
                  />
                </button>
                {showModelMenu && (
                  <div className="model-dropdown">
                    {availableModels.map((m) => (
                      <button
                        key={m.id}
                        className={`dropdown-item ${selectedModel === m.id ? "active" : ""}`}
                        onClick={() => { setSelectedModel(m.id); setShowModelMenu(false); }}
                      >
                        <span className={`dropdown-item-name model-accent-${m.accent}`}>{m.name}</span>
                        <span className="dropdown-item-rpd">{m.rpd} RPD</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="model-field">
                <span className="field-label">Estado Link</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>
                  Encriptado
                </span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {messages.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.12)", borderRadius: 100 }}>
                  <Database style={{ width: 10, height: 10, color: "#6366f1" }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#6366f1", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {messages.length} msgs
                  </span>
                </div>
              )}
              <button className="clear-btn" onClick={clearChat} title="Limpiar Memoria">
                <Trash2 style={{ width: 13, height: 13 }} />
                <span className="hidden md:inline">Reset</span>
              </button>
            </div>
          </div>

          {/* ── CHAT PANEL ── */}
          <div className="chat-panel">
            {/* Messages */}
            <div
              ref={scrollRef}
              className="chat-scroll"
              style={{ flex: 1, padding: "24px", display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto", scrollBehavior: "smooth" }}
            >
              {messages.length === 0 && !loading && (
                <div className="empty-state">
                  <div className="empty-bot-ring">
                    <div className="empty-bot-icon">
                      <Sparkles style={{ width: 32, height: 32, color: "#fff" }} />
                    </div>
                  </div>
                  <div>
                    <div className="empty-title">Esperando instrucciones</div>
                    <p className="empty-sub" style={{ marginTop: 8 }}>
                      El sistema está listo. Realiza una consulta o usa las sugerencias laterales. El agente recuerda el contexto de la conversación.
                    </p>
                  </div>
                  <div className="empty-chips">
                    {["Base de datos HR", "Contexto persistente", "Multi-modelo", "Análisis inteligente"].map((c) => (
                      <div key={c} className="empty-chip">
                        <CircleDot style={{ width: 8, height: 8 }} />
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={idx} className={`msg-wrap msg-wrap-${msg.role}`}>
                  <div className="msg-meta">
                    <span className="msg-time">{msg.timestamp}</span>
                    <span className={`msg-role msg-role-${msg.role}`}>
                      {msg.role === "user" ? "OPERADOR_RH" : "AGENTE_SISTEMA"}
                    </span>
                  </div>
                  <div className={`msg-bubble msg-bubble-${msg.role}`}>
                    {msg.role === "user" ? (
                      <div className="msg-content-user">
                        <Terminal style={{ width: 13, height: 13, color: "#d97706", flexShrink: 0 }} />
                        <span>{msg.content}</span>
                      </div>
                    ) : (
                      <div className="bot-prose">
                        {msg.isNew ? (
                          <Typewriter
                            text={msg.content}
                            speed={8}
                            chunkSize={18}
                            onUpdate={scrollToBottom}
                            onComplete={() => {
                              const updated = [...messages];
                              updated[idx].isNew = false;
                              setMessages(updated);
                            }}
                          />
                        ) : (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="loading-wrap">
                  <div className="loading-tag">
                    <Radio style={{ width: 10, height: 10, animation: "pulse 1s ease-in-out infinite" }} />
                    Enlace activo
                  </div>
                  <div className="loading-bubble">
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div className="loading-dots">
                        <div className="loading-dot" />
                        <div className="loading-dot" />
                        <div className="loading-dot" />
                      </div>
                      <span className="loading-text">Hablando con el agente...</span>
                    </div>
                    <div className="loading-bar-track">
                      <div className="loading-bar" />
                    </div>
                    <div className="loading-scan" />
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="error-bar">
                <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Input */}
            <div className="input-area">
              <form className="input-form" onSubmit={handleSubmit}>
                <div className="input-glow" />
                <div className="input-wrap">
                  <div className="input-icon">
                    <Zap style={{ width: 15, height: 15 }} />
                  </div>
                  <input
                    className="input-field"
                    type="text"
                    placeholder="Ejecutar consulta de inteligencia..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    className="input-submit"
                    disabled={loading || !prompt.trim()}
                  >
                    {loading ? (
                      <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                    ) : (
                      <>
                        <Send style={{ width: 13, height: 13 }} />
                        <span className="hidden md:inline">Enviar</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="input-footer">
                  <div className="input-footer-chip">
                    <Lock style={{ width: 9, height: 9, color: "#10b981" }} />
                    Acceso seguro
                  </div>
                  <div className="input-footer-chip">
                    <BarChart3 style={{ width: 9, height: 9, color: "#6366f1" }} />
                    Contexto activo
                  </div>
                  <div className="input-footer-divider" />
                  <span className="input-footer-tag">ANAM.RH_V2.0</span>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
