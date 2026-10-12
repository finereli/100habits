// Renders scripts/icon.svg to the PNG icons in public/icons. One-off: run with
// `node scripts/make-icons.mjs` after editing the SVG (needs playwright).
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const svg = readFileSync(new URL('./icon.svg', import.meta.url), 'utf8')
const out = new URL('../public/icons/', import.meta.url).pathname
const browser = await chromium.launch()
const page = await browser.newPage()
// [file, size, scale of the mark (maskable keeps it inside the safe zone), rounded corners]
for (const [file, size, mark, radius] of [
  ['icon-192.png', 192, 1, 0.22],
  ['icon-512.png', 512, 1, 0.22],
  ['icon-maskable-512.png', 512, 0.78, 0],
  ['apple-touch-icon.png', 180, 1, 0],
]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px;border-radius:${radius * size}px;overflow:hidden;background:#c4553a;display:grid;place-items:center">
      <div style="width:${size * mark}px;height:${size * mark}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
    </div></body>`)
  await page.screenshot({ path: out + file, omitBackground: true })
}
await browser.close()
