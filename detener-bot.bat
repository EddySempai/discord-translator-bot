@echo off
title Detener Discord Translator Bot
cd /d "D:\proyects\discord-translator-bot"
echo ===================================================
echo     Deteniendo Discord Translator Bot...
echo ===================================================
npx pm2 stop discord-translator
echo.
echo [OK] Bot detenido.
pause
