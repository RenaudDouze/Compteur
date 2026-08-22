const { PNG } = require('pngjs')
const fs = require('fs')
const path = require('path')

function drawIcon(size) {
  const png = new PNG({ width: size, height: size })
  const bg = [248, 250, 252] // slate-50
  const accent = [37, 99, 235] // blue-600

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2
      png.data[idx] = bg[0]
      png.data[idx + 1] = bg[1]
      png.data[idx + 2] = bg[2]
      png.data[idx + 3] = 255
    }
  }

  // Draw a simple "+" shape in accent color, centered
  const bar = Math.round(size * 0.12)
  const armLen = Math.round(size * 0.5)
  const cx = size / 2
  const cy = size / 2

  const setPixel = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const idx = (size * y + x) << 2
    png.data[idx] = color[0]
    png.data[idx + 1] = color[1]
    png.data[idx + 2] = color[2]
    png.data[idx + 3] = 255
  }

  for (let y = cy - bar / 2; y < cy + bar / 2; y++) {
    for (let x = cx - armLen / 2; x < cx + armLen / 2; x++) {
      setPixel(Math.round(x), Math.round(y), accent)
    }
  }
  for (let x = cx - bar / 2; x < cx + bar / 2; x++) {
    for (let y = cy - armLen / 2; y < cy + armLen / 2; y++) {
      setPixel(Math.round(x), Math.round(y), accent)
    }
  }

  return png
}

const outDir = path.join(__dirname, '..', 'public')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

for (const size of [192, 512]) {
  const png = drawIcon(size)
  const buffer = PNG.sync.write(png)
  fs.writeFileSync(path.join(outDir, `pwa-${size}x${size}.png`), buffer)
  console.log(`wrote pwa-${size}x${size}.png`)
}
