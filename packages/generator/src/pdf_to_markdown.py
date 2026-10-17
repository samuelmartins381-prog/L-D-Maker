#!/usr/bin/env python3
"""PDF → Markdown for the generator's ingest step (ADR 0013), with pdfplumber (MIT).

Headings are recognised by font size (larger than the body text, which is the most frequent size);
lines are joined back into paragraphs. Each page starts with `<!-- page N -->`, which ingest.ts turns
into a traceability anchor; headings get their own anchors there too.

    python3 pdf_to_markdown.py <file.pdf>   → Markdown on stdout
"""
import sys
from collections import Counter

import pdfplumber


def line_size(line):
    sizes = [c.get("size", 0) for c in line.get("chars", []) if c.get("text", "").strip()]
    return round(max(sizes), 1) if sizes else 0


def main(path):
    with pdfplumber.open(path) as pdf:
        pages = [p.extract_text_lines(return_chars=True) for p in pdf.pages]
    # Body size: the size that carries the most characters.
    weight = Counter()
    for lines in pages:
        for line in lines:
            weight[line_size(line)] += len(line["text"])
    body = weight.most_common(1)[0][0] if weight else 0
    heading_sizes = sorted({line_size(l) for ls in pages for l in ls if line_size(l) >= body * 1.15}, reverse=True)
    level = {s: min(i + 1, 3) for i, s in enumerate(heading_sizes)}

    out = []
    for n, lines in enumerate(pages, 1):
        out.append(f"<!-- page {n} -->")
        para, heading, last_bottom, last_height = [], [], None, None

        def flush():
            if heading:
                out.append("#" * level[heading[0]] + " " + " ".join(heading[1:]))
                heading.clear()
            if para:
                out.append(" ".join(para))
                para.clear()

        for line in lines:
            size, text = line_size(line), line["text"].strip()
            if not text:
                continue
            gap = None if last_bottom is None else line["top"] - last_bottom
            if size in level:
                if not heading or heading[0] != size or (gap is not None and gap > last_height):
                    flush()
                    heading.append(size)
                heading.append(text)
            else:
                if heading:
                    flush()
                # A vertical gap larger than half a line starts a new paragraph.
                if para and gap is not None and gap > 0.5 * last_height:
                    flush()
                para.append(text)
            last_bottom, last_height = line["bottom"], line["bottom"] - line["top"]
        flush()
    print("\n\n".join(out))


if __name__ == "__main__":
    main(sys.argv[1])
