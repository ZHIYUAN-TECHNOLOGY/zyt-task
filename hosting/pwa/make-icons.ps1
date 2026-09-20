# Prepares brand images for the site from the files taken from zhiyuantech.ai
# (hosting/hub/brand/, see BRAND.md). Run again after refreshing those files.
#   powershell -File C:\Project\ZYT-Task\hosting\pwa\make-icons.ps1
#
#   pwa/icons/icon-192.png, icon-512.png   the site's own app icons, copied
#   pwa/icons/apple-touch-icon.png         the site's own, copied
#   pwa/icons/maskable-512.png             the 512 icon shrunk to 78% on its own navy, so
#                                          round and squircle masks don't clip the mark
#   hub/brand/logo-light-72.png            the light lockup at 72 px tall (page logo, 2x)
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$brand = Join-Path (Split-Path -Parent $PSScriptRoot) 'hub\brand'
$icons = Join-Path $PSScriptRoot 'icons'
New-Item -ItemType Directory -Force $icons | Out-Null

Copy-Item (Join-Path $brand 'manifest-web-app-manifest-192x192.png') (Join-Path $icons 'icon-192.png') -Force
Copy-Item (Join-Path $brand 'manifest-web-app-manifest-512x512.png') (Join-Path $icons 'icon-512.png') -Force
Copy-Item (Join-Path $brand 'apple-touch-icon.png') (Join-Path $icons 'apple-touch-icon.png') -Force

function Save-Resized([System.Drawing.Image]$src, [int]$w, [int]$h, [string]$path, $bg) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.SmoothingMode = 'HighQuality'
  $g.PixelOffsetMode = 'HighQuality'
  if ($bg) { $g.Clear($bg) } else { $g.Clear([System.Drawing.Color]::Transparent) }
  return @{ Bitmap = $bmp; Graphics = $g }
}

# maskable: sample the icon's own ground colour, then draw the icon at 78% in the middle
$icon = [System.Drawing.Image]::FromFile((Join-Path $brand 'manifest-web-app-manifest-512x512.png'))
$ground = ([System.Drawing.Bitmap]$icon).GetPixel(8, 8)
$c = Save-Resized $icon 512 512 $null $ground
$inner = [int](512 * 0.78); $off = [int]((512 - $inner) / 2)
$c.Graphics.DrawImage($icon, $off, $off, $inner, $inner)
$c.Bitmap.Save((Join-Path $icons 'maskable-512.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$c.Graphics.Dispose(); $c.Bitmap.Dispose(); $icon.Dispose()
Write-Output ("icon ground colour: #{0:x2}{1:x2}{2:x2}" -f $ground.R, $ground.G, $ground.B)

# web-sized logo lockup
$logo = [System.Drawing.Image]::FromFile((Join-Path $brand 'logo-light.png'))
$h = 72; $w = [int][Math]::Round($logo.Width * $h / $logo.Height)
$c = Save-Resized $logo $w $h (Join-Path $brand 'logo-light-72.png') $null
$c.Graphics.DrawImage($logo, 0, 0, $w, $h)
$c.Bitmap.Save((Join-Path $brand 'logo-light-72.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$c.Graphics.Dispose(); $c.Bitmap.Dispose(); $logo.Dispose()

# and the white lockup for dark grounds
$logo = [System.Drawing.Image]::FromFile((Join-Path $brand 'logo-dark.png'))
$h = 72; $w = [int][Math]::Round($logo.Width * $h / $logo.Height)
$c = Save-Resized $logo $w $h $null $null
$c.Graphics.DrawImage($logo, 0, 0, $w, $h)
$c.Bitmap.Save((Join-Path $brand 'logo-dark-72.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$c.Graphics.Dispose(); $c.Bitmap.Dispose(); $logo.Dispose()

Get-ChildItem $icons, (Join-Path $brand 'logo-light-72.png'), (Join-Path $brand 'logo-dark-72.png') | Select-Object Name, Length
