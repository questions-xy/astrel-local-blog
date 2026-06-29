@echo off
cd /d "%~dp0"
set "GLOBAL_NODE=C:\Program Files\nodejs\node.exe"
set "BUNDLED_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if exist "%GLOBAL_NODE%" (
  "%GLOBAL_NODE%" server.js
  pause
  exit /b
)

where node >nul 2>nul
if %errorlevel%==0 (
  node server.js
  pause
  exit /b
)

if exist "%BUNDLED_NODE%" (
  "%BUNDLED_NODE%" server.js
  pause
  exit /b
)

echo Node.js was not found.
echo Please install Node.js, then run this file again.
echo Download: https://nodejs.org/
pause
