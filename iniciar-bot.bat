@echo off
title Iniciar Discord Translator Bot
cd /d "D:\proyects\discord-translator-bot"
echo ===================================================
echo     Iniciando Discord Translator Bot con PM2
echo ===================================================
npx pm2 start discord-translator
echo.
echo Presiona Ctrl+C para salir de los logs (el bot seguira corriendo en segundo plano).
npx pm2 logs discord-translator
