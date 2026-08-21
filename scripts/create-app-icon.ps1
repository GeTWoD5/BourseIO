Add-Type -AssemblyName System.Drawing

$size = 512
$bitmap = [System.Drawing.Bitmap]::new($size, $size)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#07110d'))

$accent = [System.Drawing.ColorTranslator]::FromHtml('#69efb1')
$brush = [System.Drawing.SolidBrush]::new($accent)
$font = [System.Drawing.Font]::new('Segoe UI', 290, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$format = [System.Drawing.StringFormat]::new()
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString('B', $font, $brush, [System.Drawing.RectangleF]::new(0, -26, $size, $size), $format)

$output = Join-Path $PSScriptRoot '..\app-icon-512.png'
$bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
$font.Dispose(); $brush.Dispose(); $format.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
Write-Output $output
