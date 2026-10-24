"""Where a lettered page differs from its art-only twin: those regions are the text (bubbles, captions, sound effects)."""
import numpy as np
from PIL import Image
from scipy import ndimage


def text_boxes(text_page: Image.Image, art_page: Image.Image, min_area_frac: float = 0.0008,
               min_density: float = 0.15) -> list[tuple[int, int, int, int]]:
    """(x, y, w, h) of each region that differs, after joining nearby marks into one blob."""
    a = np.asarray(text_page.convert('RGB'), dtype=np.int16)
    b = np.asarray(art_page.convert('RGB').resize(text_page.size), dtype=np.int16)
    changed = np.abs(a - b).max(axis=2) > 40
    r = max(1, round(6 * text_page.width / 1600))
    disk = np.hypot(*np.mgrid[-r:r + 1, -r:r + 1]) <= r
    joined = ndimage.binary_closing(changed, structure=disk)
    labels, _ = ndimage.label(joined)
    min_area = min_area_frac * changed.size
    boxes = []
    for i, sl in enumerate(ndimage.find_objects(labels), start=1):
        ys, xs = sl
        h, w = ys.stop - ys.start, xs.stop - xs.start
        region = labels[sl] == i
        if region.sum() < min_area or changed[sl][region].mean() < min_density:
            continue
        boxes.append((xs.start, ys.start, w, h))
    return boxes


MIN_PAGE_HEIGHT = 200  # thinner than this is a spacer strip, not a page
MAX_TEXT_SHARE = 0.3  # more text than this is a credits page, not comic lettering


def usable_page(width: int, height: int, boxes: list[tuple[int, int, int, int]]) -> bool:
    return height >= MIN_PAGE_HEIGHT and sum(w * h for *_, w, h in boxes) <= MAX_TEXT_SHARE * width * height


def split_blob(text_page: Image.Image, art_page: Image.Image, box: tuple[int, int, int, int],
               groups: list[list[float]]) -> list[tuple[int, int, int, int]]:
    """Touching bubbles form one changed blob. With 2+ word groups inside, each changed pixel goes to its nearest
    group, and each group gets the box of its own pixels (its bubble outline). One group: the box is unchanged."""
    if len(groups) < 2:
        return [tuple(box)]
    x, y, w, h = box
    a = np.asarray(text_page.convert('RGB'), dtype=np.int16)[y:y + h, x:x + w]
    b = np.asarray(art_page.convert('RGB').resize(text_page.size), dtype=np.int16)[y:y + h, x:x + w]
    ys, xs = np.nonzero(np.abs(a - b).max(axis=2) > 40)
    xs, ys = xs + x, ys + y
    # distance from each pixel to each group's rectangle
    d = np.stack([np.hypot(np.maximum(0, np.maximum(gx - xs, xs - (gx + gw))), np.maximum(0, np.maximum(gy - ys, ys - (gy + gh))))
                  for gx, gy, gw, gh in groups])
    owner = d.argmin(axis=0)
    out = []
    for k in range(len(groups)):
        px, py = xs[owner == k], ys[owner == k]
        if len(px):
            out.append((int(px.min()), int(py.min()), int(px.max() - px.min() + 1), int(py.max() - py.min() + 1)))
    return out
