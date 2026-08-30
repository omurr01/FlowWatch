# =============================================================================
# FlowWatch — Sprint 0 Environment Setup (PowerShell)
# Run this ONCE before 'docker compose up -d'.
#
# What it does:
#   1. Generates the Mosquitto password file (hashed) from .env credentials
#   2. Optionally generates self-signed TLS certificates
#   3. Verifies Docker is available
# =============================================================================

param(
    [switch]$WithTLS  # Pass -WithTLS to also generate self-signed certificates
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=============================" -ForegroundColor Cyan
Write-Host " FlowWatch Sprint 0 Setup"     -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

# ── Load .env ──────────────────────────────────────────────────────────────
if (!(Test-Path ".env")) {
    Write-Host "[ERROR] .env file not found. Copy .env.example or create one." -ForegroundColor Red
    exit 1
}

$envVars = @{}
Get-Content ".env" | ForEach-Object {
    $line = $_.Trim()
    if ($line -and !$line.StartsWith("#")) {
        $parts = $line -split "=", 2
        if ($parts.Count -eq 2) {
            $envVars[$parts[0].Trim()] = $parts[1].Trim()
        }
    }
}

# ── Step 1: Generate Mosquitto password file ──────────────────────────────
Write-Host ""
Write-Host "[1/3] Generating Mosquitto password file..." -ForegroundColor Yellow

$passwdDir = "mosquitto\config"
$passwdFile = Join-Path $passwdDir "passwd"

if (!(Test-Path $passwdDir)) {
    New-Item -ItemType Directory -Path $passwdDir -Force | Out-Null
}

# Start with empty file
Set-Content -Path $passwdFile -Value "" -NoNewline

# ARCHITECTURE.md section 4: four credential scopes + internal health-check user
$users = @(
    @{ Name = "device_unit1"; PasswordKey = "MQTT_DEVICE_UNIT1_PASSWORD" },
    @{ Name = "device_unit2"; PasswordKey = "MQTT_DEVICE_UNIT2_PASSWORD" },
    @{ Name = "dashboard";    PasswordKey = "MQTT_DASHBOARD_PASSWORD" },
    @{ Name = "nodered";      PasswordKey = "MQTT_NODERED_PASSWORD" },
    @{ Name = "health";       PasswordKey = "MQTT_HEALTH_PASSWORD" }
)

foreach ($user in $users) {
    $password = $envVars[$user.PasswordKey]
    if (!$password) {
        Write-Host "  [ERROR] Missing $($user.PasswordKey) in .env" -ForegroundColor Red
        exit 1
    }

    # Use temporary mosquitto container to hash passwords.
    # In PowerShell 5.1, a native command's stderr is surfaced as an error record, so
    # under $ErrorActionPreference="Stop" the container's benign warnings (e.g. "world
    # readable permissions") become terminating errors that abort the loop mid-way.
    # Scope ErrorActionPreference to "Continue" for the call and rely on $LASTEXITCODE.
    $mountPath = (Resolve-Path $passwdDir).Path -replace '\\', '/'
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    docker run --rm -v "${mountPath}:/mosquitto/config" eclipse-mosquitto:2 `
        mosquitto_passwd -b /mosquitto/config/passwd $user.Name $password 2>$null
    $ErrorActionPreference = $prevEap

    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] Failed to add user $($user.Name)" -ForegroundColor Red
        exit 1
    }
    Write-Host "  + $($user.Name)" -ForegroundColor Gray
}

Write-Host "  [OK] Password file created with $($users.Count) users" -ForegroundColor Green

# ── Step 2: TLS certificates (optional) ──────────────────────────────────
Write-Host ""
if ($WithTLS) {
    Write-Host "[2/3] Generating self-signed TLS certificates..." -ForegroundColor Yellow

    $certsDir = "mosquitto\certs"
    if (!(Test-Path $certsDir)) {
        New-Item -ItemType Directory -Path $certsDir -Force | Out-Null
    }

    if (Test-Path (Join-Path $certsDir "ca.crt")) {
        Write-Host "  Certificates already exist — skipping" -ForegroundColor Gray
    } else {
        $certsMountPath = (Resolve-Path $certsDir).Path -replace '\\', '/'
        docker run --rm -v "${certsMountPath}:/certs" -w /certs alpine sh -c "apk add --no-cache openssl > /dev/null 2>&1; openssl genrsa -out ca.key 2048 2>/dev/null; openssl req -new -x509 -days 3650 -key ca.key -out ca.crt -subj '/CN=FlowWatch CA' 2>/dev/null; openssl genrsa -out server.key 2048 2>/dev/null; openssl req -new -key server.key -out server.csr -subj '/CN=localhost' 2>/dev/null; openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 3650 2>/dev/null; rm -f server.csr ca.srl"

        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [ERROR] Certificate generation failed" -ForegroundColor Red
            exit 1
        }
        Write-Host "  [OK] Certificates generated in $certsDir" -ForegroundColor Green
        Write-Host "  [NOTE] Uncomment TLS listener in mosquitto.conf to enable" -ForegroundColor Cyan
    }
} else {
    Write-Host "[2/3] TLS certificates — skipped (pass -WithTLS to generate)" -ForegroundColor Gray
}

# ── Step 3: Verify Docker ────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/3] Verifying Docker..." -ForegroundColor Yellow

try {
    $composeVersion = docker compose version 2>&1
    Write-Host "  $composeVersion" -ForegroundColor Gray
    Write-Host "  [OK] Docker Compose available" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Docker Compose not found. Install Docker Desktop." -ForegroundColor Red
    exit 1
}

# ── Done ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=============================" -ForegroundColor Cyan
Write-Host " Setup Complete"               -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. docker compose up -d" -ForegroundColor White
Write-Host "  2. pip install -r mock/requirements.txt" -ForegroundColor White
Write-Host "  3. python mock/mock_publisher.py --username device_unit1 --password $($envVars['MQTT_DEVICE_UNIT1_PASSWORD'])" -ForegroundColor White
Write-Host ""
Write-Host "Service UIs:" -ForegroundColor White
Write-Host "  Node-RED:  http://localhost:1880" -ForegroundColor Gray
Write-Host "  InfluxDB:  http://localhost:8086" -ForegroundColor Gray
Write-Host ""
