#include <Arduino.h>
#include <HardwareSerial.h>
#include <SensirionUartSps30.h>
#include <WiFi.h>
#include <HTTPClient.h>

// =====================================================
// ESP32-WROOM-32D + SPS30 UART + WiFi
//
// Wiring:
// SPS30 TX  -> ESP32 GPIO16  // ESP32 receives data
// SPS30 RX  -> ESP32 GPIO17  // ESP32 sends command
// SPS30 VDD -> ESP32 5V
// SPS30 GND -> ESP32 GND
// SPS30 SEL -> Floating / not connected
// =====================================================

// =====================================================
// WiFi Configuration
// =====================================================
#define WIFI_SSID        "CW_LOVE_ZM"
#define WIFI_PASSWORD    "123456789"
#define WIFI_TIMEOUT_MS  10000          // 10 seconds
#define POST_ENDPOINT    "http://192.168.88.8:3000/api/air"  // optional

// =====================================================
// SPS30 Configuration
// =====================================================
#define SPS30_RX_PIN 16
#define SPS30_TX_PIN 17
#define SPS30_BAUD   115200

HardwareSerial SPS30Serial(1);
SensirionUartSps30 sps30;

#ifdef NO_ERROR
#undef NO_ERROR
#endif
#define NO_ERROR 0

static char errorMessage[64];

// =====================================================
// Helpers
// =====================================================
void printError(const char *functionName, int16_t errorCode) {
  errorToString(errorCode, errorMessage, sizeof(errorMessage));
  Serial.print("Error in ");
  Serial.print(functionName);
  Serial.print("(): ");
  Serial.println(errorMessage);
}

bool connectWiFi() {
  Serial.println();
  Serial.println("====================================");
  Serial.println("Connecting to WiFi");
  Serial.print("SSID: ");
  Serial.println(WIFI_SSID);
  Serial.println("====================================");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startMs = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - startMs > WIFI_TIMEOUT_MS) {
      Serial.println();
      Serial.println("WiFi connection TIMED OUT.");
      Serial.print("Last WiFi status: ");
      switch (WiFi.status()) {
        case WL_NO_SSID_AVAIL:  Serial.println("SSID not found. Check SSID name."); break;
        case WL_CONNECT_FAILED: Serial.println("Wrong password or auth rejected."); break;
        case WL_DISCONNECTED:   Serial.println("Disconnected / still trying."); break;
        case WL_IDLE_STATUS:    Serial.println("Idle. Module may not be ready."); break;
        default:                Serial.println(WiFi.status()); break;
      }
      return false;
    }
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi CONNECTED.");
  Serial.print("IP Address   : "); Serial.println(WiFi.localIP());
  Serial.print("Gateway      : "); Serial.println(WiFi.gatewayIP());
  Serial.print("DNS          : "); Serial.println(WiFi.dnsIP());
  Serial.print("Subnet Mask  : "); Serial.println(WiFi.subnetMask());
  Serial.print("Signal (RSSI): "); Serial.print(WiFi.RSSI()); Serial.println(" dBm");
  Serial.print("MAC Address  : "); Serial.println(WiFi.macAddress());

  // =====================================================
  // Ping test to server
  // =====================================================
  Serial.println();
  Serial.println("---- Connectivity Test ----");
  Serial.print("Target endpoint : "); Serial.println(POST_ENDPOINT);

  HTTPClient http;
  http.begin(POST_ENDPOINT);
  http.setTimeout(5000);
  int httpCode = http.GET();  // will likely 404, that's fine — we just want TCP to succeed

  if (httpCode > 0) {
    Serial.print("Server reachable. HTTP response: "); Serial.println(httpCode);
  } else {
    Serial.print("Server NOT reachable. Error: ");
    Serial.println(http.errorToString(httpCode));
    Serial.println("Check: server running? firewall? correct IP/port?");
  }
  http.end();
  Serial.println("---------------------------");

  return true;
}

void postReadings(float pm1p0, float pm2p5, float pm4p0, float pm10p0, float size) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, skipping POST.");
    return;
  }

  HTTPClient http;
  http.begin(POST_ENDPOINT);
  http.addHeader("Content-Type", "application/json");

  String payload = "{";
  payload += "\"pm1p0\":"  + String(pm1p0,  2) + ",";
  payload += "\"pm2p5\":"  + String(pm2p5,  2) + ",";
  payload += "\"pm4p0\":"  + String(pm4p0,  2) + ",";
  payload += "\"pm10p0\":" + String(pm10p0, 2) + ",";
  payload += "\"size\":"   + String(size,   2);
  payload += "}";

  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    Serial.print("POST response: ");
    Serial.println(httpCode);
  } else {
    Serial.print("POST failed: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

// =====================================================
// Setup
// =====================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  // --- WiFi ---
  connectWiFi();  // non-fatal: SPS30 still runs if WiFi fails

  // --- SPS30 ---
  Serial.println();
  Serial.println("====================================");
  Serial.println("ESP32 + SPS30 UART Test");
  Serial.println("SPS30 TX -> ESP32 GPIO16 RX");
  Serial.println("SPS30 RX -> ESP32 GPIO17 TX");
  Serial.println("====================================");

  SPS30Serial.begin(SPS30_BAUD, SERIAL_8N1, SPS30_RX_PIN, SPS30_TX_PIN);
  delay(1000);

  sps30.begin(SPS30Serial);
  sps30.stopMeasurement();
  delay(500);

  // Test 1: Serial number
  int8_t serialNumber[32] = {0};
  int16_t error = sps30.readSerialNumber(serialNumber, sizeof(serialNumber));
  if (error != NO_ERROR) {
    printError("readSerialNumber", error);
    Serial.println("SPS30 UART FAILED. Check TX/RX wiring, 5V power, GND, and SEL pin.");
    return;
  }
  Serial.print("SPS30 Serial Number: ");
  Serial.println((const char *)serialNumber);

  // Test 2: Product type
  int8_t productType[9] = {0};
  error = sps30.readProductType(productType, sizeof(productType));
  if (error != NO_ERROR) {
    printError("readProductType", error);
    Serial.println("SPS30 UART FAILED.");
    return;
  }
  Serial.print("SPS30 Product Type: ");
  Serial.println((const char *)productType);

  // Test 3: Start measurement
  error = sps30.startMeasurement(SPS30_OUTPUT_FORMAT_OUTPUT_FORMAT_FLOAT);
  if (error != NO_ERROR) {
    printError("startMeasurement", error);
    Serial.println("SPS30 measurement start FAILED.");
    return;
  }

  Serial.println();
  Serial.println("SPS30 UART PASSED. Measurement started.");
  Serial.println();
}

// =====================================================
// Loop
// =====================================================
void loop() {
  float mc1p0 = 0, mc2p5 = 0, mc4p0 = 0, mc10p0 = 0;
  float nc0p5 = 0, nc1p0 = 0, nc2p5 = 0, nc4p0 = 0, nc10p0 = 0;
  float typicalParticleSize = 0;

  delay(1000);

  int16_t error = sps30.readMeasurementValuesFloat(
    mc1p0, mc2p5, mc4p0, mc10p0,
    nc0p5, nc1p0, nc2p5, nc4p0, nc10p0,
    typicalParticleSize
  );

  if (error != NO_ERROR) {
    printError("readMeasurementValuesFloat", error);
    return;
  }

  // Print to Serial Monitor
  Serial.print("PM1.0: ");  Serial.print(mc1p0);  Serial.print(" ug/m3\t");
  Serial.print("PM2.5: ");  Serial.print(mc2p5);  Serial.print(" ug/m3\t");
  Serial.print("PM4.0: ");  Serial.print(mc4p0);  Serial.print(" ug/m3\t");
  Serial.print("PM10: ");   Serial.print(mc10p0); Serial.print(" ug/m3\t");
  Serial.print("Size: ");   Serial.print(typicalParticleSize); Serial.println(" um");

  // Post to server (remove or comment out if not needed)
  postReadings(mc1p0, mc2p5, mc4p0, mc10p0, typicalParticleSize);
}