(function () {
  'use strict';

  let tooltipEl     = null;
  let currentVerb   = null;   // { infinitive, data, _rect, _forceBelow }
  let conjPanelOpen = false;  // true while the expanded conjugation panel is showing

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
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'expand' && currentVerb) {
      showConjugationPanel();
    } else if (action === 'back' && currentVerb) {
      conjPanelOpen = false;
      const el = ensureTooltip();
      el.style.pointerEvents = 'auto';
      renderVerbCompact();
      placeNear(el, currentVerb._rect, 'flex', currentVerb._forceBelow);
    } else if (action === 'close') {
      hideTooltip();
    }
  }

  // ── Noun tooltip ────────────────────────────────────────────────────────────

  function showTooltip(article, word, rect, forceBelow) {
    const el = ensureTooltip();
    currentVerb   = null;
    conjPanelOpen = false;
    const cls = article === 'der' ? 'masc'
              : article === 'die' ? 'fem'
              : article === 'das' ? 'neut'
              : 'unkn';

    el.className           = 'derdiedas-tooltip';
    el.style.pointerEvents = 'none';
    el.innerHTML =
      `<span class="derdiedas-article derdiedas-${cls}">${article || '?'}</span>` +
      `<span class="derdiedas-word">${escapeHtml(word)}</span>`;

    placeNear(el, rect, 'flex', forceBelow);
  }

  // ── Verb compact tooltip ────────────────────────────────────────────────────

  function showVerbTooltip(verbResult, rect, forceBelow) {
    verbResult._rect       = rect;
    verbResult._forceBelow = forceBelow;
    currentVerb   = verbResult;
    conjPanelOpen = false;
    const el = ensureTooltip();
    el.style.pointerEvents = 'auto';
    renderVerbCompact();
    placeNear(el, rect, 'flex', forceBelow);
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
    conjPanelOpen = true;
    const tenses  = conjugate(currentVerb.infinitive, currentVerb.data);

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
        `<button class="derdiedas-back-btn"  data-action="back"  data-derdiedas="true">‹</button>` +
        `<span class="derdiedas-inf-title">${escapeHtml(currentVerb.infinitive)}</span>` +
        `<button class="derdiedas-close-btn" data-action="close" data-derdiedas="true">×</button>` +
      `</div>` +
      `<div class="derdiedas-tense-grid">${grid}</div>`;

    // Center the panel in the viewport
    el.style.display    = 'block';
    el.style.visibility = 'hidden';
    void el.offsetHeight;
    const gap  = 12;
    const top  = Math.max(gap, (window.innerHeight - el.offsetHeight) / 2);
    const left = Math.max(gap, (window.innerWidth  - el.offsetWidth)  / 2);
    el.style.top        = `${top}px`;
    el.style.left       = `${left}px`;
    el.style.visibility = 'visible';
  }

  // ── Positioning helper ──────────────────────────────────────────────────────

  function placeNear(el, rect, displayValue, forceBelow) {
    el.style.display    = displayValue;
    el.style.visibility = 'hidden';
    void el.offsetHeight;
    const tw  = el.offsetWidth;
    const th  = el.offsetHeight;
    const gap = 8;
    // forceBelow: used when the selection is inside a form input and we don't
    // know the word's exact position — place below the whole element instead.
    const below = forceBelow || (rect.top - th - gap < gap);
    const top   = below ? rect.bottom + gap : rect.top - th - gap;
    let   left  = rect.left + (rect.width - tw) / 2;
    left = Math.max(gap, Math.min(left, window.innerWidth - tw - gap));
    el.style.top        = `${top}px`;
    el.style.left       = `${left}px`;
    el.style.visibility = 'visible';
  }

  // ── Rect helper: handles selections inside <textarea>/<input> ───────────────

  function getRectAndFlags(sel) {
    const range  = sel.getRangeAt(0);
    const rect   = range.getBoundingClientRect();
    const active = document.activeElement;
    const isInput = active && (
      active.tagName === 'TEXTAREA' ||
      (active.tagName === 'INPUT' &&
       !['checkbox', 'radio', 'file', 'range'].includes(active.type))
    );
    // In form inputs, getRangeAt(0).getBoundingClientRect() returns zeros
    // because the range lives in the native text editing context.
    // Fall back to the element's own rect and force the tooltip below it.
    if (isInput) {
      return { rect: active.getBoundingClientRect(), forceBelow: true };
    }
    return { rect, forceBelow: false };
  }

  // ── Shared helpers ──────────────────────────────────────────────────────────

  function hideTooltip() {
    if (tooltipEl) tooltipEl.style.display = 'none';
    currentVerb   = null;
    conjPanelOpen = false;
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
      // Empty/multi-word click: only dismiss if the conjugation panel is NOT open
      // (the user may be clicking elsewhere while still reading the panel)
      if (!conjPanelOpen) hideTooltip();
      return;
    }

    try {
      const { rect, forceBelow } = getRectAndFlags(sel);

      if (/^[A-ZÄÖÜ]/.test(text)) {
        // Capitalized → treat as noun (German nouns are always uppercase)
        const result = await lookupWord(text);
        showTooltip(result ? result.article : null, text, rect, forceBelow);
      } else {
        // Lowercase → German nouns are always capitalized, so this is
        // never a noun — go straight to verb lookup.
        const verbResult = await lookupVerb(text);
        if (verbResult) {
          showVerbTooltip(verbResult, rect, forceBelow);
        } else if (!conjPanelOpen) {
          hideTooltip();
        }
      }
    } catch {
      if (!conjPanelOpen) hideTooltip();
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (e.target?.closest?.('[data-derdiedas]')) return;
    // The conjugation panel is intentionally "sticky" — it stays open while
    // the user interacts with the page. Dismiss only via ESC or the × button.
    if (conjPanelOpen) return;
    hideTooltip();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideTooltip();
  });

})();
