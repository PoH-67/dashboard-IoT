"use client";

import { useEffect, useState, DragEvent } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { ref, onValue, push, set, update, remove } from "firebase/database";
import { auth, rtdb } from "@/lib/firebase";
import { CanvasWidget, Datastream, DeviceItem, WidgetType } from "@/lib/iot-types";
import WidgetSettingsModal from "./WidgetSettingsModal";
import NewDatastreamModal from "./NewDatastreamModal";

interface DashboardItem {
  id: string;
  name: string;
  deviceId?: string;
  createdAt: number;
  widgets: CanvasWidget[];
}

export default function DashboardContent() {
  const [user, setUser] = useState<User | null>(null);
  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);
  const [activeDashId, setActiveDashId] = useState<string>("");
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Time filter state
  const [timeRange, setTimeRange] = useState<"Live" | "1h" | "1d" | "1w" | "1mo">("1d");

  // Edit Mode Toggle (Edit Dashboard)
  const [isEditing, setIsEditing] = useState(false);

  // New Dashboard Modal (Gambar 3)
  const [showNewDashModal, setShowNewDashModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedDeviceForNewDash, setSelectedDeviceForNewDash] = useState<string>("");
  const [creatingDash, setCreatingDash] = useState(false);

  // Modals
  const [activeWidgetModal, setActiveWidgetModal] = useState<CanvasWidget | null>(null);
  const [showNewDsModal, setShowNewDsModal] = useState(false);
  const [targetDeviceForDs, setTargetDeviceForDs] = useState<string>("");

  // Drag-and-drop reorder
  const [draggedWidgetIdx, setDraggedWidgetIdx] = useState<number | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
  }, []);

  // Check URL query parameters (e.g. from Gambar 5 "Edit Dashboard" button)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const active = params.get("active");
    const createFor = params.get("createFor");
    if (active) {
      setActiveDashId(active);
    }
    if (createFor) {
      setSelectedDeviceForNewDash(createFor);
      setShowNewDashModal(true);
    }
  }, []);

  // Fetch devices
  useEffect(() => {
    if (!user) return;
    const devRef = ref(rtdb, `users/${user.uid}/devices`);
    return onValue(devRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setDevices([]);
        return;
      }
      const list: DeviceItem[] = Object.entries(data).map(([id, val]) => ({
        id,
        ...(val as Omit<DeviceItem, "id">),
      }));
      setDevices(list);
      // Auto-select first device for new dashboard modal if not set
      if (!selectedDeviceForNewDash && list.length > 0) {
        setSelectedDeviceForNewDash(list[0].id);
      }
    });
  }, [user, selectedDeviceForNewDash]);

  // Fetch dashboards (NO auto-creation of default template dashboard!)
  useEffect(() => {
    if (!user) return;
    const dashRef = ref(rtdb, `users/${user.uid}/dashboards`);
    return onValue(dashRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setDashboards([]);
        setLoading(false);
        return;
      }

      const list: DashboardItem[] = Object.entries(data).map(([id, val]) => {
        const item = val as Omit<DashboardItem, "id">;
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
        };
      });

      setDashboards(list);
      if (list.length > 0) {
        // If current activeDashId is not in the list, set to first one
        if (!activeDashId || !list.some((d) => d.id === activeDashId)) {
          setActiveDashId(list[0].id);
        }
      } else {
        setActiveDashId("");
      }
      setLoading(false);
    });
  }, [user, activeDashId]);

  const activeDashboard = dashboards.find((d) => d.id === activeDashId) || dashboards[0] || null;
  const connectedDevice = activeDashboard?.deviceId
    ? devices.find((d) => d.id === activeDashboard.deviceId)
    : devices[0] || null;

  // Dashboard Management: Create New Dashboard (Gambar 3)
  const handleCreateDashboard = async () => {
    if (!user || !newProjectName.trim()) return;
    setCreatingDash(true);
    try {
      const dashRef = ref(rtdb, `users/${user.uid}/dashboards`);
      const newRef = push(dashRef);
      await set(newRef, {
        name: newProjectName.trim(),
        deviceId: selectedDeviceForNewDash || (devices[0]?.id || ""),
        createdAt: Date.now(),
        widgets: [],
      });
      setActiveDashId(newRef.key!);
      setShowNewDashModal(false);
      setNewProjectName("");
    } catch (err) {
      console.error(err);
      alert("Gagal membuat dashboard baru.");
    } finally {
      setCreatingDash(false);
    }
  };

  const handleDeleteDashboard = async (dashId: string, dashName: string) => {
    if (!user) return;
    if (!confirm(`Hapus dashboard "${dashName}"?`)) return;
    try {
      await remove(ref(rtdb, `users/${user.uid}/dashboards/${dashId}`));
      const remaining = dashboards.filter((d) => d.id !== dashId);
      if (remaining.length > 0) {
        setActiveDashId(remaining[0].id);
      } else {
        setActiveDashId("");
        setIsEditing(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Widget
  const addWidgetToActiveDashboard = async (type: WidgetType) => {
    if (!user || !activeDashboard) return;

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

    const defaultDevId = activeDashboard.deviceId || devices[0]?.id || "";

    const newWidget: CanvasWidget = {
      id: `w_dash_${Date.now()}`,
      type,
      title,
      deviceId: defaultDevId,
      vpin: "",
      colSpan,
      value: 0,
      min: 0,
      max: 100,
    };

    const currentWidgets = activeDashboard.widgets || [];
    const updatedWidgets = [...currentWidgets, newWidget];
    await update(ref(rtdb, `users/${user.uid}/dashboards/${activeDashboard.id}`), {
      widgets: updatedWidgets,
    });

    setActiveWidgetModal(newWidget);
  };

  const removeWidgetFromDashboard = async (widgetId: string) => {
    if (!user || !activeDashboard) return;
    const updated = (activeDashboard.widgets || []).filter((w) => w.id !== widgetId);
    await update(ref(rtdb, `users/${user.uid}/dashboards/${activeDashboard.id}`), {
      widgets: updated,
    });
  };

  // Drag and Drop from Palette
  const handlePaletteDragStart = (e: DragEvent, type: WidgetType) => {
    e.dataTransfer.setData("widgetType", type);
  };

  const handleCanvasDrop = (e: DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("widgetType") as WidgetType;
    if (type) addWidgetToActiveDashboard(type);
  };

  // Reorder in Dashboard Canvas
  const handleItemDragStart = (e: DragEvent, index: number) => {
    if (!isEditing) return;
    setDraggedWidgetIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleItemDragOver = (e: DragEvent, index: number) => {
    if (!isEditing) return;
    e.preventDefault();
    if (draggedWidgetIdx === null || draggedWidgetIdx === index || !activeDashboard) return;
    const items = [...(activeDashboard.widgets || [])];
    const draggedItem = items[draggedWidgetIdx];
    items.splice(draggedWidgetIdx, 1);
    items.splice(index, 0, draggedItem);
    setDraggedWidgetIdx(index);

    setDashboards((prev) =>
      prev.map((d) => (d.id === activeDashboard.id ? { ...d, widgets: items } : d))
    );
  };

  const handleItemDragEnd = async () => {
    if (!isEditing || !activeDashboard || !user) return;
    setDraggedWidgetIdx(null);
    await update(ref(rtdb, `users/${user.uid}/dashboards/${activeDashboard.id}`), {
      widgets: activeDashboard.widgets || [],
    });
  };

  // Interactive control: updates device virtual pin
  const handleInteract = async (widget: CanvasWidget, nextVal: number | string) => {
    if (!user || !widget.deviceId || !widget.vpin) return;
    try {
      await update(ref(rtdb, `users/${user.uid}/devices/${widget.deviceId}/datastreams/${widget.vpin}`), {
        value: nextVal,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveNewDatastream = async (newDs: Datastream) => {
    if (!user || !targetDeviceForDs) return;
    try {
      await update(ref(rtdb, `users/${user.uid}/devices/${targetDeviceForDs}/datastreams/${newDs.pin}`), newDs);
      setShowNewDsModal(false);
      if (activeWidgetModal) {
        setActiveWidgetModal({
          ...activeWidgetModal,
          deviceId: targetDeviceForDs,
          vpin: newDs.pin,
          title: activeWidgetModal.title || newDs.displayName || newDs.name,
        });
      }
    } catch (err) {
      console.error(err);
      alert("Gagal menambahkan datastream.");
    }
  };

  if (loading) return <div className="page-loading">Loading dashboards…</div>;

  return (
    <div className="dash-blynk-root">
      {/* ── Top Header ── */}
      <div className="dash-blynk-topbar">
        <div>
          <h1 className="dash-blynk-title">Dashboard</h1>
          <p className="dash-blynk-subtitle">Your data, one view</p>
        </div>
      </div>

      {/* ── Main Two-Column Layout (Gambar 2) ── */}
      <div className="dash-blynk-layout">
        {/* ── LEFT PANEL: MY DASHBOARDS ── */}
        <aside className="dash-blynk-leftpane">
          <div className="dash-leftpane-header">
            <h2 className="dash-leftpane-title">My Dashboards</h2>
            <span className="dash-leftpane-count">{dashboards.length} dashboard</span>
          </div>

          <button
            className="dash-btn-new-dash"
            onClick={() => {
              setNewProjectName("");
              setShowNewDashModal(true);
            }}
          >
            + New Dashboard
          </button>

          <div className="dash-list-scroll">
            {dashboards.length === 0 ? (
              <div className="dash-empty-left">Belum ada dashboard</div>
            ) : (
              dashboards.map((dash) => {
                const isActive = dash.id === activeDashboard?.id;
                const widgetCount = dash.widgets?.length || 0;
                return (
                  <div
                    key={dash.id}
                    className={`dash-pill-card ${isActive ? "active" : ""}`}
                    onClick={() => setActiveDashId(dash.id)}
                  >
                    <div className="dash-pill-left">
                      <span className={`dash-dot ${isActive ? "dot-online" : "dot-offline"}`} />
                      <div className="dash-pill-texts">
                        <span className="dash-pill-name">{dash.name}</span>
                        <span className="dash-pill-sub">{widgetCount} widget</span>
                      </div>
                    </div>
                    {isEditing && (
                      <button
                        className="dash-pill-delete-btn"
                        title="Delete Dashboard"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDashboard(dash.id, dash.name);
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ── RIGHT PANEL: DASHBOARD CANVAS ── */}
        <main className="dash-blynk-mainpane">
          {dashboards.length === 0 || !activeDashboard ? (
            <div className="canvas-empty-state">
              <div className="canvas-empty-content">
                <h3 className="empty-title">Belum ada dashboard</h3>
                <p className="empty-sub">
                  Klik <strong>+ New Dashboard</strong> untuk mulai membuat dashboard IoT Anda.
                </p>
                <button
                  className="btn-dash-new-primary"
                  onClick={() => setShowNewDashModal(true)}
                  style={{ marginTop: 14 }}
                >
                  + Buat Dashboard Sekarang
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header inside active dashboard */}
              <div className="dash-active-header">
                <div>
                  <h2 className="dash-active-title">{activeDashboard.name}</h2>
                  <p className="dash-active-meta">
                    {connectedDevice?.name || "Multi-device"} · {activeDashboard.widgets?.length || 0} widget
                  </p>
                </div>
                <div className="dash-active-actions">
                  <button
                    className={`btn-dash-edit-pill ${isEditing ? "is-editing" : ""}`}
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    {isEditing ? "✔ Done Editing" : "Edit Dashboard"}
                  </button>
                  <div className="dash-device-status-badge">
                    <span className={`status-dot ${connectedDevice?.status === "online" ? "online" : "offline"}`} />
                    <span className="status-label">
                      {connectedDevice?.name || "Device"} · {connectedDevice?.status === "online" ? "Online" : "Offline"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Time Range Filter Bar */}
              <div className="dash-timerange-bar">
                {(["Live", "1h", "1d", "1w", "1mo"] as const).map((r) => (
                  <button
                    key={r}
                    className={`dash-time-pill ${timeRange === r ? "active" : ""}`}
                    onClick={() => setTimeRange(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* Editor Workspace or Normal Canvas */}
              <div className={`dash-workspace-wrapper ${isEditing ? "editing" : ""}`}>
                {/* Widget Box Sidebar when editing */}
                {isEditing && (
                  <div className="widget-box-sidebar">
                    <div className="widget-box-header">
                      <h3 className="widget-box-title">Widget Box</h3>
                      <p className="widget-box-desc">Drag or click to add</p>
                    </div>

                    <div className="widget-box-categories">
                      <div className="widget-category-group">
                        <span className="category-group-label">Controls</span>
                        <div
                          className="widget-draggable-card"
                          draggable
                          onDragStart={(e) => handlePaletteDragStart(e, "switch")}
                          onClick={() => addWidgetToActiveDashboard("switch")}
                        >
                          <span className="card-item-title">Switch</span>
                          <div className="mock-switch-pill"><span className="mock-switch-circle" /></div>
                        </div>
                        <div
                          className="widget-draggable-card"
                          draggable
                          onDragStart={(e) => handlePaletteDragStart(e, "slider")}
                          onClick={() => addWidgetToActiveDashboard("slider")}
                        >
                          <span className="card-item-title">Slider</span>
                          <div className="mock-slider-track">
                            <span className="mock-slider-thumb" />
                            <span className="mock-slider-val">1</span>
                          </div>
                        </div>
                      </div>

                      <div className="widget-category-group">
                        <span className="category-group-label">Tiles</span>
                        <div
                          className="widget-draggable-card"
                          draggable
                          onDragStart={(e) => handlePaletteDragStart(e, "label")}
                          onClick={() => addWidgetToActiveDashboard("label")}
                        >
                          <span className="card-item-title">Label</span>
                          <span className="mock-tile-val">111</span>
                        </div>
                      </div>

                      <div className="widget-category-group">
                        <span className="category-group-label">Data</span>
                        <div
                          className="widget-draggable-card"
                          draggable
                          onDragStart={(e) => handlePaletteDragStart(e, "table")}
                          onClick={() => addWidgetToActiveDashboard("table")}
                        >
                          <span className="card-item-title">Table</span>
                          <span className="mock-item-sub">Time • Sensor • Value</span>
                        </div>
                        <div
                          className="widget-draggable-card"
                          draggable
                          onDragStart={(e) => handlePaletteDragStart(e, "image")}
                          onClick={() => addWidgetToActiveDashboard("image")}
                        >
                          <span className="card-item-title">Device photo</span>
                          <span className="mock-item-sub">Hardware diagram</span>
                        </div>
                        <div
                          className="widget-draggable-card"
                          draggable
                          onDragStart={(e) => handlePaletteDragStart(e, "chart")}
                          onClick={() => addWidgetToActiveDashboard("chart")}
                        >
                          <span className="card-item-title">Data chart</span>
                          <span className="mock-item-sub">Realtime line chart</span>
                        </div>
                      </div>

                      <div className="widget-category-group">
                        <span className="category-group-label">Media</span>
                        <div
                          className="widget-draggable-card"
                          draggable
                          onDragStart={(e) => handlePaletteDragStart(e, "video")}
                          onClick={() => addWidgetToActiveDashboard("video")}
                        >
                          <span className="card-item-title">Live video</span>
                          <span className="mock-item-sub">Camera stream</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dropzone & Widgets Grid */}
                <div
                  className={`widget-canvas-dropzone ${isEditing ? "editing-mode" : ""}`}
                  onDrop={handleCanvasDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {(!activeDashboard?.widgets || activeDashboard.widgets.length === 0) ? (
                    <div className="canvas-empty-state">
                      <div className="canvas-empty-content">
                        <h3 className="empty-title">Add new widget</h3>
                        <p className="empty-sub">
                          {isEditing
                            ? "Drag a widget from the Widget Box to the canvas"
                            : "Klik tombol 'Edit Dashboard' di atas untuk mulai menambahkan widget."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="canvas-widgets-grid">
                      {activeDashboard.widgets.map((w, index) => {
                        const targetDev = devices.find((d) => d.id === w.deviceId) || connectedDevice;
                        const currentDs = (targetDev && w.vpin) ? targetDev.datastreams?.[w.vpin] : null;
                        const currentVal = currentDs?.value !== undefined ? currentDs.value : w.value;
                        const isConfigured = Boolean(targetDev && w.vpin && currentDs);

                        return (
                          <div
                            key={w.id}
                            draggable={isEditing}
                            onDragStart={(e) => handleItemDragStart(e, index)}
                            onDragOver={(e) => handleItemDragOver(e, index)}
                            onDragEnd={handleItemDragEnd}
                            className={`canvas-widget-card col-span-${w.colSpan || 1} ${draggedWidgetIdx === index ? "is-dragging" : ""}`}
                          >
                            <div className="card-header-bar">
                              <div>
                                <span className="card-widget-title">{w.title}</span>
                                {isConfigured ? (
                                  <span className="card-dev-tag">
                                    [{targetDev?.name} • {w.vpin}]
                                  </span>
                                ) : (
                                  <span className="card-dev-tag not-configured" style={{ color: "#ef4444" }}>
                                    (Unassigned)
                                  </span>
                                )}
                              </div>
                              {isEditing && (
                                <div className="card-actions-right">
                                  <button
                                    className="btn-card-gear"
                                    title="Configure Device & Pin"
                                    onClick={() => setActiveWidgetModal(w)}
                                  >
                                    ⚙️
                                  </button>
                                  <button
                                    className="btn-card-trash"
                                    title="Delete"
                                    onClick={() => removeWidgetFromDashboard(w.id)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="card-widget-content">
                              {/* SWITCH */}
                              {w.type === "switch" && (
                                <div className="render-switch-row">
                                  <button
                                    className={`blynk-toggle-pill ${Number(currentVal) === 1 ? "active" : ""}`}
                                    onClick={() => {
                                      const next = Number(currentVal) === 1 ? 0 : 1;
                                      handleInteract(w, next);
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
                                    onChange={(e) => handleInteract(w, Number(e.target.value))}
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
                                      <defs>
                                        <linearGradient id={`grad_${w.id}`} x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="0%" stopColor="#0070f3" stopOpacity="0.2" />
                                          <stop offset="100%" stopColor="#0070f3" stopOpacity="0.0" />
                                        </linearGradient>
                                      </defs>
                                      <path
                                        d="M0,70 Q100,50 200,60 T350,45 T500,55 L500,100 L0,100 Z"
                                        fill={`url(#grad_${w.id})`}
                                      />
                                      <path
                                        d="M0,70 Q100,50 200,60 T350,45 T500,55"
                                        fill="none"
                                        stroke="#0070f3"
                                        strokeWidth="2.5"
                                      />
                                    </svg>
                                    <div className="chart-val-footer">
                                      <span>Current: {currentVal ?? "--"} {currentDs?.unit || ""}</span>
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
                                    <div className="esp-chip-core">{targetDev?.type || "ESP32"}</div>
                                  </div>
                                </div>
                              )}

                              {/* TABLE — dynamic actual datastreams */}
                              {w.type === "table" && (
                                <div className="render-table-block">
                                  {targetDev && targetDev.datastreams && Object.keys(targetDev.datastreams).length > 0 ? (
                                    <table className="blynk-data-table">
                                      <thead>
                                        <tr>
                                          <th>Pin</th>
                                          <th>Sensor</th>
                                          <th>Value</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {Object.entries(targetDev.datastreams).map(([pin, ds]) => (
                                          <tr key={pin}>
                                            <td>{pin}</td>
                                            <td>{ds.displayName || ds.name}</td>
                                            <td>
                                              {ds.value !== undefined ? String(ds.value) : "--"} {ds.unit || ""}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <div style={{ color: "#9ca3af", fontSize: 12, padding: "16px 0", textAlign: "center" }}>
                                      Belum ada datastream pada device ini.
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* VIDEO */}
                              {w.type === "video" && (
                                <div className="render-video-block">
                                  <div className="video-camera-screen">
                                    <div className="camera-live-badge">LIVE</div>
                                    <div className="camera-glitch-box b1" />
                                    <div className="camera-glitch-box b2" />
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
            </>
          )}
        </main>
      </div>

      {/* ── MODAL: CREATE NEW DASHBOARD (Gambar 3) ── */}
      {showNewDashModal && (
        <div className="modal-backdrop-blur" onClick={() => setShowNewDashModal(false)}>
          <div className="modal-content-card blynk-new-dash-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="modal-header-clean">
              <h3 className="modal-title-bold">New Dashboard</h3>
              <p className="modal-subtitle-text">Select a device and its widgets to get started.</p>
            </div>

            {/* Form */}
            <div className="modal-body-form" style={{ marginTop: 16 }}>
              {/* Project Name */}
              <div className="modal-input-group">
                <label className="modal-label-bold">Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. Smart Home Monitoring"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="modal-text-input"
                  autoFocus
                />
              </div>

              {/* Device Radio Grid */}
              <div className="modal-input-group" style={{ marginTop: 18 }}>
                <label className="modal-label-bold">Device</label>
                {devices.length === 0 ? (
                  <p style={{ color: "#9ca3af", fontSize: 13, margin: "8px 0" }}>
                    Belum ada perangkat terdaftar. Silakan buat perangkat di menu Device terlebih dahulu.
                  </p>
                ) : (
                  <div className="device-radio-grid-2col">
                    {devices.map((d) => (
                      <label key={d.id} className="device-radio-item" onClick={() => setSelectedDeviceForNewDash(d.id)}>
                        <span className={`custom-radio-circle ${selectedDeviceForNewDash === d.id ? "checked" : ""}`}>
                          {selectedDeviceForNewDash === d.id && <span className="custom-radio-inner" />}
                        </span>
                        <span className="device-radio-label">{d.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons: Cancel & Next (Gambar 3) */}
            <div className="modal-footer-between" style={{ marginTop: 24 }}>
              <div />
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  type="button"
                  className="btn-modal-pill-cancel"
                  onClick={() => setShowNewDashModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-modal-pill-next"
                  disabled={!newProjectName.trim() || creatingDash}
                  onClick={handleCreateDashboard}
                >
                  {creatingDash ? "Creating..." : "Next"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: WIDGET SETTINGS ── */}
      {activeWidgetModal && (
        <WidgetSettingsModal
          widget={activeWidgetModal}
          devices={devices}
          onClose={() => setActiveWidgetModal(null)}
          onSave={async (updated) => {
            if (!user || !activeDashboard) return;
            const updatedWidgets = (activeDashboard.widgets || []).map((w) =>
              w.id === updated.id ? updated : w
            );
            await update(ref(rtdb, `users/${user.uid}/dashboards/${activeDashboard.id}`), {
              widgets: updatedWidgets,
            });
            setActiveWidgetModal(null);
          }}
          onCreateDatastream={(devId) => {
            setTargetDeviceForDs(devId);
            setShowNewDsModal(true);
          }}
        />
      )}

      {/* ── MODAL: NEW DATASTREAM ── */}
      {showNewDsModal && (
        <NewDatastreamModal
          existingPins={
            devices.find((d) => d.id === targetDeviceForDs)?.datastreams
              ? Object.keys(devices.find((d) => d.id === targetDeviceForDs)!.datastreams!)
              : []
          }
          onClose={() => setShowNewDsModal(false)}
          onSave={handleSaveNewDatastream}
        />
      )}
    </div>
  );
}
