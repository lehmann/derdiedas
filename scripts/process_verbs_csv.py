#!/usr/bin/env python3
"""
Build data/verbs.json from the viorelsfetea/german-verbs-database CSV.

Downloads automatically from GitHub; or pass a local file path as the first argument.

  python3 scripts/process_verbs_csv.py
  python3 scripts/process_verbs_csv.py path/to/verbs.csv

Existing entries in data/verbs.json are kept (they contain hand-tuned prs
arrays for sein/haben/werden/modals).  New verbs are converted to the minimal
representation needed by conjugate() in lookup.js:
  a   – auxiliary: "h" (haben) | "s" (sein)
  pp  – Partizip II
  sep – separable prefix (if any)
  pt  – Präteritum ich/er stem, only when irregular
  p2  – Präsens du form, only when irregular (vowel change)
  p3  – Präsens er form, only when irregular
  prs – full 6-form Präsens array, only for fully irregular ich form
"""

import csv
import io
import json
import sys
import urllib.request
from pathlib import Path

CSV_URL = (
    "https://raw.githubusercontent.com/"
    "viorelsfetea/german-verbs-database/master/output/verbs.csv"
)

ROOT     = Path(__file__).parent.parent
OUT_PATH = ROOT / "data" / "verbs.json"


# ── Regular-form helpers ──────────────────────────────────────────────────────

def _sib(stem: str) -> bool:
    return bool(stem) and stem[-1] in "sßzx"

def _eins(stem: str) -> bool:
    """Stem needs an -e- insertion before -st/-t (ends in t/d)."""
    return bool(stem) and stem[-1] in "td"

def reg_du(stem: str) -> str:
    if _sib(stem):  return stem + "t"
    if _eins(stem): return stem + "est"
    return stem + "st"

def reg_er(stem: str) -> str:
    return stem + ("et" if _eins(stem) else "t")

def reg_pt(stem: str) -> str:
    """Regular Präteritum ich/er form (the full form, e.g. 'kaufte')."""
    return stem + ("ete" if _eins(stem) else "te")


# ── Row processor ─────────────────────────────────────────────────────────────

def process_row(row: dict, existing: dict) -> "tuple[str, dict] | None":
    inf = row.get("Infinitive", "").strip()
    if not inf or " " in inf:
        return None
    # Our conjugation engine doesn't support -eln/-ern stems
    if inf.endswith(("eln", "ern")):
        return None
    # Existing entries win
    if inf in existing:
        return None

    pp    = row.get("Partizip II", "").strip()
    hilfs = row.get("Hilfsverb", "haben").strip()
    if not pp:
        return None

    # ── Separable prefix detection ────────────────────────────────────────────
    # The CSV stores conjugated forms as "mache auf", "finge an", etc.
    # The last token is the prefix; the infinitive must start with it.
    prs_ich_raw = row.get("Präsens_ich", "").strip()
    sep = None
    if " " in prs_ich_raw:
        candidate = prs_ich_raw.split()[-1]
        if inf.startswith(candidate) and len(candidate) < len(inf) - 2:
            sep = candidate

    base_inf = inf[len(sep):] if sep else inf
    if not base_inf.endswith("en") or len(base_inf) < 4:
        return None
    stem = base_inf[:-2]

    def strip_sep(f: str) -> str:
        """Remove ' <sep>' suffix that appears in separated conjugated forms."""
        return f[: -(len(sep) + 1)] if sep and f.endswith(" " + sep) else f

    def first_word(f: str) -> str:
        return f.split()[0] if f else ""

    # ── Assemble entry ────────────────────────────────────────────────────────
    entry: dict = {
        "a": "h" if hilfs == "haben" else "s",
        "pp": pp,
    }
    if sep:
        entry["sep"] = sep

    # Präteritum: store only if irregular
    pt_col = row.get("Präteritum_ich", "").strip()
    pt_raw = first_word(strip_sep(pt_col))
    if pt_raw and pt_raw != reg_pt(stem):
        entry["pt"] = pt_raw

    # Präsens: detect column name for "er/sie/es" (may contain commas/spaces)
    er_col_key = next(
        (k for k in row if k.startswith("Präsens_er")),
        "Präsens_er, sie, es",
    )
    ich_raw = first_word(strip_sep(prs_ich_raw))
    du_raw  = first_word(strip_sep(row.get("Präsens_du", "").strip()))
    er_raw  = first_word(strip_sep(row.get(er_col_key, "").strip()))

    if ich_raw and ich_raw != stem + "e":
        # Fully irregular ich form (modal-style): store whole Präsens array.
        # wir and sie/Sie are always the base infinitive in German (except sein,
        # which is already in existing).
        ihr = stem + ("et" if _eins(stem) else "t")
        entry["prs"] = [ich_raw, du_raw or (reg_du(stem)), er_raw or (reg_er(stem)),
                        base_inf, ihr, base_inf]
    else:
        if du_raw and du_raw != reg_du(stem):
            entry["p2"] = du_raw
        if er_raw and er_raw != reg_er(stem):
            entry["p3"] = er_raw

    return inf, entry


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    if len(sys.argv) >= 2:
        print(f"Reading {sys.argv[1]} …", file=sys.stderr)
        csv_text = Path(sys.argv[1]).read_text(encoding="utf-8")
    else:
        print(f"Downloading {CSV_URL} …", file=sys.stderr)
        with urllib.request.urlopen(CSV_URL) as resp:
            csv_text = resp.read().decode("utf-8")
        print("Download complete.", file=sys.stderr)

    existing: dict = {}
    if OUT_PATH.exists():
        existing = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    print(f"Existing verbs.json: {len(existing)} entries.", file=sys.stderr)

    result = dict(existing)
    added = skipped = errors = 0

    for row in csv.DictReader(io.StringIO(csv_text)):
        try:
            out = process_row(row, existing)
        except Exception as exc:
            errors += 1
            if errors <= 5:
                print(f"  Error on {row.get('Infinitive','?')}: {exc}", file=sys.stderr)
            continue
        if out is None:
            skipped += 1
        else:
            result[out[0]] = out[1]
            added += 1

    result = dict(sorted(result.items()))
    OUT_PATH.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(
        f"\nDone: {len(result):,} total verbs "
        f"({len(existing)} kept + {added} new, "
        f"{skipped} skipped, {errors} errors).\n"
        f"Written to {OUT_PATH}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
