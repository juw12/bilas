$py = "C:\Users\juwen_lie\AppData\Local\Programs\Python\Python313\python.exe"
$env:PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "1"
Set-Location "C:\Users\juwen_lie\.vector\scratch\session_mw6mgt7k11fv6kug5\bilas"
$shim = "hone\r12\edge_run.py"
$log = "hone\r14\checks.log"
"== gates" | Out-File $log
& $py $shim tests\gates.py r14_gates 2>&1 | Out-File -Append $log
"== flow desktop" | Out-File -Append $log
& $py $shim tests\flow.py r14d 1280 800 2>&1 | Out-File -Append $log
"== flow phone" | Out-File -Append $log
& $py $shim tests\flow.py r14m 390 844 2>&1 | Out-File -Append $log
"== sit desktop" | Out-File -Append $log
& $py $shim tests\sit.py r14sit 1280 800 2>&1 | Out-File -Append $log
"== sit phone" | Out-File -Append $log
& $py $shim tests\sit.py r14sitm 390 844 2>&1 | Out-File -Append $log
"== gestures" | Out-File -Append $log
& $py $shim tests\gestures.py 2>&1 | Out-File -Append $log
"== dialdrawer" | Out-File -Append $log
& $py $shim tests\dialdrawer.py 2>&1 | Out-File -Append $log
"== tactile desktop" | Out-File -Append $log
& $py $shim tests\tactile.py r14t 1280 800 2>&1 | Out-File -Append $log
"== tactile phone" | Out-File -Append $log
& $py $shim tests\tactile.py r14tm 390 844 2>&1 | Out-File -Append $log
"== done" | Out-File -Append $log
