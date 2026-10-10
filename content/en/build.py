"""Build the English question set, written from the Berean Standard Bible (BSB), one source per book.

    python content/en/build.py gen joh          # gen.src.json -> gen_quiz.json (checked against BSB)
    python content/en/build.py show "gen 3:1-7" # print BSB verses for writing
    python content/en/build.py export           # every *_quiz.json here -> the app's seed file
    python content/en/build.py retire genesis_quiz_en.json   # before deleting an old English seed file

The BSB text is public domain and lives here as bsb_vpl.txt (eBible.org "engbsb" VPL export,
"GEN 1:1 In the beginning..."). Book codes are its codes in lower case: gen, exo, … joh, phm, rev.
A source entry:
    {"ref": "gen 3:6", "d": "easy" | "medium" | "hard", "q": ..., "a": ..., "wrong": [3 options],
     "why": one sentence, "quote": verbatim BSB text from the cited verses,
     "story": optional story id (content/en/stories_en.json) for Easy questions on a core story}
`export` merges every built book into apps/api/src/main/resources/seed/questions/bsb_en_quiz.json.
"""
import importlib.util
import json
import random
import re
import sys
from collections import Counter
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).parent
_spec = importlib.util.spec_from_file_location("easy_core_build", HERE.parent / "easy-core" / "build.py")
core = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(core)

_CODES = ("gen exo lev num deu jos jdg rut 1sa 2sa 1ki 2ki 1ch 2ch ezr neh est job psa pro ecc sol isa "
          "jer lam eze dan hos joe amo oba jon mic nah hab zep hag zec mal "
          "mat mar luk joh act rom 1co 2co gal eph phi col 1th 2th 1ti 2ti tit phm heb jam 1pe 2pe "
          "1jo 2jo 3jo jud rev").split()
assert len(_CODES) == len(core._SEED) == 66
# BSB code -> (seed book name, testament tag)
BOOKS = {c: (s, "Old Testament" if i < 39 else "New Testament") for i, (c, s) in enumerate(zip(_CODES, core._SEED))}
REF = re.compile(r"^([a-z0-9]+) (\d+):(\d+)(?:-(\d+))?$")
LEVELS = ("easy", "medium", "hard")
MAX_QUESTION_WORDS = 24
MAX_EASY_QUESTION_WORDS = 20
MAX_ANSWER_WORDS = 8
SEED_FILE = core.API_RES / "questions" / "bsb_en_quiz.json"
# content_hash of every old English question whose seed file was deleted: export refuses to bring
# their text back.
RETIRED = HERE / "retired_hashes.txt"
STORIES = json.loads((HERE / "stories_en.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=None)
def bible() -> dict:
    """{(code, chapter, verse): text} from bsb_vpl.txt."""
    verses = {}
    for line in (HERE / "bsb_vpl.txt").read_text(encoding="utf-8").splitlines():
        m = re.match(r"^(\w+) (\d+):(\d+) (.*)$", line)
        if m:
            verses[(m.group(1).lower(), int(m.group(2)), int(m.group(3)))] = m.group(4).strip()
    return verses


def passage(code: str, chap: int, v1: int, v2: int) -> str:
    return " ".join(bible().get((code, chap, v), "") for v in range(v1, v2 + 1)).strip()


def book_name(seed_book: str) -> str:
    return "Psalm" if seed_book == "Psalms" else seed_book


def build(code: str) -> int:
    src = json.loads((HERE / f"{code}.src.json").read_text(encoding="utf-8"))
    out, problems = [], []
    rng = random.Random(f"bsb-en-{code}")
    slots: list[int] = []
    for i, q in enumerate(src, 1):
        tag = f"#{i} [{q.get('ref')}] {q.get('q', '')[:40]}"
        m = REF.match(q["ref"])
        if not m or m.group(1) not in BOOKS:
            problems.append(f"{tag}: bad ref")
            continue
        if m.group(1) != code:
            problems.append(f"{tag}: ref is not in book '{code}'")
        if q.get("d") not in LEVELS:
            problems.append(f"{tag}: d must be one of {LEVELS}")
        story = q.get("story")
        if story is not None and (story not in STORIES or q.get("d") != "easy"):
            problems.append(f"{tag}: story must be an id from stories_en.json, on an easy question")
        chap, v1, v2 = int(m.group(2)), int(m.group(3)), int(m.group(4) or m.group(3))
        text = passage(code, chap, v1, v2)
        if not text:
            problems.append(f"{tag}: no BSB text for {code} {chap}:{v1}-{v2}")
        elif q["quote"] not in text:
            problems.append(f"{tag}: quote not verbatim in BSB {code} {chap}:{v1}-{v2}")
        options = [q["a"], *q["wrong"]]
        if len(options) != 4 or len({o.lower() for o in options}) != 4:
            problems.append(f"{tag}: need 4 distinct options")
        limit = MAX_EASY_QUESTION_WORDS if q.get("d") == "easy" else MAX_QUESTION_WORDS
        if core.words(q["q"]) > limit:
            problems.append(f"{tag}: question has {core.words(q['q'])} words (max {limit})")
        for o in options:
            if core.words(o) > MAX_ANSWER_WORDS:
                problems.append(f"{tag}: option '{o}' too long")
        if re.search(r"\b\d+:\d+\b|\bchapter \d+|\bverse \d+", q["q"], re.I):
            problems.append(f"{tag}: questions must not cite chapter/verse")
        # spread the correct answer evenly over A-D: every run of 4 questions uses each slot once
        if not slots:
            slots = [0, 1, 2, 3]
            rng.shuffle(slots)
        wrong = list(q["wrong"])
        rng.shuffle(wrong)
        pos = slots.pop()
        options = wrong[:pos] + [q["a"]] + wrong[pos:]
        seed_book, testament = BOOKS[m.group(1)]
        ref = f"{book_name(seed_book)} {chap}:{v1}" + (f"-{v2}" if v2 != v1 else "")
        item = {
            "book": seed_book, "chapter": chap, "verseStart": v1,
            "difficulty": q.get("d"), "type": "multiple_choice_single",
            "content": q["q"], "options": options, "correctAnswer": [options.index(q["a"])],
            "explanation": f"{q['why']} “{q['quote']}” ({ref}, BSB)",
            "language": "en",
            "tags": (["Core story", STORIES[story][0]] if story else []) + [testament, "BSB"],
        }
        if v2 != v1:
            item["verseEnd"] = v2
        if story:
            item["story"] = story
        out.append(item)
    levels = Counter(q.get("d") for q in src)
    stories = sum(1 for q in src if q.get("story"))
    print(f"{code}: {len(src)} questions {dict(levels)}, {stories} on core stories; answer slots "
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
    # A question whose content_hash already exists is skipped by the seeder, and retired text must
    # not come back.
    other = {h: "a retired seed file" for h in RETIRED.read_text(encoding="utf-8").split()} if RETIRED.exists() else {}
    for f in (core.API_RES / "questions").glob("*_quiz*.json"):
        if f.name != SEED_FILE.name:
            for q in json.loads(f.read_text(encoding="utf-8")):
                other[core.content_hash(q)] = f.name
    problems += [f"same as a question in {other[core.content_hash(q)]}: [{q['book']} {q['chapter']}:{q['verseStart']}] {q['content']}"
                 for q in merged if core.content_hash(q) in other]
    if problems:
        print(f"{len(problems)} problem(s):")
        for p in problems:
            print("  -", p)
        return 1
    SEED_FILE.write_text(json.dumps(merged, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    books = Counter((q["book"], q["difficulty"]) for q in merged)
    stories = Counter(q["story"] for q in merged if q.get("story"))
    print(f"exported {len(merged)} questions to {SEED_FILE.name} ({len(stories)} core stories)")
    for book in sorted({b for b, _ in books}):
        print(f"  {book}: easy {books[(book, 'easy')]}, medium {books[(book, 'medium')]}, hard {books[(book, 'hard')]}")
    print("old English questions of these books can be retired:", ", ".join(sorted({b for b, _ in books})))
    return 0


def retire(names: list[str]) -> int:
    """Record the content hashes of old English seed files about to be deleted (see RETIRED)."""
    known = set(RETIRED.read_text(encoding="utf-8").split()) if RETIRED.exists() else set()
    added = 0
    for name in names:
        for q in json.loads((core.API_RES / "questions" / name).read_text(encoding="utf-8")):
            h = core.content_hash(q)
            if h not in known:
                known.add(h)
                added += 1
    with RETIRED.open("w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(sorted(known)) + "\n")
    print(f"recorded {added} new hashes ({len(known)} in {RETIRED.name}); now delete: {' '.join(names)}")
    return 0


def show(spec: str) -> None:
    """Print verses for writing: `show "gen 3"` or `show "gen 3:1-7"`."""
    code, _, rest = spec.partition(" ")
    chap, _, span = rest.partition(":")
    chap = int(chap)
    lo, _, hi = span.partition("-")
    last = max(v for (c, ch, v) in bible() if c == code and ch == chap)
    lo = int(lo) if lo else 1
    hi = int(hi) if hi else (lo if span else last)
    for v in range(lo, hi + 1):
        if (code, chap, v) in bible():
            print(f"{v} {bible()[(code, chap, v)]}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        sys.exit(export())
    if len(sys.argv) > 1 and sys.argv[1] == "retire":
        sys.exit(retire(sys.argv[2:]))
    if len(sys.argv) > 1 and sys.argv[1] == "show":
        for spec in sys.argv[2:]:
            print(f"== {spec}")
            show(spec)
        sys.exit(0)
    sys.exit(max(build(c) for c in sys.argv[1:]) if len(sys.argv) > 1 else 0)
