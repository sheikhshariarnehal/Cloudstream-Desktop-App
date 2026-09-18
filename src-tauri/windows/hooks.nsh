!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Ensuring existing CloudStream Desktop processes are closed..."
  nsExec::Exec 'taskkill /F /IM cloudstream-desktop.exe'
  nsExec::Exec 'powershell -NoProfile -NonInteractive -Command "try { Get-Process -Name java -ErrorAction SilentlyContinue | Where-Object { $_.Path -like \"*CloudStream*\" } | Stop-Process -Force } catch {}; exit 0"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Ensuring existing CloudStream Desktop processes are closed..."
  nsExec::Exec 'taskkill /F /IM cloudstream-desktop.exe'
  nsExec::Exec 'powershell -NoProfile -NonInteractive -Command "try { Get-Process -Name java -ErrorAction SilentlyContinue | Where-Object { $_.Path -like \"*CloudStream*\" } | Stop-Process -Force } catch {}; exit 0"'
!macroend
