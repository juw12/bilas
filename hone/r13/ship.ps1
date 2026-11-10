$env:GIT_TERMINAL_PROMPT = "0"
$git = "C:\Users\juwen_lie\AppData\Local\Programs\Git\cmd\git.exe"
$py = "C:\Users\juwen_lie\AppData\Local\Programs\Python\Python313\python.exe"
Set-Location "C:\Users\juwen_lie\.vector\scratch\session_mw6mgt7k11fv6kug5\bilas"
& $git add js/app.js js/i18n.js index.html css/style.css sw.js tests/sit.py hone/r13/pr_body.md hone/r13/checks.ps1 hone/r13/summary.py hone/r13/section.py hone/r13/ship.ps1
& $git commit -q -m "Sit mode is read-only, film grain toggle, first-run intro beat (queue 236)" 2>&1
& $git log --oneline -2
for ($i = 0; $i -lt 4; $i++) {
    & $git push -u origin r13-sit 2>&1
    if ($LASTEXITCODE -eq 0) {
        break
    }
    Start-Sleep -Seconds 5
}
& $py ..\ghpr.py bilas r13-sit "Sit mode is read-only, film grain toggle, first-run intro beat (queue 236)" hone\r13\pr_body.md hone\r13\pr.log 2>&1
Get-Content hone\r13\pr.log
