Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\proyects\discord-translator-bot"
WshShell.Run "node index.js", 0, False
