"""Rendering helpers for synthetic Golden documents (T-008).

Produces realistic-looking test documents in the five supported formats.
Styles: clean (vector-like), scan (image PDF), photo (phone picture),
handwritten (jittered glyph drawing), blurry (defocused scan).
"""
import csv
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONTS = {
    "sans": "C:/Windows/Fonts/arial.ttf",
    "mono": "C:/Windows/Fonts/consola.ttf",
    "hand": "C:/Windows/Fonts/comic.ttf",
}

def _page_image(lines, style="clean", seed=0, size=(1240, 1754)):
    rng = random.Random(seed)
    img = Image.new("RGB", size, (252, 252, 250) if style != "scan" else (245, 245, 245))
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONTS["hand" if style == "handwritten" else "sans"], 26)
    y = 90
    for line in lines:
        if isinstance(line, tuple):  # (text, style-hint)
            line, hint = line
            if hint == "title":
                font = ImageFont.truetype(FONTS["sans"], 34)
            else:
                font = ImageFont.truetype(FONTS["hand" if style == "handwritten" else "sans"], 26)
        text = str(line)
        if style == "handwritten":
            x = 100
            for ch in text:
                dx, dy = rng.randint(-2, 2), rng.randint(-3, 3)
                draw.text((x + dx, y + dy), ch, font=font, fill=(30, 30, 60))
                x += draw.textlength(ch, font=font) + rng.randint(-1, 2)
        else:
            draw.text((100, y), text, font=font, fill=(20, 20, 20))
        y += 44
        if y > size[1] - 60:
            break
    if style in ("scan", "handwritten"):
        img = img.rotate(rng.uniform(-0.6, 0.6), fillcolor=(250, 250, 250))
        px = img.load()
        for _ in range(1400):  # speckle noise
            x, y = rng.randrange(img.width), rng.randrange(img.height)
            px[x, y] = (rng.randrange(140, 200),) * 3
    if style == "photo":
        img = img.rotate(rng.uniform(-3, 3), expand=False, fillcolor=(238, 238, 238))
        img = Image.eval(img, lambda v: min(255, int(v * rng.uniform(0.94, 1.04))))
    if style == "blurry":
        img = img.filter(ImageFilter.GaussianBlur(radius=3.4))
    return img

def save_pdf(pages, path):
    imgs = [_page_image(*p["args"], seed=p.get("seed", 0)) for p in pages]
    imgs[0].save(path, "PDF", save_all=True, append_images=imgs[1:], resolution=150)

def save_image(page, path, style="clean", seed=0):
    _page_image(page, style=style, seed=seed).save(path, quality=88)

def save_xlsx(rows, path, sheet="Sheet1"):
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = sheet
    for row in rows:
        ws.append(row)
    wb.save(path)

def save_csv(rows, path):
    with open(path, "w", newline="", encoding="utf-8") as fh:
        csv.writer(fh).writerows(rows)

def save_corrupt_pdf(path):
    """A file with a PDF magic header but garbage body — must be rejected as corrupt."""
    import random as _r
    rng = _r.Random(99)
    blob = bytearray(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n")
    blob += bytes(rng.randrange(256) for _ in range(40_000))
    Path(path).write_bytes(bytes(blob))
