$py = "C:\Users\juwen_lie\AppData\Local\Programs\Python\Python313\python.exe"
$env:PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "1"
Set-Location "C:\Users\juwen_lie\.vector\scratch\session_mw6mgt7k11fv6kug5\bilas"
$shim = "hone\r12\edge_run.py"
$log = "hone\r14\rerun.log"
"== gates" | Out-File $log
& $py $shim tests\gates.py r14_gates 2>&1 | Out-File -Append $log
"== sit phone" | Out-File -Append $log
& $py $shim tests\sit.py r14sitm 390 844 2>&1 | Out-File -Append $log
"== gestures" | Out-File -Append $log
& $py $shim tests\gestures.py 2>&1 | Out-File -Append $log
"== done" | Out-File -Append $log
