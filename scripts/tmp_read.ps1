$lines = Get-Content 'e:\ai网站\XC-STUDIO\pages\Workspace.tsx'
$start = 1226
$end = 1270
for ($i = $start - 1; $i -lt $end; $i++) {
    Write-Output (($i + 1).ToString() + ': ' + $lines[$i])
}
