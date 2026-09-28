#!/bin/bash
set -e

echo "=================================================="
echo " ORACLE CLOUD (ARM64) SETUP SCRIPT"
echo "=================================================="

# 1. Verify OS and Architecture
if [[ "$(uname -m)" != "aarch64" ]]; then
    echo "ERROR: This script is intended for Oracle Cloud A1 instances (ARM64/aarch64)."
    echo "Current architecture: $(uname -m)"
    echo "COMPATIBILITY BLOCKER: The setup script will NOT silently install x86 binaries on ARM64."
    exit 1
fi

if ! grep -qi "ubuntu" /etc/os-release; then
    echo "WARNING: This script is tested on Ubuntu."
fi

# 2. Resource Check
echo "-> System Resources:"
free -h
df -h
CPUS=$(nproc)
echo "CPU Count: $CPUS"

TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_RAM" -lt 8000 ]; then
    echo "WARNING: System has less than 8GB RAM. BGE-M3 and NeMo models require significant memory."
fi

# 3. Directories
BASE_DIR="/opt/thiruvalluvar"
APP_DIR="$BASE_DIR/app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

if [ ! -d "$APP_DIR" ]; then
    echo "ERROR: App directory not found at $APP_DIR. Please clone the repository first."
    exit 1
fi

# 4. OS Dependencies
echo "-> Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y curl wget git build-essential ffmpeg libsndfile1 jq

# 5. Node.js (v22 LTS for compatibility)
echo "-> Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js already installed: $(node -v)"
fi

# 6. Build Backend
echo "-> Building NestJS application..."
cd "$APP_DIR"
npm ci
npm run build

# 7. Conda (Miniforge3 / Miniconda for aarch64)
echo "-> Setting up Conda for ARM64..."
CONDA_DIR="$BASE_DIR/Miniconda3"
if [ ! -d "$CONDA_DIR" ]; then
    wget -qO miniconda.sh "https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-aarch64.sh"
    bash miniconda.sh -b -p "$CONDA_DIR"
    rm miniconda.sh
fi

source "$CONDA_DIR/bin/activate"

if ! conda info --envs | grep -q "py311"; then
    conda create -y -n py311 python=3.11
fi
conda activate py311

# 8. STT Dependencies (ARM64 specific PyTorch CPU)
echo "-> Installing STT Python Dependencies..."
pip install --upgrade pip
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install pytorch-lightning librosa omegaconf ruamel.yaml huggingface-hub numba Cython soundfile

# Clone NeMo if not exists (for STT local testing)
if [ ! -d "$APP_DIR/stt-test/AI4Bharat-NeMo" ]; then
    echo "Cloning AI4Bharat NeMo..."
    git clone -b nemo-v2 https://github.com/AI4Bharat/NeMo.git "$APP_DIR/stt-test/AI4Bharat-NeMo"
    cd "$APP_DIR/stt-test/AI4Bharat-NeMo"
    sed -i 's/\r$//' reinstall.sh || true
    bash reinstall.sh || echo "WARNING: NeMo reinstall script encountered an issue. Manual compilation may be needed."
fi

# 9. Download Models
echo "-> Running Model Download Script..."
bash "$SCRIPT_DIR/download-models.sh"

# 10. Systemd Service
echo "-> Configuring Systemd..."
sudo cp "$SCRIPT_DIR/systemd/thiruvalluvar-backend.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable thiruvalluvar-backend.service

# 11. Final Configuration
if [ ! -f "$APP_DIR/.env" ]; then
    cp "$SCRIPT_DIR/.env.production.example" "$APP_DIR/.env"
    echo "WARNING: Created $APP_DIR/.env from template."
    echo "You MUST edit $APP_DIR/.env and add your MongoDB Atlas URI!"
fi

echo "=================================================="
echo " SETUP COMPLETE"
echo "=================================================="
echo "To start the application run:"
echo "  sudo systemctl start thiruvalluvar-backend"
echo "To check health run:"
echo "  $SCRIPT_DIR/health-check.sh"
echo "=================================================="
