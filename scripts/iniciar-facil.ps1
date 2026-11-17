# Rotas Vivas: launcher local no Windows 10/11 64-bit.
# Baixa Node.js SOMENTE se uma versão compatível não existir e verifica SHA-256.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Port = 3000
$Url = "http://localhost:$Port"
$NodeVersion = 'v22.16.0'
$ArchiveName = 'node-v22.16.0-win-x64.zip'
$ExpectedHash = '21c2d9735c80b8f86dab19305aa6a9f6f59bbc808f68de3eef09d5832e3bfbbd'
$RuntimeRoot = Join-Path $Root '.runtime'
$NodePath = Join-Path $RuntimeRoot 'node-v22.16.0-win-x64\node.exe'
$DataDir = Join-Path $Root 'data'
New-Item -ItemType Directory -Path $DataDir -Force | Out-Null

function Test-Game {
  try {
    $response = Invoke-RestMethod -Uri "$Url/health" -TimeoutSec 2
    return ($response.ok -eq $true -and $null -ne $response.rooms)
  } catch { return $false }
}

if (Test-Game) {
  Write-Host "O jogo ja esta ativo. Abrindo no navegador..." -ForegroundColor Green
  Start-Process $Url
  exit 0
}

$node = $null
try {
  $systemNode = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($systemNode) {
    $major = [int]((& $systemNode.Source -v) -replace '^v(\d+).*','$1')
    if ($major -ge 22) { $node = $systemNode.Source }
  }
} catch { }

if (-not $node) {
  if (!(Test-Path $NodePath)) {
    Write-Host 'Preparando o motor do jogo (primeira execucao)...' -ForegroundColor Yellow
    Write-Host 'Apenas o Node.js oficial sera baixado de nodejs.org e verificado por SHA-256.'
    New-Item -ItemType Directory -Path $RuntimeRoot -Force | Out-Null
    $zip = Join-Path $RuntimeRoot $ArchiveName
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/download/release/v22.16.0/$ArchiveName" -OutFile $zip
    $hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hash -ne $ExpectedHash) {
      Remove-Item $zip -ErrorAction SilentlyContinue
      throw 'Integridade do download nao confere com o arquivo oficial. Operacao interrompida.'
    }
    Expand-Archive -LiteralPath $zip -DestinationPath $RuntimeRoot -Force
    Remove-Item $zip -ErrorAction SilentlyContinue
  }
  if (!(Test-Path $NodePath)) { throw 'Nao foi possivel preparar o motor do jogo.' }
  $node = $NodePath
}

Write-Host 'Iniciando o jogo local...' -ForegroundColor Green
$env:DATA_DIR = $DataDir
$env:PORT = "$Port"
$out = Join-Path $DataDir 'server-out.log'
$err = Join-Path $DataDir 'server-error.log'
$null = Start-Process -FilePath $node -ArgumentList 'server.js' -WorkingDirectory $Root -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
for ($i=0; $i -lt 35; $i++) {
  if (Test-Game) {
    Write-Host 'Jogo iniciado com sucesso!' -ForegroundColor Green
    Start-Process $Url
    exit 0
  }
  Start-Sleep -Milliseconds 550
}
throw "O servidor nao respondeu. Verifique $err e se a porta 3000 esta livre."
