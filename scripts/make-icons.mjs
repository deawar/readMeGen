// scripts/make-icons.mjs
// Regenerate the app icons from code (no binary design assets to maintain).
// Draws a 1024px master PNG with pure-JS pureimage, then packs .ico/.icns
// with pure-JS png2icons. Dev-only: the generated build/icon.{png,ico,icns}
// are committed and consumed by electron-builder; nothing new ships at runtime.
//
//   node scripts/make-icons.mjs
//
// Design: rounded-square (squircle-ish) with an indigo->violet gradient and
// the white Markdown mark (block "M" + down arrow), the universal docs glyph.

import * as PImage from 'pureimage'
import png2icons from 'png2icons'
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const SIZE = 1024
const OUT_DIR = 'build'

// Clockwise rounded-rect subpath (no beginPath — composable into a frame).
function rrCW (ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// Counter-clockwise rounded-rect subpath — opposite winding punches a hole
// inside a CW outer path (nonzero fill rule), yielding a crisp border frame.
function rrCCW (ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y)
  ctx.quadraticCurveTo(x, y, x, y + r)
  ctx.lineTo(x, y + h - r)
  ctx.quadraticCurveTo(x, y + h, x + r, y + h)
  ctx.lineTo(x + w - r, y + h)
  ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - r)
  ctx.lineTo(x + w, y + r)
  ctx.quadraticCurveTo(x + w, y, x + w - r, y)
  ctx.lineTo(x + r, y)
  ctx.closePath()
}

function draw () {
  const img = PImage.make(SIZE, SIZE)
  const ctx = img.getContext('2d')

  // Gradient rounded-square background (transparent corners).
  const g = ctx.createLinearGradient(0, 0, SIZE, SIZE)
  g.addColorStop(0, '#4338ca')
  g.addColorStop(1, '#7c3aed')
  ctx.fillStyle = g
  ctx.beginPath()
  rrCW(ctx, 0, 0, SIZE, SIZE, 230)
  ctx.fill()

  // Markdown mark, authored in its native 208x128 space, centered and scaled.
  const markW = 620
  const markH = (markW * 128) / 208
  const ox = (SIZE - markW) / 2
  const oy = (SIZE - markH) / 2
  const s = markW / 208
  const mx = (x) => ox + x * s
  const my = (y) => oy + y * s

  // Rounded-rect border drawn as a filled frame (outer CW minus inner CCW) —
  // crisper than a thick stroke on curved corners.
  const bw = 11
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  rrCW(ctx, mx(5), my(5), 198 * s, 118 * s, 20 * s)
  rrCCW(ctx, mx(5 + bw), my(5 + bw), (198 - 2 * bw) * s, (118 - 2 * bw) * s, 12 * s)
  ctx.fill()

  // Filled "M" and down-arrow.
  ctx.fillStyle = '#ffffff'
  const fill = (pts) => {
    ctx.beginPath()
    ctx.moveTo(mx(pts[0][0]), my(pts[0][1]))
    for (let i = 1; i < pts.length; i++) ctx.lineTo(mx(pts[i][0]), my(pts[i][1]))
    ctx.closePath()
    ctx.fill()
  }
  fill([[30, 98], [30, 30], [50, 30], [70, 55], [90, 30], [110, 30],
    [110, 98], [90, 98], [90, 59], [70, 84], [50, 59], [50, 98]])
  fill([[155, 98], [125, 65], [145, 65], [145, 30], [165, 30], [165, 65], [185, 65]])

  return img
}

async function main () {
  mkdirSync(OUT_DIR, { recursive: true })
  const img = draw()
  const pngPath = `${OUT_DIR}/icon.png`
  await PImage.encodePNGToStream(img, createWriteStream(pngPath))

  const png = readFileSync(pngPath)
  writeFileSync(`${OUT_DIR}/icon.ico`, png2icons.createICO(png, png2icons.BICUBIC, 0, true))
  writeFileSync(`${OUT_DIR}/icon.icns`, png2icons.createICNS(png, png2icons.BICUBIC, 0))
  console.log('wrote build/icon.png, build/icon.ico, build/icon.icns')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
