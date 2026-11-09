$py = "C:\Users\juwen_lie\AppData\Local\Programs\Python\Python313\python.exe"
Set-Location "C:\Users\juwen_lie\.vector\scratch\session_mw6mgt7k11fv6kug5\bilas"
Write-Output "== flow 1280"
& $py tests\flow.py dt2_1280 1280 800 2>&1 | Select-Object -Last 1
Write-Output "== flow 390"
& $py tests\flow.py dt2_390 390 844 2>&1 | Select-Object -Last 1
Write-Output "== gates"
& $py tests\gates.py 2>&1 | Select-Object -Last 1
Write-Output "== done"
