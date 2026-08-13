"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regUnit, setRegUnit] = useState("");
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const result = await signIn("credentials", { username, password, redirect: false });
    if (result?.error) { setError("Username atau password salah"); setLoading(false); }
    else { router.push("/dashboard"); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(""); setRegSuccess(""); setRegLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: regUsername, password: regPassword, name: regName, unit: regUnit }),
      });
      const data = await res.json();
      if (!res.ok) { setRegError(data.error || "Registrasi gagal"); }
      else { setRegSuccess("Registrasi berhasil! Silakan login."); setTimeout(() => { setShowRegister(false); setUsername(regUsername); }, 1500); }
    } catch { setRegError("Terjadi kesalahan jaringan"); }
    finally { setRegLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
      <div style={{ position: "relative", background: "rgba(30,41,59,0.85)", backdropFilter: "blur(20px)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: 20, padding: "48px 40px", width: "100%", maxWidth: 420, boxShadow: "0 25px 50px rgba(0,0,0,0.4)" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 64, height: 64, margin: "0 auto 16px", background: "linear-gradient(135deg, #3b82f6, #eab308)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: "0 8px 32px rgba(59,130,246,0.3)" }}>⚡</div>
          <div style={{ fontSize: 28, fontWeight: 800, background: "linear-gradient(135deg, #93c5fd, #fde68a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>SPARK</div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>Sistem Pemetaan Pintar Rencana Kelistrikan</div>
        </div>

        {!showRegister ? (
          <form onSubmit={handleLogin}>
            {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Username</label>
              <input style={{ width: "100%", padding: "12px 16px", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 10, color: "#e2e8f0", fontSize: 15, outline: "none", boxSizing: "border-box" }} type="text" placeholder="Masukkan username" value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Password</label>
              <input style={{ width: "100%", padding: "12px 16px", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 10, color: "#e2e8f0", fontSize: 15, outline: "none", boxSizing: "border-box" }} type="password" placeholder="Masukkan password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button style={{ width: "100%", padding: 14, background: "linear-gradient(135deg, #3b82f6, #2563eb)", border: "none", borderRadius: 10, color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8 }} type="submit" disabled={loading}>{loading ? "Memproses..." : "Masuk"}</button>
            <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "#94a3b8" }}>Belum punya akun? <button onClick={() => setShowRegister(true)} style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Daftar</button></div>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            {regError && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>⚠️ {regError}</div>}
            {regSuccess && <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>✅ {regSuccess}</div>}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Nama Lengkap</label>
              <input style={{ width: "100%", padding: "12px 16px", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 10, color: "#e2e8f0", fontSize: 15, outline: "none", boxSizing: "border-box" }} type="text" placeholder="Nama Lengkap" value={regName} onChange={e => setRegName(e.target.value)} required autoFocus />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Username</label>
              <input style={{ width: "100%", padding: "12px 16px", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 10, color: "#e2e8f0", fontSize: 15, outline: "none", boxSizing: "border-box" }} type="text" placeholder="Min. 3 karakter" value={regUsername} onChange={e => setRegUsername(e.target.value)} required />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Unit PLN</label>
              <input style={{ width: "100%", padding: "12px 16px", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 10, color: "#e2e8f0", fontSize: 15, outline: "none", boxSizing: "border-box" }} type="text" placeholder="Contoh: UP3 Kupang" value={regUnit} onChange={e => setRegUnit(e.target.value)} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Password</label>
              <input style={{ width: "100%", padding: "12px 16px", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 10, color: "#e2e8f0", fontSize: 15, outline: "none", boxSizing: "border-box" }} type="password" placeholder="Min. 6 karakter" value={regPassword} onChange={e => setRegPassword(e.target.value)} required />
            </div>
            <button style={{ width: "100%", padding: 14, background: "linear-gradient(135deg, #3b82f6, #2563eb)", border: "none", borderRadius: 10, color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8 }} type="submit" disabled={regLoading}>{regLoading ? "Mendaftar..." : "Daftar Akun"}</button>
            <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "#94a3b8" }}>Sudah punya akun? <button onClick={() => setShowRegister(false)} style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Masuk</button></div>
          </form>
        )}
      </div>
    </div>
  );
}
