$f = 'e:\ai网站\XC-STUDIO\pages\Workspace.tsx'
$lines = [System.IO.File]::ReadAllLines($f)
for ($i = 0; $i -lt $lines.Length; $i++) {
    $l = $lines[$i]
    if ($l -match 'addGenImage|handleSend|processMessage') {
        Write-Output "$($i+1): $($l.Substring(0, [Math]::Min(120, $l.Length)))"
    }
}
