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
