# Thiruvalluvar Voice AI - Backend

## Architecture

This project is a NestJS-based backend for a voice AI application capable of answering questions based on the Thirukkural.

The core pipeline processes user queries sequentially:
1. **Speech-to-Text (STT):** Converts Tamil audio into text.
2. **Query Parsing:** Normalizes Tamil text, detecting specific requests for Kurals and mapping Tamil numerals (௦-௯) to Arabic digits.
3. **Knowledge Service:** Routes the parsed query through deterministic and semantic retrieval layers.
4. **Text-to-Speech (TTS):** Synthesizes the generated Tamil response into speech using Piper TTS.

## Datasets

The backend relies on the following authoritative datasets (in MongoDB):
*   **DS1 (Thirukkural):** The 1,330 Kurals, including their explanations in Tamil and English.
*   **DS2 (Adhigaram/Topic):** Details about the 133 Adhigarams (topics).
*   **DS3 (Biography):** Verified biographical facts about Thiruvalluvar.
*   **DS4 (Dictionary/Keywords):** Lexical terms mapped directly to Kurals.
*   **DS7 (System Facts):** General facts regarding the AI and the system.

## Speech-to-Text (STT)

The STT module uses a local **AI4Bharat IndicConformer** model (`ai4bharat/indicconformer_stt_ta_hybrid_ctc_rnnt_large`) running via NVIDIA NeMo to transcribe Tamil audio. It expects `wav` format and returns the highly accurate transcribed text.

## Semantic Retrieval

When a user query cannot be deterministically resolved (e.g., asking for a specific Kural number), the backend falls back to **Semantic Retrieval**:
*   Uses **Atlas Hybrid Search**, combining BGE-M3 vector embeddings and BM25 lexical text search.
*   The results from vector and lexical search are merged using Reciprocal Rank Fusion (RRF).
*   **Confidence Calibration Layer:** A robust, multi-tier confidence policy is applied to validate the top result. To be accepted, a candidate must have strong RRF agreement and *must* also be the #1 vector result, or it requires strong vector margin and contextual disambiguation (multi-token query).

## Text-to-Speech (TTS)

Responses are synthesized into realistic Tamil speech using the local **Piper TTS** engine, ensuring offline capability, fast generation, and authentic pronunciation.

## Safety & UNKNOWN Behavior

To prevent hallucinations, the system incorporates strict safety protocols:
*   Queries that fail the Semantic Retrieval confidence check are rejected.
*   The AI safely outputs `UNKNOWN` (mapped to dataset `D001`) for queries it does not understand, including ambiguous inputs, nonsensical strings, generic conversation starters, or targets that require more context.
*   **No LLM Reranking:** All safety validations are purely mathematical and deterministic, ensuring zero false-positive mappings (as validated against adversarial benchmarks).

## Known Limitations

**Retrieval Recall:** 
While the confidence layer successfully guarantees zero incorrect candidates are accepted (0 false positives), there remains a known limitation in the initial retrieval stage. Out of the 31 semantic target queries in the Phase 4.3 benchmark, **23 queries did not retrieve the expected Kural within the Hybrid Top-5**. Because these valid candidates never enter the candidate pool, the confidence layer cannot accept them. Improving candidate retrieval recall (Recall@5) is the primary target for future optimization (Phase 4.5+).

## Running Locally

To run the end-to-end Voice AI pipeline locally, you will need two separate terminal windows.

### Terminal 1: NestJS Backend
1. Open a terminal in `thiruvalluvar-backend`.
2. Run `npm install` (if not done already).
3. Start the server: `npm run start`

### Terminal 2: STT & Voice CLI
1. Open a new terminal and navigate to `thiruvalluvar-backend/stt-test`.
2. Activate the Python 3.11 virtual environment: `.\.venv311\Scripts\activate` (on Windows).
3. Run the interactive voice test: `python voice_knowledge_test.py`.
4. Follow the CLI prompt, speak your question in Tamil, and the AI will reply with synthesized Tamil audio.

## Cloud Deployment Checklist

To hand this project over to the cloud deployment team, provide them with the following:

1. **Dockerization Setup:** The backend relies heavily on local machine learning models (IndicConformer via NeMo, Piper TTS). A `Dockerfile` needs to be created to encapsulate the Node.js API, Python environment, system libraries (like `ffmpeg`), and to pre-download the models so they do not download on startup.
2. **Environment Variables:** Provide the `.env.example` file. Crucially, the team needs the **MongoDB Atlas connection string**.
3. **Database Configuration:** Ensure the target MongoDB Atlas cluster contains all datasets (DS1-DS7) and that the **Vector Search Indexes** (for BGE-M3 embeddings) are accurately configured.
4. **Hardware Requirements:** Highlight that this application requires adequate computational resources (memory and CPU/GPU) to run the STT/TTS and vector embedding models efficiently. A standard lightweight container will likely crash or have very high latency.
