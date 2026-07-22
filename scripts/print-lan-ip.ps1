# Print IPv4 addresses useful for Expo device testing (excludes loopback).
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' } |
  Sort-Object InterfaceAlias |
  Format-Table InterfaceAlias, IPAddress, PrefixLength -AutoSize

Write-Host ""
Write-Host "Use a Wi-Fi / Ethernet address (not vEthernet/WSL if phone cannot reach it)."
Write-Host "Example EXPO_PUBLIC_API_URL=http://<IP>:8000/api/v1"
Write-Host "Backend must listen on 0.0.0.0:8000 (not only 127.0.0.1)."
