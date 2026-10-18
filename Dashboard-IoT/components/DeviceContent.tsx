"use client";

import { useEffect, useState, DragEvent } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  ref, onValue, push, set, update, remove
} from "firebase/database";
import { auth, rtdb } from "@/lib/firebase";

// ── Types ──────────────────────────────────────────────
export type WidgetType = "switch" | "slider" | "label" | "table" | "image" | "chart" | "video";

export interface Datastream {
  pin: string; // e.g. "V0", "V1"
  name: string;
  type: "Integer" | "Double" | "String";
  min: number;
  max: number;
  value: number | string;
}

export interface CanvasWidget {
  id: string;
  type: WidgetType;
  title: string;
  vpin: string; // Virtual Pin mapping e.g. "V1"
  colSpan?: number; // 1 or 2 or 3
  unit?: string;
  min?: number;
  max?: number;
  value?: number | string;
}

export interface DeviceItem {
  id: string;
  name: string;
  type: string;
  authToken: string;
  owner: string;
  status: "online" | "offline";
  lastSeen: number | null;
  createdAt: number | null;
  datastreams?: Record<string, Datastream>;
  widgets?: CanvasWidget[];
}

// ── Default Datastreams Generator ──────────────────────
function getDefaultDatastreams(): Record<string, Datastream> {
  return {
    V0: { pin: "V0", name: "pembacaan pH", type: "Double", min: 0, max: 14, value: 7.0 },
    V1: { pin: "V1", name: "pembacaan kelembapan", type: "Integer", min: 0, max: 100, value: 63 },
    V2: { pin: "V2", name: "status pompa", type: "Integer", min: 0, max: 1, value: 1 },
    V3: { pin: "V3", name: "suhu udara", type: "Double", min: 0, max: 100, value: 27.4 },
    V4: { pin: "V4", name: "kecepatan kipas", type: "Integer", min: 0, max: 100, value: 40 },
    V5: { pin: "V5", name: "intensitas cahaya", type: "Integer", min: 0, max: 1023, value: 412 },
  };
}

function genAuthToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const prefix = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const suffix = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${prefix}-${suffix}`;
}

export default function DeviceContent() {
  const [user, setUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);
  const [isEditingWidgets, setIsEditingWidgets] = useState(false);

  // New Device Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDevName, setNewDevName] = useState("");
  const [newDevType, setNewDevType] = useState("ESP32");
  const [creating, setCreating] = useState(false);

  // Canvas Widgets State (saat edit widget)
  const [canvasWidgets, setCanvasWidgets] = useState<CanvasWidget[]>([]);
  const [activeWidgetForModal, setActiveWidgetForModal] = useState<CanvasWidget | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const devRef = ref(rtdb, `users/${user.uid}/devices`);
    return onValue(devRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setDevices([]);
        setLoading(false);
        return;
      }
      const list: DeviceItem[] = Object.entries(data).map(([id, val]) => {
        const item = val as Omit<DeviceItem, "id">;
        let wList: CanvasWidget[] = [];
        if (item.widgets) {
          if (Array.isArray(item.widgets)) {
            wList = item.widgets;
          } else {
            wList = Object.entries(item.widgets).map(([wid, w]) => ({
              ...(w as CanvasWidget),
              id: wid,
            }));
          }
        }
        return {
          id,
          ...item,
          widgets: wList,
          datastreams: item.datastreams || getDefaultDatastreams(),
        };
      });
      setDevices(list);
      setLoading(false);

      // Sinkronkan selected device jika sedang dibuka
      if (selectedDevice) {
        const found = list.find((d) => d.id === selectedDevice.id);
        if (found) setSelectedDevice(found);
      }
    });
  }, [user, selectedDevice?.id]);

  const handleCreateDevice = async () => {
    if (!user || !newDevName.trim()) return;
    setCreating(true);
    try {
      const token = genAuthToken();
      const devRef = ref(rtdb, `users/${user.uid}/devices`);
      const newRef = push(devRef);
      await set(newRef, {
        name: newDevName.trim(),
        type: newDevType,
        authToken: token,
        owner: `${user.email || "member@upnvj.ac.id"} (you)`,
        status: "offline",
        lastSeen: null,
        createdAt: Date.now(),
        datastreams: getDefaultDatastreams(),
        widgets: [
          { id: "w_1", type: "switch", title: "Device power", vpin: "V2", colSpan: 1, value: 1 },
          { id: "w_2", type: "slider", title: "Fan speed", vpin: "V4", min: 0, max: 100, colSpan: 1, value: 40 },
          { id: "w_3", type: "label", title: "Temperature", vpin: "V3", unit: "°C", colSpan: 1, value: 27.4 },
          { id: "w_4", type: "chart", title: "Temperature, last 24 hours", vpin: "V3", colSpan: 2 },
          { id: "w_5", type: "image", title: "Device photo", vpin: "V0", colSpan: 1 },
          { id: "w_6", type: "table", title: "Latest readings", vpin: "V1", colSpan: 2 },
          { id: "w_7", type: "video", title: "Live video (optional)", vpin: "V0", colSpan: 1 }
        ],
      });
      setShowAddModal(false);
      setNewDevName("");
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteDevice = async (id: string, name: string) => {
    if (!user) return;
    if (!confirm(`Hapus device "${name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await remove(ref(rtdb, `users/${user.uid}/devices/${id}`));
      if (selectedDevice?.id === id) {
        setIsEditingWidgets(false);
        setSelectedDevice(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenEditWidgets = (device: DeviceItem) => {
    setSelectedDevice(device);
    setCanvasWidgets(device.widgets || []);
    setIsEditingWidgets(true);
  };

  const handleApplyChanges = async () => {
    if (!user || !selectedDevice) return;
    try {
      await update(ref(rtdb, `users/${user.uid}/devices/${selectedDevice.id}`), {
        widgets: canvasWidgets,
      });
      setIsEditingWidgets(false);
      alert("Perubahan widget berhasil disimpan!");
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan widget.");
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: DragEvent, type: WidgetType) => {
    e.dataTransfer.setData("widgetType", type);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("widgetType") as WidgetType;
    if (!type) return;
    addWidgetToCanvas(type);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const addWidgetToCanvas = (type: WidgetType) => {
    const newId = `w_${Date.now()}`;
    let title = "New Widget";
    let vpin = "V1";
    let colSpan = 1;

    switch (type) {
      case "switch":
        title = "Switch";
        vpin = "V2";
        colSpan = 1;
        break;
      case "slider":
        title = "Slider";
        vpin = "V4";
        colSpan = 1;
        break;
      case "label":
        title = "Value Display";
        vpin = "V3";
        colSpan = 1;
        break;
      case "chart":
        title = "Data Chart";
        vpin = "V3";
        colSpan = 2;
        break;
      case "table":
        title = "Data Table";
        vpin = "V1";
        colSpan = 2;
        break;
      case "image":
        title = "Image Widget";
        colSpan = 1;
        break;
      case "video":
        title = "Live Video";
        colSpan = 1;
        break;
    }

    const newWidget: CanvasWidget = {
      id: newId,
      type,
      title,
      vpin,
      colSpan,
      value: type === "switch" ? 0 : type === "slider" ? 50 : 25,
      min: 0,
      max: 100,
    };

    setCanvasWidgets((prev) => [...prev, newWidget]);
  };

  const removeWidgetFromCanvas = (id: string) => {
    setCanvasWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  // Realtime Live Update Virtual Pin value
  const updateDatastreamValue = async (pin: string, val: number | string) => {
    if (!user || !selectedDevice) return;
    try {
      await update(ref(rtdb, `users/${user.uid}/devices/${selectedDevice.id}/datastreams/${pin}`), {
        value: val,
      });
      // Update juga di state canvas
      setCanvasWidgets((prev) =>
        prev.map((w) => (w.vpin === pin ? { ...w, value: val } : w))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const filteredDevices = devices.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.authToken.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="page-loading">Loading devices…</div>;
  }

  // ══════════════════════════════════════════════════════════
  // VIEW: EDIT WIDGETS CANVAS (Gambar 1 & 5)
  // ══════════════════════════════════════════════════════════
  if (isEditingWidgets && selectedDevice) {
    const ds = selectedDevice.datastreams || getDefaultDatastreams();

    return (
      <div className="blynk-device-editor-page">
        {/* Header */}
        <div className="editor-top-header">
          <div>
            <h1 className="editor-main-title">Device</h1>
            <p className="editor-sub-title">Guidances you might need!</p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="editor-action-bar">
          <div className="action-bar-left">
            <h2 className="widget-settings-heading">Widget Settings</h2>
            <span className="current-device-tag">({selectedDevice.name})</span>
          </div>
          <div className="action-bar-buttons">
            <button
              className="btn-editor-cancel"
              onClick={() => setIsEditingWidgets(false)}
            >
              Cancel
            </button>
            <button
              className="btn-editor-apply"
              onClick={handleApplyChanges}
            >
              Apply Changes
            </button>
          </div>
        </div>

        {/* Main Work Area: Sidebar + Canvas */}
        <div className="editor-workspace-layout">
          {/* ── Left Sidebar: Widget Box ── */}
          <div className="widget-box-sidebar">
            <div className="widget-box-header">
              <h3 className="widget-box-title">Widget Box</h3>
              <p className="widget-box-desc">Device metrics</p>
            </div>

            <div className="widget-box-categories">
              {/* Category: Controls */}
              <div className="widget-category-group">
                <span className="category-group-label">Controls</span>
                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, "switch")}
                  onClick={() => addWidgetToCanvas("switch")}
                  title="Click or Drag to Canvas"
                >
                  <span className="card-item-title">Switch</span>
                  <div className="mock-switch-pill">
                    <span className="mock-switch-circle" />
                  </div>
                </div>

                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, "slider")}
                  onClick={() => addWidgetToCanvas("slider")}
                  title="Click or Drag to Canvas"
                >
                  <span className="card-item-title">Slider</span>
                  <div className="mock-slider-track">
                    <span className="mock-slider-thumb" />
                    <span className="mock-slider-val">1</span>
                  </div>
                </div>
              </div>

              {/* Category: Tiles */}
              <div className="widget-category-group">
                <span className="category-group-label">Tiles</span>
                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, "label")}
                  onClick={() => addWidgetToCanvas("label")}
                  title="Click or Drag to Canvas"
                >
                  <span className="card-item-title">Label</span>
                  <span className="mock-tile-val">111</span>
                </div>
              </div>

              {/* Category: Data */}
              <div className="widget-category-group">
                <span className="category-group-label">Data</span>
                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, "table")}
                  onClick={() => addWidgetToCanvas("table")}
                  title="Click or Drag to Canvas"
                >
                  <span className="card-item-title">Table</span>
                  <span className="mock-item-sub">Time • Sensor • Value</span>
                </div>

                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, "image")}
                  onClick={() => addWidgetToCanvas("image")}
                  title="Click or Drag to Canvas"
                >
                  <span className="card-item-title">Image</span>
                  <span className="mock-item-sub">Photo or diagram</span>
                </div>

                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, "chart")}
                  onClick={() => addWidgetToCanvas("chart")}
                  title="Click or Drag to Canvas"
                >
                  <span className="card-item-title">Data chart</span>
                  <span className="mock-item-sub">Realtime line chart</span>
                </div>
              </div>

              {/* Category: Media */}
              <div className="widget-category-group">
                <span className="category-group-label">Media</span>
                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, "video")}
                  onClick={() => addWidgetToCanvas("video")}
                  title="Click or Drag to Canvas"
                >
                  <span className="card-item-title">Live video</span>
                  <span className="mock-item-sub">Device camera</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Canvas: Grid Area ── */}
          <div
            className="widget-canvas-dropzone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {canvasWidgets.length === 0 ? (
              // Empty Canvas (Gambar 5)
              <div className="canvas-empty-state">
                <div className="canvas-grid-lines-bg" />
                <div className="canvas-empty-content">
                  <h3 className="empty-title">Add new widget</h3>
                  <p className="empty-sub">Drag a widget from the Widget Box to the canvas</p>
                </div>
              </div>
            ) : (
              // Active Widgets Canvas (Gambar 1)
              <div className="canvas-widgets-grid">
                {canvasWidgets.map((w) => {
                  const datastream = ds[w.vpin];
                  const currentVal = datastream ? datastream.value : w.value;

                  return (
                    <div
                      key={w.id}
                      className={`canvas-widget-card col-span-${w.colSpan || 1}`}
                    >
                      {/* Widget Controls Bar */}
                      <div className="card-header-bar">
                        <span className="card-widget-title">{w.title}</span>
                        <div className="card-actions-right">
                          <button
                            className="btn-card-gear"
                            title="Edit Virtual Pin / Datastream"
                            onClick={() => setActiveWidgetForModal(w)}
                          >
                            ⚙️
                          </button>
                          <button
                            className="btn-card-trash"
                            title="Delete Widget"
                            onClick={() => removeWidgetFromCanvas(w.id)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Widget Body Rendering */}
                      <div className="card-widget-content">
                        {/* SWITCH */}
                        {w.type === "switch" && (
                          <div className="render-switch-row">
                            <button
                              className={`blynk-toggle-pill ${Number(currentVal) === 1 ? "active" : ""}`}
                              onClick={() => {
                                const next = Number(currentVal) === 1 ? 0 : 1;
                                updateDatastreamValue(w.vpin, next);
                              }}
                            >
                              <span className="toggle-pill-thumb" />
                            </button>
                            <span className="toggle-status-text">
                              {Number(currentVal) === 1 ? "On" : "Off"}
                            </span>
                          </div>
                        )}

                        {/* SLIDER */}
                        {w.type === "slider" && (
                          <div className="render-slider-row">
                            <input
                              type="range"
                              min={w.min ?? 0}
                              max={w.max ?? 100}
                              value={Number(currentVal) || 0}
                              className="blynk-slider-element"
                              onChange={(e) => updateDatastreamValue(w.vpin, Number(e.target.value))}
                            />
                            <span className="slider-value-display">{currentVal}</span>
                          </div>
                        )}

                        {/* LABEL / TILE */}
                        {w.type === "label" && (
                          <div className="render-label-row">
                            <span className="label-large-text">
                              {currentVal}{w.unit || "°C"}
                            </span>
                          </div>
                        )}

                        {/* DATA CHART */}
                        {w.type === "chart" && (
                          <div className="render-chart-block">
                            <svg className="blynk-chart-svg" viewBox="0 0 500 120" preserveAspectRatio="none">
                              <defs>
                                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#0070f3" stopOpacity="0.25" />
                                  <stop offset="100%" stopColor="#0070f3" stopOpacity="0.0" />
                                </linearGradient>
                              </defs>
                              <path
                                d="M0,80 Q50,70 100,60 T200,50 T300,40 T400,30 T500,45 L500,120 L0,120 Z"
                                fill="url(#chartGrad)"
                              />
                              <path
                                d="M0,80 Q50,70 100,60 T200,50 T300,40 T400,30 T500,45"
                                fill="none"
                                stroke="#0070f3"
                                strokeWidth="2.5"
                              />
                            </svg>
                          </div>
                        )}

                        {/* IMAGE */}
                        {w.type === "image" && (
                          <div className="render-image-block">
                            <div className="image-mock-esp32">
                              <span className="dot-pin p-tl" />
                              <span className="dot-pin p-tr" />
                              <span className="dot-pin p-bl" />
                              <span className="dot-pin p-br" />
                              <div className="esp-chip-core">ESP32</div>
                            </div>
                          </div>
                        )}

                        {/* TABLE */}
                        {w.type === "table" && (
                          <div className="render-table-block">
                            <table className="blynk-data-table">
                              <thead>
                                <tr>
                                  <th>Time</th>
                                  <th>Sensor</th>
                                  <th>Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>12:41:08</td>
                                  <td>Temperature</td>
                                  <td>{ds.V3?.value ?? 27.4}</td>
                                </tr>
                                <tr>
                                  <td>12:41:06</td>
                                  <td>Humidity</td>
                                  <td>{ds.V1?.value ?? 63.1}</td>
                                </tr>
                                <tr>
                                  <td>12:41:04</td>
                                  <td>Light</td>
                                  <td>{ds.V5?.value ?? 412.0}</td>
                                </tr>
                                <tr>
                                  <td>12:41:02</td>
                                  <td>Temperature</td>
                                  <td>{ds.V3?.value ?? 27.3}</td>
                                </tr>
                                <tr>
                                  <td>12:41:00</td>
                                  <td>Humidity</td>
                                  <td>{ds.V1?.value ?? 63.0}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* LIVE VIDEO */}
                        {w.type === "video" && (
                          <div className="render-video-block">
                            <div className="video-camera-screen">
                              <div className="camera-live-badge">LIVE</div>
                              <div className="camera-glitch-box b1" />
                              <div className="camera-glitch-box b2" />
                              <div className="camera-footer-info">CAM-01 12:41:08</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── MODAL: EDIT VIRTUAL PIN & DATASTREAM (Gambar 4) ── */}
        {activeWidgetForModal && (
          <DatastreamModal
            widget={activeWidgetForModal}
            device={selectedDevice}
            onClose={() => setActiveWidgetForModal(null)}
            onSave={(updatedWidget) => {
              setCanvasWidgets((prev) =>
                prev.map((w) => (w.id === updatedWidget.id ? updatedWidget : w))
              );
              setActiveWidgetForModal(null);
            }}
          />
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // VIEW: DEVICE LIST (Gambar 3)
  // ══════════════════════════════════════════════════════════
  return (
    <div className="blynk-device-list-page">
      {/* Header */}
      <div className="page-header-simple">
        <h1 className="page-title-bold">Device</h1>
        <p className="page-sub-text">Guidances you might need!</p>
      </div>

      {/* Table Section Header */}
      <div className="device-table-toolbar">
        <h2 className="device-list-heading">Device List</h2>
        <button
          className="btn-new-device-blue"
          onClick={() => setShowAddModal(true)}
        >
          <span className="plus-icon">⊕</span> New Device
        </button>
      </div>

      {/* Devices Table */}
      <div className="device-table-card">
        <table className="device-modern-table">
          <thead>
            <tr>
              <th className="col-name">Device Name ⬍</th>
              <th className="col-token">Auth Token ⬍</th>
              <th className="col-owner">Device Owner ⬍</th>
              <th className="col-status">Status ⬍</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-devices-row">
                  Belum ada device. Klik <strong>+ New Device</strong> untuk menambahkan.
                </td>
              </tr>
            ) : (
              filteredDevices.map((d) => (
                <tr key={d.id}>
                  <td className="cell-name">
                    <label className="checkbox-wrap">
                      <input type="checkbox" />
                      <span className="dev-name-text">{d.name}</span>
                    </label>
                  </td>
                  <td className="cell-token">
                    <span className="token-masked">
                      {d.authToken ? `${d.authToken.slice(0, 8)} - •••••` : "—"}
                    </span>
                  </td>
                  <td className="cell-owner">{d.owner || user?.email || "owner"}</td>
                  <td className="cell-status">
                    <span className={`status-pill ${d.status}`}>
                      {d.status === "online" ? "Online" : "Offline"}
                    </span>
                  </td>
                  <td className="cell-actions">
                    <button
                      className="btn-action-edit"
                      onClick={() => handleOpenEditWidgets(d)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-action-delete"
                      onClick={() => handleDeleteDevice(d.id, d.name)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── MODAL: CREATE NEW DEVICE ── */}
      {showAddModal && (
        <div className="modal-backdrop-blur" onClick={() => setShowAddModal(false)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-simple">
              <h3>Create New Device</h3>
              <button className="btn-close-modal" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="modal-body-form">
              <div className="modal-input-group">
                <label>Device Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Device Hiji"
                  value={newDevName}
                  onChange={(e) => setNewDevName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="modal-input-group">
                <label>Hardware Type</label>
                <select value={newDevType} onChange={(e) => setNewDevType(e.target.value)}>
                  <option value="ESP32">ESP32</option>
                  <option value="ESP8266">ESP8266</option>
                  <option value="Arduino">Arduino</option>
                  <option value="Raspberry Pi">Raspberry Pi</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
            </div>
            <div className="modal-footer-simple">
              <button className="btn-modal-cancel" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button
                className="btn-modal-submit"
                disabled={!newDevName.trim() || creating}
                onClick={handleCreateDevice}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MODAL: VIRTUAL PIN & DATASTREAM (Gambar 4)
// ══════════════════════════════════════════════════════════
function DatastreamModal({
  widget,
  device,
  onClose,
  onSave,
}: {
  widget: CanvasWidget;
  device: DeviceItem;
  onClose: () => void;
  onSave: (updated: CanvasWidget) => void;
}) {
  const [activeTab, setActiveTab] = useState<"data" | "design">("data");
  const [selectedVpin, setSelectedVpin] = useState(widget.vpin || "V1");
  const [widgetTitle, setWidgetTitle] = useState(widget.title);
  const [colSpan, setColSpan] = useState(widget.colSpan || 1);

  // Datastreams
  const ds = device.datastreams || getDefaultDatastreams();
  const assignedDs = ds[selectedVpin] || {
    pin: selectedVpin,
    name: "Datastream",
    type: "Integer",
    min: 0,
    max: 100,
    value: 0,
  };

  const handleSave = () => {
    onSave({
      ...widget,
      title: widgetTitle,
      vpin: selectedVpin,
      colSpan,
    });
  };

  return (
    <div className="modal-backdrop-blur" onClick={onClose}>
      <div className="datastream-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Title */}
        <div className="ds-modal-top">
          <h2 className="ds-modal-title">{widget.title || widget.type.toUpperCase()}</h2>
        </div>

        {/* Tabs: Data / Design */}
        <div className="ds-tabs-row">
          <button
            className={`ds-tab-btn ${activeTab === "data" ? "active" : ""}`}
            onClick={() => setActiveTab("data")}
          >
            Data
          </button>
          <button
            className={`ds-tab-btn ${activeTab === "design" ? "active" : ""}`}
            onClick={() => setActiveTab("design")}
          >
            Design
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "data" ? (
          <div className="ds-tab-body">
            <div className="ds-field-section">
              <span className="ds-section-heading">DATASTREAM</span>
              <p className="ds-section-sub">Min/Max values of datastreams will be used as On/Off values.</p>

              {/* Status Assigned */}
              <div className="ds-assigned-badge-row">
                <span className="ds-check-icon">✔</span>
                <span className="ds-assigned-text">
                  <strong>1 Datastream</strong> assigned to the widget:
                </span>
                <span className="ds-pill-tag">
                  🎵 {assignedDs.pin} {assignedDs.name} &nbsp; {assignedDs.type} [{assignedDs.min}-{assignedDs.max}]
                </span>
              </div>

              {/* Virtual Pin Selector */}
              <label className="ds-input-label">VIRTUAL PIN</label>
              <div className="ds-vpin-select-box">
                <select
                  value={selectedVpin}
                  onChange={(e) => setSelectedVpin(e.target.value)}
                  className="ds-vpin-dropdown"
                >
                  {Object.entries(ds).map(([pin, item]) => (
                    <option key={pin} value={pin}>
                      {pin} — {item.name} ({item.type} [{item.min}-{item.max}])
                    </option>
                  ))}
                </select>
                <button
                  className="btn-ds-trash"
                  title="Reset Pin"
                  onClick={() => setSelectedVpin("V0")}
                >
                  🗑
                </button>
              </div>
            </div>

            {/* Devices Section */}
            <div className="ds-field-section" style={{ marginTop: 20 }}>
              <span className="ds-section-heading">DEVICES</span>
              <p className="ds-section-sub">Select devices that will be assigned to the widget.</p>

              <div className="ds-devices-table-wrap">
                <table className="ds-mini-table">
                  <thead>
                    <tr>
                      <th>Device Name</th>
                      <th>Organization</th>
                      <th>Device owner</th>
                      <th>Device Id</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="active-row">
                      <td>
                        <span className="active-dot-icon">🎵</span> {device.name}
                      </td>
                      <td>My organization - KSM IoT</td>
                      <td>{device.owner || "Owner"}</td>
                      <td>{device.id.slice(0, 8)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* Tab Design */
          <div className="ds-tab-body">
            <div className="ds-field-section">
              <label className="ds-input-label">Widget Title</label>
              <input
                type="text"
                className="ds-text-input"
                value={widgetTitle}
                onChange={(e) => setWidgetTitle(e.target.value)}
              />
            </div>

            <div className="ds-field-section" style={{ marginTop: 14 }}>
              <label className="ds-input-label">Grid Width (Columns)</label>
              <select
                value={colSpan}
                onChange={(e) => setColSpan(Number(e.target.value))}
                className="ds-text-input"
              >
                <option value={1}>1 Column (Standard)</option>
                <option value={2}>2 Columns (Wide)</option>
                <option value={3}>3 Columns (Full Width)</option>
              </select>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="ds-modal-footer">
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
