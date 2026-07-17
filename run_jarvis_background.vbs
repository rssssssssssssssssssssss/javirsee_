Set WshShell = CreateObject("WScript.Shell")
WshShell.Run Chr(34) & WshShell.CurrentDirectory & "\launch_python_jarvis.bat" & Chr(34), 0
Set WshShell = Nothing
