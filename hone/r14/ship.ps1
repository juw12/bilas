$env:GIT_TERMINAL_PROMPT = "0"
$git = "C:\Users\juwen_lie\AppData\Local\Programs\Git\cmd\git.exe"
$py = "C:\Users\juwen_lie\AppData\Local\Programs\Python\Python313\python.exe"
Set-Location "C:\Users\juwen_lie\.vector\scratch\session_mw6mgt7k11fv6kug5\bilas"
& $git add js/app.js js/world.js js/i18n.js index.html css/style.css sw.js tests/tactile.py tests/flow.py hone/r14/pr_body.md hone/r14/checks.ps1 hone/r14/probe_posters.py hone/r14/ship.ps1 hone/r14/rerun.ps1
& $git commit -q -m "Tactile start button, coin plate and tray; wall notes readable on phone; floor tile variation (queue 233, 234)" 2>&1
& $git log --oneline -2
for ($i = 0; $i -lt 4; $i++) {
    & $git push -u origin r14-tactile 2>&1
    if ($LASTEXITCODE -eq 0) {
        break
    }
    Start-Sleep -Seconds 5
}
& $py ..\ghpr.py bilas r14-tactile "Tactile start button, coin plate and tray; wall notes readable on phone; floor tile variation (queue 233, 234)" hone\r14\pr_body.md hone\r14\pr.log 2>&1
Get-Content hone\r14\pr.log
