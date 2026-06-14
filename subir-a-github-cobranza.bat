@echo off
setlocal
cd /d "%~dp0"

echo.
echo Subiendo la app de Cobranza Tres Provincias a GitHub...
echo.

git --version >nul 2>&1
if errorlevel 1 (
  echo No se encontro Git instalado o disponible en esta computadora.
  echo Instala Git o abre GitHub Desktop y avisame.
  pause
  exit /b 1
)

echo Revisando conexion actual...
git remote get-url origin >nul 2>&1
if not errorlevel 1 (
  git remote rename origin norfer-anterior 2>nul
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin https://github.com/norferdeposito-pixel/cobranza-tres-provincias.git
) else (
  git remote set-url origin https://github.com/norferdeposito-pixel/cobranza-tres-provincias.git
)

echo.
echo Preparando version para publicar...
call npm run build
if errorlevel 1 (
  echo.
  echo No se pudo preparar la app para publicar. Mandame una captura de esta ventana.
  pause
  exit /b 1
)

echo.
echo Guardando cambios...
git branch -M main
git add .
git commit -m "Primera version modulo cobranza"

echo.
echo Enviando a GitHub...
git push -u origin main
if errorlevel 1 (
  echo.
  echo GitHub no recibio la app. Si se abrio una ventana para iniciar sesion, completala y volve a ejecutar este archivo.
  echo Si no se abrio nada, mandame una captura de esta ventana.
  pause
  exit /b 1
)

echo.
echo Listo. La app quedo subida al repositorio de Cobranza Tres Provincias.
pause
