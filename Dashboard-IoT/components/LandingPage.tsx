"use client";

import { useRouter } from "next/navigation";
import TeamGallery from "./TeamGallery";

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="lp-root">
      {/* ────── HERO ────── */}
      <section className="lp-hero">
        {/* decorative circles */}
        <span className="lp-deco lp-dot lp-dot-1" />
        <span className="lp-deco lp-dot lp-dot-2" />
        <span className="lp-deco lp-ring lp-ring-1" />
        <span className="lp-deco lp-ring lp-ring-2" />
        <span className="lp-deco lp-ring lp-ring-3" />

        {/* nav */}
        <nav className="lp-nav">
          <div className="lp-brand">
            <img src="/Logo_IoT.png" alt="KSM IoT logo" className="lp-brand-img" />
            <div className="lp-brand-text">
              <span className="lp-brand-name">KSM Internet Of Things</span>
              <span className="lp-brand-sub">UPN &quot;Veteran&quot; Jakarta</span>
            </div>
          </div>
          <button className="lp-nav-icon" aria-label="Profile" onClick={() => router.push("/login")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </button>
        </nav>

        {/* hero content */}
        <div className="lp-hero-body">
          <h1 className="lp-headline">
            <span className="lp-headline-accent">EMPOWERING NEXT-GEN</span>
            <br />
            through the internet of things
          </h1>
          <p className="lp-subtext">
            Building connected smart hardware, resilient mesh sensor networks, bare-metal firmware
            architectures, and edge intelligence prototypes directly from the student workbench.
          </p>
          <div className="lp-cta-row">
            <button className="lp-btn lp-btn-primary" onClick={() => router.push("/signup")}>
              SIGN UP
            </button>
            <button className="lp-btn lp-btn-outline" onClick={() => router.push("/login")}>
              SIGN IN
            </button>
          </div>
        </div>
      </section>

      {/* ────── TEAM ────── */}
      <TeamGallery />

      {/* ────── FOOTER ────── */}
      <footer className="lp-footer">
        © {new Date().getFullYear()} KSM Internet Of Things — UPN &quot;Veteran&quot; Jakarta
      </footer>
    </div>
  );
}
