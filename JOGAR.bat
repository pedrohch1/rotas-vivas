@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo.
echo  ====================================================
echo    ROTAS VIVAS - Iniciador Facil (Alfa 0.5)
echo  ====================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-facil.ps1"
if errorlevel 1 (
  echo.
  echo Nao foi possivel iniciar. Veja a mensagem acima.
  pause
)
