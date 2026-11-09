# Telefonda test için küçük web sunucusu (Python/Node gerekmez)
param([int]$Port = 8080)

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$types = @{
  '.html'        = 'text/html; charset=utf-8'
  '.css'         = 'text/css; charset=utf-8'
  '.js'          = 'application/javascript; charset=utf-8'
  '.json'        = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.svg'         = 'image/svg+xml'
  '.png'         = 'image/png'
}

$listener = New-Object System.Net.Sockets.TcpListener -ArgumentList ([System.Net.IPAddress]::Any), $Port
$listener.Start()
Write-Host ""
Write-Host "  Makyaj Studyosu calisiyor"
Write-Host "  Bilgisayar : http://localhost:$Port/"
Write-Host "  Telefon    : http://<bilgisayarin-ip-adresi>:$Port/   (ayni Wi-Fi aginda)"
Write-Host "  Kapatmak icin Ctrl+C"
Write-Host ""

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    # yarı açık / boşta bekleyen bağlantı sunucuyu kilitlemesin
    $client.ReceiveTimeout = 4000
    $stream = $client.GetStream()
    $stream.ReadTimeout = 4000
    $stream.WriteTimeout = 5000
    $reader = New-Object System.IO.StreamReader -ArgumentList $stream
    $requestLine = $reader.ReadLine()
    if ($requestLine) {
      while ($true) {
        $line = $reader.ReadLine()
        if ($null -eq $line -or $line -eq '') { break }
      }
      $parts = $requestLine.Split(' ')
      $path = if ($parts.Length -ge 2) { $parts[1] } else { '/' }
      $path = $path.Split('?')[0]
      if ($path -eq '/') { $path = '/index.html' }
      elseif ($path.EndsWith('/')) { $path = $path + 'index.html' }
      $rel = $path.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
      $file = Join-Path $root $rel

      if ((Test-Path -LiteralPath $file -PathType Leaf) -and ($file.StartsWith($root))) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
        $ct = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
        $head = "HTTP/1.1 200 OK`r`nContent-Type: $ct`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
        $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
        $stream.Write($hb, 0, $hb.Length)
        $stream.Write($bytes, 0, $bytes.Length)
      } else {
        $body = [System.Text.Encoding]::UTF8.GetBytes('Bulunamadi')
        $head = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
        $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
        $stream.Write($hb, 0, $hb.Length)
        $stream.Write($body, 0, $body.Length)
      }
    }
  } catch {
  } finally {
    $client.Close()
  }
}
