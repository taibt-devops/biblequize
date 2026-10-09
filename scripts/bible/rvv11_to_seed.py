#!/usr/bin/env python3
"""Build BibleTextImporter seed files from the RVV11 chapters cached by content/easy-core/build.py.

Usage:
    python scripts/bible/rvv11_to_seed.py check        # report against the canonical verse table only
    python scripts/bible/rvv11_to_seed.py write        # write apps/api/src/main/resources/seed/bible/rvv11/

Source used for Memorize mode (DECISIONS 2026-10-09): Bản Truyền Thống Hiệu Đính 2010 (RVV11),
read from kinhthanh.httlvn.org one chapter at a time (cache: content/easy-core/.cache/rvv11/,
fetched on demand at 1.5 s per page). The user confirmed the right to use the full text
(DECISIONS 2026-09-15, D2).

Output matches scripts/bible/usfm_to_seed.py: one file per book, `NN-Book.json` (canonical order,
`_` for spaces), a JSON array of {"chapter", "verse", "text"}, one verse per line.
A block RVV11 prints as one ("17-18") is stored under its first verse with "verseEnd".

RVV11 numbers verses its own way in a few places, compared with the app's canonical table
(apps/web/src/data/bibleData.ts, mirror of BibleStructure.java): verses only in late manuscripts are
left out (Matthew 17:21…), a few Old Testament chapters follow the Hebrew numbering (Jonah 2:1-11),
and some verses are merged. Those differences are listed, and written to rvv11/DIFFERENCES.md;
`write` refuses only on real problems (empty text, markup left over, a chapter with no verses).
"""
import importlib.util
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps" / "api" / "src" / "main" / "resources" / "seed" / "bible" / "rvv11"
_spec = importlib.util.spec_from_file_location("easy_core_build", ROOT / "content" / "easy-core" / "build.py")
core = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(core)

# Leftovers of the page markup or of footnote markers that must not reach the app. Square brackets
# are RVV11's own (passages missing from the oldest manuscripts, e.g. Mark 16:9-20).
SUSPECT = re.compile(r"[<>{}*+#\\|⚓]|&\w+;")


def canonical() -> dict[str, list[int]]:
    """English book key -> verses per chapter, from the web's copy of BibleStructure."""
    src = (ROOT / "apps" / "web" / "src" / "data" / "bibleData.ts").read_text(encoding="utf-8")
    table = {}
    for name, counts in re.findall(r"^\s*'([^']+)': \[([\d,]+)\],$", src, re.M):
        table[name] = [int(n) for n in counts.split(",")]
    if len(table) != 66:
        raise SystemExit(f"expected 66 books in bibleData.ts, found {len(table)}")
    return table


def book_rows(code: str, counts: list[int], problems: list[str], differences: list[str]) -> list[dict]:
    seed_book = core.BOOKS[code][0]
    rows = []
    for chap, n in enumerate(counts, 1):
        verses = core.chapter(code, chap)
        merged = verses.get("merged", {})
        odd = [v for v in verses if not v.isdigit() and v != "merged"]
        if odd:
            problems.append(f"{seed_book} {chap}: unexpected keys {odd}")
        keys = sorted(int(v) for v in verses if v.isdigit())
        if not keys:
            problems.append(f"{seed_book} {chap}: no verses")
            continue
        covered = set()
        for v in keys:
            last = int(merged.get(str(v), v))
            covered.update(range(v, last + 1))
            text = unicodedata.normalize("NFC", re.sub(r"\s+", " ", verses[str(v)]).strip())
            if not text:
                problems.append(f"{seed_book} {chap}:{v}: empty")
            elif SUSPECT.search(text):
                problems.append(f"{seed_book} {chap}:{v}: suspect characters: {text[:80]}")
            row = {"chapter": chap, "verse": v}
            if last != v:
                row["verseEnd"] = last
                differences.append(f"{seed_book} {chap}:{v}-{last} merged")
            row["text"] = text
            rows.append(row)
        canon = set(range(1, n + 1))
        if covered != canon:
            missing, extra = sorted(canon - covered), sorted(covered - canon)
            differences.append(f"{seed_book} {chap}: canonical 1-{n}, RVV11 1-{max(covered)}"
                               + (f", no {missing}" if missing else "") + (f", extra {extra}" if extra else ""))
    return rows


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"
    table = canonical()
    problems: list[str] = []
    differences: list[str] = []
    books = []
    for order, (code, (seed_book, _vn, _t)) in enumerate(core.BOOKS.items(), 1):
        books.append((order, seed_book, book_rows(code, table[seed_book], problems, differences)))
    total = sum(len(rows) for _, _, rows in books)
    print(f"{len(books)} books, {total} rows, {len(differences)} difference(s), {len(problems)} problem(s)")
    for p in problems[:200]:
        print("  -", p)
    if mode != "write":
        return 0
    if problems:
        print("not written: fix the problems first")
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    header = ("# RVV11 vs the canonical verse table (BibleStructure)\n\n"
              "Generated by scripts/bible/rvv11_to_seed.py. Merged blocks are stored under their first verse\n"
              "with verseEnd; verses RVV11 leaves out have no row.\n\n")
    (OUT / "DIFFERENCES.md").write_text(header + "".join(f"- {d}\n" for d in differences),
                                        encoding="utf-8", newline="\n")
    for order, book, rows in books:
        target = OUT / f"{order:02d}-{book.replace(' ', '_')}.json"
        lines = ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows)
        target.write_text("[\n" + lines + "\n]\n", encoding="utf-8", newline="\n")
    print(f"wrote {len(books)} books → {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
