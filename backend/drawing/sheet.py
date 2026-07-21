"""
sheet.py - Single source of truth for permit sheet physical size and the
proportional render-scale shim.

Why this exists (S86):
Sheets are drawn in DATA coordinates (feet) with fonts/linewidths in absolute
POINTS. When the figure grows (e.g. 14x8.5 -> 36x24 ARCH D), the geometry
fills the larger page automatically but point-based text/lines stay the same
absolute size and therefore SHRINK relative to the sheet. To keep normalized
type constant (the reference sets sit at ~0.3% of sheet width) every
point-valued style must scale with sheet width.

Rather than edit ~294 scattered fontsize literals, render_scale() applies a
single multiplier centrally:
  - rcParams defaults (font.size, lines/patch/hatch linewidth, markersize)
  - explicit fontsize/size kwargs on the text-family methods

CONTRACT: at the current default size (letter landscape 14x8.5) FONT_SCALE is
1.0 and render_scale() is a guaranteed no-op (rcParams * 1.0, explicit * 1.0),
so pre-S86 output is byte-for-byte unchanged. Flipping ACTIVE to a larger size
is what a visual (eyes-on) design pass tunes.
"""

import contextlib
import os

import matplotlib as mpl
import matplotlib.pyplot as plt


# ------------------------------------------------------------
# Sheet size registry (inches, landscape W x H)
# ------------------------------------------------------------
# Baseline is the historical letter-ish landscape size the tool shipped with.
# ARCH sizes match professional deck permit sets (the All Things Architecture
# Colorado Springs references are ARCH D 36x24).
SHEET_SIZES = {
    "letter":  (14.0, 8.5),    # historical default (pre-S86)
    "tabloid": (17.0, 11.0),   # ARCH B-ish; office/plotter printable
    "arch_c":  (24.0, 18.0),   # ARCH C
    "arch_d":  (36.0, 24.0),   # ARCH D -- matches the reference sets
}

# The baseline width every point-valued style was authored against.
BASE_WIDTH = 14.0

# ACTIVE sheet. Kept at "letter" so shipped output is unchanged until a
# visual design pass blesses a larger size. Read via getters below so callers
# always see the current value. SBP_SHEET env var overrides for renders/design
# sessions without touching the shipped default.
_ACTIVE = os.environ.get("SBP_SHEET", "letter")
if _ACTIVE not in SHEET_SIZES:
    _ACTIVE = "letter"


# S87: standard architect's-ruler scales (in/ft, label), largest first.
# Professional sets print at one of these and STATE it; anything else is
# unmeasurable with a scale ruler. PPRBD floor for deck plans is 1/4".
STANDARD_SCALES = [
    (3.0,    '3" = 1\'-0"'),
    (1.5,    '1-1/2" = 1\'-0"'),
    (1.0,    '1" = 1\'-0"'),
    (0.75,   '3/4" = 1\'-0"'),
    (0.5,    '1/2" = 1\'-0"'),
    (0.375,  '3/8" = 1\'-0"'),
    (0.25,   '1/4" = 1\'-0"'),
    (0.1875, '3/16" = 1\'-0"'),
    (0.125,  '1/8" = 1\'-0"'),
]


def fit_scale(span_x_ft, span_y_ft, box_w_in, box_h_in, snap=True):
    """Largest scale (in/ft) at which a span_x x span_y ft drawing fits a
    box_w x box_h inch axes box. snap=True returns the largest STANDARD
    architectural scale that fits (with its label); snap=False returns the
    raw fill ratio (label None)."""
    raw = min(box_w_in / max(span_x_ft, 1e-9), box_h_in / max(span_y_ft, 1e-9))
    if not snap:
        return raw, None
    for s, label in STANDARD_SCALES:
        if s <= raw + 1e-9:
            return s, label
    return raw, None


def set_active(name):
    """Select the active sheet size by registry key. Returns (W, H)."""
    global _ACTIVE
    if name not in SHEET_SIZES:
        raise ValueError(f"unknown sheet size {name!r}; choices: {list(SHEET_SIZES)}")
    _ACTIVE = name
    return SHEET_SIZES[_ACTIVE]


def sheet_size():
    """Active (width, height) in inches."""
    return SHEET_SIZES[_ACTIVE]


def font_scale():
    """Multiplier that keeps point-valued styles proportional to sheet width."""
    return SHEET_SIZES[_ACTIVE][0] / BASE_WIDTH


# Convenience module-level values for figsize= call sites. These are read at
# import time; callers that may change size at runtime should call sheet_size().
SHEET_W, SHEET_H = SHEET_SIZES[_ACTIVE]


_SCALED_RC = (
    "font.size",
    "axes.linewidth",
    "lines.linewidth",
    "lines.markersize",
    "patch.linewidth",
    "hatch.linewidth",
    "xtick.major.width",
    "ytick.major.width",
)


@contextlib.contextmanager
def render_scale(scale=None):
    """Context manager that scales every point-valued style by `scale`
    (defaults to font_scale() for the active sheet). No-op when scale == 1.0.

    Scales rcParams defaults for un-specified artists, and explicit
    fontsize/size kwargs on Axes.text / Axes.annotate / Figure.text (where the
    ~294 literals live). Explicit linewidths on individual artists are left to
    the visual design pass; rcParams covers the common defaults.
    """
    if scale is None:
        scale = font_scale()

    # Fast path: exact no-op, no patching at all.
    if scale == 1.0:
        yield
        return

    saved_rc = {k: mpl.rcParams[k] for k in _SCALED_RC}
    Axes = mpl.axes.Axes
    Figure = mpl.figure.Figure
    orig_text = Axes.text
    orig_annotate = Axes.annotate
    orig_fig_text = Figure.text

    def _scaled_kwargs(kwargs):
        for key in ("fontsize", "size"):
            if key in kwargs and isinstance(kwargs[key], (int, float)):
                kwargs[key] = kwargs[key] * scale
        return kwargs

    def text(self, *a, **k):
        return orig_text(self, *a, **_scaled_kwargs(k))

    def annotate(self, *a, **k):
        return orig_annotate(self, *a, **_scaled_kwargs(k))

    def fig_text(self, *a, **k):
        return orig_fig_text(self, *a, **_scaled_kwargs(k))

    try:
        for k in _SCALED_RC:
            mpl.rcParams[k] = saved_rc[k] * scale
        Axes.text = text
        Axes.annotate = annotate
        Figure.text = fig_text
        yield
    finally:
        Axes.text = orig_text
        Axes.annotate = orig_annotate
        Figure.text = orig_fig_text
        for k, v in saved_rc.items():
            mpl.rcParams[k] = v
