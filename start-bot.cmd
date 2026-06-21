@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if not errorlevel 1 (
  where npm.cmd >nul 2>&1
  if not errorlevel 1 goto run
)

set "CODEX_NODE_ROOT=%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node"
for /f "delims=" %%D in ('dir /b /ad /o-d "%CODEX_NODE_ROOT%" 2^>nul') do (
  if exist "%CODEX_NODE_ROOT%\%%D\bin\node.exe" (
    if exist "%CODEX_NODE_ROOT%\%%D\bin\npm.cmd" (
      set "PATH=%CODEX_NODE_ROOT%\%%D\bin;%PATH%"
      goto run
    )
  )
)

echo Node.js was not found. Install Node.js 22 or newer and try again.
pause
exit /b 1

:run
call npm.cmd start
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" pause
exit /b %EXIT_CODE%
