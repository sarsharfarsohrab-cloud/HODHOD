#!/usr/bin/env python3
"""Cut the Hodhod mascot sheets into normalised transparent poses, a wing-flap
sprite and the PWA icons.

Usage (run with `python3 -I`):
  python3 -I scripts/mascot/cut.py \
      --expressions SHEET_4x3.png --objects SHEET_3x3.png \
      --fly FLAP_6x1.png --icon ICON.png \
      [--out public] [--check DIR]

Any of the four inputs may be omitted; only the matching outputs are written.
--check renders verification contact sheets (light #f1f1f9 / dark #131127).
"""
import argparse
import io
import os

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

EXPRESSIONS = ["idle", "morning", "happy", "celebrating", "proud", "thinking",
               "encouraging", "sad", "comforting", "surprised", "sleepy", "confused"]
OBJECTS = ["reading", "card", "writing", "teacher", "streak", "trophy",
           "waiting", "goodbye", "pointing"]

LIGHT = (0xF1, 0xF1, 0xF9)
DARK = (0x13, 0x11, 0x27)

STRICT_T = 12     # whiteness distance (255-min(rgb)) of the paper itself
SHADOW_REACH = 34  # ground shadow: paper must be within this many px below
GLOW_REACH = 60    # px around a flame where light on the paper becomes glow
BAND = 3          # px of anti-aliased edge on each side of the cut
POSE_SIZE = 512
BASELINE = 0.06   # feet this fraction above the bottom
FLY_SIZE = 384
WEBP_Q = 82
WEBP_BUDGET = 45 * 1024


# --------------------------------------------------------------------------
# background removal
# --------------------------------------------------------------------------
def remove_background(rgb_u8):
    """Return float RGBA (0..1 alpha, 0..255 colour) with the border-connected
    near-white background removed and a decontaminated anti-aliased edge."""
    rgb = rgb_u8.astype(np.float32)
    h, w, _ = rgb.shape
    dist_white = 255.0 - rgb.min(axis=2)
    spread = rgb.max(axis=2) - rgb.min(axis=2)

    def border_connected(mask):
        lab, _ = ndi.label(mask)
        ids = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
        return np.isin(lab, ids[ids > 0])

    disk = lambda r: (np.hypot(*np.mgrid[-r:r + 1, -r:r + 1]) <= r + 0.3)
    # 1) the paper itself: strictly near-white, connected to the border
    strict = dist_white < STRICT_T
    bg_paper = border_connected(strict)
    # enclosed paper pockets (e.g. between wing and head) -- blobs only, so the
    # 1-2 px light rims around the held card / book pages are not punched out
    #    Paper is neutral (spread ~1); a flame's white-hot core is not.
    paperlike = strict & (spread <= 4) & (dist_white <= 8)
    #    Eye catchlights are pure white too: they sit in a dark pupil, whereas a
    #    paper pocket is ringed by bright orange/cream feathers.
    lum = rgb.mean(axis=2)
    cand = ndi.binary_opening(paperlike & ~bg_paper, structure=disk(1))
    plab, pn = ndi.label(cand)
    for i, sl in enumerate(ndi.find_objects(plab), start=1):
        if sl is None:
            continue
        ys, xs = sl
        y0, y1 = max(ys.start - 4, 0), min(ys.stop + 4, h)
        x0, x1 = max(xs.start - 4, 0), min(xs.stop + 4, w)
        comp = plab[y0:y1, x0:x1] == i
        area = comp.sum()
        fill = area / ((ys.stop - ys.start) * (xs.stop - xs.start))
        ring = ndi.binary_dilation(comp, structure=disk(2)) & ~comp
        rl = lum[y0:y1, x0:x1][ring]
        rc = rgb[y0:y1, x0:x1][ring]
        bright = (rl > 140).mean()
        # eye whites border a warm black/brown iris; wings are blue-black
        eyeish = ((rl < 110) & (rc[:, 0] >= rc[:, 2] - 3)).mean()
        if area >= 6 and fill > 0.3 and bright > 0.35 and eyeish < 0.04:
            grow = ndi.binary_dilation(comp, structure=disk(1)) & paperlike[y0:y1, x0:x1]
            bg_paper[y0:y1, x0:x1] |= grow
    # 2) ground shadow: greyish pixels with paper a short way straight below
    #    them (so a pale prop like the blank card is never flooded).
    down = np.full((h, w), 10 ** 6, np.int32)
    run = np.full(w, 10 ** 6, np.int32)
    for y in range(h - 1, -1, -1):
        run = np.where(bg_paper[y], 0, run + 1)
        down[y] = run
    greyish = (spread <= 0.5 * dist_white + 4) & (dist_white < 150)
    # warm ambient light/occlusion right on the ground line
    warm_ground = (spread <= 0.6 * dist_white + 8) & (dist_white < 100) & (down <= 20)
    soft = (greyish & (down <= SHADOW_REACH)) | warm_ground
    soft_open = ndi.binary_opening(soft, structure=disk(2))
    lab, _ = ndi.label(soft_open | bg_paper)
    keep = np.unique(lab[bg_paper])
    grown = np.isin(lab, keep[keep > 0]) & ~bg_paper
    # 3) light emitted by a flame onto the paper: keep it as a soft, semi-
    #    transparent warm glow instead of an opaque cream blob.
    emit = (rgb[..., 0] > 248) & (rgb[..., 1] > 195) & (rgb[..., 2] < 175)
    emit = ndi.binary_opening(emit, structure=disk(2))
    elab, en = ndi.label(emit)
    if en:
        areas = ndi.sum(emit, elab, np.arange(1, en + 1))
        emit = np.isin(elab, 1 + np.nonzero(areas >= 800)[0])
        if os.environ.get("MASCOT_DEBUG"):
            print("emitters", [(int(a), tuple(int(v) for v in c)) for a, c in
                               zip(areas, ndi.center_of_mass(emit if False else elab > 0, elab, np.arange(1, en + 1))) if a >= 800])
    glow_a = np.zeros((h, w), np.float32)
    glow_rgb = np.zeros_like(rgb)
    if emit.any():
        edist = ndi.distance_transform_edt(~emit)
        zone = edist <= GLOW_REACH
        glowish = zone & (dist_white < 110) & (rgb[..., 0] > 228) & ~emit & ~bg_paper
        lab, _ = ndi.label(glowish | bg_paper)
        keep = np.unique(lab[bg_paper])
        glow = np.isin(lab, keep[keep > 0]) & glowish
        region = glow | (bg_paper & zone)
        G = np.array([255, 205, 95], np.float32)
        wg = 255 - G
        proj = ((255 - rgb) * wg).sum(axis=2) / (wg ** 2).sum()
        ga = np.clip(1.6 * proj, 0, 1) * region
        ga = ndi.gaussian_filter(ga, 1.5) * region
        ga *= np.clip((GLOW_REACH - edist) / 25.0, 0, 1)  # fade out at the zone edge
        dec = np.clip(255 - (255 - rgb) / np.maximum(ga, 1e-3)[..., None], 0, 255)
        t = np.clip((ga - 0.5) / 0.4, 0, 1)[..., None]
        gcol = G * (1 - t) + dec * t
        glow_a[region] = ga[region]
        glow_rgb[region] = gcol[region]
        bg_paper = bg_paper | glow
    # small pale specks left on the ground line become part of the shadow layer
    pale = ~(bg_paper | grown) & (dist_white < 45) & (down <= 20)
    plab, pn = ndi.label(pale)
    if pn:
        idx = np.arange(1, pn + 1)
        parea = ndi.sum(pale, plab, idx)
        touch = ndi.maximum(ndi.binary_dilation(bg_paper | grown), plab, idx)
        grown |= np.isin(plab, idx[(parea < 80) & (touch > 0)])
    bg = bg_paper | grown
    fg = ~bg
    # shadow layer: grey, multiplied-looking -> semi-transparent dark
    shade = np.zeros((h, w), np.float32)
    lum = rgb.mean(axis=2)
    shade[grown] = np.clip((250.0 - lum[grown]) / 255.0 * 1.15, 0, 0.55)

    # distance (px) from each pixel to the other side of the cut
    d_in = ndi.distance_transform_edt(fg)   # fg pixels: distance to bg
    d_out = ndi.distance_transform_edt(bg)  # bg pixels: distance to fg

    # foreground colour estimate F near the edge: normalised blur of interior
    interior = (d_in > BAND).astype(np.float32)
    sig = 4.0
    wsum = ndi.gaussian_filter(interior, sig)
    F = np.empty_like(rgb)
    for c in range(3):
        F[..., c] = ndi.gaussian_filter(rgb[..., c] * interior, sig)
    with np.errstate(invalid="ignore", divide="ignore"):
        F /= wsum[..., None]
    # fall back to the pixel itself where no interior is near
    weak = wsum < 1e-3
    F[weak] = rgb[weak]

    W = 255.0
    wf = W - F
    wc = W - rgb
    denom = (wf ** 2).sum(axis=2)
    with np.errstate(invalid="ignore", divide="ignore"):
        a_proj = (wc * wf).sum(axis=2) / denom
    a_proj = np.clip(np.nan_to_num(a_proj), 0, 1)

    alpha = np.where(fg, 1.0, 0.0).astype(np.float32)
    edge_fg = fg & (d_in <= BAND)
    edge_bg = bg & (d_out <= 2) & ~weak
    reliable = denom > 900  # F clearly different from white
    # fg side: projected alpha, but never punch holes in pale interior colours
    alpha[edge_fg & reliable] = np.maximum(a_proj, 0.0)[edge_fg & reliable]
    # on the fg side keep pixels fairly solid as we move inward
    ramp = np.clip(d_in / BAND, 0, 1)
    alpha = np.where(edge_fg & reliable, np.maximum(alpha, ramp ** 2), alpha)
    alpha[edge_bg] = (a_proj * (a_proj > 0.12))[edge_bg]

    # decontaminate: un-mix white from edge pixels
    col = rgb.copy()
    edge = (edge_fg | edge_bg) & (alpha > 0)
    with np.errstate(invalid="ignore", divide="ignore"):
        dec = W - (W - rgb) / np.maximum(alpha, 1e-3)[..., None]
    dec = np.clip(dec, 0, 255)
    t = np.clip((alpha - 0.25) / 0.55, 0, 1)[..., None]
    mix = F * (1 - t) + dec * t
    col[edge] = mix[edge]
    # merge the shadow layer underneath the bird
    sh = shade * (1 - alpha)
    total = alpha + sh
    shadow_rgb = np.array([34, 28, 40], np.float32)
    with np.errstate(invalid="ignore", divide="ignore"):
        col = (col * alpha[..., None] + shadow_rgb * sh[..., None]) / np.maximum(total, 1e-6)[..., None]
    # and the flame glow on top of the shadow layer (both live on the paper)
    ga = glow_a * (1 - alpha)
    t2 = total + ga * (1 - total)
    with np.errstate(invalid="ignore", divide="ignore"):
        col = (col * total[..., None] * (1 - ga[..., None]) + glow_rgb * ga[..., None]) \
            / np.maximum(t2, 1e-6)[..., None]
    total = t2
    total[total < 0.012] = 0
    return np.dstack([col, total])


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def to_image(rgba_f):
    a = np.clip(rgba_f[..., 3] * 255 + 0.5, 0, 255).astype(np.uint8)
    rgb = np.clip(rgba_f[..., :3] + 0.5, 0, 255).astype(np.uint8)
    rgb[a == 0] = 0
    return Image.fromarray(np.dstack([rgb, a]), "RGBA")


def resize_rgba(im, size):
    """Resize with premultiplied alpha (no dark/white fringes)."""
    return im.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def components_by_cell(alpha, cols, rows, min_area=12):
    """Label foreground groups and assign them to grid cells by centroid."""
    h, w = alpha.shape
    grown = ndi.binary_dilation(alpha > 0.02, iterations=2)
    lab, n = ndi.label(grown, structure=np.ones((3, 3)))
    idx = np.arange(1, n + 1)
    area = ndi.sum(alpha, lab, idx)
    cy, cx = np.array(ndi.center_of_mass(alpha, lab, idx)).T if n else ([], [])
    cells = {}
    for i, a, y, x in zip(idx, area, cy, cx):
        if a < min_area or not np.isfinite(x):
            continue
        c = min(int(x / (w / cols)), cols - 1)
        r = min(int(y / (h / rows)), rows - 1)
        cells.setdefault(r * cols + c, []).append((int(i), float(a)))
    return lab, cells


def cut_cells(rgba, cols, rows):
    """Return list (cell order) of dicts: crop (float rgba), box, main-bottom."""
    lab, cells = components_by_cell(rgba[..., 3], cols, rows)
    out = []
    for k in range(cols * rows):
        comps = cells.get(k, [])
        if not comps:
            raise SystemExit(f"cell {k}: no figure found")
        ids = [c[0] for c in comps]
        main = max(comps, key=lambda c: c[1])[0]
        m = np.isin(lab, ids)
        a = rgba[..., 3] * m
        ys, xs = np.nonzero(a > 0.004)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        crop = rgba[y0:y1, x0:x1].copy()
        crop[..., 3] = a[y0:y1, x0:x1]
        # feet: lowest solid row of the main (bird) component
        mm = (lab[y0:y1, x0:x1] == main) & (crop[..., 3] > 0.5)
        rows_any = np.nonzero(mm.sum(axis=1) >= 3)[0]
        out.append(dict(crop=crop, box=(x0, y0, x1, y1), feet=y0 + rows_any.max() + 1,
                        main_box=_bbox(mm, x0, y0), ncomp=len(comps)))
    return out


def _bbox(mask, ox, oy):
    ys, xs = np.nonzero(mask)
    return (ox + xs.min(), oy + ys.min(), ox + xs.max() + 1, oy + ys.max() + 1)


def save_pair(im, base, budget=WEBP_BUDGET):
    im.save(base + ".png", optimize=True)
    q = WEBP_Q
    while True:
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=q, method=6, alpha_quality=90)
        if buf.tell() <= budget or q <= 60:
            break
        q -= 4
    with open(base + ".webp", "wb") as f:
        f.write(buf.getvalue())
    return q, buf.tell()


# --------------------------------------------------------------------------
# poses
# --------------------------------------------------------------------------
def layout_sheet(cells, cols, rows, size=POSE_SIZE):
    """One scale per sheet; feet on a common baseline; centred horizontally."""
    base_y = size * (1 - BASELINE)
    margin = size * 0.02
    # ground line per row = median feet; elevated (jumping) poses keep their lift
    for r in range(rows):
        row = cells[r * cols:(r + 1) * cols]
        med = float(np.median([c["feet"] for c in row]))
        for c in row:
            lift = med - c["feet"]          # >0: feet above the row's ground line
            c["ground"] = med if lift > 15 else c["feet"]
    scale = 1e9
    for c in cells:
        x0, y0, x1, y1 = c["box"]
        g = c["ground"]
        scale = min(scale,
                    (size - 2 * margin) / (x1 - x0),
                    (base_y - margin) / max(g - y0, 1),
                    (size - margin - base_y) / max(y1 - g, 1e-3) if y1 > g else 1e9)
    placed = []
    for c in cells:
        x0, y0, x1, y1 = c["box"]
        crop = to_image(c["crop"])
        w = max(1, round((x1 - x0) * scale))
        h = max(1, round((y1 - y0) * scale))
        im = resize_rgba(crop, (w, h))
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        px = round((size - w) / 2)
        py = round(base_y - (c["ground"] - y0) * scale)
        py = min(max(py, round(margin)), size - h)
        canvas.alpha_composite(im, (px, py))
        placed.append(canvas)
    return placed, scale


# --------------------------------------------------------------------------
# fly sprite
# --------------------------------------------------------------------------
def orange_mask(rgb, alpha):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (alpha > 0.9) & (r > 170) & (g > 70) & (g < 200) & (b < 110) & (r - b > 110)


def fly_frames(rgba):
    cells = cut_cells(rgba, 6, 1)
    full = rgba
    # coarse anchor: centroid of the orange (crest/head/body) pixels
    anchors = []
    gray = (full[..., :3] * full[..., 3:4] + 255 * (1 - full[..., 3:4])).mean(axis=2)
    for c in cells:
        x0, y0, x1, y1 = c["box"]
        om = orange_mask(c["crop"][..., :3], c["crop"][..., 3])
        cy, cx = ndi.center_of_mass(om)
        anchors.append([x0 + cx, y0 + cy])
    anchors = np.array(anchors)
    # refine by matching the face patch of frame 0 (eyes/beak), +-14 px
    ax, ay = anchors[0]
    ph, pw = 70, 90
    tpl = gray[int(ay) - ph:int(ay) + ph, int(ax) - pw:int(ax) + pw]
    for i in range(1, len(cells)):
        bx, by = anchors[i]
        best = None
        for dy in range(-14, 15):
            for dx in range(-14, 15):
                yy, xx = int(by) + dy, int(bx) + dx
                p = gray[yy - ph:yy + ph, xx - pw:xx + pw]
                if p.shape != tpl.shape:
                    continue
                e = np.mean((p - tpl) ** 2)
                if best is None or e < best[0]:
                    best = (e, dx, dy)
        anchors[i] = [int(bx) + best[1] + (ax - int(ax)), int(by) + best[2] + (ay - int(ay))]
    return cells, anchors


def frame_on_canvas(c, anchor, ref, scale, size):
    x0, y0, x1, y1 = c["box"]
    big = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    im = to_image(c["crop"])
    w = round((x1 - x0) * scale)
    h = round((y1 - y0) * scale)
    # sub-pixel placement via affine transform on the full-resolution crop
    sx = ref[0] - (anchor[0] - x0) * scale
    sy = ref[1] - (anchor[1] - y0) * scale
    prem = im.convert("RGBa")
    inv = 1.0 / scale
    t = prem.transform((size, size), Image.AFFINE,
                       (inv, 0, -sx * inv, 0, inv, -sy * inv), resample=Image.BICUBIC)
    # downscale quality: pre-shrink with LANCZOS when strongly reducing
    if scale < 0.6:
        small = prem.resize((max(1, w), max(1, h)), Image.LANCZOS)
        fx = (x1 - x0) / max(1, w)
        t = small.transform((size, size), Image.AFFINE,
                            (inv / fx, 0, -sx * inv / fx, 0, inv / fx, -sy * inv / fx),
                            resample=Image.BICUBIC)
    big.alpha_composite(t.convert("RGBA"))
    return big


def build_fly(path, out_dir, check):
    rgba = remove_background(np.asarray(Image.open(path).convert("RGB")))
    cells, anchors = fly_frames(rgba)
    # near-duplicate test: last frame vs first, aligned
    def aligned_alpha(i, pad=0):
        c = cells[i]
        x0, y0, x1, y1 = c["box"]
        return c, x0, y0
    def diff(i, j):
        size = 900
        ref = (size / 2, size / 2)
        A = np.asarray(frame_on_canvas(cells[i], anchors[i], ref, 1.0, size)).astype(np.float32)
        B = np.asarray(frame_on_canvas(cells[j], anchors[j], ref, 1.0, size)).astype(np.float32)
        m = (A[..., 3] > 0) | (B[..., 3] > 0)
        return float(np.abs(A[..., 3] - B[..., 3])[m].mean()), float(np.abs(A[..., :3] - B[..., :3]).mean(axis=2)[m].mean())
    n = len(cells)
    d61 = diff(n - 1, 0)
    d12 = diff(0, 1)
    order = list(range(n))
    dropped = None
    if d61[0] < 0.35 * d12[0]:
        dropped = n - 1
        order = order[:-1]
    # common extent around the anchor
    ext = []
    for i in order:
        x0, y0, x1, y1 = cells[i]["box"]
        ax, ay = anchors[i]
        ext.append((x0 - ax, y0 - ay, x1 - ax, y1 - ay))
    ext = np.array(ext)
    L, T, R, B = ext[:, 0].min(), ext[:, 1].min(), ext[:, 2].max(), ext[:, 3].max()
    span = max(R - L, B - T)
    scale = FLY_SIZE * 0.96 / span
    ref = (FLY_SIZE / 2 - (L + R) / 2 * scale, FLY_SIZE / 2 - (T + B) / 2 * scale)
    frames = [frame_on_canvas(cells[i], anchors[i], ref, scale, FLY_SIZE) for i in order]
    sheet = Image.new("RGBA", (FLY_SIZE * len(frames), FLY_SIZE), (0, 0, 0, 0))
    for k, f in enumerate(frames):
        sheet.alpha_composite(f, (k * FLY_SIZE, 0))
    q, nbytes = save_pair(sheet, os.path.join(out_dir, "fly-sprite"), budget=10 ** 9)
    info = dict(frames=len(frames), order=[i + 1 for i in order], dropped=None if dropped is None else dropped + 1,
                diff_last_first=d61, diff_1_2=d12, anchors=anchors.round(1).tolist(), scale=scale)
    if check:
        overlay = Image.new("RGBA", (FLY_SIZE, FLY_SIZE), (0, 0, 0, 0))
        for f in frames:
            a = np.asarray(f).copy()
            a[..., 3] = (a[..., 3] * 0.5).astype(np.uint8)
            overlay.alpha_composite(Image.fromarray(a))
        tiles = [("overlay 50%", overlay)] + [(f"frame {i + 1}", f) for i, f in zip(order, frames)]
        contact(tiles, os.path.join(check, "fly-frames.png"), tile=FLY_SIZE, crosshair=ref_point(frames, anchors, order, scale, ref))
    return info


def ref_point(frames, anchors, order, scale, ref):
    return ref  # anchor position on every frame canvas


# --------------------------------------------------------------------------
# icons
# --------------------------------------------------------------------------
def poly_terms(x, y, deg):
    return np.stack([x ** i * y ** j for i in range(deg + 1) for j in range(deg + 1 - i)], axis=-1)


def build_icons(path, out_dir, check):
    src = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    h, w, _ = src.shape
    dist_white = 255 - src.min(axis=2)
    lab, _ = ndi.label(dist_white < 40)
    corner_ids = {lab[0, 0], lab[0, -1], lab[-1, 0], lab[-1, -1]} - {0}
    corners = np.isin(lab, list(corner_ids))
    # gradient model: fit a smooth polynomial to the indigo/violet background
    r, g, b = src[..., 0], src[..., 1], src[..., 2]
    bgmask = (b > r + 60) & (b > g + 80) & ~ndi.binary_dilation(corners, iterations=6)
    ys, xs = np.nonzero(bgmask)
    sel = np.random.default_rng(0).choice(len(xs), size=min(60000, len(xs)), replace=False)
    xs, ys = xs[sel], ys[sel]
    deg = 3
    A = poly_terms(xs / w, ys / h, deg)
    coef = np.linalg.lstsq(A, src[ys, xs], rcond=None)[0]

    def model(xx, yy):
        return np.clip(poly_terms(xx, yy, deg) @ coef, 0, 255)

    gy, gx = np.mgrid[0:h, 0:w]
    M = model(gx / w, gy / h).astype(np.float32)
    # replace white corners; un-mix white from the anti-aliased rim
    band = ndi.binary_dilation(corners, iterations=5) & ~corners
    wm = 255 - M
    with np.errstate(invalid="ignore", divide="ignore"):
        a = ((255 - src) * wm).sum(axis=2) / (wm ** 2).sum(axis=2)
    a = np.clip(np.nan_to_num(a), 0, 1)
    out = src.copy()
    out[corners] = M[corners]
    rim = out + (1 - a)[..., None] * (M - 255)
    out[band] = np.clip(rim, 0, 255)[band]
    # a touch of grain so the filled corners match the rendered gradient
    noise = np.random.default_rng(1).normal(0, 1.2, out.shape).astype(np.float32)
    fill = ndi.gaussian_filter(corners.astype(np.float32), 2)[..., None]
    out = np.clip(out + noise * fill, 0, 255)
    full = Image.fromarray((out + 0.5).astype(np.uint8), "RGB")

    os.makedirs(out_dir, exist_ok=True)
    res = {}
    for name, s in [("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512),
                    ("favicon.png", 64), ("favicon-32.png", 32)]:
        full.resize((s, s), Image.LANCZOS).save(os.path.join(out_dir, name), optimize=True)
        res[name] = s

    # maskable: bird head inside the central 80% circle; body runs off the bottom edge
    S = 512
    k = 0.64                       # scale of the source square inside the canvas
    head_cx = 0.47                 # head centre (fraction of source width)
    dx = S / 2 - head_cx * S * k
    dy = S - S * k                 # bottom anchored
    yy, xx = np.mgrid[0:S, 0:S]
    pad = model(np.clip((xx - dx) / (S * k), -0.15, 1.15), np.clip((yy - dy) / (S * k), -0.15, 1.0)).astype(np.float32)
    canvas = Image.fromarray((pad + 0.5).astype(np.uint8), "RGB")
    small = full.resize((round(S * k), round(S * k)), Image.LANCZOS)
    # feathered paste so the seam between real and modelled gradient vanishes
    fm = np.zeros((small.height, small.width), np.float32)
    f = 14
    ramp_x = np.clip(np.minimum(np.arange(small.width), small.width - 1 - np.arange(small.width)) / f, 0, 1)
    ramp_y = np.clip(np.arange(small.height) / f, 0, 1)
    fm = np.minimum(ramp_x[None, :], ramp_y[:, None])
    canvas.paste(small, (round(dx), round(dy)), Image.fromarray((fm * 255).astype(np.uint8)))
    canvas.save(os.path.join(out_dir, "maskable-512.png"), optimize=True)
    res["maskable-512.png"] = S
    if check:
        prev = canvas.copy().convert("RGBA")
        d = ImageDraw.Draw(prev)
        d.ellipse([S * 0.1, S * 0.1, S * 0.9, S * 0.9], outline=(255, 0, 0, 255), width=3)
        masked = canvas.copy().convert("RGBA")
        cm = Image.new("L", (S, S), 0)
        ImageDraw.Draw(cm).ellipse([S * 0.1, S * 0.1, S * 0.9, S * 0.9], fill=255)
        masked.putalpha(cm)
        tiles = [("icon-512", full.resize((512, 512), Image.LANCZOS).convert("RGBA")),
                 ("maskable + safe zone", prev), ("maskable circle crop", masked),
                 ("apple 180 (x2)", Image.open(os.path.join(out_dir, "apple-touch-icon.png")).resize((360, 360), Image.NEAREST).convert("RGBA")),
                 ("favicon 64 (x4)", Image.open(os.path.join(out_dir, "favicon.png")).resize((256, 256), Image.NEAREST).convert("RGBA")),
                 ("favicon 32 (x8)", Image.open(os.path.join(out_dir, "favicon-32.png")).resize((256, 256), Image.NEAREST).convert("RGBA")),
                 ("corner TL zoom", full.crop((0, 0, 200, 200)).resize((512, 512), Image.NEAREST).convert("RGBA")),
                 ("corner BL zoom", full.crop((0, h - 200, 200, h)).resize((512, 512), Image.NEAREST).convert("RGBA")),
                 ("corner BR zoom", full.crop((w - 200, h - 200, w, h)).resize((512, 512), Image.NEAREST).convert("RGBA"))]
        contact(tiles, os.path.join(check, "icons.png"), tile=512, cols=3)
    return res


# --------------------------------------------------------------------------
# verification sheets
# --------------------------------------------------------------------------
def contact(tiles, path, tile=256, cols=None, crosshair=None):
    cols = cols or len(tiles)
    rows_n = (len(tiles) + cols - 1) // cols
    pad = 22
    sheet = Image.new("RGB", (cols * tile * 2, rows_n * (tile + pad)), (128, 128, 128))
    d = ImageDraw.Draw(sheet)
    for k, (name, im) in enumerate(tiles):
        im = im if im.size == (tile, tile) else im.resize((tile, tile), Image.LANCZOS)
        r, c = divmod(k, cols)
        for j, bgc in enumerate((LIGHT, DARK)):
            bgim = Image.new("RGBA", (tile, tile), bgc + (255,))
            bgim.alpha_composite(im)
            x, y = (c * 2 + j) * tile, r * (tile + pad) + pad
            sheet.paste(bgim.convert("RGB"), (x, y))
            if crosshair is not None:
                cx, cy = crosshair
                d.line([x + cx - 10, y + cy, x + cx + 10, y + cy], fill=(255, 0, 0))
                d.line([x + cx, y + cy - 10, x + cx, y + cy + 10], fill=(255, 0, 0))
        d.text((c * 2 * tile + 4, r * (tile + pad) + 5), name, fill=(255, 255, 255))
    sheet.save(path)


def pose_checks(names, images, check, tag):
    tiles = list(zip(names, images))
    contact(tiles, os.path.join(check, f"poses-{tag}.png"), tile=256, cols=4)
    # 1:1 zoom on the dark background for halo inspection
    contact(tiles, os.path.join(check, f"poses-{tag}-full.png"), tile=POSE_SIZE, cols=3)


def build_poses(path, names, cols, rows, out_dir, check, tag):
    rgba = remove_background(np.asarray(Image.open(path).convert("RGB")))
    cells = cut_cells(rgba, cols, rows)
    placed, scale = layout_sheet(cells, cols, rows)
    info = {"scale": scale}
    for name, im in zip(names, placed):
        q, nb = save_pair(im, os.path.join(out_dir, name))
        info[name] = (q, nb)
    if check:
        pose_checks(names, placed, check, tag)
        to_image(rgba).save(os.path.join(check, f"cutout-{tag}.png"))
    return info


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--expressions")
    ap.add_argument("--objects")
    ap.add_argument("--fly")
    ap.add_argument("--icon")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "..", "public"))
    ap.add_argument("--check")
    a = ap.parse_args()
    mdir = os.path.join(a.out, "mascot")
    os.makedirs(mdir, exist_ok=True)
    if a.check:
        os.makedirs(a.check, exist_ok=True)
    if a.expressions:
        print("expressions", build_poses(a.expressions, EXPRESSIONS, 4, 3, mdir, a.check, "expressions"))
    if a.objects:
        print("objects", build_poses(a.objects, OBJECTS, 3, 3, mdir, a.check, "objects"))
    if a.fly:
        print("fly", build_fly(a.fly, mdir, a.check))
    if a.icon:
        print("icons", build_icons(a.icon, os.path.join(a.out, "icons"), a.check))


if __name__ == "__main__":
    main()
