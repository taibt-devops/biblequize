"""Build the RVV11 Medium/Hard question sets, one human-edited source file per book.

    python content/books/build.py sa mat         # sa.src.json -> sa_quiz.json (checked against RVV11)
    python content/books/build.py export         # every *_quiz.json here -> the app's seed file
    python content/books/build.py retire genesis_quiz.json   # before deleting an old seed file

Shares the RVV11 reader, cache and checks with content/easy-core/build.py. A source entry:
    {"ref": "sa 14:18", "d": "medium" | "hard", "q": ..., "a": ..., "wrong": [3 options],
     "why": one sentence, "quote": verbatim RVV11 text from the cited verses}
`export` merges every built book into apps/api/src/main/resources/seed/questions/rvv11_books_quiz.json
and prints the books whose old (1925-era) Vietnamese questions can now be retired.
"""
import importlib.util
import json
import random
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
_spec = importlib.util.spec_from_file_location("easy_core_build", HERE.parent / "easy-core" / "build.py")
core = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(core)

LEVELS = ("medium", "hard")
MAX_QUESTION_WORDS = 26
MAX_ANSWER_WORDS = 10
SEED_FILE = core.API_RES / "questions" / "rvv11_books_quiz.json"
# content_hash of every old Vietnamese question whose seed file was deleted. Those rows stay in the
# database (deactivated), so a new question with the same hash would be skipped by the seeder.
RETIRED = HERE / "retired_hashes.txt"


def build(code: str) -> int:
    src = json.loads((HERE / f"{code}.src.json").read_text(encoding="utf-8"))
    out, problems = [], []
    rng = random.Random(f"rvv11-books-{code}")
    slots: list[int] = []
    for i, q in enumerate(src, 1):
        tag = f"#{i} [{q.get('ref')}] {q.get('q', '')[:40]}"
        m = core.REF.match(q["ref"])
        if not m or m.group(1) not in core.BOOKS:
            problems.append(f"{tag}: bad ref")
            continue
        if m.group(1) != code:
            problems.append(f"{tag}: ref is not in book '{code}'")
        if q.get("d") not in LEVELS:
            problems.append(f"{tag}: d must be one of {LEVELS}")
        chap, v1, v2 = int(m.group(2)), int(m.group(3)), int(m.group(4) or m.group(3))
        verses = core.chapter(m.group(1), chap)
        text = " ".join(verses.get(str(v), "") for v in range(v1, v2 + 1))
        if q["quote"] not in text:
            problems.append(f"{tag}: quote not verbatim in RVV11 {m.group(1)} {chap}:{v1}-{v2}")
        options = [q["a"], *q["wrong"]]
        if len(options) != 4 or len(set(options)) != 4:
            problems.append(f"{tag}: need 4 distinct options")
        if core.words(q["q"]) > MAX_QUESTION_WORDS:
            problems.append(f"{tag}: question has {core.words(q['q'])} words (max {MAX_QUESTION_WORDS})")
        for o in options:
            if core.words(o) > MAX_ANSWER_WORDS:
                problems.append(f"{tag}: option '{o}' too long")
        if re.search(r"\b\d+:\d+\b|\bchương \d+", q["q"]):
            problems.append(f"{tag}: questions must not cite chapter/verse")
        # spread the correct answer evenly over A-D: every run of 4 questions uses each slot once
        if not slots:
            slots = [0, 1, 2, 3]
            rng.shuffle(slots)
        wrong = list(q["wrong"])
        rng.shuffle(wrong)
        pos = slots.pop()
        options = wrong[:pos] + [q["a"]] + wrong[pos:]
        seed_book, vn_book, testament = core.BOOKS[m.group(1)]
        ref_vn = f"{vn_book} {chap}:{v1}" + (f"-{v2}" if v2 != v1 else "")
        item = {
            "book": seed_book, "chapter": chap, "verseStart": v1,
            "difficulty": q.get("d"), "type": "multiple_choice_single",
            "content": q["q"], "options": options, "correctAnswer": [options.index(q["a"])],
            "explanation": f"{q['why']} “{q['quote']}” ({ref_vn})",
            "language": "vi", "tags": [testament, "RVV11"],
        }
        if v2 != v1:
            item["verseEnd"] = v2
        out.append(item)
    levels = Counter(q.get("d") for q in src)
    print(f"{code}: {len(src)} questions {dict(levels)}; answer slots "
          f"{dict(sorted(Counter('ABCD'[o['correctAnswer'][0]] for o in out).items()))}")
    if problems:
        print(f"{len(problems)} problem(s):")
        for p in problems:
            print("  -", p)
        return 1
    (HERE / f"{code}_quiz.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return 0


def export() -> int:
    merged = []
    for f in sorted(HERE.glob("*_quiz.json")):
        merged += json.loads(f.read_text(encoding="utf-8"))
    problems = []
    hashes = Counter(core.content_hash(q) for q in merged)
    problems += [f"duplicate question inside the set ({n}x): {h[:12]}" for h, n in hashes.items() if n > 1]
    # A question whose content_hash already exists is skipped by the seeder. The old files of the
    # books being replaced count too: they stay in the database (deactivated) after the switch.
    other = {h: "a retired seed file" for h in RETIRED.read_text(encoding="utf-8").split()} if RETIRED.exists() else {}
    for f in (core.API_RES / "questions").glob("*_quiz*.json"):
        if f.name != SEED_FILE.name:
            for q in json.loads(f.read_text(encoding="utf-8")):
                other[core.content_hash(q)] = f.name
    problems += [f"same as a question in {other[core.content_hash(q)]}: [{q['book']} {q['chapter']}:{q['verseStart']}] {q['content']}"
                 for q in merged if core.content_hash(q) in other]
    # Same verse, same answer as a "Dễ cốt lõi" question: the same fact asked twice.
    easy = json.loads((core.API_RES / "questions" / "easy_core_quiz.json").read_text(encoding="utf-8"))
    seen = {(q["book"], q["chapter"], q["verseStart"], q["options"][q["correctAnswer"][0]].lower()) for q in easy}
    problems += [f"same fact as a Dễ cốt lõi question: [{q['book']} {q['chapter']}:{q['verseStart']}] {q['content']}"
                 for q in merged
                 if (q["book"], q["chapter"], q["verseStart"], q["options"][q["correctAnswer"][0]].lower()) in seen]
    if problems:
        print(f"{len(problems)} problem(s):")
        for p in problems:
            print("  -", p)
        return 1
    SEED_FILE.write_text(json.dumps(merged, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    books = Counter((q["book"], q["difficulty"]) for q in merged)
    print(f"exported {len(merged)} questions to {SEED_FILE.name}")
    for book in sorted({b for b, _ in books}):
        print(f"  {book}: medium {books[(book, 'medium')]}, hard {books[(book, 'hard')]}")
    print("old vi questions of these books can be retired:", ", ".join(sorted({b for b, _ in books})))
    return 0


def retire(names: list[str]) -> int:
    """Record the content hashes of old seed files about to be deleted (see RETIRED)."""
    known = set(RETIRED.read_text(encoding="utf-8").split()) if RETIRED.exists() else set()
    added = 0
    for name in names:
        for q in json.loads((core.API_RES / "questions" / name).read_text(encoding="utf-8")):
            h = core.content_hash(q)
            if h not in known:
                known.add(h)
                added += 1
    RETIRED.write_text("\n".join(sorted(known)) + "\n", encoding="utf-8")
    print(f"recorded {added} new hashes ({len(known)} in {RETIRED.name}); now delete: {' '.join(names)}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        sys.exit(export())
    if len(sys.argv) > 1 and sys.argv[1] == "retire":
        sys.exit(retire(sys.argv[2:]))
    if len(sys.argv) > 1 and sys.argv[1] == "show":
        for spec in sys.argv[2:]:
            print(f"== {spec}")
            core.show(spec)
        sys.exit(0)
    sys.exit(max(build(c) for c in sys.argv[1:]) if len(sys.argv) > 1 else 0)
