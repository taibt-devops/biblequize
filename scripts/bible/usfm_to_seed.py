#!/usr/bin/env python3
"""Convert a USFM Bible (66 books) into BibleTextImporter seed files.

Usage:
    python scripts/bible/usfm_to_seed.py <usfm_dir> <out_dir>

Source used for Memorize mode (DECISIONS 2026-09-15): eBible.org `vie1934`
(Vietnamese Traditional Version 1926, William Cadman) — Public Domain.
    https://ebible.org/Scriptures/vie1934_usfm.zip

Output: one file per book, `NN-Book.json` (canonical order, `_` for spaces), each a JSON
array of {"chapter", "verse", "text"} — one verse per line so diffs stay readable.
Only \\id \\c \\v (and ignorable headings/paragraph markers) are expected; anything else
aborts so a different USFM flavour can't silently leak markup into verse text.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

# USFM book id → English key used by questions.book / BibleStructure, in canonical order.
BOOKS = [
    ("GEN", "Genesis"), ("EXO", "Exodus"), ("LEV", "Leviticus"), ("NUM", "Numbers"), ("DEU", "Deuteronomy"),
    ("JOS", "Joshua"), ("JDG", "Judges"), ("RUT", "Ruth"), ("1SA", "1 Samuel"), ("2SA", "2 Samuel"),
    ("1KI", "1 Kings"), ("2KI", "2 Kings"), ("1CH", "1 Chronicles"), ("2CH", "2 Chronicles"), ("EZR", "Ezra"),
    ("NEH", "Nehemiah"), ("EST", "Esther"), ("JOB", "Job"), ("PSA", "Psalms"), ("PRO", "Proverbs"),
    ("ECC", "Ecclesiastes"), ("SNG", "Song of Songs"), ("ISA", "Isaiah"), ("JER", "Jeremiah"), ("LAM", "Lamentations"),
    ("EZK", "Ezekiel"), ("DAN", "Daniel"), ("HOS", "Hosea"), ("JOL", "Joel"), ("AMO", "Amos"),
    ("OBA", "Obadiah"), ("JON", "Jonah"), ("MIC", "Micah"), ("NAM", "Nahum"), ("HAB", "Habakkuk"),
    ("ZEP", "Zephaniah"), ("HAG", "Haggai"), ("ZEC", "Zechariah"), ("MAL", "Malachi"), ("MAT", "Matthew"),
    ("MRK", "Mark"), ("LUK", "Luke"), ("JHN", "John"), ("ACT", "Acts"), ("ROM", "Romans"),
    ("1CO", "1 Corinthians"), ("2CO", "2 Corinthians"), ("GAL", "Galatians"), ("EPH", "Ephesians"), ("PHP", "Philippians"),
    ("COL", "Colossians"), ("1TH", "1 Thessalonians"), ("2TH", "2 Thessalonians"), ("1TI", "1 Timothy"), ("2TI", "2 Timothy"),
    ("TIT", "Titus"), ("PHM", "Philemon"), ("HEB", "Hebrews"), ("JAS", "James"), ("1PE", "1 Peter"),
    ("2PE", "2 Peter"), ("1JN", "1 John"), ("2JN", "2 John"), ("3JN", "3 John"), ("JUD", "Jude"),
    ("REV", "Revelation"),
]

IGNORED = {"ide", "h", "toc1", "toc2", "toc3", "mt1", "mt2", "mt", "p", "q", "q1", "q2", "m", "b", "nb"}
MARKER = re.compile(r"\\(\w+)\s*")


def parse_book(path: Path, expected_id: str) -> list[dict]:
    text = unicodedata.normalize("NFC", path.read_text(encoding="utf-8-sig"))
    verses: list[dict] = []
    chapter = 0
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        m = re.match(r"\\(\w+)\s*(.*)$", line)
        if not m:  # continuation of the previous verse
            if not verses:
                raise ValueError(f"{path.name}: text before first verse: {line[:60]}")
            verses[-1]["text"] += " " + line
            continue
        tag, rest = m.group(1), m.group(2)
        if tag == "id":
            if not rest.startswith(expected_id):
                raise ValueError(f"{path.name}: expected \\id {expected_id}, got {rest[:10]}")
        elif tag == "c":
            chapter = int(rest.split()[0])
        elif tag == "v":
            num, _, body = rest.partition(" ")
            verses.append({"chapter": chapter, "verse": int(num), "text": body})
        elif tag not in IGNORED:
            raise ValueError(f"{path.name}: unsupported USFM marker \\{tag}")
    for v in verses:
        v["text"] = re.sub(r"\s+", " ", v["text"]).strip()
        if not v["text"] or "\\" in v["text"]:
            raise ValueError(f"{path.name} {v['chapter']}:{v['verse']}: empty or markup left in text")
    return verses


def main() -> None:
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    total = 0
    for order, (usfm_id, book) in enumerate(BOOKS, start=1):
        matches = sorted(src.glob(f"*-{usfm_id}*.usfm")) or sorted(src.glob(f"*{usfm_id}*.usfm"))
        if len(matches) != 1:
            raise SystemExit(f"{usfm_id}: expected exactly one USFM file, found {len(matches)}")
        verses = parse_book(matches[0], usfm_id)
        target = out / f"{order:02d}-{book.replace(' ', '_')}.json"
        lines = ",\n".join(json.dumps(v, ensure_ascii=False, separators=(",", ":")) for v in verses)
        target.write_text("[\n" + lines + "\n]\n", encoding="utf-8", newline="\n")
        total += len(verses)
    print(f"wrote {len(BOOKS)} books, {total} verses → {out}")


if __name__ == "__main__":
    main()
