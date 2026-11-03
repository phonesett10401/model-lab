"""The page's bubble extent in Python (same rule as bubbleExtent in src/lib/comic/bubble.ts, paper only), so training
labels and the page draw the same boxes. Held to src/lib/comic/bubble-cases.json by test_comic_bubble.py."""
import numpy as np
from scipy import ndimage

NEAR = 40        # how far (per channel) a pixel may be from the paper colour and still count as paper
SATURATION = 45  # most a paper colour's channels may differ (cream ~40; a lilac window or painted sky is art)
GAP = 2          # outline gaps up to twice this wide are closed before flooding
FOUR = ndimage.generate_binary_structure(2, 1)


def _spread(m: np.ndarray, r: int, shrink: bool) -> np.ndarray:
    """Shrinks (min) or grows (max) a 0/1 map by r pixels along rows, then columns; past the edge counts as kept."""
    f = ndimage.minimum_filter1d if shrink else ndimage.maximum_filter1d
    cval = 1 if shrink else 0
    return f(f(m, 2 * r + 1, axis=1, mode='constant', cval=cval), 2 * r + 1, axis=0, mode='constant', cval=cval)


def _reached(seeds: np.ndarray, passable: np.ndarray) -> np.ndarray:
    """Pixels of `passable` 4-connected to a seed pixel that is itself passable."""
    lab, _ = ndimage.label(passable, FOUR)
    ids = np.unique(lab[seeds & passable])
    return np.isin(lab, ids[ids > 0])


def _hull_rows(marked: np.ndarray) -> list:
    """Per row, [first, last] inside the convex hull of the marked pixels, or None (as hullRows in bubble.ts)."""
    h, w = marked.shape
    pts = []
    for y in range(h):
        xs = np.flatnonzero(marked[y])
        if len(xs):
            pts += [(int(xs[0]), y), (int(xs[-1]), y)]
    pts.sort()
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    def half(seq):
        out = []
        for p in seq:
            while len(out) >= 2 and cross(out[-2], out[-1], p) <= 0:
                out.pop()
            out.append(p)
        return out[:-1]

    poly = pts if len(pts) < 3 else half(pts) + half(pts[::-1])
    rows = [None] * h
    for y in range(h):
        lo, hi = np.inf, -np.inf
        for i in range(len(poly)):
            (ax, ay), (bx, by) = poly[i], poly[(i + 1) % len(poly)]
            if y < min(ay, by) or y > max(ay, by):
                continue
            for x in ([ax, bx] if ay == by else [ax + (y - ay) * (bx - ax) / (by - ay)]):
                lo, hi = min(lo, x), max(hi, x)
        if lo <= hi:
            rows[y] = (max(0, int(np.ceil(lo - 1e-9))), min(w - 1, int(np.floor(hi + 1e-9))))
    return rows


def _lobe(mask: np.ndarray, seed: tuple, others: list) -> np.ndarray:
    """The part of a filled bubble that holds `seed` when it is joined to other bubbles (whose text boxes are `others`)
    by narrow necks: the bubble is shrunk until the texts sit in separate pieces, then each pixel goes to the nearest
    piece. A single bubble holding several paragraphs never comes apart before a text's piece vanishes: kept whole."""
    def ids(lab, b):
        x, y, w, h = (int(round(v)) for v in b)
        got = np.unique(lab[max(0, y):max(0, y + h), max(0, x):max(0, x + w)])
        return set(got[got > 0].tolist())
    dist = ndimage.distance_transform_edt(mask)
    for r in range(2, int(dist.max()), 2):
        lab, _ = ndimage.label(dist > r, FOUR)
        own, rest = ids(lab, seed), [ids(lab, o) for o in others]
        if not own or not all(rest):
            return mask
        if len(own) == 1 and all(own.isdisjoint(s) for s in rest):
            near = lab[tuple(ndimage.distance_transform_edt(lab == 0, return_distances=False, return_indices=True))]
            return mask & (near == own.pop())
    return mask


def bubble_extent(rgb: np.ndarray, seed: tuple | None = None, others: list = ()) -> tuple[int, int, int, int] | None:
    """The whole bubble around a box in an RGB crop (h×w×3): (x, y, w, h) in crop pixels, or None when there is no
    closed bubble of paper (paper running off the crop, painted art, busy art). `seed` (x, y, w, h) is where the paper
    is looked for; default the middle half of the crop. `others`: other bubbles' text boxes (crop pixels); when one lies
    in the same paper, only the seed's own lobe is kept (training labels only; bubble.ts has no such step)."""
    h, w = rgb.shape[:2]
    px = rgb.astype(np.int16)
    sx, sy, sw, sh = seed if seed else (w / 4, h / 4, w / 2, h / 2)
    xs, ys = np.arange(w)[None, :], np.arange(h)[:, None]
    central = (xs >= sx) & (xs < sx + sw) & (ys >= sy) & (ys < sy + sh)

    # Paper colour: the commonest light, near-grey colour in the seed area (16 levels a channel), averaged.
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    ok = central & (0.299 * r + 0.587 * g + 0.114 * b >= 150) & (px.max(2) - px.min(2) <= SATURATION)
    if not ok.any():
        return None
    keys = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    k = keys[ok]
    top = np.bincount(k).argmax()
    paper = px[ok][k == top].mean(0)
    paper_map = (np.abs(px - paper) <= NEAR).all(2)

    core = _spread(paper_map, GAP, True)
    inside = _spread(_reached(central, core), GAP, False) & paper_map
    need = sw * sh * 0.3 if seed else w * h * 0.15
    if inside.sum() < need:
        return None

    # The bubble: everything the crop edge can't reach without crossing the paper, plus the paper's convex hull
    # (letters touching the outline) unless the hull is much bigger than the bubble (two joined bubbles).
    edge = np.zeros((h, w), bool)
    edge[0, :] = edge[-1, :] = edge[:, 0] = edge[:, -1] = True
    mask = ~_reached(edge, ~inside)
    # Other bubbles' text in this paper: keep the seed's own lobe (before the hull, which would fill the necks).
    held = [o for o in others if seed and 0 <= o[1] + o[3] / 2 < h and 0 <= o[0] + o[2] / 2 < w
            and mask[int(o[1] + o[3] / 2), int(o[0] + o[2] / 2)]]
    if held:
        mask = _lobe(mask, seed, held)
        inside &= mask
    rows = _hull_rows(inside)
    if sum(r1 - r0 + 1 for r0, r1 in filter(None, rows)) <= mask.sum() * 1.3:
        for y, row in enumerate(rows):
            if row:
                mask[y, row[0]:row[1] + 1] = True
    ys_, xs_ = np.nonzero(mask)
    if not len(xs_):
        return None
    x0, x1, y0, y1 = xs_.min(), xs_.max(), ys_.min(), ys_.max()
    if x0 == 0 or y0 == 0 or x1 == w - 1 or y1 == h - 1:
        return None
    return int(x0), int(y0), int(x1 - x0 + 1), int(y1 - y0 + 1)


def grow(rgb: np.ndarray, box: list[float], most: float | None = None, others: list = ()) -> list[int] | None:
    """A text-only box grown to the whole bubble around it, or None when there is no closed bubble (or, with `most`, only
    one over `most` times the box's area: for boxes already near a bubble's size, a white panel or joined bubbles; tight
    line boxes can't use it, a one-line bubble is often 4× its text). The crop reaches
    1.5× the box's longer side on every side (a one-line box at the top of a tall bubble still sees the whole bubble)."""
    H, W = rgb.shape[:2]
    x, y, w, h = box
    pad = 1.5 * max(w, h)
    cx, cy = max(0, int(x - pad)), max(0, int(y - pad))
    cw, ch = min(W, int(np.ceil(x + w + pad))) - cx, min(H, int(np.ceil(y + h + pad))) - cy
    if cw < 8 or ch < 8:
        return None
    e = bubble_extent(rgb[cy:cy + ch, cx:cx + cw], (x - cx, y - cy, w, h), [(o[0] - cx, o[1] - cy, o[2], o[3]) for o in others])
    if not e or (most and e[2] * e[3] > most * w * h):
        return None
    return [cx + e[0], cy + e[1], e[2], e[3]]
