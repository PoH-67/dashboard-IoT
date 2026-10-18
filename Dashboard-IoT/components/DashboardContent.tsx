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
  createdAt: number;
  widgets: CanvasWidget[];
}

export default function DashboardContent() {
  const [user, setUser] = useState<User | null>(null);
  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);
  const [activeDashId, setActiveDashId] = useState<string>("");
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Mode Toggle
  const [isEditing, setIsEditing] = useState(false);
  const [showNewDashModal, setShowNewDashModal] = useState(false);
  const [newDashName, setNewDashName] = useState("");

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
    });
  }, [user]);

  // Fetch dashboards
  useEffect(() => {
    if (!user) return;
    const dashRef = ref(rtdb, `users/${user.uid}/dashboards`);
    return onValue(dashRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        // Create initial default dashboard
        const newRef = push(dashRef);
        set(newRef, {
          name: "Main Dashboard",
          createdAt: Date.now(),
          widgets: [],
        });
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
      if (!activeDashId && list.length > 0) {
        setActiveDashId(list[0].id);
      }
      setLoading(false);
    });
  }, [user, activeDashId]);

  const activeDashboard = dashboards.find((d) => d.id === activeDashId) || dashboards[0];

  // Dashboard Management
  const handleCreateDashboard = async () => {
    if (!user || !newDashName.trim()) return;
    try {
      const dashRef = ref(rtdb, `users/${user.uid}/dashboards`);
      const newRef = push(dashRef);
      await set(newRef, {
        name: newDashName.trim(),
        createdAt: Date.now(),
        widgets: [],
      });
      setActiveDashId(newRef.key!);
      setShowNewDashModal(false);
      setNewDashName("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDashboard = async (dashId: string, dashName: string) => {
    if (!user || dashboards.length <= 1) {
      alert("Minimal harus ada 1 dashboard tersisa.");
      return;
    }
    if (!confirm(`Hapus dashboard "${dashName}"?`)) return;
    try {
      await remove(ref(rtdb, `users/${user.uid}/dashboards/${dashId}`));
      const remaining = dashboards.filter((d) => d.id !== dashId);
      if (remaining.length > 0) setActiveDashId(remaining[0].id);
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
      id: `w_dash_${Date.now()}`,
      type,
      title,
      deviceId: devices[0]?.id || "",
      vpin: "", // Unassigned by default
      colSpan,
      value: type === "switch" ? 0 : 0,
      min: 0,
      max: 100,
    };

    const currentWidgets = activeDashboard.widgets || [];
    const updatedWidgets = [...currentWidgets, newWidget];
    await update(ref(rtdb, `users/${user.uid}/dashboards/${activeDashboard.id}`), {
      widgets: updatedWidgets,
    });

    // Auto open settings for the new widget
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
    if (type) {
      addWidgetToActiveDashboard(type);
    }
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
    
    // Optimistic update
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

  // Interactive control: updates the target device's virtual pin value in RTDB
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

  // Create new datastream from modal
  const handleSaveNewDatastream = async (newDs: Datastream) => {
    if (!user || !targetDeviceForDs) return;
    try {
      await update(ref(rtdb, `users/${user.uid}/devices/${targetDeviceForDs}/datastreams/${newDs.pin}`), newDs);
      setShowNewDsModal(false);
      // Automatically assign to the active widget modal if open
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
    <div className="blynk-multi-dashboard-page">
      {/* Header */}
      <div className="dashboard-top-header">
        <div>
          <h1 className="page-title-bold">Dashboard</h1>
          <p className="page-sub-text">Customize your widgets and monitor devices.</p>
        </div>
        <div className="dash-header-actions">
          <button
            className={`btn-dash-mode ${isEditing ? "active" : ""}`}
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? "✔ Done Editing" : "✎ Edit Dashboard"}
          </button>
          <button
            className="btn-dash-new"
            onClick={() => setShowNewDashModal(true)}
          >
            + New Dashboard
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="dashboard-tabs-bar">
        <div className="tabs-scroll-row">
          {dashboards.map((dash) => (
            <div
              key={dash.id}
              className={`dash-tab-pill ${dash.id === activeDashboard?.id ? "active" : ""}`}
              onClick={() => setActiveDashId(dash.id)}
            >
              <span className="tab-pill-name">{dash.name}</span>
              {dashboards.length > 1 && isEditing && (
                <button
                  className="tab-pill-del"
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
          ))}
        </div>
      </div>

      {/* Main Container */}
      <div className={`dashboard-main-container ${!isEditing ? "view-mode" : ""}`}>
        {/* Left Sidebar when Editing */}
        {isEditing && (
          <div className="widget-box-sidebar">
            <div className="widget-box-header">
              <h3 className="widget-box-title">Widget Box</h3>
              <p className="widget-box-desc">Drag or click to add</p>
            </div>

            <div className="widget-box-categories">
              {/* Controls */}
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

              {/* Tiles */}
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

              {/* Data */}
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
                  <span className="card-item-title">Image</span>
                  <span className="mock-item-sub">Photo or diagram</span>
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

              {/* Media */}
              <div className="widget-category-group">
                <span className="category-group-label">Media</span>
                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handlePaletteDragStart(e, "video")}
                  onClick={() => addWidgetToActiveDashboard("video")}
                >
                  <span className="card-item-title">Live video</span>
                  <span className="mock-item-sub">Device camera</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Canvas Area */}
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
                    : "Klik '✎ Edit Dashboard' untuk mulai menyusun widget."}
                </p>
              </div>
            </div>
          ) : (
            <div className="canvas-widgets-grid">
              {activeDashboard.widgets.map((w, index) => {
                const targetDev = devices.find((d) => d.id === w.deviceId);
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
                    {/* Header */}
                    <div className="card-header-bar">
                      <div>
                        <span className="card-widget-title">{w.title}</span>
                        {isConfigured ? (
                          <span className="card-dev-tag">
                            [{targetDev?.name} • {w.vpin}]
                          </span>
                        ) : (
                          <span className="card-dev-tag not-configured" style={{ color: "#ef4444" }}>
                            (Not Assigned)
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

                    {/* Content */}
                    <div className="card-widget-content">
                      {!isConfigured && !isEditing ? (
                        <div style={{ color: "#9ca3af", fontSize: 12, padding: "12px 0", textAlign: "center" }}>
                          Widget belum terhubung ke perangkat. Edit untuk memilih datastream.
                        </div>
                      ) : (
                        <>
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
                              <svg className="blynk-chart-svg" viewBox="0 0 500 120" preserveAspectRatio="none">
                                <defs>
                                  <linearGradient id={`dashG_${w.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#0070f3" stopOpacity="0.25" />
                                    <stop offset="100%" stopColor="#0070f3" stopOpacity="0.0" />
                                  </linearGradient>
                                </defs>
                                <path
                                  d="M0,80 Q50,70 100,60 T200,50 T300,40 T400,30 T500,45 L500,120 L0,120 Z"
                                  fill={`url(#dashG_${w.id})`}
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
                                <div className="esp-chip-core">{targetDev?.type || "ESP32"}</div>
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
                                    <td>{targetDev?.datastreams?.V3?.value ?? "27.4"}</td>
                                  </tr>
                                  <tr>
                                    <td>12:41:06</td>
                                    <td>Humidity</td>
                                    <td>{targetDev?.datastreams?.V1?.value ?? "63.1"}</td>
                                  </tr>
                                  <tr>
                                    <td>12:41:04</td>
                                    <td>Light</td>
                                    <td>{targetDev?.datastreams?.V5?.value ?? "412.0"}</td>
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
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL: CREATE NEW DASHBOARD ── */}
      {showNewDashModal && (
        <div className="modal-backdrop-blur" onClick={() => setShowNewDashModal(false)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-simple">
              <h3>Create New Dashboard</h3>
              <button className="btn-close-modal" onClick={() => setShowNewDashModal(false)}>✕</button>
            </div>
            <div className="modal-body-form">
              <div className="modal-input-group">
                <label>Dashboard Name</label>
                <input
                  type="text"
                  placeholder="e.g. Living Room, Farm A"
                  value={newDashName}
                  onChange={(e) => setNewDashName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer-simple">
              <button className="btn-modal-cancel" onClick={() => setShowNewDashModal(false)}>
                Cancel
              </button>
              <button
                className="btn-modal-submit"
                disabled={!newDashName.trim()}
                onClick={handleCreateDashboard}
              >
                Create
              </button>
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
          initialPin="V0"
          onClose={() => setShowNewDsModal(false)}
          onSave={handleSaveNewDatastream}
        />
      )}
    </div>
  );
}
