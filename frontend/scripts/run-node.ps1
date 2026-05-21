param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string] $Script,

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $ScriptArgs
)

$ErrorActionPreference = "Stop"

$localNode = Resolve-Path -LiteralPath "..\.tools\node-v20.19.5-win-x64\node.exe" -ErrorAction SilentlyContinue
$nodeCandidates = @()

if ($env:NODE_EXE) {
  $nodeCandidates += $env:NODE_EXE
}

if ($localNode) {
  $nodeCandidates += $localNode.Path
}

$commandNode = Get-Command node.exe -ErrorAction SilentlyContinue
if ($commandNode) {
  $nodeCandidates += $commandNode.Source
}

foreach ($candidate in $nodeCandidates) {
  if (-not (Test-Path -LiteralPath $candidate)) {
    continue
  }

  try {
    & $candidate $Script @ScriptArgs
    exit $LASTEXITCODE
  } catch {
    continue
  }
}

throw "No usable Node.js runtime was found. Set NODE_EXE or install Node.js 20+."
