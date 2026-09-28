#!/bin/bash
source "$HOME/miniconda/bin/activate"
conda activate py311

CHECKPOINT="/mnt/d/hf/hub/models--ai4bharat--indicconformer_stt_ta_hybrid_ctc_rnnt_large/snapshots/8c31aa8d04964b8fc87e4eaaee7916f7d2c024da/indicconformer_stt_ta_hybrid_rnnt_large.nemo"
AUDIO="/mnt/d/Infynux/thiruvalluvar-voice-ai/thiruvalluvar-backend/stt-test/test_input.wav"

cd /mnt/d/Infynux/thiruvalluvar-voice-ai/thiruvalluvar-backend/stt-test

python inference.py -c "$CHECKPOINT" -f "$AUDIO" -d cpu -l ta
