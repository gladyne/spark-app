"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

type ProjectSummary = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) { const data = await res.json(); setProjects(data); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated") fetchProjects();
  }, [status, router, fetchProjects]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      if (res.ok) {
        const proj = await res.json();
        router.push(`/?project=${proj.id}`);
      }
    } catch (e) { console.error(e); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus project "${name}"? Data tidak bisa dikembalikan.`)) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const handleRename = async (id: string) => {
    if (!renameVal.trim()) return;
    await fetch(`/api/projects/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameVal }),
    });
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: renameVal } : p));
    setRenamingId(null);
  };

  if (status === "loading" || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "#60a5fa", fontSize: 18, fontWeight: 600 }}>
        Memuat...
      </div>
    );
  }

  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 8, color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a, #1e293b)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", color: "#e2e8f0" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", borderBottom: "1px solid rgba(148,163,184,0.1)", background: "rgba(15,23,42,0.5)", backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => router.push("/")}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #3b82f6, #eab308)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
            <span style={{ fontSize: 20, fontWeight: 800, background: "linear-gradient(135deg, #93c5fd, #fde68a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>SPARK</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
            <button
              onClick={() => router.push("/")}
              style={{ padding: "6px 12px", background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 8, color: "#93c5fd", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              🗺️ Peta GIS
            </button>
            <button
              onClick={() => router.push("/schematic")}
              style={{ padding: "6px 12px", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 8, color: "#fde68a", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              📐 Mode Skematik
            </button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>👤 {session?.user?.name}</span>
          <button onClick={() => signOut({ callbackUrl: "/login" })} style={{ padding: "8px 16px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#fca5a5", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Keluar</button>
        </div>
      </header>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, marginBottom: 4 }}>Project Saya</h1>
            <p style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>{projects.length} project</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => router.push("/schematic")}
              style={{ padding: "12px 20px", background: "linear-gradient(135deg, #d97706, #b45309)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 10, color: "#fef3c7", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(217,119,6,0.25)" }}
              title="Buka Kanvas Gambar Bebas Single Line Diagram & Kop PLN"
            >
              <span>📐</span>
              <span>Gambar Skematik (SLD)</span>
            </button>
            <button
              onClick={() => setShowNew(true)}
              style={{ padding: "12px 24px", background: "linear-gradient(135deg, #3b82f6, #2563eb)", border: "none", borderRadius: 10, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <span>+</span>
              <span>Project Baru (Peta)</span>
            </button>
          </div>
        </div>

        {/* New Project Form */}
        {showNew && (
          <div style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 14, padding: 24, marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Buat Project Baru</h3>
            <div style={{ marginBottom: 12 }}>
              <input style={inputStyle} placeholder="Nama project (contoh: Penyulang Oesapa)" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
            </div>
            <div style={{ marginBottom: 16 }}>
              <input style={inputStyle} placeholder="Deskripsi (opsional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleCreate} disabled={creating || !newName.trim()} style={{ padding: "10px 20px", background: "#3b82f6", border: "none", borderRadius: 8, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: creating || !newName.trim() ? 0.5 : 1 }}>{creating ? "Membuat..." : "Buka di Peta GIS"}</button>
              <button onClick={() => router.push("/schematic")} style={{ padding: "10px 20px", background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 8, color: "#fde68a", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>📐 Buka di Skematik</button>
              <button onClick={() => { setShowNew(false); setNewName(""); setNewDesc(""); }} style={{ padding: "10px 20px", background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 8, color: "#94a3b8", fontSize: 13, cursor: "pointer" }}>Batal</button>
            </div>
          </div>
        )}

        {/* Project List */}
        {projects.length === 0 && !showNew ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#475569" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
            <p style={{ fontSize: 16, fontWeight: 600 }}>Belum ada project</p>
            <p style={{ fontSize: 13 }}>Klik &quot;+ Project Baru&quot; untuk mulai</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {projects.map(p => (
              <div key={p.id} style={{ background: "rgba(30,41,59,0.5)", border: "1px solid rgba(148,163,184,0.1)", borderRadius: 14, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.2s", cursor: "pointer" }}
                onClick={() => { if (!renamingId) router.push(`/?project=${p.id}`); }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.4)"; (e.currentTarget as HTMLElement).style.background = "rgba(30,41,59,0.7)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(148,163,184,0.1)"; (e.currentTarget as HTMLElement).style.background = "rgba(30,41,59,0.5)"; }}>
                <div style={{ flex: 1 }}>
                  {renamingId === p.id ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }} onClick={e => e.stopPropagation()}>
                      <input style={{ ...inputStyle, width: 250 }} value={renameVal} onChange={e => setRenameVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleRename(p.id); if (e.key === "Escape") setRenamingId(null); }} autoFocus />
                      <button onClick={() => handleRename(p.id)} style={{ padding: "6px 12px", background: "#3b82f6", border: "none", borderRadius: 6, color: "white", fontSize: 12, cursor: "pointer" }}>OK</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📐 {p.name}</div>
                      {p.description && <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 4 }}>{p.description}</div>}
                      <div style={{ fontSize: 11, color: "#475569" }}>Diubah {new Date(p.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setRenamingId(p.id); setRenameVal(p.name); }} style={{ padding: "6px 10px", background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: 6, color: "#94a3b8", fontSize: 12, cursor: "pointer" }} title="Rename">✏️</button>
                  <button onClick={() => handleDelete(p.id, p.name)} style={{ padding: "6px 10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, color: "#fca5a5", fontSize: 12, cursor: "pointer" }} title="Hapus">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
