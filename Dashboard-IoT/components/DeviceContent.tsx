"use client";

import { useEffect, useState, DragEvent } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  ref, onValue, push, set, update, remove
} from "firebase/database";
import { auth, rtdb } from "@/lib/firebase";
import {
  WidgetType,
  Datastream,
  CanvasWidget,
  DeviceItem,
  getDefaultDatastreams,
  genAuthToken,
} from "@/lib/iot-types";
import WidgetSettingsModal from "./WidgetSettingsModal";
import NewDatastreamModal from "./NewDatastreamModal";

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
  const [showNewDsModal, setShowNewDsModal] = useState(false);

  // Drag and drop reorder state
  const [draggedWidgetIdx, setDraggedWidgetIdx] = useState<number | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
  }, []);

  // Fetch devices in realtime from Firebase RTDB
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
          datastreams: item.datastreams || {},
        };
      });
      setDevices(list);
      setLoading(false);

      // Keep selected device synced if editing
      if (selectedDevice) {
        const found = list.find((d) => d.id === selectedDevice.id);
        if (found) setSelectedDevice(found);
      }
    });
  }, [user, selectedDevice?.id]);

  // Create a brand new device with EMPTY template (no default widgets, clean start)
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
        owner: `${user.email || "user@example.com"} (you)`,
        status: "offline",
        lastSeen: null,
        createdAt: Date.now(),
        datastreams: getDefaultDatastreams(),
        widgets: [], // Empty initially - user creates their own layout!
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
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan widget.");
    }
  };

  // Add widget from Widget Box
  const addWidgetToCanvas = (type: WidgetType) => {
    const newId = `w_${Date.now()}`;
    let title = "New Widget";
    let colSpan = 1;

    switch (type) {
      case "switch":
        title = "Switch";
        colSpan = 1;
        break;
      case "slider":
        title = "Slider";
        colSpan = 1;
        break;
      case "label":
        title = "Label";
        colSpan = 1;
        break;
      case "chart":
        title = "Data chart";
        colSpan = 2;
        break;
      case "table":
        title = "Table";
        colSpan = 2;
        break;
      case "image":
        title = "Image";
        colSpan = 1;
        break;
      case "video":
        title = "Live video";
        colSpan = 1;
        break;
    }

    const newWidget: CanvasWidget = {
      id: newId,
      type,
      title,
      vpin: "", // Not connected yet!
      colSpan,
      value: type === "switch" ? 0 : 0,
    };

    setCanvasWidgets((prev) => [...prev, newWidget]);
    // Automatically open settings so the user can configure it!
    setActiveWidgetForModal(newWidget);
  };

  const removeWidgetFromCanvas = (id: string) => {
    setCanvasWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  // Drag from palette
  const handlePaletteDragStart = (e: DragEvent, type: WidgetType) => {
    e.dataTransfer.setData("widgetType", type);
  };

  // Drop onto canvas
  const handleCanvasDrop = (e: DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("widgetType") as WidgetType;
    if (type) {
      addWidgetToCanvas(type);
    }
  };

  // Drag reordering inside canvas
  const handleItemDragStart = (e: DragEvent, index: number) => {
    setDraggedWidgetIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleItemDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (draggedWidgetIdx === null || draggedWidgetIdx === index) return;
    const items = [...canvasWidgets];
    const draggedItem = items[draggedWidgetIdx];
    items.splice(draggedWidgetIdx, 1);
    items.splice(index, 0, draggedItem);
    setDraggedWidgetIdx(index);
    setCanvasWidgets(items);
  };

  const handleItemDragEnd = () => {
    setDraggedWidgetIdx(null);
  };

  // Interactive control updates
  const handleWidgetValueChange = async (vpin: string, val: number | string) => {
    if (!user || !selectedDevice || !vpin) return;
    try {
      await update(ref(rtdb, `users/${user.uid}/devices/${selectedDevice.id}/datastreams/${vpin}`), {
        value: val,
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Saving new datastream from NewDatastreamModal
  const handleSaveNewDatastream = async (newDs: Datastream) => {
    if (!user || !selectedDevice) return;
    try {
      await update(ref(rtdb, `users/${user.uid}/devices/${selectedDevice.id}/datastreams/${newDs.pin}`), newDs);
      
      // Update local selectedDevice
      const updatedDs = { ...(selectedDevice.datastreams || {}), [newDs.pin]: newDs };
      setSelectedDevice({ ...selectedDevice, datastreams: updatedDs });

      // If modal was open for a widget, assign this new pin
      if (activeWidgetForModal) {
        setActiveWidgetForModal({
          ...activeWidgetForModal,
          vpin: newDs.pin,
          title: activeWidgetForModal.title || newDs.displayName || newDs.name,
        });
      }
      setShowNewDsModal(false);
    } catch (err) {
      console.error(err);
      alert("Gagal menambahkan datastream.");
    }
  };

  const filteredDevices = devices.filter((d) =>
    (d.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.authToken || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="page-loading">Loading devices…</div>;
  }

  // ══════════════════════════════════════════════════════════
  // VIEW: EDIT WIDGETS CANVAS (Gambar 1 & 5)
  // ══════════════════════════════════════════════════════════
  if (isEditingWidgets && selectedDevice) {
    const ds = selectedDevice.datastreams || {};

    return (
      <div className="blynk-device-editor-page">
        {/* Header */}
        <div className="editor-top-header">
          <div>
            <h1 className="editor-main-title">Device</h1>
            <p className="editor-sub-title">Customize your widgets.</p>
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

        {/* Workspace: Sidebar + Canvas */}
        <div className="editor-workspace-layout">
          {/* ── Left Sidebar: Widget Box (Gambar 1) ── */}
          <div className="widget-box-sidebar">
            <div className="widget-box-header">
              <h3 className="widget-box-title">Widget Box</h3>
              <p className="widget-box-desc">Device metrics</p>
            </div>

            <div className="widget-box-categories">
              {/* Controls */}
              <div className="widget-category-group">
                <span className="category-group-label">Controls</span>
                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handlePaletteDragStart(e, "switch")}
                  onClick={() => addWidgetToCanvas("switch")}
                  title="Drag or click to add"
                >
                  <span className="card-item-title">Switch</span>
                  <div className="mock-switch-pill"><span className="mock-switch-circle" /></div>
                </div>

                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handlePaletteDragStart(e, "slider")}
                  onClick={() => addWidgetToCanvas("slider")}
                  title="Drag or click to add"
                >
                  <span className="card-item-title">Slider</span>
                  <div className="mock-slider-track">
                    <span className="mock-slider-thumb" />
                    <span className="mock-slider-val">1</span>
                  </div>
                </div>
              </div>

              {/* Tiles */}
              <div className="widget-category-group">
                <span className="category-group-label">Tiles</span>
                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handlePaletteDragStart(e, "label")}
                  onClick={() => addWidgetToCanvas("label")}
                  title="Drag or click to add"
                >
                  <span className="card-item-title">Label</span>
                  <span className="mock-tile-val">111</span>
                </div>
              </div>

              {/* Data */}
              <div className="widget-category-group">
                <span className="category-group-label">Data</span>
                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handlePaletteDragStart(e, "table")}
                  onClick={() => addWidgetToCanvas("table")}
                  title="Drag or click to add"
                >
                  <span className="card-item-title">Table</span>
                  <span className="mock-item-sub">Time • Sensor • Value</span>
                </div>

                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handlePaletteDragStart(e, "image")}
                  onClick={() => addWidgetToCanvas("image")}
                  title="Drag or click to add"
                >
                  <span className="card-item-title">Image</span>
                  <span className="mock-item-sub">Photo or diagram</span>
                </div>

                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handlePaletteDragStart(e, "chart")}
                  onClick={() => addWidgetToCanvas("chart")}
                  title="Drag or click to add"
                >
                  <span className="card-item-title">Data chart</span>
                  <span className="mock-item-sub">Realtime line chart</span>
                </div>
              </div>

              {/* Media */}
              <div className="widget-category-group">
                <span className="category-group-label">Media</span>
                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handlePaletteDragStart(e, "video")}
                  onClick={() => addWidgetToCanvas("video")}
                  title="Drag or click to add"
                >
                  <span className="card-item-title">Live video</span>
                  <span className="mock-item-sub">Device camera</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Canvas: Grid Area (Gambar 2 & 5) ── */}
          <div
            className="widget-canvas-dropzone editing-mode"
            onDrop={handleCanvasDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {canvasWidgets.length === 0 ? (
              <div className="canvas-empty-state">
                <div className="canvas-empty-content">
                  <h3 className="empty-title">Add new widget</h3>
                  <p className="empty-sub">Drag a widget from the Widget Box to the canvas</p>
                </div>
              </div>
            ) : (
              <div className="canvas-widgets-grid">
                {canvasWidgets.map((w, index) => {
                  const currentDs = w.vpin ? ds[w.vpin] : null;
                  const currentVal = currentDs?.value !== undefined ? currentDs.value : w.value;
                  const isConfigured = Boolean(w.vpin && currentDs);

                  return (
                    <div
                      key={w.id}
                      draggable
                      onDragStart={(e) => handleItemDragStart(e, index)}
                      onDragOver={(e) => handleItemDragOver(e, index)}
                      onDragEnd={handleItemDragEnd}
                      className={`canvas-widget-card col-span-${w.colSpan || 1} ${draggedWidgetIdx === index ? "is-dragging" : ""}`}
                    >
                      {/* Card Header */}
                      <div className="card-header-bar">
                        <div>
                          <span className="card-widget-title">{w.title}</span>
                          {isConfigured ? (
                            <span className="card-dev-tag">[{w.vpin}]</span>
                          ) : (
                            <span className="card-dev-tag not-configured" style={{ color: "#ef4444" }}>
                              (Unassigned)
                            </span>
                          )}
                        </div>
                        <div className="card-actions-right">
                          <button
                            className="btn-card-gear"
                            title="Configure Datastream / Title"
                            onClick={() => setActiveWidgetForModal(w)}
                          >
                            ⚙️
                          </button>
                          <button
                            className="btn-card-trash"
                            title="Delete"
                            onClick={() => removeWidgetFromCanvas(w.id)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="card-widget-content">
                        {/* SWITCH */}
                        {w.type === "switch" && (
                          <div className="render-switch-row">
                            <button
                              className={`blynk-toggle-pill ${Number(currentVal) === 1 ? "active" : ""}`}
                              onClick={() => {
                                const next = Number(currentVal) === 1 ? 0 : 1;
                                handleWidgetValueChange(w.vpin!, next);
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
                              min={currentDs?.min ?? w.min ?? 0}
                              max={currentDs?.max ?? w.max ?? 100}
                              value={Number(currentVal) || 0}
                              className="blynk-slider-element"
                              onChange={(e) => handleWidgetValueChange(w.vpin!, Number(e.target.value))}
                            />
                            <span className="slider-value-display">{currentVal ?? 0}</span>
                          </div>
                        )}

                        {/* LABEL */}
                        {w.type === "label" && (
                          <div className="render-label-row">
                            <span className="label-large-text">
                              {currentVal ?? "--"} {currentDs?.unit || w.unit || ""}
                            </span>
                          </div>
                        )}

                        {/* CHART */}
                        {w.type === "chart" && (
                          <div className="render-chart-block">
                            <svg className="blynk-chart-svg" viewBox="0 0 500 120" preserveAspectRatio="none">
                              <defs>
                                <linearGradient id={`devGrad_${w.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#0070f3" stopOpacity="0.25" />
                                  <stop offset="100%" stopColor="#0070f3" stopOpacity="0.0" />
                                </linearGradient>
                              </defs>
                              <path
                                d="M0,80 Q50,70 100,60 T200,50 T300,40 T400,30 T500,45 L500,120 L0,120 Z"
                                fill={`url(#devGrad_${w.id})`}
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
                              <div className="esp-chip-core">{selectedDevice.type || "ESP32"}</div>
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
                                  <td>{ds.V3?.value ?? "27.4"}</td>
                                </tr>
                                <tr>
                                  <td>12:41:06</td>
                                  <td>Humidity</td>
                                  <td>{ds.V1?.value ?? "63.1"}</td>
                                </tr>
                                <tr>
                                  <td>12:41:04</td>
                                  <td>Light</td>
                                  <td>{ds.V5?.value ?? "412.0"}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* VIDEO */}
                        {w.type === "video" && (
                          <div className="render-video-block">
                            <div className="video-camera-screen">
                              <div className="camera-live-badge">LIVE</div>
                              <div className="camera-glitch-box b1" />
                              <div className="camera-glitch-box b2" />
                              <div className="camera-footer-info">CAM-01 LIVE</div>
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

        {/* ── MODAL: WIDGET SETTINGS (Gambar 3) ── */}
        {activeWidgetForModal && (
          <WidgetSettingsModal
            widget={activeWidgetForModal}
            device={selectedDevice}
            onClose={() => setActiveWidgetForModal(null)}
            onSave={(updated) => {
              setCanvasWidgets((prev) =>
                prev.map((w) => (w.id === updated.id ? updated : w))
              );
              setActiveWidgetForModal(null);
            }}
            onCreateDatastream={() => {
              setShowNewDsModal(true);
            }}
          />
        )}

        {/* ── MODAL: NEW DATASTREAM (Gambar 4 & 5) ── */}
        {showNewDsModal && (
          <NewDatastreamModal
            existingPins={Object.keys(ds)}
            initialPin="V0"
            onClose={() => setShowNewDsModal(false)}
            onSave={handleSaveNewDatastream}
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
