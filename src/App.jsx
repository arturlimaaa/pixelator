import { useState, useRef, useCallback, useEffect } from "react";

const PALETTES = {
  sunset: {
    name: "Sunset Glow",
    colors: ["#1a0a2e", "#3d1e6d", "#8b2f97", "#c94277", "#e86547", "#f4a261", "#f7d794", "#faf0ca", "#ffffff"],
  },
  gameboy: {
    name: "Game Boy",
    colors: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"],
  },
  pico8: {
    name: "PICO-8",
    colors: ["#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8", "#ff004d", "#ffa300", "#ffec27", "#00e436", "#29adff", "#83769c", "#ff77a8", "#ffccaa"],
  },
  lospec_twilight: {
    name: "Twilight",
    colors: ["#0e0e12", "#1a1a2e", "#16213e", "#533483", "#e94560", "#f5a623", "#f7d794", "#eaf6f6"],
  },
  vapor: {
    name: "Vaporwave",
    colors: ["#0d0221", "#0f084b", "#26408b", "#a6d9f7", "#f7cad0", "#ff6b97", "#ff3864", "#261447", "#7b2d8e", "#f0f0f0"],
  },
  earthen: {
    name: "Earthen",
    colors: ["#2b2d42", "#3d405b", "#606c38", "#283618", "#dda15e", "#bc6c25", "#fefae0", "#d4a373", "#e9c46a"],
  },
  neon: {
    name: "Neon Noir",
    colors: ["#0a0a0a", "#1a1a2e", "#0f3460", "#16c79a", "#e94560", "#f5a623", "#ff6b6b", "#ee5a24", "#ffffff"],
  },
  pastel: {
    name: "Soft Pastel",
    colors: ["#355070", "#6d597a", "#b56576", "#e56b6f", "#eaac8b", "#e8d5b7", "#f0efeb", "#89b0ae", "#bee3db"],
  },
};

const exampleModules = import.meta.glob("./assets/examples/*.{jpg,jpeg,png,webp}", { eager: true, import: "default" });
const EXAMPLES = Object.entries(exampleModules).map(([path, url]) => {
  const filename = path.split("/").pop().replace(/\.\w+$/, "");
  const label = filename.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return { id: filename, src: url, label };
});

function colorDistance(c1, c2) {
  const r = c1[0] - c2[0];
  const g = c1[1] - c2[1];
  const b = c1[2] - c2[2];
  return r * r + g * g + b * b;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function findClosestColor(rgb, palette) {
  let minDist = Infinity;
  let closest = palette[0];
  for (const color of palette) {
    const dist = colorDistance(rgb, color);
    if (dist < minDist) {
      minDist = dist;
      closest = color;
    }
  }
  return closest;
}

function processImage(img, resolution, paletteKey, dithering, contrast, saturation) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const aspect = img.width / img.height;
  let w, h;
  if (aspect >= 1) {
    w = resolution;
    h = Math.round(resolution / aspect);
  } else {
    h = resolution;
    w = Math.round(resolution * aspect);
  }

  canvas.width = w;
  canvas.height = h;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Apply contrast
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
    data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128));
    data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128));
  }

  // Apply saturation
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = Math.max(0, Math.min(255, gray + saturation * (data[i] - gray)));
    data[i + 1] = Math.max(0, Math.min(255, gray + saturation * (data[i + 1] - gray)));
    data[i + 2] = Math.max(0, Math.min(255, gray + saturation * (data[i + 2] - gray)));
  }

  const paletteRgb = PALETTES[paletteKey].colors.map(hexToRgb);

  if (dithering === "floyd") {
    // Floyd-Steinberg dithering
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const old = pixels[idx];
        const nw = findClosestColor(old, paletteRgb);
        pixels[idx] = nw;

        const err = [old[0] - nw[0], old[1] - nw[1], old[2] - nw[2]];

        const spread = (dx, dy, f) => {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const ni = ny * w + nx;
            pixels[ni] = [
              pixels[ni][0] + err[0] * f,
              pixels[ni][1] + err[1] * f,
              pixels[ni][2] + err[2] * f,
            ];
          }
        };
        spread(1, 0, 7 / 16);
        spread(-1, 1, 3 / 16);
        spread(0, 1, 5 / 16);
        spread(1, 1, 1 / 16);
      }
    }

    for (let i = 0; i < pixels.length; i++) {
      data[i * 4] = Math.max(0, Math.min(255, pixels[i][0]));
      data[i * 4 + 1] = Math.max(0, Math.min(255, pixels[i][1]));
      data[i * 4 + 2] = Math.max(0, Math.min(255, pixels[i][2]));
    }
  } else if (dithering === "ordered") {
    const bayer = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const threshold = ((bayer[y % 4][x % 4] / 16) - 0.5) * 64;
        const r = Math.max(0, Math.min(255, data[i] + threshold));
        const g = Math.max(0, Math.min(255, data[i + 1] + threshold));
        const b = Math.max(0, Math.min(255, data[i + 2] + threshold));
        const closest = findClosestColor([r, g, b], paletteRgb);
        data[i] = closest[0];
        data[i + 1] = closest[1];
        data[i + 2] = closest[2];
      }
    }
  } else {
    // No dithering
    for (let i = 0; i < data.length; i += 4) {
      const closest = findClosestColor([data[i], data[i + 1], data[i + 2]], paletteRgb);
      data[i] = closest[0];
      data[i + 1] = closest[1];
      data[i + 2] = closest[2];
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return { canvas, w, h };
}

function renderUpscaled(sourceCanvas, w, h, scale) {
  const out = document.createElement("canvas");
  out.width = w * scale;
  out.height = h * scale;
  const ctx = out.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceCanvas, 0, 0, w * scale, h * scale);
  return out;
}

const PixelSlider = ({ label, value, onChange, min, max, step = 1, suffix = "" }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
      <span style={{ fontSize: 11, fontFamily: "'Press Start 2P', monospace", color: "#c0b8d4", letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: "'Press Start 2P', monospace", color: "#f4a261" }}>{value}{suffix}</span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{
        width: "100%", height: 6, appearance: "none", background: "linear-gradient(90deg, #3d1e6d, #e94560)",
        borderRadius: 3, outline: "none", cursor: "pointer",
      }}
    />
  </div>
);

const ExampleCard = ({ original, pixelated, label, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: "pointer", textAlign: "center" }}
    >
      <div style={{
        width: 76, height: 76,
        borderRadius: 8,
        border: `1px solid ${hovered ? "#e94560" : "#3d1e6d"}`,
        background: "rgba(26,10,46,0.6)",
        overflow: "hidden",
        position: "relative",
        transform: hovered ? "scale(1.05)" : "scale(1)",
        boxShadow: hovered ? "0 0 20px rgba(233,69,96,0.25)" : "none",
        transition: "all 0.2s",
      }}>
        <img src={pixelated} alt={label} style={{
          width: "100%", height: "100%", objectFit: "cover",
          imageRendering: "pixelated",
          position: "absolute", top: 0, left: 0,
          opacity: hovered ? 0 : 1,
          transition: "opacity 0.3s",
        }} />
        <img src={original} alt={label} style={{
          width: "100%", height: "100%", objectFit: "cover",
          position: "absolute", top: 0, left: 0,
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.3s",
        }} />
      </div>
      <div style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 7,
        color: hovered ? "#f4a261" : "#6b5b8a",
        marginTop: 6,
        transition: "color 0.2s",
      }}>
        {label}
      </div>
    </div>
  );
};

export default function PixelArtConverter() {
  const [image, setImage] = useState(null);
  const [imgEl, setImgEl] = useState(null);
  const [resolution, setResolution] = useState(64);
  const [palette, setPalette] = useState("sunset");
  const [dithering, setDithering] = useState("floyd");
  const [contrast, setContrast] = useState(20);
  const [saturation, setSaturation] = useState(1.3);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [exampleData, setExampleData] = useState([]);
  const fileInputRef = useRef(null);
  const displayRef = useRef(null);

  // Generate pixelated thumbnails for example cards on mount
  useEffect(() => {
    let cancelled = false;
    setExampleData([]);
    EXAMPLES.forEach(({ src, label }) => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        const { canvas, w, h } = processImage(img, 48, "sunset", "floyd", 20, 1.3);
        const scale = Math.max(1, Math.floor(120 / Math.max(w, h)));
        const upscaled = renderUpscaled(canvas, w, h, scale);
        setExampleData(prev => [...prev, { original: src, pixelated: upscaled.toDataURL(), label }]);
      };
      img.src = src;
    });
    return () => { cancelled = true; };
  }, []);

  const loadExample = useCallback((src) => {
    const img = new Image();
    img.onload = () => {
      setImage(src);
      setImgEl(img);
    };
    img.src = src;
  }, []);

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setImage(url);
    const img = new Image();
    img.onload = () => setImgEl(img);
    img.src = url;
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  useEffect(() => {
    if (!imgEl) return;
    const { canvas, w, h } = processImage(imgEl, resolution, palette, dithering, contrast, saturation);
    const scale = Math.max(1, Math.floor(Math.min(512 / w, 512 / h)));
    const upscaled = renderUpscaled(canvas, w, h, scale);
    setResult(upscaled.toDataURL("image/png"));
  }, [imgEl, resolution, palette, dithering, contrast, saturation]);

  const download = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = "pixel-art.png";
    a.click();
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0a0a12 0%, #1a0a2e 40%, #0e0e1a 100%)",
      fontFamily: "'Courier New', monospace",
      color: "#eae6f0",
      padding: "0 0 40px 0",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        padding: "32px 24px 20px",
        textAlign: "center",
        borderBottom: "2px solid #3d1e6d",
        background: "linear-gradient(180deg, rgba(61,30,109,0.3) 0%, transparent 100%)",
      }}>
        <h1 style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 20,
          background: "linear-gradient(90deg, #e94560, #f4a261, #f7d794)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          margin: 0,
          letterSpacing: 2,
          imageRendering: "pixelated",
        }}>
          ✦ PIXELATOR ✦
        </h1>
        <p style={{ fontSize: 12, color: "#8b7aad", marginTop: 8, fontFamily: "'Press Start 2P', monospace", lineHeight: 1.8 }}>
          photo → pixel art converter
        </p>
      </div>
      {/* disclaimer */}
      <div style={{
        textAlign: "center",
        padding: "4px 10px",
      }}>
        disclaimer: no pictures are uploaded to any server, all processing is done locally in your browser!
        <p style={{ color: "#6b5b8a", marginTop: 4 }}>
        if you decide to post them, please credit <a href="https://arturlima.me/projects/pixelator/" style={{ color: "#e94560", textDecoration: "none" }}>pixelator </a> :)
        </p>
      </div>

      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 24,
        maxWidth: 960,
        margin: "0px auto",
        padding: "0 20px",
      }}>
        {/* Controls Panel */}
        <div style={{
          flex: "1 1 280px",
          minWidth: 260,
          background: "rgba(26,10,46,0.6)",
          border: "1px solid #3d1e6d",
          borderRadius: 8,
          padding: 20,
          backdropFilter: "blur(10px)",
        }}>
          {/* Upload */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragOver ? "#e94560" : "#533483"}`,
              borderRadius: 8,
              padding: "28px 16px",
              textAlign: "center",
              cursor: "pointer",
              marginBottom: 20,
              background: dragOver ? "rgba(233,69,96,0.08)" : "rgba(83,52,131,0.1)",
              transition: "all 0.2s",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>🖼</div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#c0b8d4", lineHeight: 1.8 }}>
              {image ? "DROP NEW IMAGE" : "DROP IMAGE HERE"}
            </div>
            <div style={{ fontSize: 10, color: "#6b5b8a", marginTop: 4 }}>or click to browse</div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => handleFile(e.target.files[0])} />
          </div>

          {/* Resolution */}
          <PixelSlider label="RESOLUTION" value={resolution} onChange={setResolution} min={16} max={128} suffix="px" />

          {/* Contrast */}
          <PixelSlider label="CONTRAST" value={contrast} onChange={setContrast} min={-100} max={100} />

          {/* Saturation */}
          <PixelSlider label="SATURATION" value={saturation} onChange={setSaturation} min={0} max={3} step={0.1} suffix="x" />

          {/* Palette */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontFamily: "'Press Start 2P', monospace", color: "#c0b8d4", marginBottom: 8 }}>PALETTE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(PALETTES).map(([key, pal]) => (
                <div
                  key={key}
                  onClick={() => setPalette(key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
                    borderRadius: 6,
                    background: palette === key ? "rgba(233,69,96,0.15)" : "transparent",
                    border: palette === key ? "1px solid #e94560" : "1px solid transparent",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                    {pal.colors.slice(0, 8).map((c, i) => (
                      <div key={i} style={{
                        width: 12, height: 12, background: c, borderRadius: 2,
                        border: "1px solid rgba(255,255,255,0.1)",
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 9, fontFamily: "'Press Start 2P', monospace", color: palette === key ? "#f4a261" : "#8b7aad" }}>
                    {pal.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Dithering */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontFamily: "'Press Start 2P', monospace", color: "#c0b8d4", marginBottom: 8 }}>DITHERING</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[["none", "None"], ["floyd", "Floyd-Steinberg"], ["ordered", "Ordered"]].map(([val, label]) => (
                <button key={val} onClick={() => setDithering(val)} style={{
                  flex: 1, padding: "8px 4px", fontSize: 8, fontFamily: "'Press Start 2P', monospace",
                  background: dithering === val ? "rgba(233,69,96,0.2)" : "rgba(83,52,131,0.2)",
                  border: dithering === val ? "1px solid #e94560" : "1px solid #3d1e6d",
                  color: dithering === val ? "#f4a261" : "#8b7aad",
                  borderRadius: 6, cursor: "pointer", transition: "all 0.15s",
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Preview Panel + Examples */}
        <div style={{
          flex: "1 1 400px",
          display: "flex",
          gap: 16,
        }}>
          {/* Preview */}
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}>
            <div
              ref={displayRef}
              onMouseDown={() => setShowOriginal(true)}
              onMouseUp={() => setShowOriginal(false)}
              onMouseLeave={() => setShowOriginal(false)}
              onTouchStart={() => setShowOriginal(true)}
              onTouchEnd={() => setShowOriginal(false)}
              style={{
                width: "100%",
                aspectRatio: "1",
                maxWidth: 512,
                background: "rgba(26,10,46,0.4)",
                border: "1px solid #3d1e6d",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {!image && (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <div style={{ fontSize: 60, marginBottom: 16, opacity: 0.4 }}>☁</div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#533483", lineHeight: 2 }}>
                    Upload an image<br />to get started
                  </div>
                </div>
              )}
              {image && showOriginal && (
                <img src={image} alt="original" style={{
                  maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
                }} />
              )}
              {image && !showOriginal && result && (
                <img src={result} alt="pixel art" style={{
                  maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
                  imageRendering: "pixelated",
                }} />
              )}
            </div>
            {image && (
              <div style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 8,
                color: "#6b5b8a",
                textAlign: "center",
                lineHeight: 1.8,
              }}>
                HOLD TO SEE ORIGINAL
              </div>
            )}
            {result && (
              <button onClick={download} style={{
                width: "100%", maxWidth: 512, padding: "12px", marginTop: 8,
                fontFamily: "'Press Start 2P', monospace", fontSize: 11,
                background: "linear-gradient(135deg, #e94560, #c94277)",
                border: "none", borderRadius: 6, color: "#fff",
                cursor: "pointer", letterSpacing: 1,
                boxShadow: "0 4px 20px rgba(233,69,96,0.3)",
              }}>
                ⬇ DOWNLOAD PNG
              </button>
            )}
          </div>

          {/* Examples Column */}
          {exampleData.length > 0 && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              overflowY: "auto",
            }}>
              <div style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 7,
                color: "#c0b8d4",
                letterSpacing: 1,
                writingMode: "horizontal-tb",
                textOrientation: "mixed",
                marginBottom: 2,
              }}>
                EXAMPLES
              </div>
              {exampleData.map((ex) => (
                <ExampleCard
                  key={ex.label}
                  original={ex.original}
                  pixelated={ex.pixelated}
                  label={ex.label}
                  onClick={() => loadExample(ex.original)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
