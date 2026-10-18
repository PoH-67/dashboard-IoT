"use client";

import { useState } from "react";
import { CanvasWidget, Datastream, DeviceItem } from "@/lib/iot-types";

interface Props {
  widget: CanvasWidget;
  device?: DeviceItem; // If editing within a specific device
  devices?: DeviceItem[]; // If editing within Dashboard (can pick device)
  onClose: () => void;
  onSave: (updated: CanvasWidget) => void;
  onCreateDatastream: (targetDeviceId: string) => void;
}

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

  // Title display
  const widgetTypeTitle = widget.type.charAt(0).toUpperCase() + widget.type.slice(1);

  // Widget preview value
  const previewVal = (selectedVpin && datastreams[selectedVpin]?.value) ?? (widget.type === "switch" ? 0 : 40);

  const handleSave = () => {
    onSave({
      ...widget,
      title: title.trim() || widgetTypeTitle,
      deviceId: selectedDeviceId,
      vpin: selectedVpin,
      colSpan,
    });
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
              <label>DATASTREAM</label>
              <div className="blynk-ds-select-row">
                <select
                  value={selectedVpin}
                  onChange={(e) => setSelectedVpin(e.target.value)}
                  className="blynk-ds-select"
                >
                  <option value="">Select Datastream</option>
                  {Object.entries(datastreams).map(([pin, ds]) => (
                    <option key={pin} value={pin}>
                      {pin} {ds.name} ({ds.type})
                    </option>
                  ))}
                </select>

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
                    <span className="label-large-text">27.4°C</span>
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
                    <div className="esp-chip-core">ESP32</div>
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
