#include <Arduino.h>
#include <HardwareSerial.h>
#include <SensirionUartSps30.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <MQTTClient.h> // arduino-mqtt by Joel Gaehwiler (256dpi) — canonical for AWS IoT
#include <time.h>

// =====================================================
// ESP32-WROOM-32D + SPS30 UART -> AWS IoT Core (MQTT/TLS)
//
// This is the AWS IoT Core variant of esp32-sketch.ino. Instead of writing
// directly to InfluxDB over HTTP, it publishes readings to AWS IoT Core over
// MQTT with mutual-TLS (X.509 client certificate) authentication. An AWS IoT
// Rule on the topic then fans the data out to its destination (e.g. Timestream,
// a Lambda that writes to InfluxDB, Kinesis, etc.) — the device stays dumb.
//
// Wiring (unchanged):
// SPS30 TX  -> ESP32 GPIO16  // ESP32 receives data
// SPS30 RX  -> ESP32 GPIO17  // ESP32 sends command
// SPS30 VDD -> ESP32 5V
// SPS30 GND -> ESP32 GND
// SPS30 SEL -> Floating / not connected
// =====================================================

// =====================================================
// WiFi Configuration
// =====================================================
#define WIFI_SSID "CW_LOVE_ZM"
#define WIFI_PASSWORD "123456789"
#define WIFI_TIMEOUT_MS 10000 // 10 seconds

// =====================================================
// AWS IoT Core Configuration
// =====================================================
// Your account/region-specific ATS data endpoint. Find it with:
//   aws iot describe-endpoint --endpoint-type iot:Data-ATS
// e.g. "a1b2c3d4e5f6g7-ats.iot.ap-southeast-1.amazonaws.com"
#define AWS_IOT_ENDPOINT "xxxxxxxxxxxxxx-ats.iot.ap-southeast-1.amazonaws.com"
#define AWS_IOT_PORT 8883 // MQTT over TLS

// The IoT "Thing" name doubles as the MQTT client id. Must be unique per device
// and should match the thing you registered in AWS IoT Core.
#define THING_NAME "aerosensei-esp32-esp32_015"

// Topic the device publishes telemetry to. Keep a per-device segment so an IoT
// Rule / policy can scope by device if needed.
#define MQTT_PUBLISH_TOPIC "aerosensei/telemetry/" SENSOR_UUID

// Identity carried in the payload (same fields the InfluxDB pipeline expects).
// SENSOR_UUID = sensor_registry.id (the generated UUID, not the label);
// SITE_ID / SITE_NAME come from the sensor's company_sites row. Bake these in
// per physical device at flash time.
#define SENSOR_UUID "00000000-0000-0000-0000-000000000000"
#define SITE_ID "1"
#define SITE_NAME "VPBank Tower Hanoi"

// NTP — TLS certificate validation needs a correct clock, and we stamp readings.
#define NTP_SERVER "pool.ntp.org"

// How often to read the SPS30 and publish (seconds -> ms)
#define PUBLISH_INTERVAL_MS 15000

// =====================================================
// TLS credentials (X.509 mutual auth)
//
// For production, move these into a separate `secrets.h` (git-ignored) and
// `#include "secrets.h"` here instead of inlining them. Each device gets its
// own certificate + private key generated when you create/attach it in AWS IoT.
// =====================================================

// Amazon Root CA 1 (validates the AWS IoT server). Same for every device.
// Download: https://www.amazontrust.com/repository/AmazonRootCA1.pem
static const char AWS_ROOT_CA[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
PASTE_AmazonRootCA1.pem_HERE
-----END CERTIFICATE-----
)EOF";

// This device's certificate (xxxx-certificate.pem.crt from AWS IoT).
static const char DEVICE_CERT[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
PASTE_DEVICE_CERTIFICATE_HERE
-----END CERTIFICATE-----
)EOF";

// This device's private key (xxxx-private.pem.key from AWS IoT). Keep secret.
static const char DEVICE_PRIVATE_KEY[] PROGMEM = R"EOF(
-----BEGIN RSA PRIVATE KEY-----
PASTE_DEVICE_PRIVATE_KEY_HERE
-----END RSA PRIVATE KEY-----
)EOF";

// =====================================================
// SPS30 Configuration
// =====================================================
#define SPS30_RX_PIN 16
#define SPS30_TX_PIN 17
#define SPS30_BAUD 115200

HardwareSerial SPS30Serial(1);
SensirionUartSps30 sps30;

#ifdef NO_ERROR
#undef NO_ERROR
#endif
#define NO_ERROR 0

static char errorMessage[64];

// MQTT over a mutually-authenticated TLS socket.
WiFiClientSecure net;
MQTTClient mqttClient(512); // buffer large enough for our JSON payload

// =====================================================
// Helpers
// =====================================================
void printError(const char *functionName, int16_t errorCode)
{
    errorToString(errorCode, errorMessage, sizeof(errorMessage));
    Serial.print("Error in ");
    Serial.print(functionName);
    Serial.print("(): ");
    Serial.println(errorMessage);
}

bool connectWiFi()
{
    Serial.println();
    Serial.println("====================================");
    Serial.println("Connecting to WiFi");
    Serial.print("SSID: ");
    Serial.println(WIFI_SSID);
    Serial.println("====================================");

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    unsigned long startMs = millis();
    while (WiFi.status() != WL_CONNECTED)
    {
        if (millis() - startMs > WIFI_TIMEOUT_MS)
        {
            Serial.println();
            Serial.println("WiFi connection TIMED OUT.");
            return false;
        }
        delay(500);
        Serial.print(".");
    }

    Serial.println();
    Serial.println("WiFi CONNECTED.");
    Serial.print("IP Address   : ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    return true;
}

// TLS validation requires a correct wall clock. Block briefly until NTP syncs.
void syncTime()
{
    configTime(0, 0, NTP_SERVER); // UTC
    Serial.print("Waiting for NTP time sync");
    time_t now = time(nullptr);
    unsigned long startMs = millis();
    while (now < 1700000000 && millis() - startMs < 15000)
    {
        delay(300);
        Serial.print(".");
        now = time(nullptr);
    }
    Serial.println();
    Serial.print("Current UTC epoch: ");
    Serial.println((long)now);
}

// Returns current UTC time in nanoseconds since epoch, or 0 before NTP sync.
int64_t getUnixNanoTimestamp()
{
    time_t now = time(nullptr);
    if (now < 1700000000)
    {
        return 0;
    }
    return (int64_t)now * 1000000000LL;
}

// Establish (or re-establish) the mutually-authenticated MQTT/TLS session.
bool connectAWS()
{
    // Load the credentials into the TLS client.
    net.setCACert(AWS_ROOT_CA);
    net.setCertificate(DEVICE_CERT);
    net.setPrivateKey(DEVICE_PRIVATE_KEY);

    mqttClient.begin(AWS_IOT_ENDPOINT, AWS_IOT_PORT, net);

    Serial.print("Connecting to AWS IoT Core as ");
    Serial.print(THING_NAME);
    Serial.println(" ...");

    unsigned long startMs = millis();
    while (!mqttClient.connect(THING_NAME))
    {
        if (millis() - startMs > 15000)
        {
            Serial.println();
            Serial.print("AWS IoT connect FAILED. lastError=");
            Serial.print(mqttClient.lastError());
            Serial.print(" returnCode=");
            Serial.println(mqttClient.returnCode());
            Serial.println("Check: endpoint, certs/key match the Thing, policy allows iot:Connect/Publish, clock synced.");
            return false;
        }
        Serial.print(".");
        delay(500);
    }

    Serial.println();
    Serial.println("AWS IoT Core CONNECTED.");
    return true;
}

// Escapes double quotes/backslashes so SITE_NAME is safe inside JSON.
String jsonEscape(const char *value)
{
    String out;
    for (const char *c = value; *c; c++)
    {
        if (*c == '"' || *c == '\\')
        {
            out += '\\';
        }
        out += *c;
    }
    return out;
}

void publishReadings(float pm1p0, float pm2p5, float pm4p0, float pm10p0, float nc0p5)
{
    if (!mqttClient.connected())
    {
        Serial.println("MQTT not connected, reconnecting...");
        if (!connectAWS())
        {
            return;
        }
    }

    // JSON payload. An AWS IoT Rule can SELECT these fields and route them to
    // the destination of your choice.
    String payload = "{";
    payload += "\"sensor_id\":\"" + String(SENSOR_UUID) + "\",";
    payload += "\"site_id\":\"" + String(SITE_ID) + "\",";
    payload += "\"site_name\":\"" + jsonEscape(SITE_NAME) + "\",";
    payload += "\"pm1_0\":" + String(pm1p0, 2) + ",";
    payload += "\"pm2_5\":" + String(pm2p5, 2) + ",";
    payload += "\"pm4_0\":" + String(pm4p0, 2) + ",";
    payload += "\"pm10\":" + String(pm10p0, 2) + ",";
    payload += "\"nc0_5\":" + String(nc0p5, 2);

    int64_t ts = getUnixNanoTimestamp();
    if (ts > 0)
    {
        char tsBuf[24];
        snprintf(tsBuf, sizeof(tsBuf), "%lld", (long long)ts);
        payload += ",\"timestamp_ns\":";
        payload += tsBuf;
    }
    payload += "}";

    bool ok = mqttClient.publish(MQTT_PUBLISH_TOPIC, payload);
    if (ok)
    {
        Serial.print("Published to ");
        Serial.print(MQTT_PUBLISH_TOPIC);
        Serial.print(": ");
        Serial.println(payload);
    }
    else
    {
        Serial.print("Publish FAILED. lastError=");
        Serial.println(mqttClient.lastError());
    }
}

// =====================================================
// Setup
// =====================================================
void setup()
{
    Serial.begin(115200);
    delay(1000);

    // --- WiFi ---
    connectWiFi(); // non-fatal: SPS30 still runs if WiFi fails

    // --- Time (UTC): required for TLS cert validation + timestamps ---
    syncTime();

    // --- AWS IoT Core (MQTT/TLS) ---
    connectAWS();

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
    if (error != NO_ERROR)
    {
        printError("readSerialNumber", error);
        Serial.println("SPS30 UART FAILED. Check TX/RX wiring, 5V power, GND, and SEL pin.");
        return;
    }
    Serial.print("SPS30 Serial Number: ");
    Serial.println((const char *)serialNumber);

    // Test 2: Product type
    int8_t productType[9] = {0};
    error = sps30.readProductType(productType, sizeof(productType));
    if (error != NO_ERROR)
    {
        printError("readProductType", error);
        Serial.println("SPS30 UART FAILED.");
        return;
    }
    Serial.print("SPS30 Product Type: ");
    Serial.println((const char *)productType);

    // Test 3: Start measurement
    error = sps30.startMeasurement(SPS30_OUTPUT_FORMAT_OUTPUT_FORMAT_FLOAT);
    if (error != NO_ERROR)
    {
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
void loop()
{
    float mc1p0 = 0, mc2p5 = 0, mc4p0 = 0, mc10p0 = 0;
    float nc0p5 = 0, nc1p0 = 0, nc2p5 = 0, nc4p0 = 0, nc10p0 = 0;
    float typicalParticleSize = 0;

    // Keep the MQTT session alive (PINGREQ/PINGRESP + inbound processing).
    mqttClient.loop();

    delay(PUBLISH_INTERVAL_MS);

    int16_t error = sps30.readMeasurementValuesFloat(
        mc1p0, mc2p5, mc4p0, mc10p0,
        nc0p5, nc1p0, nc2p5, nc4p0, nc10p0,
        typicalParticleSize);

    if (error != NO_ERROR)
    {
        printError("readMeasurementValuesFloat", error);
        return;
    }

    // Print to Serial Monitor
    Serial.print("PM1.0: ");
    Serial.print(mc1p0);
    Serial.print(" ug/m3\t");
    Serial.print("PM2.5: ");
    Serial.print(mc2p5);
    Serial.print(" ug/m3\t");
    Serial.print("PM4.0: ");
    Serial.print(mc4p0);
    Serial.print(" ug/m3\t");
    Serial.print("PM10: ");
    Serial.print(mc10p0);
    Serial.print(" ug/m3\t");
    Serial.print("Size: ");
    Serial.print(typicalParticleSize);
    Serial.println(" um");

    // Publish to AWS IoT Core
    publishReadings(mc1p0, mc2p5, mc4p0, mc10p0, nc0p5);
}
