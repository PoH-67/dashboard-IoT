"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
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
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Load saved email if Remember Me was selected previously
    if (typeof window !== "undefined") {
      const savedEmail = localStorage.getItem("ksm_iot_remember_email");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    }

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

      // Handle remember me state persistence
      if (typeof window !== "undefined") {
        if (rememberMe) {
          localStorage.setItem("ksm_iot_remember_email", email.trim());
        } else {
          localStorage.removeItem("ksm_iot_remember_email");
        }
      }

      router.replace("/guide");
    } catch (err) {
      console.error(err);
      setError(authError(err));
    } finally {
      setLoading(false);
    }
  };

  if (checking) return <main className="auth-loading">Loading...</main>;

  return (
    <main className="login-page">
      {/* ── Full-page background image ── */}
      <div className="login-bg-full" />
      <div className="login-bg-overlay" />

      {/* ── RIGHT: Form Card Panel ── */}
      <section className="login-card-panel">
        <div className="login-card-inner">
          {/* Brand header */}
          <div className="login-brand">
            <img src="/Logo_IoT.png" alt="KSM IoT" className="login-brand-logo" />
            <div className="login-brand-meta">
              <span className="login-brand-name">KSM Internet Of Things</span>
              <span className="login-brand-inst">UPN &quot;Veteran&quot; Jakarta</span>
            </div>
          </div>

          {/* Heading */}
          <div className="login-heading-group">
            <h1 className="login-title">Welcome Back</h1>
            <p className="login-subtitle">
              Log in with your credentials to access your IoT nodes and monitoring dashboard
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="login-form">
            {/* Email Address */}
            <div className="login-field">
              <label className="login-label">
                Email Address <span className="login-req">*</span>
              </label>
              <input
                type="email"
                className="login-input"
                placeholder="member@upnvj.ac.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {/* Password */}
            <div className="login-field">
              <label className="login-label">
                Password <span className="login-req">*</span>
              </label>
              <div className="login-pw-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  className="login-input login-input-pw"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="login-pw-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="login-options-row">
              <label className="login-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
            </div>

            {/* Error Message */}
            {error && <div className="login-error-msg">{error}</div>}

            {/* Submit Button */}
            <button className="login-submit-btn" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>

            {/* Switch to Signup */}
            <p className="login-signup-prompt">
              Don&apos;t have an account?{" "}
              <a href="/signup" className="login-signup-link">Sign Up</a>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
