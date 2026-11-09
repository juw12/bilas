$py = "C:\Users\juwen_lie\AppData\Local\Programs\Python\Python313\python.exe"
Set-Location "C:\Users\juwen_lie\.vector\scratch\session_mw6mgt7k11fv6kug5\bilas"
$log = "hone\dial-drawer\checks.log"
"== flow 1280" | Out-File $log
& $py tests\flow.py ddf_1280 1280 800 2>&1 | Select-Object -Last 1 | Out-File $log -Append
"== flow 390" | Out-File $log -Append
& $py tests\flow.py ddf_390 390 844 2>&1 | Select-Object -Last 1 | Out-File $log -Append
"== gestures 390" | Out-File $log -Append
& $py tests\gestures.py ddg_390 390 844 2>&1 | Select-Object -Last 1 | Out-File $log -Append
"== dialdrawer 390" | Out-File $log -Append
& $py tests\dialdrawer.py dd_390 390 844 2>&1 | Out-File $log -Append
"== gates" | Out-File $log -Append
& $py tests\gates.py 2>&1 | Select-Object -Last 1 | Out-File $log -Append
"== done" | Out-File $log -Append
