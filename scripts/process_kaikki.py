#!/usr/bin/env python3
"""
Extract German noun genders from the kaikki.org Wiktionary dump.

Download the source file (~1 GB) from:
  https://kaikki.org/dictionary/German/kaikki.org-dictionary-German.json

Usage:
  python3 process_kaikki.py kaikki.org-dictionary-German.json

Output: data/nouns.json (written to the project root relative to this script)
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

GENDER_TAGS = {'masculine': 'm', 'feminine': 'f', 'neuter': 'n'}
OUT_PATH = Path(__file__).parent.parent / 'data' / 'nouns.json'


def extract_gender(entry: dict) -> str | None:
    for tag in entry.get('tags', []):
        if tag in GENDER_TAGS:
            return GENDER_TAGS[tag]
    for sense in entry.get('senses', []):
        for tag in sense.get('tags', []):
            if tag in GENDER_TAGS:
                return GENDER_TAGS[tag]
    return None


def main() -> None:
    if len(sys.argv) < 2:
        print('Usage: python3 process_kaikki.py <kaikki-jsonl-file>', file=sys.stderr)
        sys.exit(1)

    source = Path(sys.argv[1])
    nouns: dict[str, str] = {}
    conflicts: dict[str, set] = defaultdict(set)

    with source.open(encoding='utf-8') as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            if entry.get('pos') != 'noun':
                continue

            word = entry.get('word', '').strip().lower()
            if not word or ' ' in word or len(word) < 2:
                continue

            gender = extract_gender(entry)
            if not gender:
                continue

            if word in nouns and nouns[word] != gender:
                # Homonyms with different genders (e.g. "der See" vs "die See"):
                # record the conflict and remove at the end.
                conflicts[word].add(nouns[word])
                conflicts[word].add(gender)
            else:
                nouns[word] = gender

    for word in conflicts:
        nouns.pop(word, None)

    result = dict(sorted(nouns.items()))
    OUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')

    print(
        f'Done. {len(result):,} nouns written to {OUT_PATH}  '
        f'({len(conflicts)} homonym conflicts removed).',
        file=sys.stderr,
    )


if __name__ == '__main__':
    main()
