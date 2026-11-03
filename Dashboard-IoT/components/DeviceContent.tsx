"use client";

import { useEffect, useState, DragEvent } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  ref, onValue, push, set, update, remove, get
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

const LEGACY_TEMPLATE_NAMES = [
  "pembacaan pH",
  "pembacaan kelembapan",
  "status pompa",
  "suhu udara",
  "kecepatan kipas",
  "intensitas cahaya",
];

const PAGE_SIZE = 10;

export default function DeviceContent() {
  const [user, setUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);

  // View mode: "list" | "detail" | "editWidgets"
  const [viewMode, setViewMode] = useState<"list" | "detail" | "editWidgets">("list");

  // New Device Modal (Gambar 2)
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDevName, setNewDevName] = useState("");
  const [newDevBoard, setNewDevBoard] = useState<"Arduino" | "ESP32">("Arduino");
  const [newDevToken, setNewDevToken] = useState("");
  const [creating, setCreating] = useState(false);

  // Delete Confirmation Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Device Detail: token visibility & copy feedback
  const [showToken, setShowToken] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Canvas Widgets State (saat edit widget mode)
  const [canvasWidgets, setCanvasWidgets] = useState<CanvasWidget[]>([]);
  const [activeWidgetForModal, setActiveWidgetForModal] = useState<CanvasWidget | null>(null);
  const [showNewDsModal, setShowNewDsModal] = useState(false);

  // Drag and drop reorder state
  const [draggedWidgetIdx, setDraggedWidgetIdx] = useState<number | null>(null);

  // Search filter & Pagination (Gambar 3)
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

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

      // Keep selected device synced
      if (selectedDevice) {
        const found = list.find((d) => d.id === selectedDevice.id);
        if (found) setSelectedDevice(found);
      }
    });
  }, [user, selectedDevice?.id]);

  // Create a brand new device (Gambar 2)
  const handleCreateDevice = async () => {
    if (!user || !newDevName.trim()) return;
    setCreating(true);
    try {
      const token = newDevToken.trim() || genAuthToken();
      const devRef = ref(rtdb, `users/${user.uid}/devices`);
      const newRef = push(devRef);
      const devId = newRef.key!;

      const newDeviceData: Omit<DeviceItem, "id"> = {
        name: newDevName.trim(),
        type: newDevBoard,
        authToken: token,
        owner: `${user.email || "user@example.com"} (you)`,
        status: "offline",
        lastSeen: null,
        createdAt: Date.now(),
        datastreams: {}, // Bersih tanpa template dummy!
        widgets: [],
      };

      await set(newRef, newDeviceData);

      // Best effort: Save token index for ESP32 authentication verification
      try {
        await set(ref(rtdb, `device_tokens/${token}`), {
          uid: user.uid,
          deviceId: devId,
          deviceName: newDevName.trim(),
          createdAt: Date.now(),
        });
      } catch (tokenErr) {
        console.warn("device_token sync notice:", tokenErr);
      }

      setShowAddModal(false);
      setNewDevName("");
      setNewDevToken("");
      setNewDevBoard("Arduino");

      // Langsung lanjutkan ke widget settings seperti di subtitle Gambar 2
      const createdItem: DeviceItem = { id: devId, ...newDeviceData };
      setSelectedDevice(createdItem);
      setCanvasWidgets([]);
      setViewMode("editWidgets");
    } catch (err: any) {
      console.error(err);
      alert("Gagal membuat device: " + (err?.message || "Periksa koneksi"));
    } finally {
      setCreating(false);
    }
  };

  // Prompt delete confirmation (modal)
  const handlePromptDelete = (id: string, name: string) => {
    setDeviceToDelete({ id, name });
    setShowDeleteModal(true);
  };

  // Pastikan delete device 100% berhasil!
  const handleConfirmDelete = async () => {
    if (!user || !deviceToDelete) return;
    setDeleting(true);
    const devId = deviceToDelete.id;
    const targetDev = devices.find((d) => d.id === devId);
    const token = targetDev?.authToken;

    try {
      let clientDeleted = false;

      // 1. Coba hapus via client SDK di path user (selalu authorized bagi user pemilik)
      try {
        await remove(ref(rtdb, `users/${user.uid}/devices/${devId}`));
        clientDeleted = true;
      } catch (clientErr) {
        console.warn("Client removal error, using server API delete:", clientErr);
      }

      // 2. Fallback via server API jika rules client bermasalah
      if (!clientDeleted) {
        const res = await fetch("/api/device/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: user.uid, deviceId: devId, authToken: token }),
        });
        if (!res.ok) {
          throw new Error("Gagal menghapus melalui server.");
        }
      }

      // 3. Bersihkan token index jika diizinkan (non-blocking)
      if (token) {
        try {
          await remove(ref(rtdb, `device_tokens/${token}`));
        } catch {
          // Ignore jika permission tidak mengizinkan write device_tokens langsung dari client
        }
      }

      // 4. Update state lokal
      setDevices((prev) => prev.filter((d) => d.id !== devId));
      if (selectedDevice?.id === devId) {
        setViewMode("list");
        setSelectedDevice(null);
      }
    } catch (err: any) {
      console.error("Delete error:", err);
      alert("Gagal menghapus device: " + (err?.message || "Periksa koneksi database."));
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
      setDeviceToDelete(null);
    }
  };

  // Hapus datastream tertentu
  const handleDeleteDatastream = async (pinToDelete: string) => {
    if (!user || !selectedDevice) return;
    if (!confirm(`Hapus datastream pin "${pinToDelete}"?`)) return;
    try {
      await remove(ref(rtdb, `users/${user.uid}/devices/${selectedDevice.id}/datastreams/${pinToDelete}`));
      const updatedDs = { ...(selectedDevice.datastreams || {}) };
      delete updatedDs[pinToDelete];
      setSelectedDevice({ ...selectedDevice, datastreams: updatedDs });
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus datastream.");
    }
  };

  // Bersihkan semua template datastream bawaan (V0–V5)
  const handleClearLegacyTemplates = async () => {
    if (!user || !selectedDevice) return;
    const currentDs = selectedDevice.datastreams || {};
    const legacyEntries = Object.entries(currentDs).filter(([, ds]) =>
      LEGACY_TEMPLATE_NAMES.includes(ds.name)
    );
    if (legacyEntries.length === 0) return;
    if (!confirm(`Hapus ${legacyEntries.length} datastream template bawaan (V0–V5)?`)) return;

    try {
      for (const [pin] of legacyEntries) {
        await remove(ref(rtdb, `users/${user.uid}/devices/${selectedDevice.id}/datastreams/${pin}`));
      }
      const updatedDs = { ...currentDs };
      for (const [pin] of legacyEntries) {
        delete updatedDs[pin];
      }
      setSelectedDevice({ ...selectedDevice, datastreams: updatedDs });
    } catch (err) {
      console.error(err);
      alert("Gagal membersihkan template.");
    }
  };

  // Navigate to device detail view (Gambar 5)
  const handleOpenDeviceDetail = (device: DeviceItem) => {
    setSelectedDevice(device);
    setShowToken(false);
    setViewMode("detail");
  };

  // Navigate to widget editor (Widget Box + Canvas)
  const handleOpenEditWidgets = (device: DeviceItem) => {
    setSelectedDevice(device);
    setCanvasWidgets(device.widgets || []);
    setViewMode("editWidgets");
  };

  const handleApplyChanges = async () => {
    if (!user || !selectedDevice) return;
    try {
      await update(ref(rtdb, `users/${user.uid}/devices/${selectedDevice.id}`), {
        widgets: canvasWidgets,
      });
      setViewMode("detail");
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan widget.");
    }
  };

  // "Edit Dashboard" button logic in Gambar 5
  const handleEditDashboard = async () => {
    if (!user || !selectedDevice) return;
    try {
      const dashSnap = await get(ref(rtdb, `users/${user.uid}/dashboards`));
      const dashData = dashSnap.val();
      if (dashData) {
        let matchedDashId = "";
        for (const [dashId, val] of Object.entries<any>(dashData)) {
          if (val?.deviceId === selectedDevice.id) {
            matchedDashId = dashId;
            break;
          }
          if (val?.widgets) {
            const wList = Array.isArray(val.widgets) ? val.widgets : Object.values(val.widgets);
            if (wList.some((w: any) => w?.deviceId === selectedDevice.id)) {
              matchedDashId = dashId;
              break;
            }
          }
        }
        if (matchedDashId) {
          window.location.href = `/dashboard?active=${matchedDashId}`;
          return;
        }
      }
      window.location.href = `/dashboard?createFor=${selectedDevice.id}`;
    } catch (err) {
      console.error(err);
      window.location.href = `/dashboard?createFor=${selectedDevice.id}`;
    }
  };

  // Add widget from Widget Box
  const addWidgetToCanvas = (type: WidgetType) => {
    const newId = `w_${Date.now()}`;
    let title = "New Widget";
    let colSpan = 1;

    switch (type) {
      case "switch": title = "Switch"; colSpan = 1; break;
      case "slider": title = "Slider"; colSpan = 1; break;
      case "label": title = "Label"; colSpan = 1; break;
      case "chart": title = "Data chart"; colSpan = 2; break;
      case "table": title = "Table"; colSpan = 2; break;
      case "image": title = "Device photo"; colSpan = 1; break;
      case "video": title = "Live video"; colSpan = 1; break;
    }

    const newWidget: CanvasWidget = {
      id: newId,
      type,
      title,
      deviceId: selectedDevice?.id,
      vpin: "",
      colSpan,
      value: 0,
    };

    setCanvasWidgets((prev) => [...prev, newWidget]);
    setActiveWidgetForModal(newWidget);
  };

  const removeWidgetFromCanvas = (id: string) => {
    setCanvasWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  const handlePaletteDragStart = (e: DragEvent, type: WidgetType) => {
    e.dataTransfer.setData("widgetType", type);
  };

  const handleCanvasDrop = (e: DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("widgetType") as WidgetType;
    if (type) addWidgetToCanvas(type);
  };

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

  const handleSaveNewDatastream = async (newDs: Datastream) => {
    if (!user || !selectedDevice) return;
    try {
      await update(ref(rtdb, `users/${user.uid}/devices/${selectedDevice.id}/datastreams/${newDs.pin}`), newDs);
      const updatedDs = { ...(selectedDevice.datastreams || {}), [newDs.pin]: newDs };
      setSelectedDevice({ ...selectedDevice, datastreams: updatedDs });

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

  // Filter & Pagination
  const filteredDevices = devices.filter((d) =>
    (d.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.authToken || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredDevices.length / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedDevices = filteredDevices.slice(startIndex, startIndex + PAGE_SIZE);

  if (loading) {
    return <div className="page-loading">Loading devices…</div>;
  }

  // ══════════════════════════════════════════════════════════
  // VIEW 1: EDIT WIDGETS CANVAS (Widget Box & Drag-Drop)
  // ══════════════════════════════════════════════════════════
  if (viewMode === "editWidgets" && selectedDevice) {
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
              onClick={() => setViewMode("detail")}
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
          {/* Left Sidebar: Widget Box */}
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
                  <span className="card-item-title">Device photo</span>
                  <span className="mock-item-sub">Hardware diagram</span>
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
                  <span className="mock-item-sub">Camera stream</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Canvas */}
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
                            <div className="widget-chart-clean-view">
                              <svg className="blynk-chart-svg" viewBox="0 0 500 100" preserveAspectRatio="none">
                                <path
                                  d="M0,70 Q100,50 200,60 T350,45 T500,55 L500,100 L0,100 Z"
                                  fill="rgba(0,112,243,0.12)"
                                />
                                <path
                                  d="M0,70 Q100,50 200,60 T350,45 T500,55"
                                  fill="none"
                                  stroke="#0070f3"
                                  strokeWidth="2.5"
                                />
                              </svg>
                              <div className="chart-val-footer">
                                <span>Nilai: {currentVal ?? "--"} {currentDs?.unit || ""}</span>
                              </div>
                            </div>
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
                            {Object.keys(ds).length === 0 ? (
                              <div style={{ color: "#9ca3af", fontSize: 12, padding: "16px 0", textAlign: "center" }}>
                                Belum ada datastream.
                              </div>
                            ) : (
                              <table className="blynk-data-table">
                                <thead>
                                  <tr>
                                    <th>Pin</th>
                                    <th>Sensor</th>
                                    <th>Value</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(ds).map(([pin, stream]) => (
                                    <tr key={pin}>
                                      <td>{pin}</td>
                                      <td>{stream.displayName || stream.name}</td>
                                      <td>
                                        {stream.value !== undefined ? String(stream.value) : "—"} {stream.unit || ""}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}

                        {/* VIDEO */}
                        {w.type === "video" && (
                          <div className="render-video-block">
                            <div className="video-camera-screen">
                              <div className="camera-live-badge">LIVE</div>
                              <div className="camera-footer-info">CAM-01</div>
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

        {/* MODAL: WIDGET SETTINGS */}
        {activeWidgetForModal && (
          <WidgetSettingsModal
            widget={activeWidgetForModal}
            device={selectedDevice}
            onClose={() => setActiveWidgetForModal(null)}
            onSave={(updated) => {
              setCanvasWidgets((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
              setActiveWidgetForModal(null);
            }}
            onCreateDatastream={() => setShowNewDsModal(true)}
          />
        )}

        {/* MODAL: NEW DATASTREAM */}
        {showNewDsModal && (
          <NewDatastreamModal
            existingPins={Object.keys(ds)}
            onClose={() => setShowNewDsModal(false)}
            onSave={handleSaveNewDatastream}
          />
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // VIEW 2: DEVICE DETAIL (Gambar 5 - Read View)
  // ══════════════════════════════════════════════════════════
  if (viewMode === "detail" && selectedDevice) {
    const ds = selectedDevice.datastreams || {};
    const widgets = selectedDevice.widgets || [];
    const hasLegacy = Object.values(ds).some((item) => LEGACY_TEMPLATE_NAMES.includes(item.name));

    return (
      <div className="dev-detail-page-container">
        {/* Top Breadcrumb with Back Arrow (Gambar 5) */}
        <div className="dev-detail-breadcrumb-bar">
          <button
            className="btn-detail-back-arrow"
            onClick={() => {
              setViewMode("list");
              setSelectedDevice(null);
            }}
            title="Kembali ke Device List"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="back-arrow-svg">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="dev-breadcrumb-path">
            <span
              className="crumb-link"
              onClick={() => {
                setViewMode("list");
                setSelectedDevice(null);
              }}
            >
              Device
            </span>
            <span className="crumb-slash"> / </span>
            <span className="crumb-active">{selectedDevice.name}</span>
          </div>
        </div>

        {/* Device Information Card (Gambar 5) */}
        <div className="dev-detail-card-box">
          <div className="dev-card-left-group">
            {/* Chip Avatar Icon */}
            <div className="dev-chip-icon-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="#0070f3" strokeWidth="2" className="dev-chip-icon-svg">
                <rect x="5" y="5" width="14" height="14" rx="2" />
                <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
              </svg>
            </div>

            {/* Info Texts */}
            <div className="dev-info-texts">
              <div className="dev-title-status-row">
                <h1 className="dev-name-heading">{selectedDevice.name}</h1>
                <span className={`dev-status-badge ${selectedDevice.status}`}>
                  • {selectedDevice.status === "online" ? "Online" : "Offline"}
                </span>
              </div>

              <div className="dev-meta-line">
                <span className="meta-text">
                  Owner <strong>{selectedDevice.owner || user?.email || "member@upnvj.ac.id (you)"}</strong>
                </span>
                <span className="meta-sep" />
                <span className="meta-text">
                  Board <strong>{selectedDevice.type || "ESP32"}</strong>
                </span>
              </div>

              {/* AuthToken row with eye toggle & copy */}
              <div className="dev-auth-token-row">
                <span className="auth-token-label">AuthToken:</span>
                <span className="auth-token-val">
                  {showToken
                    ? selectedDevice.authToken
                    : `${selectedDevice.authToken ? selectedDevice.authToken.slice(0, 8) : "GoE5-mYy"} •••••`}
                </span>

                <button
                  className="btn-auth-eye"
                  onClick={() => setShowToken(!showToken)}
                  title={showToken ? "Sembunyikan AuthToken" : "Lihat AuthToken"}
                >
                  {showToken ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="eye-svg">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="eye-svg">
                      <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>

                <button
                  className="btn-auth-copy"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedDevice.authToken || "");
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                  }}
                  title="Salin AuthToken untuk Arduino IDE"
                >
                  {copiedToken ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons: Widget Settings & Edit Dashboard (Gambar 5) */}
          <div className="dev-card-right-actions">
            <button
              className="btn-widget-settings-pill"
              onClick={() => handleOpenEditWidgets(selectedDevice)}
            >
              Widget Settings
            </button>
            <button
              className="btn-edit-dashboard-pill"
              onClick={handleEditDashboard}
            >
              Edit Dashboard
            </button>
          </div>
        </div>

        {/* Datastreams Quick-Manage Section */}
        {hasLegacy && (
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#9a3412" }}>
              Perangkat ini memiliki datastream template bawaan lama (V0-V5). Ingin menghapusnya agar bersih?
            </span>
            <button
              type="button"
              onClick={handleClearLegacyTemplates}
              style={{
                background: "#ea580c",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✕ Hapus Template V0-V5
            </button>
          </div>
        )}

        {/* Widgets Grid View (Gambar 5) */}
        <div className="dev-detail-widgets-area">
          {widgets.length === 0 ? (
            <div className="canvas-empty-state" style={{ minHeight: 200 }}>
              <div className="canvas-empty-content">
                <h3 className="empty-title">Belum ada widget pada device ini</h3>
                <p className="empty-sub">
                  Klik tombol <strong>Widget Settings</strong> di atas untuk menambahkan kontrol, gauge, chart, dan indikator.
                </p>
                <button
                  className="btn-dash-new-primary"
                  onClick={() => handleOpenEditWidgets(selectedDevice)}
                  style={{ marginTop: 14 }}
                >
                  + Tambah Widget Sekarang
                </button>
              </div>
            </div>
          ) : (
            <div className="canvas-widgets-grid">
              {widgets.map((w) => {
                const currentDs = w.vpin ? ds[w.vpin] : null;
                const currentVal = currentDs?.value !== undefined ? currentDs.value : w.value;

                return (
                  <div key={w.id} className={`canvas-widget-card col-span-${w.colSpan || 1}`}>
                    <div className="card-header-bar">
                      <div>
                        <span className="card-widget-title">{w.title}</span>
                        {w.vpin && currentDs && (
                          <span className="card-dev-tag">[{w.vpin}]</span>
                        )}
                      </div>
                    </div>

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
                          <div className="widget-chart-clean-view">
                            <svg className="blynk-chart-svg" viewBox="0 0 500 100" preserveAspectRatio="none">
                              <path
                                d="M0,70 Q100,50 200,60 T350,45 T500,55 L500,100 L0,100 Z"
                                fill="rgba(0,112,243,0.12)"
                              />
                              <path
                                d="M0,70 Q100,50 200,60 T350,45 T500,55"
                                fill="none"
                                stroke="#0070f3"
                                strokeWidth="2.5"
                              />
                            </svg>
                            <div className="chart-val-footer">
                              <span>Nilai: {currentVal ?? "--"} {currentDs?.unit || ""}</span>
                            </div>
                          </div>
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
                          {Object.keys(ds).length === 0 ? (
                            <div style={{ color: "#9ca3af", fontSize: 12, padding: "16px 0", textAlign: "center" }}>
                              Belum ada datastream pada device ini.
                            </div>
                          ) : (
                            <table className="blynk-data-table">
                              <thead>
                                <tr>
                                  <th>Pin</th>
                                  <th>Sensor</th>
                                  <th>Value</th>
                                  <th style={{ width: 40 }}>Aksi</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(ds).map(([pin, stream]) => (
                                  <tr key={pin}>
                                    <td>{pin}</td>
                                    <td>{stream.displayName || stream.name}</td>
                                    <td>
                                      {stream.value !== undefined ? String(stream.value) : "—"} {stream.unit || ""}
                                    </td>
                                    <td>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteDatastream(pin)}
                                        title="Hapus pin ini"
                                        style={{
                                          background: "transparent",
                                          border: "none",
                                          color: "#ef4444",
                                          cursor: "pointer",
                                          padding: 2,
                                        }}
                                      >
                                        🗑
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}

                      {/* VIDEO */}
                      {w.type === "video" && (
                        <div className="render-video-block">
                          <div className="video-camera-screen">
                            <div className="camera-live-badge">LIVE</div>
                            <div className="camera-footer-info">CAM-01</div>
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
    );
  }

  // ══════════════════════════════════════════════════════════
  // VIEW 3: DEVICE LIST (Gambar 3 & 4)
  // ══════════════════════════════════════════════════════════
  return (
    <div className="blynk-device-list-page">
      {/* Header */}
      <div className="page-header-simple">
        <h1 className="page-title-bold">Device</h1>
        <p className="page-sub-text">Your devices, your control</p>
      </div>

      {/* Table Section Header */}
      <div className="device-table-toolbar">
        <h2 className="device-list-heading">Device List</h2>
        <button
          className="btn-new-device-blue"
          onClick={() => {
            setNewDevName("");
            setNewDevBoard("Arduino");
            setNewDevToken(genAuthToken());
            setShowAddModal(true);
          }}
        >
          <span className="plus-icon">⊕</span> New Device
        </button>
      </div>

      {/* Devices Table (Gambar 4) */}
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
            {paginatedDevices.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-devices-row">
                  Belum ada device. Klik <strong>+ New Device</strong> untuk menambahkan perangkat baru.
                </td>
              </tr>
            ) : (
              paginatedDevices.map((d) => (
                <tr
                  key={d.id}
                  className="device-row-clickable"
                  onClick={() => handleOpenDeviceDetail(d)}
                  title="Klik untuk membuka detail device"
                >
                  <td className="cell-name">
                    <span className="dev-name-text">{d.name}</span>
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
                  <td className="cell-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn-action-icon"
                      title="Edit Widgets"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditWidgets(d);
                      }}
                    >
                      {/* Pencil Icon */}
                      <svg viewBox="0 0 20 20" fill="currentColor" className="action-icon-svg">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button
                      className="btn-action-icon danger"
                      title="Delete Device"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePromptDelete(d.id, d.name);
                      }}
                    >
                      {/* Trash Icon */}
                      <svg viewBox="0 0 20 20" fill="currentColor" className="action-icon-svg">
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* ── PAGINATION BAR (Gambar 3) ── */}
        <div className="device-table-pagination-bar">
          <div className="pagination-info-text">
            Showing <strong>{filteredDevices.length > 0 ? startIndex + 1 : 0}</strong> to{" "}
            <strong>{Math.min(startIndex + PAGE_SIZE, filteredDevices.length)}</strong> of{" "}
            <strong>{filteredDevices.length}</strong> registered devices
          </div>

          <div className="pagination-buttons-group">
            <button
              type="button"
              className="btn-page-nav-pill"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn-page-nav-pill"
              disabled={currentPage >= totalPages || filteredDevices.length === 0}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL: CREATE NEW DEVICE (Gambar 2) ── */}
      {showAddModal && (
        <div className="modal-backdrop-blur" onClick={() => setShowAddModal(false)}>
          <div className="modal-content-card blynk-new-dev-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="modal-header-clean">
              <h3 className="modal-title-bold">New device</h3>
              <p className="modal-subtitle-text">Fill in the device details, then continue to widget settings.</p>
            </div>

            <div className="modal-body-form" style={{ marginTop: 18 }}>
              {/* Project Name */}
              <div className="modal-input-group">
                <label className="modal-label-bold">Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. Smart Greenhouse"
                  value={newDevName}
                  onChange={(e) => setNewDevName(e.target.value)}
                  className="modal-text-input"
                  autoFocus
                />
              </div>

              {/* Board: Arduino & ESP32 Only (Gambar 2) */}
              <div className="modal-input-group" style={{ marginTop: 16 }}>
                <label className="modal-label-bold">Board</label>
                <div style={{ display: "flex", gap: 32, marginTop: 6 }}>
                  <label
                    className="device-radio-item"
                    style={{ cursor: "pointer" }}
                    onClick={() => setNewDevBoard("Arduino")}
                  >
                    <span className={`custom-radio-circle ${newDevBoard === "Arduino" ? "checked" : ""}`}>
                      {newDevBoard === "Arduino" && <span className="custom-radio-inner" />}
                    </span>
                    <span className="device-radio-label">Arduino</span>
                  </label>

                  <label
                    className="device-radio-item"
                    style={{ cursor: "pointer" }}
                    onClick={() => setNewDevBoard("ESP32")}
                  >
                    <span className={`custom-radio-circle ${newDevBoard === "ESP32" ? "checked" : ""}`}>
                      {newDevBoard === "ESP32" && <span className="custom-radio-inner" />}
                    </span>
                    <span className="device-radio-label">ESP32</span>
                  </label>
                </div>
              </div>

              {/* Token/Key with Generate button (Gambar 2) */}
              <div className="modal-input-group" style={{ marginTop: 18 }}>
                <label className="modal-label-bold">Token/Key</label>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="text"
                    placeholder="Paste the token from your device"
                    value={newDevToken}
                    onChange={(e) => setNewDevToken(e.target.value)}
                    className="modal-text-input"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-token-generate"
                    onClick={() => setNewDevToken(genAuthToken())}
                    title="Generate token acak baru"
                  >
                    Generate
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Buttons: Cancel & Confirm (Gambar 2) */}
            <div className="modal-footer-between" style={{ marginTop: 24 }}>
              <div />
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  type="button"
                  className="btn-modal-pill-cancel"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-modal-pill-next"
                  disabled={!newDevName.trim() || creating}
                  onClick={handleCreateDevice}
                >
                  {creating ? "Creating..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: DELETE CONFIRMATION ── */}
      {showDeleteModal && deviceToDelete && (
        <div
          className="modal-backdrop-blur"
          onClick={() => {
            if (!deleting) {
              setShowDeleteModal(false);
              setDeviceToDelete(null);
            }
          }}
        >
          <div className="modal-content-card modal-delete-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-simple">
              <h3>Delete Device</h3>
              <button
                className="btn-close-modal"
                disabled={deleting}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeviceToDelete(null);
                }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body-form">
              <div className="delete-confirm-body">
                <div className="delete-device-name">&quot;{deviceToDelete.name}&quot;</div>
                <p className="delete-confirm-text">
                  Apakah Anda yakin ingin menghapus perangkat ini? Semua widget dan konfigurasi terkait perangkat ini akan dihapus permanen.
                </p>
              </div>
            </div>
            <div className="modal-footer-simple">
              <button
                className="btn-modal-cancel"
                disabled={deleting}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeviceToDelete(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn-modal-delete"
                disabled={deleting}
                onClick={handleConfirmDelete}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
