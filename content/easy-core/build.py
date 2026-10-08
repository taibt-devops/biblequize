"""Build the "Dễ cốt lõi" question set from its human-edited source.

    python content/easy-core/build.py pilot          # pilot.src.json -> pilot_quiz.json

For every question it:
  * checks the quote is a verbatim substring of the cited verses in Kinh Thánh Bản Truyền Thống
    Hiệu Đính 2010 (RVV11), read from content/easy-core/.cache/rvv11/<code>-<chapter>.json and
    fetched from kinhthanh.httlvn.org when missing (one request per 1.5 s);
  * checks the writing rules of README.md (lengths, 4 distinct options, answer not repeated);
  * shuffles the options deterministically so the correct answer is spread over A-D;
  * writes the seed format read by QuestionSeeder (book, chapter, verseStart/verseEnd, difficulty,
    type, content, options, correctAnswer, explanation, language, tags).
The output is NOT under seed/questions on purpose: nothing is loaded until the set is approved.
"""
import html as htmlmod
import json
import random
import re
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
CACHE = HERE / ".cache" / "rvv11"

# site code -> (seed book name, RVV11 book name, testament)
BOOKS = {
    "sa": ("Genesis", "Sáng Thế Ký", "Cựu Ước"),
    "xu": ("Exodus", "Xuất Ai Cập Ký", "Cựu Ước"),
    "1sa": ("1 Samuel", "1 Sa-mu-ên", "Cựu Ước"),
    "da": ("Daniel", "Đa-ni-ên", "Cựu Ước"),
    "gion": ("Jonah", "Giô-na", "Cựu Ước"),
    "mat": ("Matthew", "Ma-thi-ơ", "Tân Ước"),
    "lu": ("Luke", "Lu-ca", "Tân Ước"),
    "gi": ("John", "Giăng", "Tân Ước"),
}
REF = re.compile(r"^([a-z0-9]+) (\d+):(\d+)(?:-(\d+))?$")
SPAN = re.compile(r'<span class="verse ([a-z0-9]+)_(\d+)_(\d+)">(.*?)</span>', re.S)
MAX_QUESTION_WORDS = 20
MAX_ANSWER_WORDS = 9


def clean(fragment: str) -> str:
    s = re.sub(r"<sup>\d+</sup>", "", fragment)
    s = re.sub(r"<a [^>]*>.*?</a>", "", s, flags=re.S)
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = htmlmod.unescape(s).replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()


def chapter(code: str, chap: int) -> dict:
    path = CACHE / f"{code}-{chap}.json"
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        url = f"https://kinhthanh.httlvn.org/doc-kinh-thanh/{code}/{chap}?v=RVV11"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (forbible content build)"})
        page = urllib.request.urlopen(req, timeout=30).read().decode("utf-8")
        verses = {}
        for c, ch, v, frag in SPAN.findall(page):
            if c == code and int(ch) == chap:
                verses[v] = (verses.get(v, "") + " " + clean(frag)).strip()
        path.write_text(json.dumps(verses, ensure_ascii=False), encoding="utf-8")
        time.sleep(1.5)
    return json.loads(path.read_text(encoding="utf-8"))


def words(s: str) -> int:
    return len(s.split())


def build(name: str) -> int:
    src = json.loads((HERE / f"{name}.src.json").read_text(encoding="utf-8"))
    out, problems = [], []
    rng = random.Random(f"easy-core-{name}")
    for i, q in enumerate(src, 1):
        tag = f"#{i} [{q['ref']}] {q['q'][:40]}"
        m = REF.match(q["ref"])
        if not m or m.group(1) not in BOOKS:
            problems.append(f"{tag}: bad ref")
            continue
        code, chap, v1, v2 = m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4) or m.group(3))
        verses = chapter(code, chap)
        text = " ".join(verses.get(str(v), "") for v in range(v1, v2 + 1))
        if q["quote"] not in text:
            problems.append(f"{tag}: quote not verbatim in RVV11 {code} {chap}:{v1}-{v2}")
        options = [q["a"], *q["wrong"]]
        if len(options) != 4 or len(set(options)) != 4:
            problems.append(f"{tag}: need 4 distinct options")
        if words(q["q"]) > MAX_QUESTION_WORDS:
            problems.append(f"{tag}: question has {words(q['q'])} words (max {MAX_QUESTION_WORDS})")
        for o in options:
            if words(o) > MAX_ANSWER_WORDS:
                problems.append(f"{tag}: option '{o}' too long")
        if re.search(r"\b\d+:\d+\b|\bchương \d+", q["q"]):
            problems.append(f"{tag}: easy questions must not cite chapter/verse")
        rng.shuffle(options)
        seed_book, vn_book, testament = BOOKS[code]
        ref_vn = f"{vn_book} {chap}:{v1}" + (f"-{v2}" if v2 != v1 else "")
        item = {
            "book": seed_book, "chapter": chap, "verseStart": v1,
            "difficulty": "easy", "type": "multiple_choice_single",
            "content": q["q"], "options": options, "correctAnswer": [options.index(q["a"])],
            "explanation": f"{q['why']} “{q['quote']}” ({ref_vn})",
            "language": "vi", "tags": ["Dễ cốt lõi", q["story"], testament, "RVV11"],
        }
        if v2 != v1:
            item["verseEnd"] = v2
        out.append(item)
    stories = Counter(q["story"] for q in src)
    print(f"{len(src)} questions, {len(stories)} stories:", dict(stories))
    print("correct answer position:", dict(sorted(Counter("ABCD"[o["correctAnswer"][0]] for o in out).items())))
    if problems:
        print(f"{len(problems)} problem(s):")
        for p in problems:
            print("  -", p)
        return 1
    (HERE / f"{name}_quiz.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("wrote", HERE / f"{name}_quiz.json")
    return 0


if __name__ == "__main__":
    sys.exit(build(sys.argv[1] if len(sys.argv) > 1 else "pilot"))
