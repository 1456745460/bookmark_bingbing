#!/usr/bin/env python3
"""Parse a Netscape-exported bookmarks.html and generate assets/js/bookmarks.js."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "source"
SOURCE_FILE = SOURCE_DIR / "bookmarks.html"
OUTPUT_FILE = ROOT / "assets" / "js" / "bookmarks.js"

TOKEN_RE = re.compile(
    r"(?P<folder><DT>\s*<H3(?P<folder_attrs>[^>]*)>(?P<folder_name>.*?)</H3>)"
    r"|(?P<link><DT>\s*<A(?P<link_attrs>[^>]*)>(?P<link_name>.*?)</A>)"
    r"|(?P<dl_open><DL\b[^>]*>)"
    r"|(?P<dl_close></DL>)",
    re.IGNORECASE | re.DOTALL,
)
ATTR_RE = re.compile(r'([A-Z_]+)\s*=\s*"([^"]*)"', re.IGNORECASE)
TAG_RE = re.compile(r"<[^>]+>")

CATEGORY_META = {
    "书签栏": {"label": "书签栏", "icon": "📌", "order": 10},
    "home": {"label": "日常", "icon": "🏠", "order": 20},
    "公司": {"label": "公司", "icon": "🏢", "order": 30},
    "影视": {"label": "影视", "icon": "🎬", "order": 40},
    "技术": {"label": "技术", "icon": "🛠️", "order": 50},
    "游戏": {"label": "游戏", "icon": "🎮", "order": 60},
    "AI": {"label": "AI", "icon": "✨", "order": 70},
    "机场": {"label": "机场", "icon": "✈️", "order": 80},
}

FALLBACK_META = {"label": "其他", "icon": "📦", "order": 90}

TITLE_SEPS = (" | ", " – ", " — ", " - ", " · ", " –", " |")


def parse_attrs(raw: str) -> dict[str, str]:
    return {key.upper(): value for key, value in ATTR_RE.findall(raw or "")}


def clean_text(raw: str) -> str:
    text = TAG_RE.sub("", raw or "")
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def short_title(title: str, host: str) -> str:
    text = title.strip()
    if not text:
        return host or "未命名"
    for sep in TITLE_SEPS:
        if sep in text:
            left = text.split(sep, 1)[0].strip()
            if 1 < len(left) <= 32:
                text = left
                break
    if len(text) > 22:
        text = text[:21].rstrip() + "…"
    return text


def host_of(url: str) -> str:
    try:
        parsed = urlparse(url)
        return (parsed.hostname or "").lower()
    except Exception:
        return ""


def make_id(url: str) -> str:
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]


def category_id(path: list[str]) -> str:
    if not path:
        return "other"
    leaf = path[-1]
    mapped = CATEGORY_META.get(leaf)
    if mapped:
        return leaf if leaf != "home" else "home"
    slug = re.sub(r"[^a-zA-Z0-9\u4e00-\u9fff]+", "-", leaf).strip("-")
    return slug or "other"


def category_meta(path: list[str]) -> tuple[str, dict]:
    cid = category_id(path)
    leaf = path[-1] if path else ""
    meta = CATEGORY_META.get(leaf, {
        "label": leaf or FALLBACK_META["label"],
        "icon": FALLBACK_META["icon"],
        "order": FALLBACK_META["order"] + len(path),
    }).copy()
    if leaf and leaf not in CATEGORY_META:
        meta["label"] = leaf
    if not path:
        meta = FALLBACK_META.copy()
        cid = "other"
    return cid, meta


def parse_netscape(html_text: str) -> list[dict]:
    folder_stack: list[str] = []
    pending_folder: str | None = None
    items: list[dict] = []
    seen: set[str] = set()

    for match in TOKEN_RE.finditer(html_text):
        kind = match.lastgroup
        if kind == "folder":
            pending_folder = clean_text(match.group("folder_name"))
        elif kind == "dl_open":
            if pending_folder:
                folder_stack.append(pending_folder)
                pending_folder = None
        elif kind == "dl_close":
            pending_folder = None
            if folder_stack:
                folder_stack.pop()
        elif kind == "link":
            attrs = parse_attrs(match.group("link_attrs"))
            url = html.unescape(attrs.get("HREF", "")).strip()
            if not url or url.lower().startswith("javascript:"):
                continue
            if url.lower().startswith("place:"):
                continue
            title = clean_text(match.group("link_name"))
            host = host_of(url)
            item_id = make_id(url)
            if item_id in seen:
                continue
            seen.add(item_id)
            cid, meta = category_meta(folder_stack)
            add_date = attrs.get("ADD_DATE", "")
            items.append({
                "id": item_id,
                "title": title or host or url,
                "shortTitle": short_title(title, host),
                "url": url,
                "host": host,
                "addDate": int(add_date) if add_date.isdigit() else None,
                "categoryId": cid,
                "categoryLabel": meta["label"],
                "folderPath": "/".join(folder_stack),
            })
    return items


def build_payload(items: list[dict], source_name: str) -> dict:
    grouped: dict[str, dict] = {}
    for item in items:
        cid = item["categoryId"]
        if cid not in grouped:
            leaf = item["folderPath"].split("/")[-1] if item["folderPath"] else ""
            _, meta = category_meta(item["folderPath"].split("/") if item["folderPath"] else [])
            if cid == "other":
                meta = FALLBACK_META.copy()
            grouped[cid] = {
                "id": cid,
                "label": item["categoryLabel"] or meta["label"],
                "icon": meta["icon"],
                "order": meta["order"],
                "count": 0,
                "items": [],
            }
        grouped[cid]["items"].append({
            "id": item["id"],
            "title": item["title"],
            "shortTitle": item["shortTitle"],
            "url": item["url"],
            "host": item["host"],
            "addDate": item["addDate"],
        })
        grouped[cid]["count"] += 1

    categories = sorted(grouped.values(), key=lambda c: (c["order"], c["label"]))
    return {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sourceFile": source_name,
        "total": len(items),
        "categories": categories,
    }


def write_js(payload: dict) -> None:
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    OUTPUT_FILE.write_text(
        "/* generated by scripts/update.py — do not edit by hand */\n"
        f"window.BOOKMARKS = {body};\n",
        encoding="utf-8",
    )


def resolve_input(path_arg: str | None) -> Path:
    if path_arg:
        candidate = Path(path_arg).expanduser().resolve()
        if not candidate.is_file():
            raise FileNotFoundError(f"找不到书签文件：{candidate}")
        return candidate
    if SOURCE_FILE.is_file():
        return SOURCE_FILE
    raise FileNotFoundError(
        "未指定书签文件，且 source/bookmarks.html 不存在。\n"
        "用法：python3 scripts/update.py /path/to/bookmarks.html"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="用浏览器导出的 bookmarks.html 更新导航数据")
    parser.add_argument("html", nargs="?", help="Netscape 格式书签 HTML（Chrome/Edge/Firefox 导出）")
    args = parser.parse_args(argv)

    src = resolve_input(args.html)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    if src.resolve() != SOURCE_FILE.resolve():
        shutil.copy2(src, SOURCE_FILE)

    text = SOURCE_FILE.read_text(encoding="utf-8", errors="replace")
    if "NETSCAPE-Bookmark-file" not in text and "<DT>" not in text:
        print("警告：文件看起来不像浏览器导出的书签 HTML。", file=sys.stderr)

    items = parse_netscape(text)
    if not items:
        print("解析结果为空，请确认导出格式为 Netscape HTML。", file=sys.stderr)
        return 1

    payload = build_payload(items, SOURCE_FILE.name)
    write_js(payload)

    print(f"已更新 {payload['total']} 条书签 → {OUTPUT_FILE.relative_to(ROOT)}")
    print(f"源文件：{SOURCE_FILE.relative_to(ROOT)}")
    for cat in payload["categories"]:
        print(f"  {cat['icon']} {cat['label']}: {cat['count']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
