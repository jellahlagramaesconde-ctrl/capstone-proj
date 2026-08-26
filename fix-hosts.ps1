# fix-hosts.ps1
# Right-click this file and select "Run with PowerShell" as Administrator
# OR open an Admin PowerShell and run: .\fix-hosts.ps1

# Check for admin privileges
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell -> Run as Administrator, then run this script again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

$hostsPath = "C:\Windows\System32\drivers\etc\hosts"

# Read current hosts file
$content = Get-Content $hostsPath -Raw

# Remove any existing jors.cosca.local entries (including commented ones with the IP)
$content = $content -replace '(?m)^\s*\d+\.\d+\.\d+\.\d+\s+jors\.cosca\.local\s*$', ''

# Clean up extra blank lines
$content = $content -replace '(\r?\n){3,}', "`r`n`r`n"
$content = $content.TrimEnd()

# Add the correct entry pointing to 127.0.0.1
$content += "`r`n`r`n# JORS COSCA - always use localhost so it works on any network`r`n127.0.0.1       jors.cosca.local`r`n"

Set-Content -Path $hostsPath -Value $content -Force -Encoding ASCII

Write-Host "SUCCESS: hosts file updated!" -ForegroundColor Green
Write-Host "jors.cosca.local now points to 127.0.0.1 (localhost)" -ForegroundColor Green
Write-Host ""

# Flush DNS cache
ipconfig /flushdns

Write-Host ""
Write-Host "You can now access jors.cosca.local:5173 in your browser." -ForegroundColor Cyan
Read-Host "Press Enter to exit"
