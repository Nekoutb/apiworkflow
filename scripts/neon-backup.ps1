# =============================================================================
#  neon-backup.ps1  -  Export the Neon database to a pg_dump file (Windows)
# =============================================================================
#
#  Purpose:
#    Take a portable backup of your Neon-hosted Postgres database so you can:
#      - Archive it locally
#      - Restore it onto the VPS local Postgres (post-bootstrap)
#      - Inspect schema or row data without hitting Neon
#
#  Usage (PowerShell, from this script's folder OR project root):
#
#    # 1. Default - reads DATABASE_URL from env var, writes .\backups\neon-<ts>.dump
#    .\scripts\neon-backup.ps1
#
#    # 2. Pass the URL explicitly
#    .\scripts\neon-backup.ps1 -DatabaseUrl "postgresql://user:pass@host/db?sslmode=require"
#
#    # 3. Custom output dir + plain-text SQL (useful for grep / review)
#    .\scripts\neon-backup.ps1 -OutputDir "C:\backups" -Format plain
#
#    # 4. Both formats in one run (custom for restore + plain for inspection)
#    .\scripts\neon-backup.ps1 -Format both
#
#  Prerequisite:
#    PostgreSQL client tools (pg_dump). Install one of:
#      - winget install -e --id PostgreSQL.PostgreSQL.16
#      - choco install postgresql --params '/Password:dummy'
#      - or download from https://www.postgresql.org/download/windows/
#    Then make sure pg_dump.exe is on your PATH (usually
#    C:\Program Files\PostgreSQL\18\bin or similar).
#
#  Output formats:
#    custom (default) - *.dump, compressed, restore with pg_restore
#    plain            - *.sql,  human-readable, restore with psql -f
#    both             - writes both files for the same backup snapshot
# =============================================================================

[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$DatabaseUrl,

  [Parameter(Mandatory = $false)]
  [string]$OutputDir,

  [Parameter(Mandatory = $false)]
  [ValidateSet('custom', 'plain', 'both')]
  [string]$Format = 'custom',

  [Parameter(Mandatory = $false)]
  [switch]$NoOwner,

  [Parameter(Mandatory = $false)]
  [switch]$NoAcl,

  [Parameter(Mandatory = $false)]
  [switch]$DataOnly,

  [Parameter(Mandatory = $false)]
  [switch]$SchemaOnly
)

$ErrorActionPreference = 'Stop'

# ---------- Helpers ----------------------------------------------------------
function Write-Step($msg)  { Write-Host "[*] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "[!] $msg" -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host "[X] $msg" -ForegroundColor Red }

# ---------- 1. Locate pg_dump -----------------------------------------------
Write-Step 'Checking for pg_dump'
$pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
if (-not $pgDump) {
  $candidates = @(
    'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe',
    'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe',
    'C:\Program Files\PostgreSQL\16\bin\pg_dump.exe',
    'C:\Program Files\PostgreSQL\15\bin\pg_dump.exe',
    'C:\Program Files\PostgreSQL\14\bin\pg_dump.exe'
  )
  $pgDump = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $pgDump) {
  Write-Err 'pg_dump not found.'
  Write-Host ''
  Write-Host 'Install PostgreSQL client tools:'
  Write-Host '  winget install -e --id PostgreSQL.PostgreSQL.16'
  Write-Host '  # or download: https://www.postgresql.org/download/windows/'
  Write-Host ''
  Write-Host 'Then re-open PowerShell so PATH refreshes.'
  exit 1
}
$version = & $pgDump --version
Write-Ok "Using $pgDump"
Write-Host "   $version" -ForegroundColor DarkGray

# ---------- 2. Resolve the connection URL -----------------------------------
if (-not $DatabaseUrl) {
  $DatabaseUrl = $env:DATABASE_URL
}
if (-not $DatabaseUrl) {
  $candidatesEnv = @(
    (Join-Path $PSScriptRoot '..\.env'),
    (Join-Path $PSScriptRoot '..\app\.env'),
    (Join-Path $PSScriptRoot '..\app\.env.local'),
    (Join-Path $PSScriptRoot '..\app\.env.production')
  )
  foreach ($envFile in $candidatesEnv) {
    if (Test-Path $envFile) {
      $line = (Get-Content $envFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1)
      if ($line) {
        $val = $line -replace '^\s*DATABASE_URL\s*=\s*', ''
        $val = $val.Trim().Trim('"').Trim("'")
        if ($val) {
          $DatabaseUrl = $val
          Write-Ok "Loaded DATABASE_URL from $envFile"
          break
        }
      }
    }
  }
}
if (-not $DatabaseUrl) {
  Write-Warn 'DATABASE_URL not provided and not found in env or .env files.'
  $DatabaseUrl = Read-Host 'Paste the Neon connection string (postgresql://...)'
}
if (-not $DatabaseUrl -or $DatabaseUrl -notmatch '^postgres(ql)?://') {
  Write-Err 'Invalid DATABASE_URL - must start with postgresql:// or postgres://'
  exit 1
}

# Ensure sslmode=require (Neon REJECTS non-SSL connections)
if ($DatabaseUrl -notmatch 'sslmode=') {
  $sep = if ($DatabaseUrl.Contains('?')) { '&' } else { '?' }
  $DatabaseUrl = "$DatabaseUrl${sep}sslmode=require"
  Write-Warn 'Added sslmode=require (Neon requires SSL)'
}

# Parse for display purposes (mask the password)
$dbUser = ''; $dbHost = ''; $dbName = 'database'
if ($DatabaseUrl -match '^postgres(?:ql)?://([^:]+):([^@]+)@([^/]+)/([^?]+)') {
  $dbUser = $matches[1]
  $dbHost = $matches[3]
  $dbName = $matches[4]
  Write-Ok "Connection: $dbUser@$dbHost/$dbName"
} else {
  Write-Warn 'Could not parse connection string for display (continuing anyway)'
}

# ---------- 3. Prepare output directory + filename --------------------------
if (-not $OutputDir) {
  $OutputDir = Join-Path $PSScriptRoot '..\backups'
}
if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
  Write-Ok "Created $OutputDir"
}
$OutputDir = (Resolve-Path $OutputDir).Path

$ts        = Get-Date -Format 'yyyyMMdd-HHmmss'
$baseName  = "neon-${dbName}-${ts}"
$dumpFile  = Join-Path $OutputDir "$baseName.dump"
$sqlFile   = Join-Path $OutputDir "$baseName.sql"

# ---------- 4. Build pg_dump arguments --------------------------------------
$commonArgs = @(
  '--verbose',
  '--no-password',
  '--encoding=UTF8'
)
if ($NoOwner)    { $commonArgs += '--no-owner' }
if ($NoAcl)      { $commonArgs += '--no-acl' }
if ($DataOnly)   { $commonArgs += '--data-only' }
if ($SchemaOnly) { $commonArgs += '--schema-only' }

function Invoke-Dump {
  param([string]$DumpFormat, [string]$OutFile)

  $dumpArgs = $commonArgs + @(
    "--format=$DumpFormat",
    "--file=$OutFile",
    $DatabaseUrl
  )

  Write-Step "Running pg_dump -> $OutFile  (format: $DumpFormat)"
  $start = Get-Date
  & $pgDump @dumpArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Err "pg_dump exited with code $LASTEXITCODE"
    if (Test-Path $OutFile) { Remove-Item $OutFile -Force }
    exit $LASTEXITCODE
  }
  $duration = (Get-Date) - $start
  $sizeMB   = [math]::Round((Get-Item $OutFile).Length / 1MB, 2)
  Write-Ok ("Wrote {0}  ({1} MB / {2:N1}s)" -f $OutFile, $sizeMB, $duration.TotalSeconds)
}

# ---------- 5. Execute the dump(s) ------------------------------------------
switch ($Format) {
  'custom' { Invoke-Dump -DumpFormat 'custom' -OutFile $dumpFile }
  'plain'  { Invoke-Dump -DumpFormat 'plain'  -OutFile $sqlFile  }
  'both'   {
    Invoke-Dump -DumpFormat 'custom' -OutFile $dumpFile
    Invoke-Dump -DumpFormat 'plain'  -OutFile $sqlFile
  }
}

# ---------- 6. Summary + restore hints --------------------------------------
Write-Host ''
Write-Host '===============================================================' -ForegroundColor DarkGreen
Write-Host '  Backup complete' -ForegroundColor Green
Write-Host '==============================================================='
Write-Host ''
Write-Host "  Output dir : $OutputDir"
if (Test-Path $dumpFile) { Write-Host "  Custom     : $(Split-Path $dumpFile -Leaf)  <- restore with pg_restore" }
if (Test-Path $sqlFile)  { Write-Host "  Plain SQL  : $(Split-Path $sqlFile  -Leaf)  <- restore with psql -f" }
Write-Host ''
Write-Host '  Restore onto the VPS local Postgres:' -ForegroundColor Cyan
Write-Host '  --------------------------------------------------------------'
if (Test-Path $dumpFile) {
  $dumpLeaf = Split-Path $dumpFile -Leaf
  Write-Host "    # 1. scp the dump file to the VPS"
  Write-Host "    scp '$dumpFile' <user>@<vps>:/tmp/"
  Write-Host ''
  Write-Host "    # 2. Restore on the VPS as the postgres user"
  Write-Host "    ssh <user>@<vps>"
  Write-Host "    sudo -u postgres pg_restore --clean --if-exists --no-owner --no-acl \\"
  Write-Host "      --dbname=cmipaportal /tmp/$dumpLeaf"
}
Write-Host ''
Write-Host '  Safety: this file contains your Neon data. Keep it private.' -ForegroundColor Yellow
Write-Host '==============================================================='
