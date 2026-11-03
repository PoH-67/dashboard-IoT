"use client";

import { useState } from "react";

const STEPS = [
  {
    num: "01",
    title: "Buat Device di Web",
    desc: "Buka menu Device di platform ini, klik '+ New Device', pilih jenis board (Arduino atau ESP32), beri nama perangkat Anda, lalu klik 'Confirm'.",
    code: null,
  },
  {
    num: "02",
    title: "Salin Auth Token",
    desc: "Buka detail perangkat yang telah Anda buat. Klik icon mata 👁️ atau tombol 'Copy' pada baris AuthToken untuk menyalin token autentikasi rahasia perangkat Anda.",
    code: `// Salin Auth Token dari halaman Detail Device di web:
const String AUTH_TOKEN = "GoE5-mYy-AbCdEfGh12345678";`,
  },
  {
    num: "03",
    title: "Tentukan Virtual Pin (Datastream)",
    desc: "Buka 'Widget Settings' pada device atau dashboard untuk menambahkan Virtual Pin (misal: V1 = Kelembapan, V2 = Jumlah Orang, V3 = Suhu, V4 = Kecepatan Kipas, V5 = Relay).",
    code: `// Contoh pemetaan Virtual Pin:
// V1 -> Kelembapan (%)
// V2 -> Penghitung Orang (PIR)
// V3 -> Suhu Udara (°C)
// V4 -> Kecepatan Kipas PWM (0-255)
// V5 -> Status Jendela / Relay (0 / 1)`,
  },
  {
    num: "04",
    title: "Install Library Standar di Arduino IDE",
    desc: "Install pustaka 'ArduinoJson' melalui menu Arduino IDE: Tools > Manage Libraries (Ctrl+Shift+I). Pustaka WiFi.h dan HTTPClient.h sudah merupakan pustaka bawaan dari board ESP32.",
    code: `Library yang diperlukan:
- WiFi.h (Bawaan ESP32)
- HTTPClient.h (Bawaan ESP32)
- ArduinoJson.h (Install via Arduino Library Manager)`,
  },
  {
    num: "05",
    title: "Upload Kode Firmware ke ESP32",
    desc: "Salin kode integrasi di bawah, masukkan SSID WiFi, password, alamat server web, dan Auth Token Anda, lalu upload ke mikrokontroler.",
    code: null,
  },
  {
    num: "06",
    title: "Pantau Realtime di Dashboard",
    desc: "Setelah ESP32 terhubung dan mengirim data, status perangkat di web otomatis menyala hijau 'Online' dan seluruh widget virtual pin akan terupdate secara realtime.",
    code: null,
  },
];

const VPIN_TABLE = [
  { pin: "V0–V255", type: "Sensor / Telemetry", desc: "Mengirim pembacaan sensor (Suhu, Kelembapan, pH, Jarak, Tegangan, dll) ke dashboard" },
  { pin: "V0–V255", type: "Actuator / Control", desc: "Menerima perintah dari tombol Switch, Slider kecepatan kipas, atau Relay di dashboard" },
];

const BOARDS = [
  { name: "ESP32 (WROOM / NodeMCU-32S / ESP32-CAM)", status: "Didukung Penuh", color: "#2c8651" },
  { name: "ESP8266 (NodeMCU / WeMos D1)", status: "Didukung Penuh", color: "#2c8651" },
  { name: "Arduino Uno/Mega + ESP-01 / Ethernet", status: "Didukung", color: "#2c8651" },
  { name: "Raspberry Pi Pico W", status: "Didukung", color: "#2c8651" },
];

export default function GuideContent() {
  const [copiedCode, setCopiedCode] = useState(false);

  const integrationCode = `/**************************************************************
 * KSM IoT Platform - Firmware Integrasi ESP32 & Arduino
 * -----------------------------------------------------------
 * Kode ini mengirim data sensor ke Firebase melalui protokol
 * HTTP REST API platform dengan validasi Auth Token.
 **************************************************************/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- 1. KONFIGURASI JARINGAN WIFI ---
const char ssid[] = "NAMA_WIFI_ANDA";
const char pass[] = "PASSWORD_WIFI_ANDA";

// --- 2. KONFIGURASI SERVER & AUTH TOKEN ---
// Jika testing di laptop (localhost), ganti IP di bawah dengan IP lokal komputer Anda
// (Cek IP lokal via perintah 'ipconfig' di Command Prompt / Terminal):
const String SERVER_URL = "http://192.168.1.10:3000/api/device/update";

// Salin Auth Token dari halaman Detail Device Anda di web:
const String AUTH_TOKEN = "MASUKKAN_AUTH_TOKEN_DARI_WEB";

// Interval pengiriman data (ms)
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 5000; // Kirim tiap 5 detik

void sendTelemetry(float suhu, float kelembapan, int orang, int kipas) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi terputus! Mencoba menyambung kembali...");
    return;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  // Format payload JSON berisi Auth Token dan Virtual Pin
  StaticJsonDocument<256> doc;
  doc["token"] = AUTH_TOKEN;

  JsonObject pins = doc.createNestedObject("pins");
  pins["V1"] = kelembapan; // Virtual Pin V1: Kelembapan
  pins["V2"] = orang;      // Virtual Pin V2: Jumlah Orang
  pins["V3"] = suhu;       // Virtual Pin V3: Suhu Udara
  pins["V4"] = kipas;      // Virtual Pin V4: Kecepatan Kipas PWM

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);

  if (httpCode == 200) {
    Serial.println("✓ [200 OK] Data berhasil terkirim dan tersimpan di Firebase!");
  } else if (httpCode == 401) {
    Serial.println("✕ [401 Unauthorized] Auth Token SALAH / Tidak terdaftar di Web!");
  } else {
    Serial.printf("✕ HTTP Error Code: %d\\n", httpCode);
  }

  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\\n=== Inisialisasi Perangkat KSM IoT ===");

  // Hubungkan ke WiFi
  WiFi.begin(ssid, pass);
  Serial.print("Menghubungkan ke WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi Terhubung! IP: " + WiFi.localIP().toString());
  Serial.println("Sistem siap mengirim telemetri.");
}

void loop() {
  unsigned long now = millis();
  if (now - lastSendTime >= sendInterval) {
    lastSendTime = now;

    // Baca sensor Anda di sini (contoh variabel):
    float suhuSaatIni = 27.5;      // Ganti dengan dht.readTemperature()
    float kelembapanSaatIni = 63.0; // Ganti dengan dht.readHumidity()
    int jumlahOrang = 2;           // Ganti dengan variabel PIR/sensor orang
    int speedKipas = 180;          // Nilai PWM kipas (0-255)

    Serial.println("Mengirim data telemetri ke platform...");
    sendTelemetry(suhuSaatIni, kelembapanSaatIni, jumlahOrang, speedKipas);
  }

  delay(20);
}`;

  return (
    <div className="page-guide">
      {/* Header */}
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Dokumentasi &amp; Panduan</span>
          <h2 className="page-title">Panduan Integrasi Perangkat IoT</h2>
          <p className="page-subtitle">
            Cara menghubungkan mikrokontroler (ESP32 / Arduino) ke platform KSM IoT menggunakan pustaka standar dan validasi Auth Token.
          </p>
        </div>
        <span className="badge-chip">HTTP REST &bull; Auth Token Validated</span>
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

      {/* Integration Code Section */}
      <div className="guide-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h3 className="guide-section-title" style={{ margin: 0 }}>Kode Template Integrasi Firmware (ESP32)</h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
              Gunakan kode ini sebagai template utama proyek IoT Anda. Salin ke Arduino IDE dan sesuaikan pin serta sensor Anda.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(integrationCode);
              setCopiedCode(true);
              setTimeout(() => setCopiedCode(false), 2000);
            }}
            style={{
              padding: "8px 18px",
              background: copiedCode ? "#10b981" : "#0070f3",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background .15s",
            }}
          >
            {copiedCode ? "✓ Berhasil Disalin!" : "Salin Kode Integrasi"}
          </button>
        </div>

        <pre className="guide-code" style={{ maxHeight: 460, overflowY: "auto" }}>
          <code>{integrationCode}</code>
        </pre>
      </div>

      {/* Virtual Pin Reference */}
      <div className="guide-section">
        <h3 className="guide-section-title">Konsep Virtual Pin (Blynk-Style)</h3>
        <p style={{ fontSize: 13, color: "#4b5563", marginBottom: 12 }}>
          Virtual Pin adalah jalur data virtual (V0 sampai V255) yang menghubungkan variabel di kode mikrokontroler Anda dengan widget di dashboard web.
        </p>
        <div className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>
                <th>Pin</th><th>Tipe Operasi</th><th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {VPIN_TABLE.map((r, i) => (
                <tr key={i}>
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
        <h3 className="guide-section-title">Daftar Hardware yang Didukung</h3>
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
    </div>
  );
}
