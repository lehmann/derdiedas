(function () {
  'use strict';

  let tooltipEl      = null;
  let currentVerb    = null; // { infinitive, data, _rect }

  function ensureTooltip() {
    if (!tooltipEl || !document.body.contains(tooltipEl)) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'derdiedas-tooltip';
      tooltipEl.setAttribute('data-derdiedas', 'true');
      tooltipEl.addEventListener('click', onTooltipClick);
      document.body.appendChild(tooltipEl);
    }
    return tooltipEl;
  }

  function onTooltipClick(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn || !currentVerb) return;
    if (btn.dataset.action === 'expand') {
      showConjugationPanel();
    } else if (btn.dataset.action === 'back') {
      renderVerbCompact();
      placeNear(ensureTooltip(), currentVerb._rect, 'flex');
    }
  }

  // ── Noun tooltip ────────────────────────────────────────────────────────────

  function showTooltip(article, word, rect) {
    const el  = ensureTooltip();
    currentVerb = null;
    const cls = article === 'der' ? 'masc'
              : article === 'die' ? 'fem'
              : article === 'das' ? 'neut'
              : 'unkn';

    el.className        = 'derdiedas-tooltip';
    el.style.pointerEvents = 'none';
    el.innerHTML =
      `<span class="derdiedas-article derdiedas-${cls}">${article || '?'}</span>` +
      `<span class="derdiedas-word">${escapeHtml(word)}</span>`;

    placeNear(el, rect, 'flex');
  }

  // ── Verb compact tooltip ────────────────────────────────────────────────────

  function showVerbTooltip(verbResult, rect) {
    verbResult._rect = rect;
    currentVerb = verbResult;
    const el = ensureTooltip();
    el.style.pointerEvents = 'auto';
    renderVerbCompact();
    placeNear(el, rect, 'flex');
  }

  function renderVerbCompact() {
    const el = ensureTooltip();
    el.className = 'derdiedas-tooltip derdiedas-verb-compact';
    el.innerHTML =
      `<span class="derdiedas-verb-tag">Verb</span>` +
      `<span class="derdiedas-word">${escapeHtml(currentVerb.infinitive)}</span>` +
      `<button class="derdiedas-expand-btn" data-action="expand" data-derdiedas="true">›</button>`;
  }

  // ── Conjugation panel ───────────────────────────────────────────────────────

  function showConjugationPanel() {
    const el     = ensureTooltip();
    const tenses = conjugate(currentVerb.infinitive, currentVerb.data);

    const grid = tenses.map(({ name, forms }) =>
      `<div class="derdiedas-tense">` +
        `<div class="derdiedas-tense-name">${escapeHtml(name)}</div>` +
        `<div class="derdiedas-tense-forms">` +
          forms.map(([p, f]) =>
            `<div><span class="derdiedas-person">${escapeHtml(p)}</span>${escapeHtml(f)}</div>`
          ).join('') +
        `</div>` +
      `</div>`
    ).join('');

    el.className = 'derdiedas-tooltip derdiedas-conj-panel';
    el.innerHTML =
      `<div class="derdiedas-conj-header">` +
        `<button class="derdiedas-back-btn" data-action="back" data-derdiedas="true">‹</button>` +
        `<span class="derdiedas-inf-title">${escapeHtml(currentVerb.infinitive)}</span>` +
      `</div>` +
      `<div class="derdiedas-tense-grid">${grid}</div>`;

    el.style.display    = 'block';
    el.style.visibility = 'hidden';
    void el.offsetHeight;
    const gap = 12;
    const top  = Math.max(gap, (window.innerHeight - el.offsetHeight) / 2);
    const left = Math.max(gap, (window.innerWidth  - el.offsetWidth)  / 2);
    el.style.top        = `${top}px`;
    el.style.left       = `${left}px`;
    el.style.visibility = 'visible';
  }

  // ── Positioning helper ──────────────────────────────────────────────────────

  function placeNear(el, rect, displayValue) {
    el.style.display    = displayValue;
    el.style.visibility = 'hidden';
    void el.offsetHeight;
    const tw  = el.offsetWidth;
    const th  = el.offsetHeight;
    const gap = 8;
    let top  = rect.top  - th - gap;
    let left = rect.left + (rect.width - tw) / 2;
    if (top < gap) top = rect.bottom + gap;
    left = Math.max(gap, Math.min(left, window.innerWidth - tw - gap));
    el.style.top        = `${top}px`;
    el.style.left       = `${left}px`;
    el.style.visibility = 'visible';
  }

  // ── Shared helpers ──────────────────────────────────────────────────────────

  function hideTooltip() {
    if (tooltipEl) tooltipEl.style.display = 'none';
    currentVerb = null;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function isSingleWord(text) {
    return (
      text.length >= 2 &&
      !/\s/.test(text) &&
      /^[a-zA-ZäöüÄÖÜß]+$/.test(text)
    );
  }

  // ── Event listeners ─────────────────────────────────────────────────────────

  document.addEventListener('mouseup', async (e) => {
    if (e.target?.closest?.('[data-derdiedas]')) return;

    const sel  = window.getSelection();
    const text = (sel?.toString() || '').trim();

    if (!isSingleWord(text)) {
      hideTooltip();
      return;
    }

    try {
      const range  = sel.getRangeAt(0);
      const rect   = range.getBoundingClientRect();
      const result = await lookupWord(text);

      if (result) {
        showTooltip(result.article, text, rect);
      } else if (/^[A-ZÄÖÜ]/.test(text)) {
        showTooltip(null, text, rect);
      } else {
        const verbResult = await lookupVerb(text);
        if (verbResult) {
          showVerbTooltip(verbResult, rect);
        } else {
          hideTooltip();
        }
      }
    } catch {
      hideTooltip();
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (e.target?.closest?.('[data-derdiedas]')) return;
    hideTooltip();
  });

})();
