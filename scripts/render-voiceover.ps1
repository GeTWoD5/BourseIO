param(
  [Parameter(Mandatory = $true)]
  [string]$TextPath,
  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

Add-Type -AssemblyName System.Speech
$text = Get-Content -LiteralPath $TextPath -Raw -Encoding UTF8
$synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer

try {
  $frenchVoice = $synthesizer.GetInstalledVoices() |
    Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'fr-*' } |
    Select-Object -First 1
  if ($frenchVoice) {
    $synthesizer.SelectVoice($frenchVoice.VoiceInfo.Name)
  }
  $synthesizer.Rate = -1
  $synthesizer.Volume = 96
  $synthesizer.SetOutputToWaveFile($OutputPath)
  $synthesizer.Speak($text)
} finally {
  $synthesizer.Dispose()
}
