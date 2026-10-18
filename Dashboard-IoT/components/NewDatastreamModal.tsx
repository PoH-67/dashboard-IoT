"use client";

import { useState } from "react";
import { Datastream, DATASTREAM_SUGGESTIONS, AVAILABLE_VIRTUAL_PINS } from "@/lib/iot-types";

interface Props {
  existingPins?: string[];
  initialPin?: string;
  onClose: () => void;
  onSave: (datastream: Datastream) => void;
}

export default function NewDatastreamModal({ existingPins = [], initialPin = "V0", onClose, onSave }: Props) {
  const [activeTab, setActiveTab] = useState<"general" | "semantic" | "units">("general");

  // General fields
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState(initialPin);
  const [color, setColor] = useState("#24292e");
  const [icon, setIcon] = useState("tune");
  const [dataType, setDataType] = useState<"Integer" | "Double" | "Enum" | "String">("Integer");
  const [minValue, setMinValue] = useState<number>(0);
  const [maxValue, setMaxValue] = useState<number>(100000);
  const [decimals, setDecimals] = useState("#");
  const [defaultValue, setDefaultValue] = useState("0");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Semantic fields
  const [semanticTag, setSemanticTag] = useState("None");

  // Units fields
  const [unit, setUnit] = useState("");
  const [useScaling, setUseScaling] = useState(false);
  const [rawMin, setRawMin] = useState<number>(0);
  const [rawMax, setRawMax] = useState<number>(1023);
  const [scaledMin, setScaledMin] = useState<number>(0);
  const [scaledMax, setScaledMax] = useState<number>(100);

  const handleSelectSuggestion = (s: typeof DATASTREAM_SUGGESTIONS[0]) => {
    setName(s.name);
    setDisplayName(s.name);
    setDataType(s.type as "Integer" | "Double" | "Enum" | "String");
    setMinValue(s.min);
    setMaxValue(s.max);
    if (s.unit) setUnit(s.unit);
    setShowSuggestions(false);
  };

  const handleCopyName = () => {
    setDisplayName(name);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      alert("Masukkan nama datastream terlebih dahulu.");
      return;
    }
    const newDs: Datastream = {
      pin,
      name: name.trim(),
      displayName: displayName.trim() || name.trim(),
      type: dataType,
      min: Number(minValue),
      max: Number(maxValue),
      decimals,
      defaultValue,
      color,
      icon,
      semantic: semanticTag,
      unit,
      useScaling,
      rawMin: useScaling ? Number(rawMin) : undefined,
      rawMax: useScaling ? Number(rawMax) : undefined,
      scaledMin: useScaling ? Number(scaledMin) : undefined,
      scaledMax: useScaling ? Number(scaledMax) : undefined,
      value: defaultValue !== "" ? (dataType === "String" ? defaultValue : Number(defaultValue)) : 0,
    };
    onSave(newDs);
  };

  const sideMenu = [
    { id: "general", label: "General" },
    { id: "semantic", label: "Semantic" },
    { id: "units", label: "Units" },
    { id: "history", label: "History", disabled: true },
    { id: "expiration", label: "Expiration", disabled: true },
    { id: "sync", label: "Sync", disabled: true },
    { id: "automations", label: "Automations", disabled: true },
    { id: "visibility", label: "Visibility", disabled: true },
    { id: "notes", label: "Notes", disabled: true },
    { id: "api", label: "API reference", disabled: true },
  ];

  return (
    <div className="blynk-modal-backdrop" onClick={onClose}>
      <div className="blynk-ds-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Title */}
        <div className="blynk-ds-modal-header">
          <h2 className="blynk-ds-modal-title">New Datastream</h2>
          <button className="blynk-ds-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Layout with Sidebar & Content */}
        <div className="blynk-ds-modal-layout">
          {/* Sidebar Nav */}
          <aside className="blynk-ds-sidebar">
            <nav className="blynk-ds-nav">
              {sideMenu.map((item) => (
                <button
                  key={item.id}
                  disabled={item.disabled}
                  className={`blynk-ds-nav-btn ${activeTab === item.id ? "active" : ""} ${item.disabled ? "disabled" : ""}`}
                  onClick={() => !item.disabled && setActiveTab(item.id as "general" | "semantic" | "units")}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Tab Content Panel */}
          <main className="blynk-ds-content">
            {activeTab === "general" && (
              <div className="blynk-ds-pane">
                <h3 className="blynk-pane-title">General</h3>

                {/* Name & Display Name */}
                <div className="blynk-form-row blynk-name-row">
                  <div className="blynk-input-field flex-1 relative-pos">
                    <label>DATASTREAM NAME</label>
                    <div className="blynk-char-input-wrap">
                      <input
                        type="text"
                        value={name}
                        maxLength={128}
                        placeholder="e.g. Battery Capacity"
                        onFocus={() => setShowSuggestions(true)}
                        onChange={(e) => setName(e.target.value)}
                      />
                      <span className="blynk-char-count">{name.length} / 128</span>
                    </div>
                    <span className="blynk-field-hint">For your reference and for MQTT topic naming</span>

                    {/* Suggestions list */}
                    {showSuggestions && (
                      <div className="blynk-autocomplete-dropdown">
                        {DATASTREAM_SUGGESTIONS.filter((s) =>
                          s.name.toLowerCase().includes(name.toLowerCase())
                        ).map((s) => (
                          <div
                            key={s.name}
                            className="blynk-autocomplete-item"
                            onMouseDown={() => handleSelectSuggestion(s)}
                          >
                            <span>{s.name}</span>
                            {s.unit && <span className="blynk-suggest-unit">{s.unit}</span>}
                          </div>
                        ))}
                        <div
                          className="blynk-autocomplete-item close-btn"
                          onMouseDown={() => setShowSuggestions(false)}
                        >
                          ✕ Close suggestions
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="blynk-btn-arrow"
                    title="Copy Name to Display Name"
                    onClick={handleCopyName}
                  >
                    →
                  </button>

                  <div className="blynk-input-field flex-1">
                    <label>DISPLAY NAME</label>
                    <input
                      type="text"
                      value={displayName}
                      placeholder="e.g. Battery Capacity"
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                    <span className="blynk-field-hint">Shown in widgets, dashboards and reports.</span>
                  </div>
                </div>

                {/* Pin, Color, Icon */}
                <div className="blynk-form-row" style={{ marginTop: 14 }}>
                  <div className="blynk-input-field flex-2">
                    <label>VIRTUAL PIN</label>
                    <select
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                    >
                      {AVAILABLE_VIRTUAL_PINS.slice(0, 32).map((p) => (
                        <option key={p} value={p}>
                          {p} {existingPins.includes(p) ? "(In Use)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="blynk-input-field flex-1">
                    <label>COLOR</label>
                    <div className="blynk-color-picker-box">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="blynk-native-color-picker"
                      />
                      <span className="blynk-color-preview" style={{ background: color }} />
                    </div>
                  </div>

                  <div className="blynk-input-field flex-1">
                    <label>ICON</label>
                    <div className="blynk-icon-box">
                      <select value={icon} onChange={(e) => setIcon(e.target.value)}>
                        <option value="tune">📊 Chart</option>
                        <option value="power">⚡ Power</option>
                        <option value="thermometer">🌡️ Temp</option>
                        <option value="water">💧 Humidity</option>
                        <option value="light">💡 Light</option>
                        <option value="cog">⚙️ State</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Data Type Segmented */}
                <div className="blynk-input-field" style={{ marginTop: 16 }}>
                  <label>DATA TYPE</label>
                  <div className="blynk-segmented-btn-group">
                    {(["Integer", "Double", "Enum", "String"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`blynk-segmented-btn ${dataType === t ? "active" : ""}`}
                        onClick={() => setDataType(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Min, Max, Decimals, Default Value */}
                <div className="blynk-form-row" style={{ marginTop: 16 }}>
                  <div className="blynk-input-field flex-1">
                    <label>MIN VALUE</label>
                    <input
                      type="number"
                      value={minValue}
                      onChange={(e) => setMinValue(Number(e.target.value))}
                    />
                  </div>
                  <div className="blynk-input-field flex-1">
                    <label>MAX VALUE</label>
                    <input
                      type="number"
                      value={maxValue}
                      onChange={(e) => setMaxValue(Number(e.target.value))}
                    />
                  </div>
                  <div className="blynk-input-field flex-1">
                    <label>DECIMALS</label>
                    <select
                      value={decimals}
                      onChange={(e) => setDecimals(e.target.value)}
                    >
                      <option value="#"># (None)</option>
                      <option value="#.#">#.#</option>
                      <option value="#.##">#.##</option>
                      <option value="#.###">#.###</option>
                    </select>
                  </div>
                  <div className="blynk-input-field flex-1">
                    <label>DEFAULT VALUE</label>
                    <input
                      type="text"
                      value={defaultValue}
                      onChange={(e) => setDefaultValue(e.target.value)}
                    />
                  </div>
                </div>

                {/* Semantic Info Notice at bottom of General */}
                <div className="blynk-info-notice" style={{ marginTop: 24 }}>
                  <strong>Semantic</strong>
                  <p>
                    Semantic tags enable the platform to understand the meaning of the datastream. This will be used in data aggregations, dashboards, automations, and beyond.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "semantic" && (
              <div className="blynk-ds-pane">
                <h3 className="blynk-pane-title">Semantic</h3>
                <p className="blynk-pane-sub">Select the property that represents this datastream.</p>

                <div className="blynk-input-field">
                  <label>SEMANTIC CLASSIFICATION</label>
                  <select
                    value={semanticTag}
                    onChange={(e) => setSemanticTag(e.target.value)}
                  >
                    <option value="None">None</option>
                    <option value="Temperature">Temperature (°C, °F, K)</option>
                    <option value="Humidity">Humidity (%)</option>
                    <option value="Pressure">Pressure (hPa, bar)</option>
                    <option value="Voltage">Voltage (V, mV)</option>
                    <option value="Current">Current (A, mA)</option>
                    <option value="Power">Power (W, kW)</option>
                    <option value="Battery Level">Battery Level (%)</option>
                    <option value="Relay / State">State Control (0/1)</option>
                    <option value="Distance">Distance / Proximity (cm, m)</option>
                    <option value="Light">Illuminance (Lux)</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === "units" && (
              <div className="blynk-ds-pane">
                <h3 className="blynk-pane-title">Units &amp; Scaling</h3>
                <p className="blynk-pane-sub">Set standard unit and optional hardware scale conversions.</p>

                <div className="blynk-input-field">
                  <label>UNIT</label>
                  <input
                    type="text"
                    placeholder="e.g. °C, %, V, mA, RPM"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </div>

                <div className="blynk-scaling-box" style={{ marginTop: 16 }}>
                  <label className="checkbox-wrap">
                    <input
                      type="checkbox"
                      checked={useScaling}
                      onChange={(e) => setUseScaling(e.target.checked)}
                    />
                    <strong>Enable Raw-to-Scaled Value Conversion</strong>
                  </label>
                  <p className="blynk-field-hint" style={{ marginTop: 4 }}>
                    Maps incoming raw ADC reading (e.g. 0-1023) directly to human-readable units (e.g. 0-100%).
                  </p>

                  {useScaling && (
                    <div className="blynk-form-row" style={{ marginTop: 14 }}>
                      <div className="blynk-input-field flex-1">
                        <label>RAW MIN</label>
                        <input
                          type="number"
                          value={rawMin}
                          onChange={(e) => setRawMin(Number(e.target.value))}
                        />
                      </div>
                      <div className="blynk-input-field flex-1">
                        <label>RAW MAX</label>
                        <input
                          type="number"
                          value={rawMax}
                          onChange={(e) => setRawMax(Number(e.target.value))}
                        />
                      </div>
                      <div className="blynk-input-field flex-1">
                        <label>SCALED MIN</label>
                        <input
                          type="number"
                          value={scaledMin}
                          onChange={(e) => setScaledMin(Number(e.target.value))}
                        />
                      </div>
                      <div className="blynk-input-field flex-1">
                        <label>SCALED MAX</label>
                        <input
                          type="number"
                          value={scaledMax}
                          onChange={(e) => setScaledMax(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Footer */}
        <div className="blynk-ds-modal-footer">
          <button className="ds-btn-cancel" onClick={onClose}>
            Back
          </button>
          <button className="ds-btn-save-lime" onClick={handleSubmit}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
