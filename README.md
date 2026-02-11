# Pixelator

A browser-based photo to pixel art converter. All processing happens locally — no images are uploaded to any server.

## Features

- Adjustable resolution, contrast, and saturation
- 8 color palettes (Sunset Glow, Game Boy, PICO-8, Vaporwave, etc.)
- Floyd-Steinberg, Ordered, or no dithering
- Hold-to-compare original vs. pixelated result
- Example images to try without uploading your own
- PNG download

## Development

```bash
npm install
npm run dev
```

## Adding Examples

Drop `.jpg`, `.jpeg`, `.png`, or `.webp` files into `src/assets/examples/`. They are picked up automatically at build time — no code changes needed. The filename becomes the label (underscores and hyphens become spaces).

## Build

```bash
npm run build
```

Output goes to `dist/`.
