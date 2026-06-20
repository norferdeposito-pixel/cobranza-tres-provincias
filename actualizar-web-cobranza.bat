@echo off
setlocal
cd /d "%~dp0"

echo.
echo Actualizando la app web de Cobranza Tres Provincias...
echo.

git --version >nul 2>&1
if errorlevel 1 (
  echo No se encontro Git instalado o disponible en esta computadora.
  pause
  exit /b 1
)

git remote set-url origin https://github.com/norferdeposito-pixel/cobranza-tres-provincias.git
git config user.name "jgcpys-2534"
git config user.email "jgcpys@gmail.com"

echo.
echo Preparando version para publicar...
call npm run build
if errorlevel 1 (
  echo.
  echo No se pudo preparar la app. Mandame una captura de esta ventana.
  pause
  exit /b 1
)

echo.
echo Guardando cambios...
git add .
git commit -m "Conectar Supabase de gestion integral"

echo.
echo Enviando cambios a GitHub y Vercel...
git push
if errorlevel 1 (
  echo.
  echo No se pudo enviar a GitHub. Mandame una captura de esta ventana.
  pause
  exit /b 1
)

echo.
echo Listo. Vercel va a actualizar la app web automaticamente.
pause
