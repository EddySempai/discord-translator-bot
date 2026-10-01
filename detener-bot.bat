@echo off
title Detener Discord Translator Bot
cd /d "D:\proyects\discord-translator-bot"
echo ===================================================
echo     Deteniendo Discord Translator Bot...
echo ===================================================

if exist bot.pid (
    set /p BOTPID=<bot.pid
    taskkill /F /PID %BOTPID% >nul 2>&1
    del bot.pid >nul 2>&1
    echo [OK] Bot detenido correctamente.
) else (
    echo [!] No se encontro el archivo bot.pid.
    echo Intentando cerrar procesos node con index.js...
    wmic process where "commandline like '%%index.js%%'" call terminate >nul 2>&1
    echo [OK] Proceso verificado.
)

echo.
timeout /t 3
