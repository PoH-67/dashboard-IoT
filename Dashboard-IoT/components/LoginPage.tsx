"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

function authError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code: string }).code) : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "Email atau password salah.";
    case "auth/invalid-email": return "Format email tidak valid.";
    case "auth/popup-blocked": return "Popup Google diblokir. Izinkan popup untuk localhost.";
    case "auth/popup-closed-by-user": return "Login Google dibatalkan.";
    case "auth/unauthorized-domain": return "Tambahkan localhost di Firebase Authentication → Settings → Authorized domains.";
    case "auth/operation-not-allowed": return "Metode login belum diaktifkan di Firebase Authentication.";
    default: return "Login gagal. Periksa konfigurasi Firebase dan Console browser.";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser: User | null) => {
      setChecking(false);
      if (currentUser) router.replace("/guide");
    });
  }, [router]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) return setError("Email dan password wajib diisi.");
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/guide");
    } catch (error) {
      console.error(error);
      setError(authError(error));
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError("");
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
      router.replace("/guide");
    } catch (error) {
      console.error(error);
      setError(authError(error));
    } finally { setLoading(false); }
  };

  if (checking) return <main className="auth-loading">Loading...</main>;

  return (
    <main className="auth-page">
      <section className="auth-layout">
        {/* ── LEFT: Form Panel ── */}
        <div className="auth-left">
          {/* Brand */}
          <div className="auth-brand">
            <img src="/Logo_IoT.png" alt="KSM IoT" className="auth-brand-img" />
            <div className="auth-brand-text">
              <span className="auth-brand-name">KSM Internet Of Things</span>
              <span className="auth-brand-sub">UPN &quot;Veteran&quot; Jakarta</span>
            </div>
          </div>

          {/* Form */}
          <div className="auth-form-wrap">
            <h1 className="auth-title">Club Sign In</h1>

            <form onSubmit={handleLogin} className="auth-form">
              {/* Email */}
              <div className="auth-field">
                <label className="auth-label">Email Address <span className="auth-req">*</span></label>
                <input
                  type="email"
                  placeholder="member@upnvj.ac.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              {/* Password */}
              <div className="auth-field">
                <label className="auth-label">Password <span className="auth-req">*</span></label>
                <div className="auth-pw-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="auth-pw-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {error && <p className="auth-error">{error}</p>}

              <button className="auth-submit" type="submit" disabled={loading}>
                {loading ? "Please wait..." : "Sign In"}
              </button>
            </form>

            {/* Divider */}
            <div className="auth-divider"><span>or continue with</span></div>

            {/* Google */}
            <button className="auth-google" type="button" onClick={handleGoogle} disabled={loading}>
              <svg viewBox="0 0 24 24" className="auth-google-icon" aria-hidden="true">
                <path fill="#4285F4" d="M21.35 12.27c0-.68-.06-1.34-.18-1.97H12v3.73h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.15c1.85-1.7 2.9-4.2 2.9-7.15z" />
                <path fill="#34A853" d="M12 21.85c2.65 0 4.87-.87 6.49-2.43l-3.15-2.45c-.87.58-1.98.92-3.34.92-2.56 0-4.73-1.73-5.51-4.05H3.23v2.53A9.8 9.8 0 0 0 12 21.85z" />
                <path fill="#FBBC04" d="M6.49 13.84A5.88 5.88 0 0 1 6.18 12c0-.64.11-1.26.31-1.84V7.63H3.23A9.85 9.85 0 0 0 2.15 12c0 1.58.38 3.07 1.08 4.37l3.26-2.53z" />
                <path fill="#EA4335" d="M12 6.11c1.44 0 2.74.5 3.76 1.47l2.82-2.82C16.87 3.14 14.65 2.15 12 2.15a9.8 9.8 0 0 0-8.77 5.48l3.26 2.53C7.27 7.84 9.44 6.11 12 6.11z" />
              </svg>
              <span>Sign in with Google</span>
            </button>

            <p className="auth-switch">
              Don&apos;t have an account?{" "}
              <a href="/signup">Sign Up</a>
            </p>
          </div>
        </div>

        {/* ── RIGHT: Promo Panel ── */}
        <div className="auth-right">
          <div className="auth-right-content">
            <h2 className="auth-right-title">
              Welcome back to the<br />
              <span>IoT Study Club.</span>
            </h2>
            <p className="auth-right-desc">
              Access your IoT testbeds, telemetry nodes, and developer guides.
            </p>
          </div>
          {/* decorative image slot */}
          <div className="auth-right-img-wrap">
            <img
              src="/auth-hero.png"
              alt=""
              className="auth-right-img"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
