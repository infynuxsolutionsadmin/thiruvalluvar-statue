#!/bin/bash
set -e

# Download miniconda if not present
if [ ! -f miniconda.sh ]; then
    curl -L -s -o miniconda.sh https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
fi

# Install miniconda to $HOME/miniconda
if [ ! -d "$HOME/miniconda" ]; then
    bash miniconda.sh -b -p "$HOME/miniconda"
fi

# Activate conda
source "$HOME/miniconda/bin/activate"

conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r

# Create and activate py311
if ! conda info --envs | grep -q py311; then
    conda create -y -n py311 python=3.11
fi
conda activate py311

# Go to NeMo and install
cd /mnt/d/Infynux/thiruvalluvar-voice-ai/thiruvalluvar-backend/stt-test/AI4Bharat-NeMo
pip install Cython

# Fix CRLF issues
sed -i 's/\r$//' reinstall.sh

# run reinstall
bash reinstall.sh
