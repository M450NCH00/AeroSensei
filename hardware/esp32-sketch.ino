#include <Arduino.h>
#include <HardwareSerial.h>
#include <SensirionUartSps30.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>

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
#define WIFI_SSID "CW_LOVE_ZM"
#define WIFI_PASSWORD "123456789"
#define WIFI_TIMEOUT_MS 10000 // 10 seconds

// InfluxDB v2 write API, exposed to the internet through the nginx reverse
// proxy at /influx/ (HTTPS on the EC2 host). nginx strips the /influx prefix
// and forwards to influxdb:8086 inside the compose network. The cert is
// self-signed, so the device connects with setInsecure() (see postReadings).
// For a purely local run, point this back at http://<lan-ip>:8086.
#define INFLUX_URL "https://ec2-3-107-194-55.ap-southeast-2.compute.amazonaws.com/influx"
#define INFLUX_ORG "my-org"
#define INFLUX_BUCKET "sensors_data"
#define INFLUX_TOKEN "my-super-secret-admin-token-12345"
#define POST_ENDPOINT INFLUX_URL "/api/v2/write?org=" INFLUX_ORG "&bucket=" INFLUX_BUCKET "&precision=ns"

// Must match this device's row in the sensor_registry table: SENSOR_UUID is
// the registry's generated `id` column (not the human-readable sensor_id
// label), and SITE_ID/SITE_NAME come from the company_sites row it belongs
// to. Look these up once via the backend/pgAdmin after registering the
// sensor and bake them into the firmware per physical device.
#define SENSOR_UUID "5932b673-a81a-4221-863b-340a9596d0e1"
#define SITE_ID "72"
#define SITE_NAME "VinUniversity - Gia Lam"

// NTP so line-protocol points can carry a real nanosecond timestamp
#define NTP_SERVER "pool.ntp.org"

// How often to read the SPS30 and write to InfluxDB (matches the
// Python traffic simulator's READING_INTERVAL of 15 seconds)
#define POST_INTERVAL_MS 15000

// =====================================================
// SPS30 Configuration
// =====================================================
#define SPS30_RX_PIN 16
#define SPS30_TX_PIN 17
#define SPS30_BAUD 115200
#define POST_INTERVAL_MS 1000

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
            Serial.print("Last WiFi status: ");
            switch (WiFi.status())
            {
            case WL_NO_SSID_AVAIL:
                Serial.println("SSID not found. Check SSID name.");
                break;
            case WL_CONNECT_FAILED:
                Serial.println("Wrong password or auth rejected.");
                break;
            case WL_DISCONNECTED:
                Serial.println("Disconnected / still trying.");
                break;
            case WL_IDLE_STATUS:
                Serial.println("Idle. Module may not be ready.");
                break;
            default:
                Serial.println(WiFi.status());
                break;
            }
            return false;
        }
        delay(500);
        Serial.print(".");
    }

    Serial.println();
    Serial.println("WiFi CONNECTED.");
    Serial.print("IP Address   : ");
    Serial.println(WiFi.localIP());
    Serial.print("Gateway      : ");
    Serial.println(WiFi.gatewayIP());
    Serial.print("DNS          : ");
    Serial.println(WiFi.dnsIP());
    Serial.print("Subnet Mask  : ");
    Serial.println(WiFi.subnetMask());
    Serial.print("Signal (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    Serial.print("MAC Address  : ");
    Serial.println(WiFi.macAddress());

    // =====================================================
    // Ping test to server
    // =====================================================
    Serial.println();
    Serial.println("---- Connectivity Test ----");
    Serial.print("Target endpoint : ");
    Serial.println(POST_ENDPOINT);

    WiFiClientSecure client;
    client.setInsecure(); // accept the nginx endpoint's self-signed TLS cert
    HTTPClient http;
    http.begin(client, POST_ENDPOINT);
    http.setTimeout(5000);
    int httpCode = http.GET(); // GET on the ingest path will likely 405/404, that's fine — we just want TCP to succeed

    if (httpCode > 0)
    {
        Serial.print("Server reachable. HTTP response: ");
        Serial.println(httpCode);
    }
    else
    {
        Serial.print("Server NOT reachable. Error: ");
        Serial.println(http.errorToString(httpCode));
        Serial.println("Check: server running? firewall? correct IP/port?");
    }
    http.end();
    Serial.println("---------------------------");

    return true;
}

// Returns the current UTC time in nanoseconds since epoch, the precision the
// InfluxDB write API is called with (precision=ns). Returns 0 if NTP has not
// synced yet, in which case InfluxDB will stamp the point with its own
// receipt time instead.
int64_t getUnixNanoTimestamp()
{
    time_t now;
    if (!time(&now) || now < 1700000000) // sanity check: before NTP sync, time() returns ~0
    {
        return 0;
    }
    return (int64_t)now * 1000000000LL;
}

// Escapes spaces, commas, and equals signs for use in an InfluxDB line
// protocol tag value (SITE_NAME may contain spaces, e.g. "VPBank Tower Hanoi").
String escapeTagValue(const char *value)
{
    String out;
    for (const char *c = value; *c; c++)
    {
        if (*c == ' ' || *c == ',' || *c == '=')
        {
            out += '\\';
        }
        out += *c;
    }
    return out;
}

void postReadings(float pm1p0, float pm2p5, float pm4p0, float pm10p0, float nc0p5)
{
    if (WiFi.status() != WL_CONNECTED)
    {
        Serial.println("WiFi not connected, skipping POST.");
        return;
    }

    WiFiClientSecure client;
    client.setInsecure(); // accept the nginx endpoint's self-signed TLS cert
    HTTPClient http;
    http.begin(client, POST_ENDPOINT);
    http.addHeader("Content-Type", "text/plain; charset=utf-8");
    http.addHeader("Authorization", "Token " INFLUX_TOKEN);

    // InfluxDB line protocol: measurement,tag=set field=set timestamp
    String line = "air_quality,sensor_id=" + String(SENSOR_UUID) +
                  ",site_id=" + String(SITE_ID) +
                  ",site_name=" + escapeTagValue(SITE_NAME) +
                  " pm1_0=" + String(pm1p0, 2) +
                  ",pm2_5=" + String(pm2p5, 2) +
                  ",pm4_0=" + String(pm4p0, 2) +
                  ",pm10=" + String(pm10p0, 2) +
                  ",nc0_5=" + String(nc0p5, 2);

    int64_t ts = getUnixNanoTimestamp();
    if (ts > 0)
    {
        char tsBuf[24];
        snprintf(tsBuf, sizeof(tsBuf), "%lld", (long long)ts);
        line += " ";
        line += tsBuf;
    }

    int httpCode = http.POST(line);

    if (httpCode > 0)
    {
        Serial.print("POST response: ");
        Serial.println(httpCode);
    }
    else
    {
        Serial.print("POST failed: ");
        Serial.println(http.errorToString(httpCode));
    }

    http.end();
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

    // --- Time (UTC) for ISO-8601 timestamps in the ingest payload ---
    configTime(0, 0, NTP_SERVER); // 0 offset, 0 DST => UTC

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

    delay(POST_INTERVAL_MS);

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

    // Post to server (remove or comment out if not needed)
    postReadings(mc1p0, mc2p5, mc4p0, mc10p0, nc0p5);
}