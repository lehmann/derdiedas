(function () {
  'use strict';

  let tooltipEl = null;

  function ensureTooltip() {
    if (!tooltipEl || !document.body.contains(tooltipEl)) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'derdiedas-tooltip';
      tooltipEl.setAttribute('data-derdiedas', 'true');
      document.body.appendChild(tooltipEl);
    }
    return tooltipEl;
  }

  function showTooltip(article, word, rect) {
    const el = ensureTooltip();
    const cls = article === 'der' ? 'masc'
              : article === 'die' ? 'fem'
              : article === 'das' ? 'neut'
              : 'unkn';
    const label = article || '?';

    el.innerHTML =
      `<span class="derdiedas-article derdiedas-${cls}">${label}</span>` +
      `<span class="derdiedas-word">${escapeHtml(word)}</span>`;

    el.style.display = 'flex';
    el.style.visibility = 'hidden';

    void el.offsetHeight; // force reflow to measure
    const tw = el.offsetWidth;
    const th = el.offsetHeight;
    const gap = 8;

    let top  = rect.top  - th - gap;
    let left = rect.left + (rect.width - tw) / 2;

    if (top < gap) top = rect.bottom + gap; // flip below if not enough room above
    left = Math.max(gap, Math.min(left, window.innerWidth - tw - gap));

    el.style.top  = `${top}px`;
    el.style.left = `${left}px`;
    el.style.visibility = 'visible';
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.style.display = 'none';
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

  document.addEventListener('mouseup', async (e) => {
    if (e.target?.closest?.('[data-derdiedas]')) return;

    const sel = window.getSelection();
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
        // Capitalized → likely a noun, but gender unknown
        showTooltip(null, text, rect);
      } else {
        hideTooltip();
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
