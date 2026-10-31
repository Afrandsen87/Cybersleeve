# Removes a finished task worktree even when Codex or a dev server left it undeletable.
# Usage: pwsh scripts/remove-worktree.ps1 -Worktree <dir> [-Branch <name>]
# Steps: stop processes whose command line mentions the worktree (leftover vite previews; TaskStop only kills the
# npm parent), drop the node_modules junction with rmdir (never recursively), take ownership of files the Codex
# sandbox account created, unlock, `git worktree remove`, delete leftover folder, optionally `git branch -d`.
# Never touches other worktrees, never deletes an unmerged branch (-d, not -D). Run from anywhere.
# Called by: agent-task section 6 step 4, codex-task. Calls: git, cmd rmdir, takeown, icacls.
param(
  [Parameter(Mandatory)][string]$Worktree,
  [string]$Branch
)
$ErrorActionPreference = 'Continue'
$wt = (Resolve-Path -LiteralPath $Worktree).Path.TrimEnd('\')
if ($wt -notmatch '\\\.claude\\worktrees\\[^\\]+$') { throw "Refusing: $wt is not under .claude\worktrees." }

# Run git from the primary checkout, not from inside the folder being deleted.
$primary = (Split-Path -Parent (git -C $wt rev-parse --path-format=absolute --git-common-dir)).Trim()
Set-Location $primary

# 1. Processes holding the folder: match the path with either slash style.
$needles = @($wt, ($wt -replace '\\', '/'))
Get-CimInstance Win32_Process | Where-Object {
  $c = $_.CommandLine; $c -and ($needles | Where-Object { $c.Contains($_) }) -and $_.ProcessId -ne $PID
} | ForEach-Object { Write-Host "Stopping $($_.Name) $($_.ProcessId)"; Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

# 2. Junction first: a recursive delete through it would empty the primary checkout's node_modules.
$nm = Join-Path $wt 'node_modules'
if ((Test-Path $nm) -and ((Get-Item $nm -Force).LinkType -eq 'Junction')) { cmd /c rmdir "`"$nm`"" }

# 3. Files written by the Codex sandbox account are owned by it; take them over so deletion works.
takeown /f $wt /r /d y 2>&1 | Out-Null
icacls $wt /grant "${env:USERNAME}:(OI)(CI)F" /t /c /q 2>&1 | Out-Null

# 4. Unlock (stale Claude session locks), then remove.
git worktree unlock $wt 2>$null
git worktree remove --force --force $wt 2>&1 | ForEach-Object { Write-Host $_ }
if (Test-Path -LiteralPath $wt) { Remove-Item -LiteralPath $wt -Recurse -Force -ErrorAction SilentlyContinue }
git worktree prune
if (Test-Path -LiteralPath $wt) { Write-Host "STILL EXISTS: $wt (something still holds it open)"; exit 1 }
Write-Host "Removed $wt"

if ($Branch) { git branch -d $Branch }
