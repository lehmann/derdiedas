#!/usr/bin/env python3
"""
Build data/verb_translations_pt.json by querying the English Wiktionary API.

For each verb in data/verbs.json, fetches the wikitext from en.wiktionary.org,
finds the German section, and extracts Portuguese translations.

Usage:
  python3 scripts/process_verb_translations.py

The script is resumable: verbs already in verb_translations_pt.json are skipped.
Rate limit: 1 request per second (50 verbs/request → ~134 requests total).
"""

import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT      = Path(__file__).parent.parent
OUT_PATH  = ROOT / "data" / "verb_translations_pt.json"
VERBS_PATH = ROOT / "data" / "verbs.json"

API_URL   = "https://de.wiktionary.org/w/api.php"
BATCH     = 50      # max titles per API request
DELAY     = 1.0     # seconds between requests (be polite)
UA        = "derdiedas-extension/1.0 (https://github.com/; verb-translation-builder)"

# ── Hand-curated seed (take priority, never overwritten) ──────────────────────
MANUAL: dict[str, str] = {
    "sein": "ser/estar", "haben": "ter", "werden": "tornar-se",
    "können": "poder", "müssen": "precisar", "sollen": "dever",
    "wollen": "querer", "dürfen": "ter permissão", "mögen": "gostar",
    "wissen": "saber", "gehen": "ir", "kommen": "vir", "laufen": "correr",
    "fahren": "dirigir", "fliegen": "voar", "rennen": "correr",
    "reisen": "viajar", "fallen": "cair", "steigen": "subir",
    "sinken": "afundar", "springen": "pular", "schwimmen": "nadar",
    "sagen": "dizer", "sprechen": "falar", "reden": "conversar",
    "erzählen": "contar", "erklären": "explicar", "fragen": "perguntar",
    "antworten": "responder", "rufen": "chamar", "schreien": "gritar",
    "flüstern": "sussurrar", "berichten": "relatar", "denken": "pensar",
    "kennen": "conhecer", "verstehen": "entender", "glauben": "acreditar",
    "hoffen": "esperar", "meinen": "achar/opinar", "wählen": "escolher",
    "entscheiden": "decidir", "planen": "planejar", "erinnern": "lembrar",
    "vergessen": "esquecer", "lernen": "aprender", "studieren": "estudar",
    "sehen": "ver", "hören": "ouvir", "fühlen": "sentir",
    "riechen": "cheirar", "schmecken": "provar", "schauen": "olhar",
    "machen": "fazer", "geben": "dar", "nehmen": "pegar/tomar",
    "bringen": "trazer", "holen": "buscar", "lassen": "deixar",
    "helfen": "ajudar", "zeigen": "mostrar", "suchen": "procurar",
    "finden": "encontrar", "treffen": "encontrar", "halten": "segurar/parar",
    "stellen": "colocar", "legen": "deitar", "setzen": "sentar",
    "tragen": "carregar", "werfen": "jogar", "ziehen": "puxar",
    "schlagen": "bater", "drücken": "apertar", "öffnen": "abrir",
    "schließen": "fechar", "aufmachen": "abrir", "zumachen": "fechar",
    "benutzen": "usar", "verwenden": "utilizar", "anfangen": "começar",
    "beginnen": "iniciar", "enden": "terminar", "aufhören": "parar",
    "stoppen": "parar", "starten": "iniciar", "stehen": "estar em pé",
    "liegen": "estar deitado", "sitzen": "estar sentado", "bleiben": "ficar",
    "warten": "esperar", "leben": "viver", "kochen": "cozinhar",
    "backen": "assar", "essen": "comer", "trinken": "beber",
    "schlafen": "dormir", "aufwachen": "acordar", "einschlafen": "adormecer",
    "waschen": "lavar", "putzen": "limpar", "aufräumen": "arrumar",
    "bauen": "construir", "reparieren": "consertar", "arbeiten": "trabalhar",
    "schreiben": "escrever", "lesen": "ler", "rechnen": "calcular",
    "zeichnen": "desenhar", "malen": "pintar", "üben": "praticar",
    "prüfen": "verificar", "testen": "testar", "kaufen": "comprar",
    "verkaufen": "vender", "bezahlen": "pagar", "zahlen": "pagar",
    "kosten": "custar", "bestellen": "pedir", "liefern": "entregar",
    "mieten": "alugar", "reservieren": "reservar", "empfehlen": "recomendar",
    "anbieten": "oferecer", "spielen": "jogar/brincar", "singen": "cantar",
    "tanzen": "dançar", "feiern": "festejar", "besuchen": "visitar",
    "einladen": "convidar", "heiraten": "casar", "lieben": "amar",
    "lachen": "rir", "weinen": "chorar", "schicken": "enviar",
    "senden": "enviar", "empfangen": "receber", "anrufen": "ligar",
    "fernsehen": "assistir TV", "herunterladen": "baixar",
    "hochladen": "fazer upload", "installieren": "instalar",
    "ändern": "mudar", "wechseln": "trocar", "wachsen": "crescer",
    "sterben": "morrer", "entstehen": "surgir", "verschwinden": "desaparecer",
    "erscheinen": "aparecer", "gewinnen": "ganhar", "verlieren": "perder",
    "ausgehen": "sair", "ankommen": "chegar", "abfahren": "partir",
    "einsteigen": "embarcar", "aussteigen": "desembarcar",
    "zurückkommen": "voltar", "weggehen": "ir embora", "mitkommen": "vir junto",
    "versprechen": "prometer", "garantieren": "garantir", "versuchen": "tentar",
    "schaffen": "conseguir", "gelingen": "dar certo", "scheitern": "fracassar",
    "aufgeben": "desistir", "heißen": "chamar-se", "scheinen": "parecer/brilhar",
    "brauchen": "precisar", "passieren": "acontecer", "bedeuten": "significar",
    "gehören": "pertencer", "folgen": "seguir", "führen": "liderar",
    "nennen": "chamar/nomear", "vorstellen": "imaginar",
    "diskutieren": "discutir", "klettern": "escalar", "schleichen": "rastejar",
    "organisieren": "organizar",
}

# ── Wikitext parsing ───────────────────────────────────────────────────────────

# Matches {{Ü|pt|jogar}} and {{Ü+|pt|jogar}} (de.wiktionary.org translation template)
_U_RE = re.compile(r'\{\{Ü\+?\|pt\|([^|}\s][^|}]*?)(?:\|[^}]*)?\}\}')


def extract_pt(wikitext: str) -> list[str]:
    words, seen = [], set()
    for m in _U_RE.finditer(wikitext):
        w = m.group(1).strip()
        if w and w.lower() not in seen and len(w) <= 28 and w.count(' ') <= 2:
            seen.add(w.lower())
            words.append(w)
        if len(words) >= 2:
            break
    return words


# ── Wiktionary API ─────────────────────────────────────────────────────────────

def fetch_batch(titles: list[str]) -> dict[str, str]:
    """Return {title: wikitext} for all titles in one API call."""
    params = urllib.parse.urlencode({
        'action': 'query',
        'titles': '|'.join(titles),
        'prop': 'revisions',
        'rvprop': 'content',
        'rvslots': 'main',
        'format': 'json',
        'formatversion': '2',
    })
    req = urllib.request.Request(
        f"{API_URL}?{params}",
        headers={'User-Agent': UA},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode('utf-8'))

    result = {}
    for page in data.get('query', {}).get('pages', []):
        title = page.get('title', '')
        revisions = page.get('revisions', [])
        if revisions:
            content = revisions[0].get('slots', {}).get('main', {}).get('content', '')
            if content:
                result[title] = content
    return result


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    verbs: dict = json.loads(VERBS_PATH.read_text(encoding='utf-8'))

    # Load existing output (allows resuming interrupted runs)
    existing: dict[str, str] = {}
    if OUT_PATH.exists():
        existing = json.loads(OUT_PATH.read_text(encoding='utf-8'))

    # Merge: manual > existing Wiktionary
    result: dict[str, str] = dict(existing)
    result.update(MANUAL)  # manual always wins

    # Only query verbs we don't have a translation for yet
    to_fetch = [v for v in verbs if v not in result]
    total    = len(to_fetch)
    batches  = [to_fetch[i:i + BATCH] for i in range(0, total, BATCH)]

    print(f"Verbs to look up: {total:,}  ({len(batches)} API requests)", file=sys.stderr)

    found = errors = 0
    for i, batch in enumerate(batches, 1):
        try:
            pages = fetch_batch(batch)
        except Exception as exc:
            print(f"  Batch {i}/{len(batches)} ERROR: {exc}", file=sys.stderr)
            errors += 1
            time.sleep(DELAY * 2)
            continue

        for verb in batch:
            wikitext = pages.get(verb, '')
            if not wikitext:
                continue
            words = extract_pt(wikitext)
            if words:
                result[verb] = '/'.join(words)
                found += 1

        if i % 10 == 0 or i == len(batches):
            print(f"  {i}/{len(batches)} batches done — {found} new translations so far",
                  file=sys.stderr)
            # Save incrementally so progress isn't lost on interruption
            _save(result)

        if i < len(batches):
            time.sleep(DELAY)

    _save(result)
    print(
        f"\nDone: {len(result):,} translations total\n"
        f"  {len(MANUAL)} manual/curated\n"
        f"  {found} new from Wiktionary\n"
        f"  {errors} batch errors\n"
        f"Written to {OUT_PATH}",
        file=sys.stderr,
    )


def _save(result: dict) -> None:
    OUT_PATH.write_text(
        json.dumps(dict(sorted(result.items())), ensure_ascii=False, indent=2),
        encoding='utf-8',
    )


if __name__ == '__main__':
    main()
