Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\proyects\discord-translator-bot"
WshShell.Run "cmd.exe /c node index.js", 0, False
