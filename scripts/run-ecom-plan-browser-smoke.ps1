param(
  [string]$AppUrl = "http://localhost:3000/workspace/plan-smoke",
  [string]$RunnerDir = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($RunnerDir)) {
  $RunnerDir = Join-Path $repoRoot "tmp\\playwright-runner"
}

if (!(Test-Path $RunnerDir)) {
  New-Item -ItemType Directory -Force -Path $RunnerDir | Out-Null
}

$packageJson = Join-Path $RunnerDir "package.json"
$playwrightEntry = Join-Path $RunnerDir "node_modules\\playwright\\index.js"
$playwrightCli = Join-Path $RunnerDir "node_modules\\playwright\\cli.js"

if (!(Test-Path $packageJson)) {
  Push-Location $RunnerDir
  try {
    npm init -y | Out-Null
  } finally {
    Pop-Location
  }
}

if (!(Test-Path $playwrightEntry)) {
  Push-Location $RunnerDir
  try {
    npm install playwright@1.58.2
  } finally {
    Pop-Location
  }
}

if (!(Test-Path $playwrightCli)) {
  throw "Playwright CLI 未安装成功：$playwrightCli"
}

Push-Location $RunnerDir
try {
  node $playwrightCli install chromium
} finally {
  Pop-Location
}

$env:PLAYWRIGHT_RUNNER_DIR = $RunnerDir
$env:ECOM_PLAN_SMOKE_URL = $AppUrl

node (Join-Path $repoRoot "scripts\\ecom-plan-browser-smoke.cjs")
exit $LASTEXITCODE
