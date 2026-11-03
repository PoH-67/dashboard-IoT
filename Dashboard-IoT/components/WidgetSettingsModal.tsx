"use client";

import { useState } from "react";
import { ref, remove } from "firebase/database";
import { auth, rtdb } from "@/lib/firebase";
import { CanvasWidget, Datastream, DeviceItem } from "@/lib/iot-types";

interface Props {
  widget: CanvasWidget;
  device?: DeviceItem; // If editing within a specific device
  devices?: DeviceItem[]; // If editing within Dashboard (can pick device)
  onClose: () => void;
  onSave: (updated: CanvasWidget) => void;
  onCreateDatastream: (targetDeviceId: string) => void;
}

const LEGACY_TEMPLATE_NAMES = [
  "pembacaan pH",
  "pembacaan kelembapan",
  "status pompa",
  "suhu udara",
  "kecepatan kipas",
  "intensitas cahaya",
];

export default function WidgetSettingsModal({
  widget,
  device,
  devices,
  onClose,
  onSave,
  onCreateDatastream,
}: Props) {
  const [title, setTitle] = useState(widget.title);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    widget.deviceId || device?.id || (devices && devices[0]?.id) || ""
  );
  const [selectedVpin, setSelectedVpin] = useState<string>(widget.vpin || "");
  const [colSpan, setColSpan] = useState<number>(widget.colSpan || 1);

  // Determine current active device
  const currentDev = device || devices?.find((d) => d.id === selectedDeviceId);
  const datastreams = currentDev?.datastreams || {};

  // Check if current device has any old template datastreams
  const hasLegacyTemplates = Object.values(datastreams).some((ds) =>
    LEGACY_TEMPLATE_NAMES.includes(ds.name)
  );

  // Title display
  const widgetTypeTitle = widget.type.charAt(0).toUpperCase() + widget.type.slice(1);

  const handleSave = () => {
    onSave({
      ...widget,
      title: title.trim() || widgetTypeTitle,
      deviceId: selectedDeviceId,
      vpin: selectedVpin,
      colSpan,
    });
  };

  const handleDeleteDatastream = async (pinToDelete: string) => {
    const user = auth.currentUser;
    if (!user || !selectedDeviceId || !pinToDelete) return;
    if (!confirm(`Hapus datastream "${pinToDelete}"?`)) return;
    try {
      await remove(ref(rtdb, `users/${user.uid}/devices/${selectedDeviceId}/datastreams/${pinToDelete}`));
      if (selectedVpin === pinToDelete) {
        setSelectedVpin("");
      }
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus datastream.");
    }
  };

  const handleClearLegacyTemplates = async () => {
    const user = auth.currentUser;
    if (!user || !selectedDeviceId) return;
    const legacyEntries = Object.entries(datastreams).filter(([, ds]) =>
      LEGACY_TEMPLATE_NAMES.includes(ds.name)
    );
    if (legacyEntries.length === 0) return;
    if (!confirm(`Hapus ${legacyEntries.length} datastream template bawaan (V0–V5)?`)) return;
    try {
      for (const [pin] of legacyEntries) {
        await remove(ref(rtdb, `users/${user.uid}/devices/${selectedDeviceId}/datastreams/${pin}`));
      }
      setSelectedVpin("");
    } catch (err) {
      console.error(err);
      alert("Gagal membersihkan template datastream.");
    }
  };

  return (
    <div className="blynk-modal-backdrop" onClick={onClose}>
      <div className="blynk-widget-settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="blynk-ws-header">
          <h2>{widgetTypeTitle} Settings</h2>
          <button className="blynk-ds-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* 2-Column Body */}
        <div className="blynk-ws-body">
          {/* Left Config Panel */}
          <div className="blynk-ws-left">
            {/* If multiple devices exist (in Dashboard view), let user choose device */}
            {devices && devices.length > 0 && (
              <div className="blynk-input-field">
                <label>TARGET DEVICE</label>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => {
                    setSelectedDeviceId(e.target.value);
                    setSelectedVpin(""); // reset pin on device switch
                  }}
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* TITLE (OPTIONAL) */}
            <div className="blynk-input-field" style={{ marginTop: 16 }}>
              <label>TITLE (OPTIONAL)</label>
              <input
                type="text"
                placeholder={widgetTypeTitle}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* DATASTREAM */}
            <div className="blynk-input-field" style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label>DATASTREAM</label>
                {hasLegacyTemplates && (
                  <button
                    type="button"
                    onClick={handleClearLegacyTemplates}
                    style={{
                      border: "none",
                      background: "none",
                      color: "#ef4444",
                      fontSize: 11,
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    ✕ Hapus Template (V0-V5)
                  </button>
                )}
              </div>

              <div className="blynk-ds-select-row">
                <select
                  value={selectedVpin}
                  onChange={(e) => setSelectedVpin(e.target.value)}
                  className="blynk-ds-select"
                >
                  <option value="">Select Datastream</option>
                  {Object.entries(datastreams).map(([pin, ds]) => (
                    <option key={pin} value={pin}>
                      {pin} {ds.displayName || ds.name} ({ds.type})
                    </option>
                  ))}
                </select>

                {selectedVpin && (
                  <button
                    type="button"
                    onClick={() => handleDeleteDatastream(selectedVpin)}
                    title="Hapus Datastream Ini"
                    style={{
                      padding: "8px 10px",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: 6,
                      color: "#dc2626",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    🗑
                  </button>
                )}

                <span className="blynk-ds-or">or</span>

                <button
                  type="button"
                  className="btn-create-datastream"
                  onClick={() => onCreateDatastream(selectedDeviceId)}
                >
                  Create Datastream
                </button>
              </div>
            </div>

            {/* Width Columns */}
            <div className="blynk-input-field" style={{ marginTop: 16 }}>
              <label>WIDGET WIDTH (COLUMNS)</label>
              <select
                value={colSpan}
                onChange={(e) => setColSpan(Number(e.target.value))}
              >
                <option value={1}>1 Column (Compact)</option>
                <option value={2}>2 Columns (Wide)</option>
                <option value={3}>3 Columns (Full row)</option>
              </select>
            </div>
          </div>

          {/* Right Live Preview Panel */}
          <div className="blynk-ws-right">
            <div className="blynk-preview-container">
              <div className="blynk-preview-card">
                <span className="blynk-preview-title">{title || widgetTypeTitle}</span>

                {/* Switch Preview */}
                {widget.type === "switch" && (
                  <div className="preview-switch-center">
                    <div className="blynk-toggle-pill">
                      <span className="toggle-pill-thumb" />
                    </div>
                  </div>
                )}

                {/* Slider Preview */}
                {widget.type === "slider" && (
                  <div className="render-slider-row" style={{ width: "100%", padding: 0 }}>
                    <div className="mock-slider-track" style={{ flex: 1 }}>
                      <span className="mock-slider-thumb" style={{ left: "40%" }} />
                    </div>
                    <span className="slider-value-display" style={{ fontSize: 20 }}>40</span>
                  </div>
                )}

                {/* Label Preview */}
                {widget.type === "label" && (
                  <div className="preview-label-center">
                    <span className="label-large-text">--</span>
                  </div>
                )}

                {/* Chart Preview */}
                {widget.type === "chart" && (
                  <div className="render-chart-block" style={{ height: 90 }}>
                    <svg className="blynk-chart-svg" viewBox="0 0 500 120" preserveAspectRatio="none">
                      <path d="M0,80 Q50,70 100,60 T200,50 T300,40 T400,30 T500,45" fill="none" stroke="#0070f3" strokeWidth="3" />
                    </svg>
                  </div>
                )}

                {/* Table Preview */}
                {widget.type === "table" && (
                  <div style={{ fontSize: 11, color: "#6b7280" }}>
                    <em>Table widget preview (Time, Sensor, Value)</em>
                  </div>
                )}

                {/* Image Preview */}
                {widget.type === "image" && (
                  <div className="image-mock-esp32" style={{ height: 100 }}>
                    <div className="esp-chip-core">{currentDev?.type || "ESP32"}</div>
                  </div>
                )}

                {/* Video Preview */}
                {widget.type === "video" && (
                  <div className="video-camera-screen" style={{ height: 100 }}>
                    <div className="camera-live-badge">LIVE</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="blynk-ws-footer">
          <button className="ds-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="ds-btn-save-lime" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
