$env:GIT_TERMINAL_PROMPT = "0"
$git = "C:\Users\juwen_lie\AppData\Local\Programs\Git\cmd\git.exe"
$py = "C:\Users\juwen_lie\AppData\Local\Programs\Python\Python313\python.exe"
Set-Location "C:\Users\juwen_lie\.vector\scratch\session_mw6mgt7k11fv6kug5\bilas"
& $git add js/app.js js/world.js sw.js tests/flow.py tests/gestures.py tests/character.py hone/r15/pr_body.md hone/r15/checks.ps1 hone/r15/ship.ps1
& $git commit -q -m "Machine character, diegetic first-run cues, water splash and coin-clink glint (queue 230-232)" 2>&1
& $git log --oneline -2
for ($i = 0; $i -lt 4; $i++) {
    & $git push -u origin r15-character 2>&1
    if ($LASTEXITCODE -eq 0) {
        break
    }
    Start-Sleep -Seconds 5
}
& $py ..\ghpr.py bilas r15-character "Machine character, diegetic first-run cues, water splash and coin-clink glint (queue 230-232)" hone\r15\pr_body.md hone\r15\pr.log 2>&1
Get-Content hone\r15\pr.log
