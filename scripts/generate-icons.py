#!/usr/bin/env python3
"""Generate PWA icons from the same palette as the in-app brand mark."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)


def make(size: int, path: Path) -> None:
    scale = 4
    s = size * scale
    img = Image.new("RGB", (s, s), "#070a10")
    draw = ImageDraw.Draw(img, "RGBA")
    # Soft teal / blue background glow.
    for i in range(5):
        radius = s * (0.55 - i * 0.07)
        alpha = 26 + i * 8
        cx, cy = s * (0.32 + i * 0.04), s * (0.28 + i * 0.03)
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=(80 + i * 12, 220 - i * 8, 210, alpha))
    # Rounded tile overlay.
    margin = s * 0.07
    draw.rounded_rectangle((margin, margin, s - margin, s - margin), radius=s * 0.24,
                           outline=(255, 255, 255, 46), width=max(1, scale * 2))
    # Custom "A" mark.
    cx, cy = s * 0.5, s * 0.52
    w, h = s * 0.27, s * 0.32
    points = [
        (cx, cy - h * 0.55),
        (cx + w, cy + h * 0.55),
        (cx + w * 0.66, cy + h * 0.55),
        (cx + w * 0.44, cy + h * 0.15),
        (cx - w * 0.44, cy + h * 0.15),
        (cx - w * 0.66, cy + h * 0.55),
        (cx - w, cy + h * 0.55),
    ]
    draw.polygon(points, fill=(245, 252, 255, 255))
    draw.rectangle((cx - w * 0.42, cy + h * 0.28, cx + w * 0.42, cy + h * 0.40), fill=(120, 240, 230, 255))
    img = img.resize((size, size), Image.LANCZOS)
    img.save(path, "PNG")
    print("icon", path.name)


for size in (192, 512, 180):
    make(size, OUT / ("apple-touch-icon.png" if size == 180 else f"icon-{size}.png"))
