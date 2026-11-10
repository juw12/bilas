$py = "C:\Users\juwen_lie\AppData\Local\Programs\Python\Python313\python.exe"
$env:PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "1"
Set-Location "C:\Users\juwen_lie\.vector\scratch\session_mw6mgt7k11fv6kug5\bilas"
$shim = "hone\r12\edge_run.py"
$log = "hone\r15\checks.log"
"== gates" | Out-File $log
& $py $shim tests\gates.py r15_gates 2>&1 | Out-File -Append $log
"== flow desktop" | Out-File -Append $log
& $py $shim tests\flow.py r15d 1280 800 2>&1 | Out-File -Append $log
"== flow phone" | Out-File -Append $log
& $py $shim tests\flow.py r15m 390 844 2>&1 | Out-File -Append $log
"== sit desktop" | Out-File -Append $log
& $py $shim tests\sit.py r15sit 1280 800 2>&1 | Out-File -Append $log
"== sit phone" | Out-File -Append $log
& $py $shim tests\sit.py r15sitm 390 844 2>&1 | Out-File -Append $log
"== gestures" | Out-File -Append $log
& $py $shim tests\gestures.py 2>&1 | Out-File -Append $log
"== dialdrawer" | Out-File -Append $log
& $py $shim tests\dialdrawer.py 2>&1 | Out-File -Append $log
"== tactile desktop" | Out-File -Append $log
& $py $shim tests\tactile.py r15t 1280 800 2>&1 | Out-File -Append $log
"== tactile phone" | Out-File -Append $log
& $py $shim tests\tactile.py r15tm 390 844 2>&1 | Out-File -Append $log
"== character desktop" | Out-File -Append $log
& $py $shim tests\character.py r15c 1280 800 2>&1 | Out-File -Append $log
"== character phone" | Out-File -Append $log
& $py $shim tests\character.py r15cm 390 844 2>&1 | Out-File -Append $log
"== done" | Out-File -Append $log
