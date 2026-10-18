"use client";

const STEPS = [
  {
    num: "01",
    title: "Create an Account",
    desc: "Sign up at this platform using your campus email (@upnvj.ac.id) and complete your club registration form.",
    code: null,
  },
  {
    num: "02",
    title: "Install Arduino / PlatformIO",
    desc: "Download and install the Arduino IDE or PlatformIO extension in VS Code to write firmware for your IoT nodes.",
    code: null,
  },
  {
    num: "03",
    title: "Install the KSM IoT Library",
    desc: "Add the library via the Arduino Library Manager or include it manually in your platformio.ini dependencies.",
    code: `[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
lib_deps =
  ksmiot/KSMIoT @ ^1.0.0
  knolleary/PubSubClient @ ^2.8`,
  },
  {
    num: "04",
    title: "Connect Your Device",
    desc: "Go to the Device page, create a new device, and copy your Auth Token. Paste it into your firmware sketch.",
    code: `#include <KSMIoT.h>

// Replace with your Auth Token from Device page
char auth[] = "YOUR_AUTH_TOKEN";
char ssid[] = "Your_WiFi_SSID";
char pass[] = "Your_WiFi_Pass";

KSMIoT node(auth, ssid, pass);

void setup() {
  Serial.begin(115200);
  node.begin();
  // Define virtual pins
  node.onWrite(V1, [](float value) {
    // handle incoming value
    digitalWrite(LED_BUILTIN, value > 0);
  });
}

void loop() {
  node.run();
  // Push sensor data every 2 sec
  node.virtualWrite(V0, analogRead(A0));
  delay(2000);
}`,
  },
  {
    num: "05",
    title: "Add Widgets to Dashboard",
    desc: "Go to your Dashboard, click 'Add Widget', select a widget type (Gauge, Chart, Button, Slider), and map it to a Virtual Pin.",
    code: null,
  },
  {
    num: "06",
    title: "Monitor & Control",
    desc: "Upload your sketch and open the Dashboard. You will see live data streaming and can control your device in real time.",
    code: null,
  },
];

const VPIN_TABLE = [
  { pin: "V0",  type: "Sensor/Read",  desc: "Push analog or sensor data to dashboard" },
  { pin: "V1",  type: "Control/Write", desc: "Receive commands from dashboard widgets" },
  { pin: "V2",  type: "Sensor/Read",  desc: "Temperature, humidity, distance, etc." },
  { pin: "V3",  type: "Control/Write", desc: "PWM output, servo angle, relay state" },
  { pin: "V4–V255", type: "Any", desc: "Expandable – map freely to your sensors/actuators" },
];

const BOARDS = [
  { name: "ESP32", status: "Supported", color: "#2c8651" },
  { name: "ESP8266", status: "Supported", color: "#2c8651" },
  { name: "Arduino Nano 33 IoT", status: "Supported", color: "#2c8651" },
  { name: "Raspberry Pi Pico W", status: "Beta", color: "#b07d2a" },
  { name: "STM32 + W5500", status: "Planned", color: "#6b7c8c" },
];

export default function GuideContent() {
  return (
    <div className="page-guide">
      {/* Header */}
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Documentation</span>
          <h2 className="page-title">Getting Started</h2>
          <p className="page-subtitle">
            Follow these steps to connect your first IoT device to the KSM IoT Platform.
          </p>
        </div>
        <span className="badge-chip">KSM IoT SDK v1.0</span>
      </div>

      {/* Steps */}
      <div className="guide-steps-list">
        {STEPS.map((s) => (
          <div key={s.num} className="guide-step-card">
            <div className="guide-step-num">{s.num}</div>
            <div className="guide-step-body">
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              {s.code && (
                <pre className="guide-code"><code>{s.code}</code></pre>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Virtual Pin Reference */}
      <div className="guide-section">
        <h3 className="guide-section-title">Virtual Pin Reference</h3>
        <div className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>
                <th>Pin</th><th>Type</th><th>Description</th>
              </tr>
            </thead>
            <tbody>
              {VPIN_TABLE.map((r) => (
                <tr key={r.pin}>
                  <td><code className="pin-badge">{r.pin}</code></td>
                  <td><span className="type-tag">{r.type}</span></td>
                  <td>{r.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supported Hardware */}
      <div className="guide-section">
        <h3 className="guide-section-title">Supported Hardware</h3>
        <div className="boards-grid">
          {BOARDS.map((b) => (
            <div key={b.name} className="board-card">
              <span className="board-name">{b.name}</span>
              <span className="board-status" style={{ color: b.color, background: b.color + "18" }}>
                {b.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="guide-section">
        <h3 className="guide-section-title">Quick Links</h3>
        <div className="quick-links">
          <a className="quick-link" href="https://docs.espressif.com/projects/esp-idf/en/latest/" target="_blank" rel="noreferrer">
            📡 ESP-IDF Documentation
          </a>
          <a className="quick-link" href="https://www.arduino.cc/reference/en/" target="_blank" rel="noreferrer">
            🔧 Arduino Reference
          </a>
          <a className="quick-link" href="https://firebase.google.com/docs/firestore" target="_blank" rel="noreferrer">
            🔥 Firebase Firestore Docs
          </a>
          <a className="quick-link" href="https://mosquitto.org/" target="_blank" rel="noreferrer">
            📨 MQTT Mosquitto Broker
          </a>
        </div>
      </div>
    </div>
  );
}
