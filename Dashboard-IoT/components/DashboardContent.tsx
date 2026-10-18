"use client";

import { useEffect, useState, DragEvent } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { ref, onValue, push, set, update, remove } from "firebase/database";
import { auth, rtdb } from "@/lib/firebase";
import { CanvasWidget, Datastream, DeviceItem, WidgetType } from "./DeviceContent";

interface DashboardItem {
  id: string;
  name: string;
  createdAt: number;
  widgets: DashboardWidget[];
}

interface DashboardWidget extends CanvasWidget {
  deviceId?: string; // target device id
}

export default function DashboardContent() {
  const [user, setUser] = useState<User | null>(null);
  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);
  const [activeDashId, setActiveDashId] = useState<string>("");
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Editor States
  const [isEditing, setIsEditing] = useState(false);
  const [showNewDashModal, setShowNewDashModal] = useState(false);
  const [newDashName, setNewDashName] = useState("");
  const [activeWidgetModal, setActiveWidgetModal] = useState<DashboardWidget | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
  }, []);

  // Fetch Devices & Dashboards realtime
  useEffect(() => {
    if (!user) return;

    // 1. Fetch Devices (untuk dipanggil di widget & virtual pin)
    const devRef = ref(rtdb, `users/${user.uid}/devices`);
    const unsubDev = onValue(devRef, (snapshot) => {
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

    // 2. Fetch Dashboards
    const dashRef = ref(rtdb, `users/${user.uid}/dashboards`);
    const unsubDash = onValue(dashRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        // Buat default dashboard jika belum ada
        const newRef = push(dashRef);
        const defaultDash: Omit<DashboardItem, "id"> = {
          name: "Main Dashboard",
          createdAt: Date.now(),
          widgets: [
            { id: "w_d1", type: "switch", title: "Main Power", vpin: "V2", colSpan: 1, value: 1 },
            { id: "w_d2", type: "slider", title: "Fan Speed", vpin: "V4", colSpan: 1, value: 40, min: 0, max: 100 },
            { id: "w_d3", type: "label", title: "Temperature", vpin: "V3", colSpan: 1, value: 27.4, unit: "°C" },
            { id: "w_d4", type: "chart", title: "Realtime Telemetry", vpin: "V3", colSpan: 2 },
            { id: "w_d5", type: "table", title: "Latest Readings", vpin: "V1", colSpan: 2 },
          ],
        };
        set(newRef, defaultDash);
        return;
      }

      const list: DashboardItem[] = Object.entries(data).map(([id, val]) => {
        const item = val as Omit<DashboardItem, "id">;
        let wList: DashboardWidget[] = [];
        if (item.widgets) {
          if (Array.isArray(item.widgets)) {
            wList = item.widgets;
          } else {
            wList = Object.entries(item.widgets).map(([wid, w]) => ({
              ...(w as DashboardWidget),
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

    return () => {
      unsubDev();
      unsubDash();
    };
  }, [user, activeDashId]);

  const activeDashboard = dashboards.find((d) => d.id === activeDashId) || dashboards[0];

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

  // Drag and Drop Widget Handlers
  const handleDragStart = (e: DragEvent, type: WidgetType) => {
    e.dataTransfer.setData("widgetType", type);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("widgetType") as WidgetType;
    if (!type || !activeDashboard) return;
    addWidgetToActiveDashboard(type);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const addWidgetToActiveDashboard = async (type: WidgetType) => {
    if (!user || !activeDashboard) return;

    const newWidget: DashboardWidget = {
      id: `w_dash_${Date.now()}`,
      type,
      title: type === "switch" ? "Control Switch" : type === "slider" ? "Slider Control" : type === "label" ? "Sensor Metric" : "Data Display",
      vpin: "V1",
      colSpan: type === "chart" || type === "table" ? 2 : 1,
      value: type === "switch" ? 0 : type === "slider" ? 50 : 27,
      min: 0,
      max: 100,
      deviceId: devices[0]?.id || "",
    };

    const updatedWidgets = [...(activeDashboard.widgets || []), newWidget];
    await update(ref(rtdb, `users/${user.uid}/dashboards/${activeDashboard.id}`), {
      widgets: updatedWidgets,
    });
  };

  const removeWidgetFromDashboard = async (widgetId: string) => {
    if (!user || !activeDashboard) return;
    const updated = activeDashboard.widgets.filter((w) => w.id !== widgetId);
    await update(ref(rtdb, `users/${user.uid}/dashboards/${activeDashboard.id}`), {
      widgets: updated,
    });
  };

  // Interaksi kontrol: update Virtual Pin di device target
  const handleInteract = async (widget: DashboardWidget, nextVal: number | string) => {
    if (!user) return;
    const targetDevId = widget.deviceId || devices[0]?.id;
    if (!targetDevId) return;

    try {
      // 1. Update ke Datastream Device di RTDB
      await update(ref(rtdb, `users/${user.uid}/devices/${targetDevId}/datastreams/${widget.vpin}`), {
        value: nextVal,
      });

      // 2. Update nilai di widget dashboard
      if (activeDashboard) {
        const updated = activeDashboard.widgets.map((w) =>
          w.id === widget.id ? { ...w, value: nextVal } : w
        );
        await update(ref(rtdb, `users/${user.uid}/dashboards/${activeDashboard.id}`), {
          widgets: updated,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="page-loading">Loading dashboards…</div>;
  }

  return (
    <div className="blynk-multi-dashboard-page">
      {/* Header */}
      <div className="dashboard-top-header">
        <div>
          <h1 className="page-title-bold">Dashboard</h1>
          <p className="page-sub-text">Monitor and control IoT devices with customizable widgets!</p>
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

      {/* Multi-Dashboard Tab Bar */}
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

      {/* Main Content Area */}
      <div className="dashboard-main-container">
        {/* Sidebar Widget Box (Hanya saat mode Edit aktif) */}
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
                  onDragStart={(e) => handleDragStart(e, "switch")}
                  onClick={() => addWidgetToActiveDashboard("switch")}
                >
                  <span className="card-item-title">Switch</span>
                  <div className="mock-switch-pill"><span className="mock-switch-circle" /></div>
                </div>

                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, "slider")}
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
                  onDragStart={(e) => handleDragStart(e, "label")}
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
                  onDragStart={(e) => handleDragStart(e, "table")}
                  onClick={() => addWidgetToActiveDashboard("table")}
                >
                  <span className="card-item-title">Table</span>
                  <span className="mock-item-sub">Time • Sensor • Value</span>
                </div>

                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, "chart")}
                  onClick={() => addWidgetToActiveDashboard("chart")}
                >
                  <span className="card-item-title">Data chart</span>
                  <span className="mock-item-sub">Realtime line chart</span>
                </div>

                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, "image")}
                  onClick={() => addWidgetToActiveDashboard("image")}
                >
                  <span className="card-item-title">Image</span>
                  <span className="mock-item-sub">Photo or diagram</span>
                </div>
              </div>

              {/* Media */}
              <div className="widget-category-group">
                <span className="category-group-label">Media</span>
                <div
                  className="widget-draggable-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, "video")}
                  onClick={() => addWidgetToActiveDashboard("video")}
                >
                  <span className="card-item-title">Live video</span>
                  <span className="mock-item-sub">Device camera</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Canvas Dashboard Area */}
        <div
          className={`widget-canvas-dropzone ${isEditing ? "editing-mode" : "view-mode"}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {(!activeDashboard?.widgets || activeDashboard.widgets.length === 0) ? (
            <div className="canvas-empty-state">
              <div className="canvas-empty-content">
                <h3 className="empty-title">Dashboard ini masih kosong</h3>
                <p className="empty-sub">
                  Klik <strong>✎ Edit Dashboard</strong> lalu seret widget dari Widget Box ke area ini.
                </p>
              </div>
            </div>
          ) : (
            <div className="canvas-widgets-grid">
              {activeDashboard.widgets.map((w) => {
                const targetDev = devices.find((d) => d.id === w.deviceId) || devices[0];
                const ds = targetDev?.datastreams?.[w.vpin];
                const currentVal = ds?.value !== undefined ? ds.value : w.value;

                return (
                  <div
                    key={w.id}
                    className={`canvas-widget-card col-span-${w.colSpan || 1}`}
                  >
                    {/* Header */}
                    <div className="card-header-bar">
                      <div>
                        <span className="card-widget-title">{w.title}</span>
                        {targetDev && (
                          <span className="card-dev-tag">
                            [{targetDev.name} • {w.vpin}]
                          </span>
                        )}
                      </div>
                      {isEditing && (
                        <div className="card-actions-right">
                          <button
                            className="btn-card-gear"
                            title="Edit Device & Virtual Pin"
                            onClick={() => setActiveWidgetModal(w)}
                          >
                            ⚙️
                          </button>
                          <button
                            className="btn-card-trash"
                            title="Remove Widget"
                            onClick={() => removeWidgetFromDashboard(w.id)}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Body Widget */}
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
                            min={w.min ?? 0}
                            max={w.max ?? 100}
                            value={Number(currentVal) || 0}
                            className="blynk-slider-element"
                            onChange={(e) => handleInteract(w, Number(e.target.value))}
                          />
                          <span className="slider-value-display">{currentVal}</span>
                        </div>
                      )}

                      {/* LABEL */}
                      {w.type === "label" && (
                        <div className="render-label-row">
                          <span className="label-large-text">
                            {currentVal}{w.unit || "°C"}
                          </span>
                        </div>
                      )}

                      {/* CHART */}
                      {w.type === "chart" && (
                        <div className="render-chart-block">
                          <svg className="blynk-chart-svg" viewBox="0 0 500 120" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id={`dashGrad_${w.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#0070f3" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#0070f3" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            <path
                              d="M0,80 Q50,70 100,60 T200,50 T300,40 T400,30 T500,45 L500,120 L0,120 Z"
                              fill={`url(#dashGrad_${w.id})`}
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
                                <td>{targetDev?.datastreams?.V3?.value ?? 27.4}</td>
                              </tr>
                              <tr>
                                <td>12:41:06</td>
                                <td>Humidity</td>
                                <td>{targetDev?.datastreams?.V1?.value ?? 63.1}</td>
                              </tr>
                              <tr>
                                <td>12:41:04</td>
                                <td>Light</td>
                                <td>{targetDev?.datastreams?.V5?.value ?? 412.0}</td>
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
                  placeholder="e.g. Greenhouse Room 1"
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

      {/* ── MODAL: CONFIGURE DASHBOARD WIDGET PIN & DEVICE ── */}
      {activeWidgetModal && (
        <ConfigureDashboardWidgetModal
          widget={activeWidgetModal}
          devices={devices}
          onClose={() => setActiveWidgetModal(null)}
          onSave={async (updated) => {
            if (!user || !activeDashboard) return;
            const updatedWidgets = activeDashboard.widgets.map((w) =>
              w.id === updated.id ? updated : w
            );
            await update(ref(rtdb, `users/${user.uid}/dashboards/${activeDashboard.id}`), {
              widgets: updatedWidgets,
            });
            setActiveWidgetModal(null);
          }}
        />
      )}
    </div>
  );
}

// ── MODAL KONFIGURASI DEVICE & VIRTUAL PIN DASHBOARD ──
function ConfigureDashboardWidgetModal({
  widget,
  devices,
  onClose,
  onSave,
}: {
  widget: DashboardWidget;
  devices: DeviceItem[];
  onClose: () => void;
  onSave: (updated: DashboardWidget) => void;
}) {
  const [selectedDevId, setSelectedDevId] = useState(widget.deviceId || devices[0]?.id || "");
  const [selectedVpin, setSelectedVpin] = useState(widget.vpin || "V1");
  const [widgetTitle, setWidgetTitle] = useState(widget.title);
  const [colSpan, setColSpan] = useState(widget.colSpan || 1);

  const targetDev = devices.find((d) => d.id === selectedDevId) || devices[0];
  const ds = targetDev?.datastreams || {};

  return (
    <div className="modal-backdrop-blur" onClick={onClose}>
      <div className="datastream-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="ds-modal-top">
          <h2 className="ds-modal-title">Configure Widget</h2>
        </div>

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
            <label className="ds-input-label">Select Target Device</label>
            <select
              className="ds-text-input"
              value={selectedDevId}
              onChange={(e) => {
                setSelectedDevId(e.target.value);
              }}
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.type}) — {d.status}
                </option>
              ))}
            </select>
          </div>

          <div className="ds-field-section" style={{ marginTop: 14 }}>
            <label className="ds-input-label">Target Virtual Pin</label>
            <select
              className="ds-text-input"
              value={selectedVpin}
              onChange={(e) => setSelectedVpin(e.target.value)}
            >
              {Object.keys(ds).length > 0 ? (
                Object.entries(ds).map(([pin, item]) => (
                  <option key={pin} value={pin}>
                    {pin} — {item.name} ({item.type} [{item.min}-{item.max}])
                  </option>
                ))
              ) : (
                <>
                  <option value="V0">V0 — Sensor 1</option>
                  <option value="V1">V1 — Sensor 2</option>
                  <option value="V2">V2 — Actuator / Relay</option>
                  <option value="V3">V3 — Temperature</option>
                  <option value="V4">V4 — Fan PWM</option>
                </>
              )}
            </select>
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

        <div className="ds-modal-footer">
          <button className="ds-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="ds-btn-save-lime"
            onClick={() => {
              onSave({
                ...widget,
                title: widgetTitle,
                deviceId: selectedDevId,
                vpin: selectedVpin,
                colSpan,
              });
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
