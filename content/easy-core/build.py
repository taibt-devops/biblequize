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

# kinhthanh.httlvn.org book codes in canonical order, with the seed book name (Question.book)
# and the Vietnamese name used in references. Exodus follows RVV11 ("Ai Cập"); the rest use
# the names churchgoers already know.
_CODES = ("sa xu le dan phu gios cac ru 1sa 2sa 1vua 2vua 1su 2su exo ne et giop thi ch tr nha es "
          "gie ca exe da os gio am ap gion mi na ha so ag xa ma "
          "mat mac lu gi cong ro 1co 2co ga eph phi co 1te 2te 1ti 2ti tit phil he gia 1phi 2phi "
          "1gi 2gi 3gi giu kh").split()
_SEED = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
         "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
         "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Songs", "Isaiah",
         "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah",
         "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
         "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians",
         "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
         "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter",
         "1 John", "2 John", "3 John", "Jude", "Revelation"]
_VN = ["Sáng Thế Ký", "Xuất Ai Cập Ký", "Lê-vi Ký", "Dân Số Ký", "Phục Truyền Luật Lệ Ký", "Giô-suê",
       "Các Quan Xét", "Ru-tơ", "1 Sa-mu-ên", "2 Sa-mu-ên", "1 Các Vua", "2 Các Vua", "1 Sử Ký",
       "2 Sử Ký", "E-xơ-ra", "Nê-hê-mi", "Ê-xơ-tê", "Gióp", "Thi Thiên", "Châm Ngôn", "Truyền Đạo",
       "Nhã Ca", "Ê-sai", "Giê-rê-mi", "Ca Thương", "Ê-xê-chi-ên", "Đa-ni-ên", "Ô-sê", "Giô-ên",
       "A-mốt", "Áp-đia", "Giô-na", "Mi-chê", "Na-hum", "Ha-ba-cúc", "Sô-phô-ni", "A-ghê",
       "Xa-cha-ri", "Ma-la-chi",
       "Ma-thi-ơ", "Mác", "Lu-ca", "Giăng", "Công Vụ Các Sứ Đồ", "Rô-ma", "1 Cô-rinh-tô",
       "2 Cô-rinh-tô", "Ga-la-ti", "Ê-phê-sô", "Phi-líp", "Cô-lô-se", "1 Tê-sa-lô-ni-ca",
       "2 Tê-sa-lô-ni-ca", "1 Ti-mô-thê", "2 Ti-mô-thê", "Tít", "Phi-lê-môn", "Hê-bơ-rơ", "Gia-cơ",
       "1 Phi-e-rơ", "2 Phi-e-rơ", "1 Giăng", "2 Giăng", "3 Giăng", "Giu-đe", "Khải Huyền"]
assert len(_CODES) == len(_SEED) == len(_VN) == 66
# site code -> (seed book name, Vietnamese book name, testament)
BOOKS = {c: (s, v, "Cựu Ước" if i < 39 else "Tân Ước") for i, (c, s, v) in enumerate(zip(_CODES, _SEED, _VN))}
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
    # Spread the correct answer evenly over A-D: each run of 4 questions uses every slot once.
    # The pilot keeps its original plain shuffle because play-test results refer to that order.
    balanced, slots = name != "pilot", []
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
        if balanced:
            if not slots:
                slots = [0, 1, 2, 3]
                rng.shuffle(slots)
            wrong = list(q["wrong"])
            rng.shuffle(wrong)
            pos = slots.pop()
            options = wrong[:pos] + [q["a"]] + wrong[pos:]
        else:
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


def show(spec: str) -> None:
    """Print verses for writing: `python build.py show sa 3` or `show sa 3:1-7`."""
    code, _, rest = spec.partition(" ")
    chap, _, span = rest.partition(":")
    verses = chapter(code, int(chap))
    lo, _, hi = span.partition("-")
    lo = int(lo) if lo else 1
    hi = int(hi) if hi else (int(lo) if span and not hi else max(map(int, verses)))
    for v in range(lo, hi + 1):
        if str(v) in verses:
            print(f"{v} {verses[str(v)]}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "show":
        for spec in sys.argv[2:]:
            print(f"== {spec}")
            show(spec)
        sys.exit(0)
    names = sys.argv[1:] or ["pilot"]
    sys.exit(max(build(n) for n in names))
