# ─────────────────────────────────────────────────────────────────────────────
# Thiruvalluvar Voice AI - Automated Environment & Dependency Setup (Windows)
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Setting up Thiruvalluvar Voice AI Environment" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Check prerequisites (Node.js & Python)
Write-Host "`n[1/5] Checking prerequisites..." -ForegroundColor Yellow

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "[ERROR] Node.js is not installed. Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "  Found Node.js: $(node --version)" -ForegroundColor Green

$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Host "[ERROR] Python is not installed. Please install Python 3.10 or 3.11." -ForegroundColor Red
    exit 1
}
Write-Host "  Found Python: $(python --version)" -ForegroundColor Green

# 2. Install Node.js backend dependencies
Write-Host "`n[2/5] Installing NestJS backend dependencies (npm install)..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] npm install failed." -ForegroundColor Red
    exit 1
}
Write-Host "  Node dependencies installed successfully." -ForegroundColor Green

# 3. Create or verify Python Virtual Environment (.venv311)
Write-Host "`n[3/5] Setting up Python virtual environment in stt-test\.venv311..." -ForegroundColor Yellow
$sttDir = Join-Path $PSScriptRoot "stt-test"
$venvDir = Join-Path $sttDir ".venv311"
$venvPython = Join-Path $venvDir "Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "  Creating virtual environment at $venvDir..."
    python -m venv $venvDir
}

# 4. Install Python dependencies and AI4Bharat NeMo
Write-Host "`n[4/5] Installing Python requirements and Piper TTS..." -ForegroundColor Yellow
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r (Join-Path $sttDir "requirements.txt")

$nemoDir = Join-Path $sttDir "AI4Bharat-NeMo"
if (Test-Path (Join-Path $nemoDir "setup.py")) {
    Write-Host "  Installing AI4Bharat-NeMo toolkit..."
    & $venvPython -m pip install -e $nemoDir --no-deps
}

# 5. Download and verify models (STT & TTS)
Write-Host "`n[5/5] Downloading & verifying AI models (STT & Piper TTS)..." -ForegroundColor Yellow
$setupModelsScript = Join-Path $PSScriptRoot "scripts\setup_models.py"
& $venvPython $setupModelsScript

# 6. Ensure .env exists
$envFile = Join-Path $PSScriptRoot ".env"
$envExample = Join-Path $PSScriptRoot ".env.example"
if (-not (Test-Path $envFile)) {
    Write-Host "`n[INFO] Creating .env from .env.example..." -ForegroundColor Cyan
    Copy-Item $envExample $envFile
    Write-Host "  [IMPORTANT] Remember to edit .env and provide your valid MONGO_URI!" -ForegroundColor Yellow
}

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " Setup Completed Successfully!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "To run the project:"
Write-Host "  Terminal 1 (Backend API):"
Write-Host "    npm run start"
Write-Host "  Terminal 2 (Voice Tester):"
Write-Host "    cd stt-test"
Write-Host "    .\.venv311\Scripts\activate"
Write-Host "    python voice_knowledge_test.py`n"

