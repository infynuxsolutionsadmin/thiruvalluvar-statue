/*
  Thiruvalluvar Voice AI - ESP32 Hardware Client
  ────────────────────────────────────────────────────────────────────────
  Hardware:
    - ESP32 DevKit (or ESP32-S3)
    - I2S Microphone (INMP441 / SPH0645) or Analog Mic via I2S
    - I2S DAC Audio Amp (MAX98357A) + Speaker
    - SSD1306 0.96" OLED Display (I2C)
    - Push-to-Talk Button (uses GPIO 0 / BOOT button or external button)

  Libraries Needed in Arduino IDE:
    - Adafruit SSD1306 & Adafruit GFX (for OLED)
    - WiFi & HTTPClient / WiFiClientSecure (built-in ESP32)
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <driver/i2s.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ─── 1. Wi-Fi & Cloudflare Settings ──────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Paste your Cloudflare Tunnel URL here
const char* SERVER_URL    = "https://rare-houses-only-disclaimer.trycloudflare.com/api/v1/voice/talk";

// ─── 2. Pin Definitions ──────────────────────────────────────────────────────
#define BUTTON_PIN      0     // Built-in BOOT button (or external push button to GND)

// OLED Display (I2C)
#define SCREEN_WIDTH    128
#define SCREEN_HEIGHT   64
#define OLED_RESET      -1
#define OLED_SDA        21
#define OLED_SCL        22
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// I2S Microphone Pins (INMP441)
#define I2S_MIC_PORT    I2S_NUM_0
#define I2S_MIC_SCK     33    // Serial Clock
#define I2S_MIC_WS      25    // Word Select (L/R clock)
#define I2S_MIC_SD      32    // Serial Data

// I2S Speaker Pins (MAX98357A)
#define I2S_SPK_PORT    I2S_NUM_1
#define I2S_SPK_BCLK    26    // Bit Clock
#define I2S_SPK_LRC     27    // Left/Right Clock
#define I2S_SPK_DIN     22    // Data In

// ─── 3. Audio Recording Buffer Config ────────────────────────────────────────
#define SAMPLE_RATE     16000
#define RECORD_SECONDS  4     // Maximum duration per voice question
#define BUFFER_SIZE     (SAMPLE_RATE * 2 * RECORD_SECONDS) // 16-bit = 2 bytes per sample

uint8_t* recordBuffer = NULL;

// ─── 4. OLED Helper ──────────────────────────────────────────────────────────
void showStatus(const char* line1, const char* line2 = "") {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Thiruvalluvar AI");
  display.println("────────────────");
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
  int byteRate = SAMPLE_RATE * 1 * 2; // sample_rate * channels * 2 bytes

  header[0] = 'R'; header[1] = 'I'; header[2] = 'F'; header[3] = 'F';
  header[4] = (byte)(totalFileLen & 0xff);
  header[5] = (byte)((totalFileLen >> 8) & 0xff);
  header[6] = (byte)((totalFileLen >> 16) & 0xff);
  header[7] = (byte)((totalFileLen >> 24) & 0xff);
  header[8] = 'W'; header[9] = 'A'; header[10] = 'V'; header[11] = 'E';
  header[12] = 'f'; header[13] = 'm'; header[14] = 't'; header[15] = ' ';
  header[16] = 16; header[17] = 0; header[18] = 0; header[19] = 0; // Subchunk1Size (16 for PCM)
  header[20] = 1; header[21] = 0;  // AudioFormat (1 = PCM)
  header[22] = 1; header[23] = 0;  // NumChannels (1 = Mono)
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
  showStatus("Listening...", "Speak your Tamil question");
  size_t bytesRead = 0;
  size_t totalBytes = 0;

  unsigned long startTime = millis();
  while (totalBytes < BUFFER_SIZE) {
    // If button was released early, stop recording
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
  client.setInsecure(); // Allows Cloudflare Tunnel HTTPS without needing certificate bundles

  HTTPClient http;
  http.begin(client, SERVER_URL);
  http.addHeader("Content-Type", "audio/wav");
  http.setTimeout(30000); // 30s timeout for AI model inference

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
    showStatus("Ready!", "Press button to ask");
  } else {
    String err = "HTTP Error: " + String(httpCode);
    showStatus("Server Error", err.c_str());
    delay(2500);
    showStatus("Ready!", "Press button to ask");
  }

  http.end();
}

// ─── Setup ───────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  // Initialize OLED
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

  showStatus("Ready!", "Press button to ask");
}

// ─── Loop ────────────────────────────────────────────────────────────────────
void loop() {
  // Check if button is pressed (LOW when pressed with INPUT_PULLUP)
  if (digitalRead(BUTTON_PIN) == LOW) {
    delay(50); // Debounce
    if (digitalRead(BUTTON_PIN) == LOW) {
      int wavSize = recordAudio();
      sendAndPlayResponse(wavSize);
    }
  }
  delay(20);
}

