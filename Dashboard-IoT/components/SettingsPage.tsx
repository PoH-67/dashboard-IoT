"use client";

import { useEffect, useState, useRef, ChangeEvent } from "react";
import { onAuthStateChanged, signOut, updateProfile, updatePassword, updateEmail, User } from "firebase/auth";
import { ref, onValue, set, update } from "firebase/database";
import { useRouter } from "next/navigation";
import { auth, rtdb } from "@/lib/firebase";

const DIVISIONS = [
  "BPI",
  "Academic",
  "Firmware Engineer",
  "Hardware Engineer",
  "Software Engineer",
  "UI/UX Engineer",
  "Network Engineer",
  "Electrical Engineer",
  "Public Relations",
  "Creative Media",
];

const POSITIONS = [
  "Chairman",
  "Vice Chairman",
  "Secretary",
  "Treasurer",
  "Head of Department",
  "Head of Division",
  "Staff",
];

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Profile Form States
  const [fullName, setFullName] = useState("");
  const [division, setDivision] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/landing");
        return;
      }
      setUser(u);
      setFullName(u.displayName || "");
      setEmail(u.email || "");
      setPhotoUrl(u.photoURL || "");

      // Ambil data profile dari RTDB
      const profileRef = ref(rtdb, `users/${u.uid}/profile`);
      return onValue(profileRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          if (data.fullName) setFullName(data.fullName);
          if (data.division) setDivision(data.division);
          if (data.position) setPosition(data.position);
          if (data.photoUrl) setPhotoUrl(data.photoUrl);
        }
        setLoading(false);
      });
    });
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/landing");
    } catch (err) {
      console.error(err);
    }
  };

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ text: "Ukuran gambar maksimal 2MB.", type: "error" });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setPhotoUrl(base64);
      setMessage({ text: "Foto dipilih. Klik 'Save Changes' untuk menyimpan permanen.", type: "success" });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveChanges = async () => {
    if (!user) return;
    setSaving(true);
    setMessage(null);

    try {
      // 1. Update Firebase Auth displayName & photoURL jika diizinkan
      const authUpdates: { displayName?: string; photoURL?: string } = {};
      if (fullName.trim() !== user.displayName) authUpdates.displayName = fullName.trim();
      if (photoUrl && photoUrl !== user.photoURL && !photoUrl.startsWith("data:")) {
        authUpdates.photoURL = photoUrl;
      }
      if (Object.keys(authUpdates).length > 0) {
        await updateProfile(user, authUpdates);
      }

      // 2. Update Password jika diisi
      if (newPassword.trim()) {
        if (newPassword.length < 8) {
          setMessage({ text: "Password minimal 8 karakter.", type: "error" });
          setSaving(false);
          return;
        }
        await updatePassword(user, newPassword.trim());
      }

      // 3. Update Email jika berubah
      if (email.trim() && email.trim() !== user.email) {
        await updateEmail(user, email.trim());
      }

      // 4. Update Profile ke RTDB
      await update(ref(rtdb, `users/${user.uid}/profile`), {
        fullName: fullName.trim(),
        division,
        position,
        email: email.trim(),
        photoUrl: photoUrl || null,
        updatedAt: Date.now(),
      });

      setNewPassword("");
      setMessage({ text: "Perubahan profil berhasil disimpan!", type: "success" });
    } catch (err: unknown) {
      console.error(err);
      const errObj = err as { code?: string; message?: string };
      if (errObj.code === "auth/requires-recent-login") {
        setMessage({ text: "Mengubah email/password membutuhkan login ulang demi keamanan.", type: "error" });
      } else {
        setMessage({ text: errObj.message || "Gagal menyimpan perubahan.", type: "error" });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page-loading">Loading settings…</div>;
  }

  return (
    <div className="settings-container-modern">
      {/* Header */}
      <div className="settings-header-modern">
        <div>
          <h1 className="settings-title-modern">Settings</h1>
          <p className="settings-sub-modern">Manage your profile, organization details, and account preferences.</p>
        </div>
        <button className="settings-logout-btn" onClick={handleLogout}>
          Log out
        </button>
      </div>

      {message && (
        <div className={`settings-alert ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Profile Overview Card */}
      <div className="settings-overview-card">
        <div className="settings-overview-left">
          <div className="settings-overview-avatar">
            {photoUrl ? (
              <img src={photoUrl} alt="Avatar" className="overview-avatar-img" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="#0070f3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </div>
          <div>
            <h2 className="overview-title">Profile Overview</h2>
            <p className="overview-sub">Review your account details and organization information before saving changes.</p>
          </div>
        </div>

        <div className="settings-overview-badge">
          <span className="overview-badge-tag">Profile Information</span>
          <strong className="overview-badge-name">{fullName || "Your account"}</strong>
          <span className="overview-badge-desc">{division ? `${division} • ${position}` : "Complete your details"}</span>
        </div>
      </div>

      {/* Main Grid: Details + Photo */}
      <div className="settings-content-grid">
        {/* Left Column: Profile Details */}
        <div className="settings-card-modern">
          <div className="settings-card-header">
            <h3 className="card-title">Profile Details</h3>
            <p className="card-sub">Update your personal and organization information.</p>
          </div>

          <div className="settings-form-body">
            <div className="form-group-modern">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="e.g. Lamine Yamal"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="form-row-modern">
              <div className="form-group-modern">
                <label>Division</label>
                <div className="select-wrapper">
                  <select value={division} onChange={(e) => setDivision(e.target.value)}>
                    <option value="">Select Division</option>
                    {DIVISIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group-modern">
                <label>Role / Position</label>
                <div className="select-wrapper">
                  <select value={position} onChange={(e) => setPosition(e.target.value)}>
                    <option value="">Select Position</option>
                    {POSITIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="form-group-modern">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="member@upnvj.ac.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group-modern">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <span className="form-hint">Kosongkan jika tidak ingin mengubah password.</span>
            </div>
          </div>

          <div className="settings-card-footer">
            <span className="footer-notice">Review your details before saving.</span>
            <button
              className="save-changes-btn"
              onClick={handleSaveChanges}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Right Column: Profile Photo */}
        <div className="settings-card-modern photo-card">
          <div className="settings-card-header">
            <h3 className="card-title">Profile Photo</h3>
            <p className="card-sub">Add a photo to personalize your account.</p>
          </div>

          <div className="photo-preview-container">
            {photoUrl ? (
              <img src={photoUrl} alt="Preview" className="photo-square-preview" />
            ) : (
              <div className="photo-placeholder-square" />
            )}
          </div>

          <p className="photo-caption">Upload a square image for the best preview.</p>

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept="image/*"
            onChange={handlePhotoUpload}
          />
          <button
            className="add-photo-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Add Photo
          </button>
        </div>
      </div>
    </div>
  );
}
