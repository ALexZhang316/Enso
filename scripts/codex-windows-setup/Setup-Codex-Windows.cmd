@echo off
setlocal

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Setup-Codex-Windows.ps1"
set "exit_code=%errorlevel%"

echo.
if not "%exit_code%"=="0" (
    echo Script failed. Send me the error above and I will help you fix it.
) else (
    echo Script completed.
)

echo.
pause
exit /b %exit_code%
