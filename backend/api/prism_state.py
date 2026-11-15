"""Pobiera dzisiejszą mapę PRISM (np. tmax) i wycina z niej jeden stan USA (PNG z przezroczystym tłem).

    from prism_state import get_state_map
    png = get_state_map("tmax", "Texas")                                   # bytes (PNG)
    png = get_state_map("tmax", "TX", marker={"lat": 30.27, "lon": -97.74, "label": "Austin"})

Wymaga: Pillow (pip install pillow). Zalecane: pip install truststore (certyfikaty systemu, ważne na Windows).
Pobieranie przez standardową bibliotekę (urllib).
"""
import io
import json
import math
import re
import ssl
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from PIL import Image, ImageChops, ImageDraw, ImageFont

BASE = "https://data.prism.oregonstate.edu/map_graphics/us/an/png/800m"
_DATA = json.loads((Path(__file__).parent / "states.json").read_text(encoding="utf-8"))
WIDTH, HEIGHT = _DATA["width"], _DATA["height"]
SS = 4  # supersampling dla gładkich krawędzi maski i znacznika

# Rzut mapy PRISM: Albers equal-area (równoleżniki 29.5/45.5, środek 23N 96W),
# dopasowany do obrazka 836x646.
_S, _TX, _TY = 1122.52694008, 429.5721394, 633.97253626
_PHI1, _PHI2, _PHI0, _LAM0 = (math.radians(v) for v in (29.5, 45.5, 23, -96))
_N = (math.sin(_PHI1) + math.sin(_PHI2)) / 2
_C = math.cos(_PHI1) ** 2 + 2 * _N * math.sin(_PHI1)
_RHO0 = math.sqrt(_C - 2 * _N * math.sin(_PHI0)) / _N


def lonlat_to_pixel(lon, lat):
    """Współrzędne geograficzne (stopnie) -> piksel (x, y) na mapie PRISM."""
    rho = math.sqrt(_C - 2 * _N * math.sin(math.radians(lat))) / _N
    th = _N * (math.radians(lon) - _LAM0)
    x, y = rho * math.sin(th), _RHO0 - rho * math.cos(th)
    return _S * x + _TX, -_S * y + _TY


@lru_cache(maxsize=None)
def _rings(code):
    """Kontury stanu jako listy punktów (x, y) w pikselach mapy."""
    path = _DATA["states"][code]["path"]
    out = []
    for ring in re.findall(r"M([^Z]+)Z", path):
        out.append([tuple(float(v) for v in p.split(",")) for p in re.split(r"\s*L", ring.strip())])
    return out


def _inside(x, y, rings):
    """Reguła even-odd (jak w SVG): punkt wewnątrz, gdy przecina nieparzysta liczba krawędzi."""
    hit = False
    for ring in rings:
        j = len(ring) - 1
        for i in range(len(ring)):
            xi, yi = ring[i]
            xj, yj = ring[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                hit = not hit
            j = i
    return hit


def state_at(lon, lat):
    """Kod stanu (np. "TX"), w którym leży punkt; ValueError, gdy punkt nie leży w żadnym stanie."""
    x, y = lonlat_to_pixel(lon, lat)
    for code in _DATA["states"]:
        if _inside(x, y, _rings(code)):
            return code
    raise ValueError(f"Współrzędne {lat}, {lon} nie leżą w żadnym ze stanów USA (obsługiwane są 48 stanów + DC)")


def find_state(query):
    """Znajdź stan po kodzie (TX) lub nazwie (Texas), bez względu na wielkość liter."""
    q = str(query).strip().lower()
    for code, s in _DATA["states"].items():
        if code.lower() == q or s["name"].lower() == q:
            return code, s
    raise ValueError(f'Nieznany stan: "{query}" (dostępne 48 stanów + DC)')


def prism_url(variable, day):
    ymd = day.strftime("%Y%m%d")
    return f"{BASE}/{variable}/daily/{day.year}/prism_{variable}_us_30s_{ymd}_076dpi.png"


def _ssl_context():
    """Kontekst SSL: najpierw magazyn certyfikatów systemu (działa za antywirusem/proxy na Windows),
    potem certifi, na końcu domyślny. Weryfikacja certyfikatu jest zawsze włączona."""
    try:
        import truststore  # pip install truststore
        return truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    except ImportError:
        pass
    try:
        import certifi  # pip install certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def _fetch_latest(variable, max_days_back):
    day = datetime.now(timezone.utc)
    for _ in range(max_days_back + 1):
        url = prism_url(variable, day)
        try:
            with urlopen(Request(url, headers={"User-Agent": "prism-state/1.0"}), timeout=20, context=_ssl_context()) as r:
                return r.read(), day.strftime("%Y-%m-%d")
        except HTTPError as e:
            if e.code != 404:
                raise
        day -= timedelta(days=1)
    raise FileNotFoundError(f'Brak mapy "{variable}" z ostatnich {max_days_back + 1} dni')


@lru_cache(maxsize=64)
def _state_mask(code):
    """Maska stanu (tryb L, rozmiar mapy), reguła even-odd jak w SVG."""
    path = _DATA["states"][code]["path"]
    big = Image.new("L", (WIDTH * SS, HEIGHT * SS), 0)
    for ring in re.findall(r"M([^Z]+)Z", path):
        pts = [tuple(float(v) * SS for v in p.split(",")) for p in re.split(r"\s*L", ring.strip())]
        layer = Image.new("L", big.size, 0)
        ImageDraw.Draw(layer).polygon(pts, fill=255)
        big = ImageChops.logical_xor(big.point(lambda v: 255 if v else 0).convert("1"),
                                     layer.convert("1")).convert("L")
    return big.resize((WIDTH, HEIGHT), Image.LANCZOS)


def _font(size):
    for name in ("DejaVuSans-Bold.ttf", "Arial Bold.ttf", "arialbd.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default(size) if hasattr(ImageFont, "load_default") else ImageFont.load_default()


def _marker_layer(size, x, y, color, radius, label):
    w, h = size
    big = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    r = radius * SS
    d.ellipse([x * SS - r - 2 * SS, y * SS - r - 2 * SS, x * SS + r + 2 * SS, y * SS + r + 2 * SS], fill="white")
    d.ellipse([x * SS - r, y * SS - r, x * SS + r, y * SS + r], fill=color)
    if label:
        d.text(((x + radius + 4) * SS, y * SS), str(label), font=_font(13 * SS), fill="black",
               stroke_width=3 * SS // 2, stroke_fill="white", anchor="lm")
    return big.resize((w, h), Image.LANCZOS)


def get_state_map(variable, state, marker=None, image_bytes=None, max_days_back=7, out_file=None, return_date=False):
    """
    variable   zmienna PRISM, np. "tmax", "tmin", "ppt"
    state      kod lub nazwa stanu, np. "TX" / "Texas"; None = wykryj stan ze współrzędnych markera
    marker     opcjonalnie {"lat":..., "lon":..., "label":"...", "color":"#e00000", "radius":5}
    image_bytes  użyj tego obrazka zamiast pobierać (np. do testów)
    return_date  zwróć krotkę (png, "RRRR-MM-DD"); data jest None, gdy podano image_bytes
    Zwraca bajty PNG z wyciętym stanem.
    """
    if state is None:
        if not marker:
            raise ValueError("Podaj stan albo współrzędne (marker)")
        code = state_at(marker["lon"], marker["lat"])
    else:
        code, _ = find_state(state)
    raw, map_date = (image_bytes, None) if image_bytes is not None else _fetch_latest(variable, max_days_back)
    img = Image.open(io.BytesIO(raw)).convert("RGBA")
    if img.size != (WIDTH, HEIGHT):
        raise ValueError(f"Nieoczekiwany rozmiar obrazka {img.size} (oczekiwano {(WIDTH, HEIGHT)})")

    # Piksel zostaje tylko w obrębie stanu i tylko gdy nie jest białym tłem (morze, jeziora)
    rgb = img.convert("RGB")
    white = ImageChops.darker(ImageChops.darker(*rgb.split()[:2]), rgb.split()[2]).point(
        lambda v: 255 if v > 240 else 0)
    alpha = ImageChops.multiply(_state_mask(code), ImageChops.invert(white))
    img.putalpha(alpha)
    bbox = alpha.point(lambda v: 255 if v > 127 else 0).getbbox()
    if not bbox:
        raise ValueError(f"Stan {code} nie znaleziony na obrazku")
    left, top, right, bottom = bbox

    mk = None
    if marker:
        px, py = lonlat_to_pixel(marker["lon"], marker["lat"])
        if not (0 <= px < WIDTH and 0 <= py < HEIGHT):
            raise ValueError(f'Współrzędne {marker["lat"]}, {marker["lon"]} leżą poza mapą USA')
        radius = marker.get("radius", 5)
        pad = radius + 3
        label_w = 8 * len(str(marker["label"])) + 12 if marker.get("label") else 0
        left, top = max(0, min(left, int(px - pad))), max(0, min(top, int(py - pad)))
        right, bottom = min(WIDTH, max(right, math.ceil(px + pad + label_w) + 1)), min(HEIGHT, max(bottom, math.ceil(py + pad) + 1))
        mk = (px - left, py - top, marker.get("color", "#e00000"), radius, marker.get("label"))

    out = img.crop((left, top, right, bottom))
    if mk:
        out = Image.alpha_composite(out, _marker_layer(out.size, *mk))

    buf = io.BytesIO()
    out.save(buf, "PNG")
    data = buf.getvalue()
    if out_file:
        Path(out_file).write_bytes(data)
    return (data, map_date) if return_date else data


def _legend_box(img):
    """Prostokąt legendy PRISM w lewym dolnym rogu: (lewo, góra, prawo, dół).
    Legenda ma jasnoszarą ramkę: szukamy od dołu poziomej linii ramki, potem idziemy w górę po jej lewym brzegu.
    Działa dla różnych rozmiarów legendy i obrazka."""
    w, h = img.size
    px = img.convert("RGB").load()

    def gray(x, y):
        r, g, b = px[x, y]
        return r == g == b and 185 <= r <= 235

    for y in range(h - 1, h // 2, -1):          # dolna krawędź: długi poziomy odcinek szarości
        x = 0
        while x < w:
            if gray(x, y):
                start = x
                while x < w and gray(x, y):
                    x += 1
                if x - start >= 100 and start < w // 3:
                    left, right, bottom = start, x - 1, y
                    top = bottom
                    col = left + 1 if gray(left + 1, bottom - 5) else left   # kolumna lewej ramki
                    while top > h // 3 and gray(col, top - 1):
                        top -= 1
                    if bottom - top >= 40:
                        return max(0, left - 1), max(0, top - 1), min(w, right + 2), min(h, bottom + 2)
            else:
                x += 1
    return 4, 497, 271, 642                     # awaryjnie: położenie z mapy tmax


def get_legend(variable, image_bytes=None, max_days_back=7):
    """Wycina legendę z oryginalnego obrazka PRISM danej zmiennej. Zwraca (png_bytes, data)."""
    raw, map_date = (image_bytes, None) if image_bytes is not None else _fetch_latest(variable, max_days_back)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    buf = io.BytesIO()
    img.crop(_legend_box(img)).save(buf, "PNG")
    return buf.getvalue(), map_date