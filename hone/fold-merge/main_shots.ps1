$py = "C:\Users\juwen_lie\AppData\Local\Programs\Python\Python313\python.exe"
Set-Location "C:\Users\juwen_lie\.vector\scratch\session_mw6mgt7k11fv6kug5\bilas_main"
Write-Output "== main flow 1280"
& $py tests\flow.py r8main_1280 1280 800 2>&1 | Select-Object -Last 2
Write-Output "== main flow 390"
& $py tests\flow.py r8main_390 390 844 2>&1 | Select-Object -Last 2
Write-Output "== done"
