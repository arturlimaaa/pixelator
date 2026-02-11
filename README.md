# Pixelator

browser-based photo to pixel art converter. all processing happens locally so no images are uploaded to any server :)

## Features

- Adjustable resolution, contrast, and saturation
- 8 color palettes (Sunset Glow, Game Boy, PICO-8, Vaporwave, etc.)
- Floyd-Steinberg, Ordered, or no dithering
- Hold-to-compare original vs. pixelated result
- Example images to try without uploading your own
- PNG download

## Running

```bash
npm install
npm run dev
```

## If you want to add Image Examples

Drop `.jpg`, `.jpeg`, `.png`, or `.webp` files into `src/assets/examples/`. They are picked up automatically at build time — no code changes needed. The filename becomes the label (underscores and hyphens become spaces).

## Build

```bash
npm run build
```

Output then goes to `dist/`.