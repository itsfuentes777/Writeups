#!/usr/bin/env python3
"""
Helper for the writeup site. Standard library only, Python 3.8+.

  python3 build.py                 Rebuild posts/index.json from posts/*.md
  python3 build.py new "Title"     Create a draft post from the template

Run the first command before every commit (or let the GitHub Action do it).
Posts with `published: false` in their front matter are left out of the index,
so drafts and active-box notes never go live by accident.
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
POSTS = ROOT / "posts"
INDEX = POSTS / "index.json"
KNOWN_DIFFICULTIES = {"easy", "medium", "hard", "insane"}


# ---------- front matter ----------

def strip_quotes(s):
    s = s.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "\"'":
        return s[1:-1]
    return s


def parse_value(raw):
    raw = raw.strip()
    if raw.startswith("[") and raw.endswith("]"):
        return [strip_quotes(x) for x in raw[1:-1].split(",") if x.strip()]
    if raw.lower() in ("true", "false"):
        return raw.lower() == "true"
    return strip_quotes(raw)


def parse_front_matter(text):
    m = re.match(r"^---[ \t]*\r?\n(.*?)\r?\n---[ \t]*\r?\n?(.*)$", text, re.S)
    if not m:
        return {}, text
    meta = {}
    for line in m.group(1).splitlines():
        line = line.rstrip()
        if not line.strip() or line.lstrip().startswith("#") or ":" not in line:
            continue
        key, value = line.split(":", 1)
        meta[key.strip().lower()] = parse_value(value)
    return meta, m.group(2)


# ---------- derived fields ----------

def auto_summary(body, limit=180):
    text = re.sub(r"```.*?```", "", body, flags=re.S)
    for para in re.split(r"\n\s*\n", text):
        p = para.strip()
        if not p or re.match(r"^([#>|!<]|[-*+] |\d+\. )", p):
            continue
        p = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", p)
        p = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", p)
        p = re.sub(r"[`*_]", "", p)
        p = " ".join(p.split())
        if p:
            if len(p) <= limit:
                return p
            return p[:limit].rsplit(" ", 1)[0].rstrip(",.;:") + "…"
    return ""


def pretty_title(stem):
    stem = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", stem)
    return stem.replace("-", " ").replace("_", " ").strip().title()


def post_date(meta, path):
    m = re.match(r"\d{4}-\d{2}-\d{2}", str(meta.get("date", "")))
    if m:
        return m.group(0)
    m = re.match(r"\d{4}-\d{2}-\d{2}", path.name)
    if m:
        return m.group(0)
    return date.fromtimestamp(path.stat().st_mtime).isoformat()


# ---------- commands ----------

def build():
    entries, skipped = [], []
    for path in sorted(POSTS.glob("*.md")):
        if path.name.startswith("_"):
            continue
        meta, body = parse_front_matter(path.read_text(encoding="utf-8-sig"))

        if meta.get("published") is False or meta.get("draft") is True:
            skipped.append(path.name)
            continue

        title = meta.get("title") or pretty_title(path.stem)
        if not meta.get("title"):
            print(f"  ! {path.name}: no title in front matter, using '{title}'")

        difficulty = str(meta.get("difficulty", "")).lower()
        if difficulty and difficulty not in KNOWN_DIFFICULTIES:
            print(f"  ! {path.name}: difficulty '{difficulty}' is not one of {sorted(KNOWN_DIFFICULTIES)}")

        tags = meta.get("tags", [])
        if isinstance(tags, str):
            tags = [tags]

        words = len(re.findall(r"\w+", re.sub(r"```.*?```", " ", body, flags=re.S)))

        entries.append({
            "slug": path.stem,
            "file": path.name,
            "title": title,
            "date": post_date(meta, path),
            "platform": meta.get("platform", ""),
            "category": str(meta.get("category", "")).lower(),
            "difficulty": difficulty,
            "points": meta.get("points", ""),
            "tags": [str(t).lower() for t in tags],
            "summary": meta.get("summary") or auto_summary(body),
            "minutes": max(1, round(words / 200)),
        })

    entries.sort(key=lambda e: (e["date"], e["title"]), reverse=True)
    INDEX.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Wrote {INDEX.relative_to(ROOT)} with {len(entries)} post(s).")
    for name in skipped:
        print(f"  - skipped {name} (unpublished)")


def new_post(title):
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "untitled"
    today = date.today().isoformat()
    path = POSTS / f"{today}-{slug}.md"
    if path.exists():
        sys.exit(f"{path.relative_to(ROOT)} already exists.")
    template = (POSTS / "_template.md").read_text(encoding="utf-8")
    path.write_text(template.replace("{{title}}", title).replace("{{date}}", today), encoding="utf-8")
    print(f"Created {path.relative_to(ROOT)} (draft: set `published: true` when ready).")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        build()
    elif args[0] == "new" and len(args) >= 2:
        new_post(" ".join(args[1:]))
    else:
        sys.exit(__doc__)
