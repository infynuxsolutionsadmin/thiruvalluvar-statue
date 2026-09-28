#!/bin/bash
source "$HOME/miniconda/bin/activate"
conda activate py311

# Clean pip cache to free up any space used by failed cuda downloads
pip cache purge

# Install CPU only PyTorch
pip install torch --index-url https://download.pytorch.org/whl/cpu

# Install missing dependencies for ASR
pip install pytorch-lightning librosa omegaconf ruamel.yaml huggingface-hub numba
