param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$openClawDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Resolve-Path (Join-Path $openClawDir "..")
$wrapper = Join-Path $openClawDir "openclaw-gateway-wrapper.cmd"
$envFile = Join-Path $projectDir ".env"

$chatId = $null
foreach ($line in Get-Content $envFile) {
  if ($line -match "^\s*TELEGRAM_CHAT_ID=(.+)$") {
    $chatId = $Matches[1].Trim()
    break
  }
}

if (-not $chatId) {
  throw "TELEGRAM_CHAT_ID is missing from .env"
}

$messageArgs = @(
  "message",
  "send",
  "--channel",
  "telegram",
  "--target",
  $chatId,
  "--message",
  "OpenClaw Telegram 연결 테스트: Gateway + Telegram + assistant-bridge 설정 확인 완료.",
  "--json"
)

if ($DryRun) {
  $messageArgs += "--dry-run"
}

Set-Location $projectDir
& $wrapper @messageArgs
