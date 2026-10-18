"use client";

import { ReactNode, ReactElement, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { ref, onValue } from "firebase/database";
import { auth, rtdb } from "@/lib/firebase";

// ── Icons ──────────────────────────────────────────────
const IconGuide = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IconDashboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const IconDevice = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);
const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconBell = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const IconChevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

// ── Nav items ──────────────────────────────────────────
type NavKey = "guide" | "dashboard" | "device" | "settings";
const navItems: { key: NavKey; label: string; href: string; Icon: () => ReactElement }[] = [
  { key: "guide",     label: "Guide",     href: "/guide",     Icon: IconGuide },
  { key: "dashboard", label: "Dashboard", href: "/dashboard", Icon: IconDashboard },
  { key: "device",    label: "Device",    href: "/device",    Icon: IconDevice },
  { key: "settings",  label: "Settings",  href: "/settings",  Icon: IconSettings },
];

function activeKey(pathname: string): NavKey {
  if (pathname.startsWith("/guide"))    return "guide";
  if (pathname.startsWith("/device"))   return "device";
  if (pathname.startsWith("/settings")) return "settings";
  return "dashboard";
}

// ── Shell ──────────────────────────────────────────────
export default function AppShell({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [search, setSearch] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [profileName, setProfileName] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("");

  useEffect(() => {
    const theme = localStorage.getItem("ksmiot-theme");
    document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
      if (!u) {
        router.replace("/landing");
        return;
      }
      setProfileName(u.displayName || "");
      setProfilePhoto(u.photoURL || "");

      // Listen realtime profile
      const profRef = ref(rtdb, `users/${u.uid}/profile`);
      return onValue(profRef, (snap) => {
        const val = snap.val();
        if (val) {
          if (val.fullName) setProfileName(val.fullName);
          if (val.photoUrl) setProfilePhoto(val.photoUrl);
        }
      });
    });
    return unsub;
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/landing");
  };

  if (checking || !user) return <main className="shell-loading">Loading...</main>;

  const initials = (user.displayName || user.email || "U").slice(0, 2).toUpperCase();
  const displayName = user.displayName || user.email?.split("@")[0] || "User";

  return (
    <div className="shell">
      {/* ── Sidebar ── */}
      <aside className="shell-sidebar">
        {/* Brand */}
        <a href="/dashboard" className="shell-brand" aria-label="KSM IoT Dashboard">
          <img src="/Logo_IoT.png" alt="KSM IoT" className="shell-brand-logo" />
          <div className="shell-brand-text">
            <span className="shell-brand-name">KSM Internet Of Things</span>
            <span className="shell-brand-sub">UPN &quot;Veteran&quot; Jakarta</span>
          </div>
        </a>

        {/* Expand / collapse icon (decorative) */}
        <div className="shell-sidebar-sep" />

        {/* Nav */}
        <nav className="shell-nav" aria-label="Main navigation">
          {navItems.map(({ key, label, href, Icon }) => (
            <a
              key={key}
              href={href}
              className={`shell-nav-item${activeKey(pathname) === key ? " active" : ""}`}
            >
              <span className="shell-nav-icon"><Icon /></span>
              <span className="shell-nav-label">{label}</span>
            </a>
          ))}
        </nav>
      </aside>

      {/* ── Main ── */}
      <div className="shell-main">
        {/* Topbar */}
        <header className="shell-topbar">
          {/* Search */}
          <div className="shell-search">
            <span className="shell-search-icon"><IconSearch /></span>
            <input
              type="text"
              placeholder="Search Dashboard"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="shell-search-input"
            />
          </div>

          {/* Right controls */}
          <div className="shell-topbar-right">
            {/* Bell */}
            <button className="shell-icon-btn" aria-label="Notifications">
              <IconBell />
            </button>

            {/* User menu */}
            <div className="shell-user-wrap">
              <button
                className="shell-user-btn"
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-label="User menu"
              >
                <div className="shell-avatar">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Profile" className="shell-avatar-img" />
                  ) : (
                    (profileName || user.displayName || user.email || "U").slice(0, 2).toUpperCase()
                  )}
                </div>
                <span className="shell-user-name">
                  {profileName || user.displayName || user.email?.split("@")[0] || "User"}
                </span>
                <span className="shell-chevron"><IconChevron /></span>
              </button>
              {userMenuOpen && (
                <div className="shell-user-menu">
                  <a href="/settings" className="shell-menu-item" onClick={() => setUserMenuOpen(false)}>Settings</a>
                  <button className="shell-menu-item danger" onClick={handleLogout}>Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}
