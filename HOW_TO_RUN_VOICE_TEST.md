# How to Run the End-to-End Voice Test

This document contains the exact steps to test the full Thiruvalluvar Voice AI pipeline: 
**Mic → AI4Bharat Tamil STT → NestJS Knowledge API → Piper TTS Answer**

---

### Step 0: Initial One-Time Setup (On any system)

If you just cloned this project on a new computer:
1. Open PowerShell and navigate to the backend folder:
   ```powershell
   cd thiruvalluvar-backend
   ```
2. Run the automated setup script:
   ```powershell
   .\setup_environment.ps1
   ```
   *(This automatically installs `npm` dependencies, creates the Python environment, installs requirements, and downloads the AI models.)*
3. Make sure `.env` has your valid `MONGO_URI`.

---

### Terminal 1: Start the Backend Server

This terminal runs the NestJS server that handles Knowledge Retrieval and Text-to-Speech (TTS).

1. Open a PowerShell window and navigate to the backend folder:
   ```powershell
   cd D:\Infynux\thiruvalluvar-voice-ai\thiruvalluvar-backend
   ```
2. Start the NestJS server:
   ```powershell
   npm run start
   ```
   *(Wait until it says "Nest application successfully started". Leave this terminal running.)*

---

### Terminal 2: Start the CLI Voice Tester

This terminal runs the Python script that listens to your microphone, uses the local AI4Bharat model to transcribe your Tamil speech, and talks to the backend.

1. Open a **new** PowerShell window.
2. Navigate to the `stt-test` directory inside the backend:
   ```powershell
   cd D:\Infynux\thiruvalluvar-voice-ai\thiruvalluvar-backend\stt-test
   ```
3. Activate the specific Python 3.11 virtual environment configured for the STT model:
   ```powershell
   .\.venv311\Scripts\activate
   ```
   *(You should see `(.venv311)` appear at the beginning of your command prompt.)*
4. Run the interactive voice test script:
   ```powershell
   python voice_knowledge_test.py
   ```

5. Follow the on-screen instructions in the CLI: Press ENTER to start recording, speak your Tamil question (e.g. "101வது குறள் என்ன?"), and listen to the AI answer you!
