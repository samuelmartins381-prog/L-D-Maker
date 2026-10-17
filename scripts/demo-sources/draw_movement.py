"""Draws the schematic of a mechanical movement used by the demo module (no text inside: it is
translated through the hotspot labels). Run: python3 scripts/demo-sources/draw_movement.py <out.svg>
Prints the organ centres in % of the image, for the hotspot coordinates of module.yaml."""
import math
import sys

W, H = 1600, 1000
INK, COPPER, STEEL, BLUE, PAPER, PLATE, LINE = (
    "#2a2622", "#8a4b2a", "#6d6a66", "#2f5d9a", "#fffdf9", "#efe7da", "#c9bba5")


def gear(cx, cy, r, teeth, depth, fill, stroke=INK, phase=0.0):
    pts = []
    for i in range(teeth * 4):
        a = phase + 2 * math.pi * i / (teeth * 4)
        rr = r if (i % 4) in (0, 1) else r - depth
        pts.append(f"{cx + rr * math.cos(a):.1f},{cy + rr * math.sin(a):.1f}")
    return (f'<polygon points="{" ".join(pts)}" fill="{fill}" stroke="{stroke}" stroke-width="2.5" '
            f'stroke-linejoin="round"/>')


def spokes(cx, cy, r, n=4, w=10, color=INK):
    out = []
    for i in range(n):
        a = math.pi / 4 + 2 * math.pi * i / n
        out.append(f'<line x1="{cx:.1f}" y1="{cy:.1f}" x2="{cx + r * math.cos(a):.1f}" '
                   f'y2="{cy + r * math.sin(a):.1f}" stroke="{color}" stroke-width="{w}" stroke-linecap="round"/>')
    return "".join(out)


def jewel(cx, cy, r=9):
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#a3203a" stroke="{INK}" stroke-width="2"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r * 0.35:.1f}" fill="{PAPER}"/>')


def spiral(cx, cy, r0, r1, turns, color):
    pts = []
    steps = int(turns * 60)
    for i in range(steps + 1):
        t = i / steps
        a = 2 * math.pi * turns * t
        r = r0 + (r1 - r0) * t
        pts.append(f"{cx + r * math.cos(a):.1f},{cy + r * math.sin(a):.1f}")
    return f'<polyline points="{" ".join(pts)}" fill="none" stroke="{color}" stroke-width="3"/>'


organs = {
    "barrel": (300, 560, 175),
    "center": (640, 420, 120),
    "third": (840, 600, 85),
    "fourth": (1000, 430, 72),
    "escape": (1150, 600, 62),
    "balance": (1370, 330, 150),
    "dial": (560, 820, 105),
}
s = []
# Cropped to the parts, so the drawing fills small screens (hotspots are placed in % of this box).
VX, VY, VW, VH = 100, 140, 1460, 810
s.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VX} {VY} {VW} {VH}" width="{VW}" height="{VH}">')
# Main plate, as seen through a display back.
s.append(f'<rect x="{VX}" y="{VY}" width="{VW}" height="{VH}" rx="36" fill="{PLATE}"/>')

# Energy path, drawn first so the parts sit on top: barrel → train → escapement → balance.
path = ["barrel", "center", "third", "fourth", "escape"]
pts = [(organs[n][0], organs[n][1]) for n in path] + [(1235, 500), (organs["balance"][0], organs["balance"][1])]
d = "M" + " L".join(f"{x},{y}" for x, y in pts)
s.append(f'<path d="{d}" fill="none" stroke="{COPPER}" stroke-width="5" stroke-dasharray="2 14" '
         f'stroke-linecap="round" opacity="0.75"/>')
for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
    # Arrowhead at the middle of each leg, pointing downstream.
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    length = math.hypot(x2 - x1, y2 - y1)
    ux, uy = (x2 - x1) / length, (y2 - y1) / length
    tip = (mx + ux * 14, my + uy * 14)
    left = (mx - ux * 10 - uy * 11, my - uy * 10 + ux * 11)
    right = (mx - ux * 10 + uy * 11, my - uy * 10 - ux * 11)
    s.append(f'<polygon points="{tip[0]:.1f},{tip[1]:.1f} {left[0]:.1f},{left[1]:.1f} {right[0]:.1f},{right[1]:.1f}" '
             f'fill="{COPPER}"/>')

# Barrel: drum with teeth, mainspring visible through a cut-out.
bx, by, br = organs["barrel"]
s.append(gear(bx, by, br, 72, 9, "#e6d6bf"))
s.append(f'<circle cx="{bx}" cy="{by}" r="{br - 22}" fill="{PAPER}" stroke="{INK}" stroke-width="2.5"/>')
s.append(spiral(bx, by, 22, br - 34, 7, COPPER))
s.append(f'<circle cx="{bx}" cy="{by}" r="24" fill="{STEEL}" stroke="{INK}" stroke-width="2.5"/>')

# Gear train: centre, third, fourth wheels with their pinions, then the escape wheel.
for name, teeth in (("center", 64), ("third", 56), ("fourth", 48)):
    cx, cy, r = organs[name]
    s.append(gear(cx, cy, r, teeth, 7, "#e9c98f"))
    s.append(f'<circle cx="{cx}" cy="{cy}" r="{r - 16}" fill="none" stroke="{INK}" stroke-width="2"/>')
    s.append(spokes(cx, cy, r - 18, 4, 9, "#b88a3e"))
    s.append(gear(cx, cy, r * 0.22, 10, 5, STEEL))
    s.append(jewel(cx, cy))

# Escape wheel: club teeth, steel.
ex, ey, er = organs["escape"]
teeth = []
for i in range(15):
    a = 2 * math.pi * i / 15
    a2 = a + 0.22
    teeth.append(f'<path d="M{ex + (er - 14) * math.cos(a):.1f},{ey + (er - 14) * math.sin(a):.1f} '
                 f'L{ex + er * math.cos(a2):.1f},{ey + er * math.sin(a2):.1f} '
                 f'L{ex + (er - 6) * math.cos(a2 + 0.12):.1f},{ey + (er - 6) * math.sin(a2 + 0.12):.1f} Z" '
                 f'fill="{STEEL}" stroke="{INK}" stroke-width="2"/>')
s.append(f'<circle cx="{ex}" cy="{ey}" r="{er - 12}" fill="#cfcac3" stroke="{INK}" stroke-width="2.5"/>')
s.extend(teeth)
s.append(spokes(ex, ey, er - 16, 3, 7, STEEL))
s.append(jewel(ex, ey))

# Pallet fork between escape wheel and balance: lever, two pallet stones, fork.
px, py = 1235, 500
s.append(f'<path d="M{px - 70},{py + 70} L{px},{py} L{px + 70},{py + 40} M{px},{py} L{px + 55},{py - 95}" '
         f'fill="none" stroke="{INK}" stroke-width="12" stroke-linecap="round"/>')
s.append(f'<rect x="{px - 82}" y="{py + 60}" width="18" height="12" fill="#a3203a" transform="rotate(-45 {px - 73} {py + 66})"/>')
s.append(f'<rect x="{px + 62}" y="{py + 32}" width="18" height="12" fill="#a3203a" transform="rotate(30 {px + 71} {py + 38})"/>')
s.append(jewel(px, py, 8))

# Balance wheel with its blued hairspring.
cx, cy, r = organs["balance"]
s.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#b88a3e" stroke-width="22"/>')
s.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{INK}" stroke-width="2.5"/>')
s.append(f'<circle cx="{cx}" cy="{cy}" r="{r - 11}" fill="none" stroke="{INK}" stroke-width="2"/>')
s.append(spokes(cx, cy, r - 10, 2, 10, "#b88a3e"))
for i in range(8):  # balance screws
    a = 2 * math.pi * i / 8 + math.pi / 8
    s.append(f'<circle cx="{cx + (r + 4) * math.cos(a):.1f}" cy="{cy + (r + 4) * math.sin(a):.1f}" r="7" fill="{STEEL}" stroke="{INK}" stroke-width="1.5"/>')
s.append(spiral(cx, cy, 14, r - 40, 9, BLUE))
s.append(jewel(cx, cy, 11))

# Dial side, drawn as a small dial with hands, linked to the centre wheel (motion works).
dx, dy, dr = organs["dial"]
s.append(f'<line x1="{organs["center"][0]}" y1="{organs["center"][1] + organs["center"][2]}" x2="{dx}" y2="{dy - dr}" '
         f'stroke="{LINE}" stroke-width="6" stroke-dasharray="4 10" stroke-linecap="round"/>')
s.append(f'<circle cx="{dx}" cy="{dy}" r="{dr}" fill="{PAPER}" stroke="{INK}" stroke-width="3"/>')
for i in range(12):
    a = 2 * math.pi * i / 12
    r1, r2 = (dr - 8, dr - 26) if i % 3 == 0 else (dr - 8, dr - 18)
    s.append(f'<line x1="{dx + r1 * math.sin(a):.1f}" y1="{dy - r1 * math.cos(a):.1f}" x2="{dx + r2 * math.sin(a):.1f}" '
             f'y2="{dy - r2 * math.cos(a):.1f}" stroke="{INK}" stroke-width="{4 if i % 3 == 0 else 2}"/>')
s.append(f'<line x1="{dx}" y1="{dy}" x2="{dx + 40}" y2="{dy - 30}" stroke="{INK}" stroke-width="8" stroke-linecap="round"/>')
s.append(f'<line x1="{dx}" y1="{dy}" x2="{dx - 18}" y2="{dy - 78}" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>')
s.append(f'<line x1="{dx}" y1="{dy + 20}" x2="{dx + 60}" y2="{dy - 55}" stroke="{COPPER}" stroke-width="2.5"/>')
s.append(f'<circle cx="{dx}" cy="{dy}" r="8" fill="{INK}"/>')
s.append("</svg>")

out = sys.argv[1]
open(out, "w").write("\n".join(s) + "\n")
pct = lambda x, y: f"x={100 * (x - VX) / VW:.1f} y={100 * (y - VY) / VH:.1f}"
for name in ("barrel", "center", "escape", "balance", "dial"):
    x, y, _ = organs[name]
    print(f"{name}: {pct(x, y)}")
print(f"escapement (wheel and pallet fork): {pct((organs['escape'][0] + px) / 2, (organs['escape'][1] + py) / 2)}")
