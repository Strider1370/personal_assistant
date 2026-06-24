$ErrorActionPreference = "Stop"

$openClawDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Resolve-Path (Join-Path $openClawDir "..")
$wrapper = Join-Path $openClawDir "openclaw-gateway-wrapper.cmd"

Set-Location $projectDir
& $wrapper gateway install --wrapper $wrapper --port 18789 --force --json
& $wrapper gateway start --json
& $wrapper gateway status --json
