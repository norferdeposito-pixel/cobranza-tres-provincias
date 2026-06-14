@echo off
cd /d "%~dp0"
echo Iniciando app de cobranza...
echo.
echo Cuando aparezca la URL, abrir: http://127.0.0.1:8090/cobranza
echo Para cerrar la app, cerrar esta ventana.
echo.
set PORT=8090
start "" cmd /c "timeout /t 2 >nul && start "" http://127.0.0.1:8090/cobranza"
"C:\Users\Usuario\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\dev-server.mjs
pause
