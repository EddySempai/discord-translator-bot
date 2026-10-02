Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\proyects\discord-translator-bot"
WshShell.Run "cmd.exe /c npx pm2 resurrect", 0, False
