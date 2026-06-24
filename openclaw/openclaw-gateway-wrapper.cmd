@echo off
setlocal

set "OPENCLAW_DIR=%~dp0"
set "PROJECT_DIR=%OPENCLAW_DIR%.."
set "ENV_FILE=%PROJECT_DIR%\.env"

if exist "%ENV_FILE%" (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
    if not "%%A"=="" set "%%A=%%B"
  )
)

set "OPENCLAW_CONFIG_PATH=%OPENCLAW_DIR%openclaw.json"
set "OPENCLAW_STATE_DIR=%OPENCLAW_DIR%.state"

call "%OPENCLAW_DIR%plugins\assistant-bridge\node_modules\.bin\openclaw.cmd" %*
