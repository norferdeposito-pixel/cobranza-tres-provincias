@echo off
cd /d "%~dp0"
echo Convirtiendo Excel de cobranza a CSV limpio...
echo.
"C:\Users\Usuario\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" tools\convert_collection_xlsx_to_csv.py "C:\Users\Usuario\Desktop\cobranza tres provincias.xlsx" "%~dp0cobranza tres provincias limpio.csv"
echo.
echo Listo. Ahora importar en la app el archivo:
echo %~dp0cobranza tres provincias limpio.csv
echo.
pause
