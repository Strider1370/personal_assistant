$ErrorActionPreference = "Stop"

$openClawDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Resolve-Path (Join-Path $openClawDir "..")
$wrapper = Join-Path $openClawDir "openclaw-gateway-wrapper.cmd"

Set-Location $projectDir
& $wrapper gateway run --port 18789 --auth none --bind loopback
