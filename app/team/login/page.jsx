"use client";
// Team-app login — visually identical to the Partner app's login (same hero, same form
// chrome) but posts to /api/auth/employee (email + password, not phone) since employees share
// one login with the desktop /employee dashboards. No social-login row here (that's Partner
// marketing flourish, not relevant to an internal tool) — just a clean native-feeling form.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@/components/partner/ui";
import { IconUser, IconLock } from "@/components/partner/icons";

export default function TeamLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const raw = await res.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON error body */ }
      if (!res.ok) throw new Error(data.error || `Login failed (${res.status})`);
      router.push(data.employee?.role === "admin" ? "/admin" : "/team/home");
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hp-root">
      <div className="hp-hero">
        <div className="hp-hero-bg" style={{ backgroundImage: "url('/Login_screen.png')" }} />
        <div className="hp-hero-scrim-full" />
        <div className="hp-hero-content" style={{ justifyContent: "flex-end" }}>
          <img src="/brand/lockup-white.png" alt="Heseos — Lighting Ahead" className="hp-brand-logo" style={{ position: "absolute", top: 28, left: 22 }} />

          <div>
            <h1 className="hp-h2">Welcome Back!</h1>
            <p className="hp-sub" style={{ marginTop: 6, marginBottom: 22 }}>Login to your Heseos Team account</p>

            <form onSubmit={submit}>
              <TextField icon={<IconUser size={18} />} type="email" placeholder="Work Email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" required />
              <TextField icon={<IconLock size={18} />} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />

              {error && <div className="hp-error">{error}</div>}

              <Button type="submit" block disabled={loading}>{loading ? "Signing in…" : "Login"}</Button>
            </form>

            <p className="hp-footnote">Don&rsquo;t have access yet? <span style={{ color: "var(--hp-text-soft)" }}>Ask your admin to set up your account.</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
