# Oracle Cloud (Ampere A1 ARM64) Deployment Guide

This guide explains how to deploy the Thiruvalluvar Voice AI backend onto an Oracle Cloud Always Free Ampere A1 (ARM64) VM.

## 1. Prerequisites

- **Instance Type:** Oracle Cloud VM.Standard.A1.Flex (ARM64 / aarch64)
- **OS:** Ubuntu 22.04 LTS (or 24.04 LTS)
- **Resources:**
  - Minimum 12 GB RAM recommended (due to NeMo and BGE-M3 memory footprint)
  - Minimum 40 GB Disk Space
- **Ports:**
  - `3000` (NestJS Backend API) - Must be opened in Oracle VCN Security Lists
- **External Dependencies:**
  - MongoDB Atlas cluster URL (with network access allowed for the Oracle VM's IP)

## 2. Directory Layout

The deployment scripts will set up the following structure in `/opt/thiruvalluvar`:

```
/opt/thiruvalluvar/
├── app/                  # The cloned GitHub repository
├── models/               # Large model files (not in Git)
│   ├── stt/              # IndicConformer NeMo model
│   └── tts/              # Piper ONNX model & config
├── piper/                # Piper ARM64 runtime binaries
└── Miniconda3/           # Conda environment for STT (ARM64)
```

## 3. Required Environment Variables

Before starting the services, you must configure `.env` inside `/opt/thiruvalluvar/app/`. Use the provided `deployment/.env.production.example` as a template.

Required variables:
- `PORT=3000`
- `NODE_ENV=production`
- `MONGO_URI` (Your MongoDB Atlas connection string)
- `PIPER_EXECUTABLE_PATH=/opt/thiruvalluvar/piper/piper`
- `PIPER_MODEL_PATH=/opt/thiruvalluvar/models/tts/ta_IN-ValluvaNeural-medium.onnx.onnx`

## 4. Models

| Model | Source | Size | Location |
|-------|--------|------|----------|
| **IndicConformer STT** | HuggingFace (`ai4bharat`) | ~500 MB | `/opt/thiruvalluvar/models/stt/indicconformer_stt_ta_hybrid_rnnt_large.nemo` |
| **BGE-M3 Embedding** | HuggingFace (`Xenova/bge-m3`) | ~2.2 GB | Handled automatically by NestJS Transformers.js (Cached internally) |
| **Piper TTS Model** | HuggingFace (`Jeyaram-K/piper-tamil-voices`) | ~75 MB | `/opt/thiruvalluvar/models/tts/ta_IN-ValluvaNeural-medium.onnx.onnx` |

**NOTE:** The Piper TTS model (`ta_IN-ValluvaNeural-medium`) is downloaded automatically by the setup script. The script verifies that the upstream `ta_IN-ValluvaNeural-medium.onnx.onnx` and `ta_IN-ValluvaNeural-medium.onnx.json` files are properly sourced and configured for runtime inference without altering application behavior.

## 5. Deployment Steps

Run the following commands as a user with `sudo` privileges (e.g., `ubuntu`):

```bash
# 1. Clone the repository
sudo mkdir -p /opt/thiruvalluvar
sudo chown -R $USER:$USER /opt/thiruvalluvar
git clone <YOUR_REPO_URL> /opt/thiruvalluvar/app
cd /opt/thiruvalluvar/app

# 2. Make scripts executable
chmod +x deployment/*.sh

# 3. Run the automated setup
./deployment/setup-oracle.sh

# 4. Start the services
./deployment/start.sh
```

## 6. Services & Systemd

The setup script creates a systemd service for the backend API:

- **Service Name:** `thiruvalluvar-backend.service`
- **Port:** `3000`

### Checking Logs
```bash
journalctl -u thiruvalluvar-backend -f
```

### Restarting
```bash
sudo systemctl restart thiruvalluvar-backend
```

### Stopping
```bash
./deployment/stop.sh
```

## 7. Health Check

To verify that the application and its dependencies are running correctly:
```bash
./deployment/health-check.sh
```

## 8. ARM64 Compatibility Notes

- **Node.js:** Fully supported on ARM64.
- **Python / Conda:** Miniforge3/Miniconda aarch64 is used.
- **PyTorch:** The setup script downloads `aarch64` CPU wheels.
- **Piper TTS:** The setup script explicitly downloads the `aarch64` Linux release of Piper.
- **Transformers.js (BGE-M3):** Runs purely in ONNX Runtime for Node.js, which fully supports ARM64. 

## 9. Troubleshooting

- **MongoDB connection failure:** Check if the Oracle VM's public IP is whitelisted in MongoDB Atlas Network Access.
- **Piper unavailable / 500 error on TTS:** Ensure `PIPER_EXECUTABLE_PATH` points to the correct aarch64 binary and the `.onnx` model exists.
- **STT local scripts failing:** If testing `voice_knowledge_test.py` via SSH, ensure you activate the conda environment first: `source /opt/thiruvalluvar/Miniconda3/bin/activate py311`
