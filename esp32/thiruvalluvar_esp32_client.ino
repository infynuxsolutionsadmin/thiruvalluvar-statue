/*
  Thiruvalluvar Voice AI - ESP32 Hardware Client
  ────────────────────────────────────────────────────────────────────────
  Exact Pinout from Schematic (TirtheshBuilds / Cirkit Designer):

    1. INMP441 I2S Microphone:
       - VDD  -> 3V3
       - GND  -> GND
       - L/R  -> GND (Left channel mono)
       - SD   -> GPIO 32 (D32)
       - WS   -> GPIO 33 (D33)
       - SCK  -> GPIO 14 (D14)

    2. MAX98357A I2S DAC Audio Amplifier:
       - VIN  -> VIN (5V)
       - GND  -> GND
       - LRC  -> GPIO 25 (D25)
       - DIN  -> GPIO 26 (D26)
       - BCLK -> GPIO 27 (D27)
       - Speaker +/- -> Connected to 3W speaker

    3. SSD1306 0.96" OLED Display (I2C):
       - VCC  -> 3V3
       - GND  -> GND
       - SCL  -> GPIO 15 (D15)
       - SDA  -> GPIO 4  (D4)

    4. Button:
       - Built-in BOOT button on ESP32 (GPIO 0)
         (Press and hold BOOT to speak, release to send)

  Required Libraries in Arduino IDE:
    - Adafruit SSD1306 & Adafruit GFX
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <driver/i2s.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ─── 1. Wi-Fi & Live Cloudflare Endpoint ───────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_NAME";      // <-- Put Wi-Fi name here
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";  // <-- Put Wi-Fi password here

// Your live Cloudflare Tunnel endpoint:
const char* SERVER_URL    = "https://rare-houses-only-disclaimer.trycloudflare.com/api/v1/voice/talk";

// ─── 2. Pin Definitions (From Your Exact Schematic) ───────────────────────────
#define BUTTON_PIN      0     // Built-in BOOT button on ESP32

// OLED Display (I2C)
#define SCREEN_WIDTH    128
#define SCREEN_HEIGHT   64
#define OLED_RESET      -1
#define OLED_SDA        4     // D4 connected to SDA
#define OLED_SCL        15    // D15 connected to SCL
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// INMP441 Microphone Pins (I2S Input)
#define I2S_MIC_PORT    I2S_NUM_0
#define I2S_MIC_SCK     14    // D14 connected to SCK
#define I2S_MIC_WS      33    // D33 connected to WS
#define I2S_MIC_SD      32    // D32 connected to SD

// MAX98357A Speaker Pins (I2S Output)
#define I2S_SPK_PORT    I2S_NUM_1
#define I2S_SPK_BCLK    27    // D27 connected to BCLK
#define I2S_SPK_DIN     26    // D26 connected to DIN
#define I2S_SPK_LRC     25    // D25 connected to LRC

// ─── 3. Audio Config ─────────────────────────────────────────────────────────
#define SAMPLE_RATE     16000
#define RECORD_SECONDS  4     // Maximum question duration (seconds)
#define BUFFER_SIZE     (SAMPLE_RATE * 2 * RECORD_SECONDS) // 16-bit = 2 bytes per sample

uint8_t* recordBuffer = NULL;

// ─── 4. OLED Display Helper ──────────────────────────────────────────────────
void showStatus(const char* line1, const char* line2 = "") {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Thiruvalluvar AI");
  display.println("----------------");
  display.setTextSize(1);
  display.println(line1);
  if (strlen(line2) > 0) {
    display.println(line2);
  }
  display.display();
}

// ─── 5. I2S Setup ────────────────────────────────────────────────────────────
void setupI2SMicrophone() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = 1024,
    .use_apll = false
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_MIC_SCK,
    .ws_io_num = I2S_MIC_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_MIC_SD
  };

  i2s_driver_install(I2S_MIC_PORT, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_MIC_PORT, &pin_config);
}

void setupI2SSpeaker() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = 22050, // Piper TTS standard sample rate
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 6,
    .dma_buf_len = 512,
    .use_apll = false
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_SPK_BCLK,
    .ws_io_num = I2S_SPK_LRC,
    .data_out_num = I2S_SPK_DIN,
    .data_in_num = I2S_PIN_NO_CHANGE
  };

  i2s_driver_install(I2S_SPK_PORT, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_SPK_PORT, &pin_config);
}

// ─── 6. WAV Header Generator ─────────────────────────────────────────────────
void createWavHeader(byte* header, int totalDataLen) {
  int totalFileLen = totalDataLen + 36;
  int byteRate = SAMPLE_RATE * 1 * 2;

  header[0] = 'R'; header[1] = 'I'; header[2] = 'F'; header[3] = 'F';
  header[4] = (byte)(totalFileLen & 0xff);
  header[5] = (byte)((totalFileLen >> 8) & 0xff);
  header[6] = (byte)((totalFileLen >> 16) & 0xff);
  header[7] = (byte)((totalFileLen >> 24) & 0xff);
  header[8] = 'W'; header[9] = 'A'; header[10] = 'V'; header[11] = 'E';
  header[12] = 'f'; header[13] = 'm'; header[14] = 't'; header[15] = ' ';
  header[16] = 16; header[17] = 0; header[18] = 0; header[19] = 0;
  header[20] = 1; header[21] = 0;  // PCM
  header[22] = 1; header[23] = 0;  // Mono
  header[24] = (byte)(SAMPLE_RATE & 0xff);
  header[25] = (byte)((SAMPLE_RATE >> 8) & 0xff);
  header[26] = (byte)((SAMPLE_RATE >> 16) & 0xff);
  header[27] = (byte)((SAMPLE_RATE >> 24) & 0xff);
  header[28] = (byte)(byteRate & 0xff);
  header[29] = (byte)((byteRate >> 8) & 0xff);
  header[30] = (byte)((byteRate >> 16) & 0xff);
  header[31] = (byte)((byteRate >> 24) & 0xff);
  header[32] = 2; header[33] = 0;  // BlockAlign
  header[34] = 16; header[35] = 0; // BitsPerSample
  header[36] = 'd'; header[37] = 'a'; header[38] = 't'; header[39] = 'a';
  header[40] = (byte)(totalDataLen & 0xff);
  header[41] = (byte)((totalDataLen >> 8) & 0xff);
  header[42] = (byte)((totalDataLen >> 16) & 0xff);
  header[43] = (byte)((totalDataLen >> 24) & 0xff);
}

// ─── 7. Record Audio ─────────────────────────────────────────────────────────
int recordAudio() {
  showStatus("Listening...", "Speak your Tamil query");
  size_t bytesRead = 0;
  size_t totalBytes = 0;

  while (totalBytes < BUFFER_SIZE) {
    // If BOOT button was released, stop recording early
    if (digitalRead(BUTTON_PIN) == HIGH && totalBytes > (SAMPLE_RATE * 2)) {
      break;
    }
    i2s_read(I2S_MIC_PORT, (void*)(recordBuffer + 44 + totalBytes), 1024, &bytesRead, portMAX_DELAY);
    totalBytes += bytesRead;
  }

  // Prepend 44-byte WAV header
  createWavHeader(recordBuffer, totalBytes);
  return totalBytes + 44;
}

// ─── 8. Send to AI Server & Play Response ────────────────────────────────────
void sendAndPlayResponse(int totalWavBytes) {
  showStatus("Thinking...", "Processing AI answer...");

  WiFiClientSecure client;
  client.setInsecure(); // Allows Cloudflare Tunnel HTTPS without certificate bundles

  HTTPClient http;
  http.begin(client, SERVER_URL);
  http.addHeader("Content-Type", "audio/wav");
  http.setTimeout(35000); // 35s timeout for AI inference & network transit

  int httpCode = http.POST(recordBuffer, totalWavBytes);

  if (httpCode == HTTP_CODE_OK) {
    showStatus("Speaking...", "Playing Tamil response");
    WiFiClient* stream = http.getStreamPtr();

    // Skip the 44-byte WAV header from the incoming response
    uint8_t headerDiscard[44];
    stream->readBytes(headerDiscard, 44);

    uint8_t playBuffer[512];
    size_t bytesWritten;

    while (http.connected() && (stream->available() || stream->connected())) {
      int len = stream->readBytes(playBuffer, sizeof(playBuffer));
      if (len > 0) {
        i2s_write(I2S_SPK_PORT, playBuffer, len, &bytesWritten, portMAX_DELAY);
      }
    }
    showStatus("Ready!", "Hold BOOT to speak");
  } else {
    String err = "HTTP Error: " + String(httpCode);
    showStatus("Server Error", err.c_str());
    delay(2500);
    showStatus("Ready!", "Hold BOOT to speak");
  }

  http.end();
}

// ─── Setup ───────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  // Initialize OLED on D4 (SDA) and D15 (SCL) as wired in schematic
  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED init failed");
  }
  showStatus("Starting up...", "Connecting Wi-Fi");

  // Allocate audio buffer (in PSRAM if available, or internal heap)
  if (psramFound()) {
    recordBuffer = (uint8_t*)ps_malloc(BUFFER_SIZE + 44);
    Serial.println("Using PSRAM for audio buffer");
  } else {
    recordBuffer = (uint8_t*)malloc(BUFFER_SIZE + 44);
    Serial.println("Using Internal Heap for audio buffer");
  }

  // Connect to Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());

  // Setup I2S Mic & Speaker
  setupI2SMicrophone();
  setupI2SSpeaker();

  showStatus("Ready!", "Hold BOOT to speak");
}

// ─── Loop ────────────────────────────────────────────────────────────────────
void loop() {
  // Check if BOOT button is pressed (LOW when pressed with INPUT_PULLUP)
  if (digitalRead(BUTTON_PIN) == LOW) {
    delay(50); // Debounce
    if (digitalRead(BUTTON_PIN) == LOW) {
      int wavSize = recordAudio();
      sendAndPlayResponse(wavSize);
    }
  }
  delay(20);
}
