(() => {
  'use strict';

  const cfg = Object.assign(
    { title: 'CTF Writeups', tagline: '', author: '', links: [] },
    window.SITE_CONFIG || {}
  );

  const app = document.getElementById('app');
  const root = document.documentElement;
  const state = { q: '', platform: '', category: '', tag: '' };

  let posts = [];
  let loadError = null;
  let routeToken = 0;
  let stopTocTracking = null;

  /* ---------- helpers ---------- */

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const slugify = (s) =>
    s.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-').replace(/-+/g, '-') || 'section';

  const countBy = (list, key) => {
    const m = new Map();
    list.forEach((p) => {
      const k = key(p);
      if (k) m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };

  const diffBadge = (level) =>
    level ? `<span class="diff" data-level="${esc(String(level).toLowerCase())}"><i></i>${esc(level)}</span>` : '';

  /* ---------- chrome: header, footer, theme ---------- */

  function initChrome() {
    document.getElementById('site-name').textContent = cfg.author || cfg.title;
    document.getElementById('site-links').innerHTML = (cfg.links || [])
      .map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a>`)
      .join('');
    document.getElementById('site-footer').textContent =
      `© ${new Date().getFullYear()} ${cfg.author || cfg.title}. Writeups are for education; only test systems you have permission to test.`;

    const btn = document.getElementById('theme-toggle');
    const label = () => (root.dataset.theme === 'dark' ? 'Light' : 'Dark');
    btn.textContent = label();
    btn.setAttribute('aria-label', 'Switch color theme');
    btn.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
      btn.textContent = label();
    });
  }

  /* ---------- data ---------- */

  async function loadPosts() {
    try {
      const r = await fetch('posts/index.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      const list = Array.isArray(data) ? data : data.posts || [];
      posts = list.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } catch (e) {
      loadError = e;
    }
  }

  /* ---------- routing ---------- */

  function route() {
    const token = ++routeToken;
    if (stopTocTracking) { stopTocTracking(); stopTocTracking = null; }

    const hash = location.hash.slice(1) || '/';
    const qi = hash.indexOf('?');
    const path = qi === -1 ? hash : hash.slice(0, qi);
    const query = new URLSearchParams(qi === -1 ? '' : hash.slice(qi + 1));

    window.scrollTo(0, 0);

    if (loadError) return renderLoadError();
    if (path.startsWith('/post/')) return showPost(decodeURIComponent(path.slice(6)), token);

    state.q = query.get('q') || '';
    state.platform = query.get('platform') || '';
    state.category = query.get('category') || '';
    state.tag = query.get('tag') || '';
    renderHome();
  }

  function renderLoadError() {
    document.title = cfg.title;
    const local = location.protocol === 'file:';
    app.innerHTML = `
      <div class="intro"><h1>${esc(cfg.title)}</h1></div>
      <p class="notice error">Couldn't load <code>posts/index.json</code>.</p>
      <p class="notice">${local
        ? 'You opened the page straight from disk. Browsers block that. Run <code>python3 -m http.server</code> in this folder and open <code>http://localhost:8000</code>.'
        : 'Run <code>python3 build.py</code> to generate it, then commit and push <code>posts/index.json</code>.'}</p>`;
  }

  /* ---------- home ---------- */

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return posts.filter((p) => {
      if (state.platform && p.platform !== state.platform) return false;
      if (state.category && p.category !== state.category) return false;
      if (state.tag && !(p.tags || []).includes(state.tag)) return false;
      if (!q) return true;
      const hay = [p.title, p.summary, p.platform, p.category, p.difficulty, ...(p.tags || [])].join(' ').toLowerCase();
      return q.split(/\s+/).every((word) => hay.includes(word));
    });
  }

  function chipGroup(label, kind, entries) {
    if (entries.length < 2) return '';
    const chips = entries
      .map(([value, n]) =>
        `<button type="button" class="chip" data-kind="${kind}" data-value="${esc(value)}" aria-pressed="${state[kind] === value}">${esc(value)}<span class="n">${n}</span></button>`)
      .join('');
    return `<div class="chips" role="group" aria-label="${esc(label)}"><span class="chip-label">${esc(label)}</span>${chips}</div>`;
  }

  function renderHome() {
    document.title = cfg.title;

    const intro = `
      <section class="intro">
        <h1>${esc(cfg.title)}</h1>
        ${cfg.tagline ? `<p class="tagline">${esc(cfg.tagline)}</p>` : ''}
      </section>`;

    if (!posts.length) {
      app.innerHTML = `<div class="home">${intro}<p class="empty">No writeups yet. Add a Markdown file to <code>posts/</code>, run <code>python3 build.py</code>, and push.</p></div>`;
      return;
    }

    app.innerHTML = `
      <div class="home">
        ${intro}
        <section class="controls" aria-label="Find writeups">
          <input class="search" type="search" placeholder="Search titles, tags, platforms" aria-label="Search writeups" value="${esc(state.q)}">
          ${chipGroup('Platform', 'platform', countBy(posts, (p) => p.platform))}
          ${chipGroup('Category', 'category', countBy(posts, (p) => p.category))}
        </section>
        <div id="results" aria-live="polite"></div>
      </div>`;

    const search = app.querySelector('.search');
    search.addEventListener('input', () => {
      state.q = search.value;
      renderResults();
    });

    app.querySelector('.controls').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const { kind, value } = chip.dataset;
      state[kind] = state[kind] === value ? '' : value;
      app.querySelectorAll(`.chip[data-kind="${kind}"]`).forEach((c) =>
        c.setAttribute('aria-pressed', String(state[kind] === c.dataset.value)));
      renderResults();
    });

    app.querySelector('#results').addEventListener('click', (e) => {
      const clear = e.target.closest('[data-clear]');
      if (!clear) return;
      if (clear.dataset.clear === 'tag') {
        state.tag = '';
      } else {
        Object.assign(state, { q: '', platform: '', category: '', tag: '' });
        search.value = '';
        app.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
      }
      renderResults();
    });

    renderResults();
  }

  function row(p) {
    return `
      <li>
        <a class="row" href="#/post/${encodeURIComponent(p.slug)}">
          <time class="row-date" datetime="${esc(p.date)}">${esc(p.date)}</time>
          <span class="row-main">
            <span class="row-title">${esc(p.title)}</span>
            ${p.summary ? `<span class="row-summary">${esc(p.summary)}</span>` : ''}
          </span>
          <span class="row-meta">
            ${p.platform ? `<span>${esc(p.platform)}</span>` : ''}
            ${diffBadge(p.difficulty)}
          </span>
        </a>
      </li>`;
  }

  function renderResults() {
    const list = filtered();
    const active = state.q || state.platform || state.category || state.tag;
    const box = document.getElementById('results');

    box.innerHTML = `
      <div class="results-bar">
        <span>${list.length} of ${posts.length} writeup${posts.length === 1 ? '' : 's'}</span>
        ${state.tag ? `<button type="button" class="chip" data-clear="tag" aria-label="Remove tag filter ${esc(state.tag)}">tag: ${esc(state.tag)} ×</button>` : ''}
        ${active ? '<button type="button" class="linklike" data-clear="all">Clear filters</button>' : ''}
      </div>
      ${list.length
        ? `<ol class="ledger">${list.map(row).join('')}</ol>`
        : '<p class="empty">Nothing matches. Try a different search or clear the filters.</p>'}`;

    // Keep the URL shareable without adding history entries.
    const params = new URLSearchParams();
    Object.entries(state).forEach(([k, v]) => { if (v) params.set(k, v); });
    const qs = params.toString();
    history.replaceState(null, '', '#/' + (qs ? '?' + qs : ''));
  }

  /* ---------- post ---------- */

  async function showPost(slug, token) {
    const idx = posts.findIndex((p) => p.slug === slug);
    if (idx < 0) {
      document.title = 'Not found · ' + cfg.title;
      app.innerHTML = `<div class="post"><a class="back" href="#/">Back to all writeups</a><p class="notice error">That writeup doesn't exist.</p></div>`;
      return;
    }

    const p = posts[idx];
    document.title = `${p.title} · ${cfg.title}`;
    app.innerHTML = '<p class="loading">Loading writeup…</p>';

    let md;
    try {
      const r = await fetch('posts/' + encodeURI(p.file), { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      md = await r.text();
    } catch (e) {
      if (token !== routeToken) return;
      app.innerHTML = `<div class="post"><a class="back" href="#/">Back to all writeups</a><p class="notice error">Couldn't load <code>posts/${esc(p.file)}</code>.</p></div>`;
      return;
    }
    if (token !== routeToken) return; // user already navigated away

    md = md.replace(/^\uFEFF/, '').replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, '');
    const html = DOMPurify.sanitize(marked.parse(md, { gfm: true }));

    const facts = [
      ['Platform', p.platform],
      ['Category', p.category],
      ['Difficulty', p.difficulty ? diffBadge(p.difficulty) : ''],
      ['Points', p.points],
      ['Date', p.date],
    ].filter(([, v]) => v);

    const newer = posts[idx - 1];
    const older = posts[idx + 1];
    const pagerLink = (post, cls, dir) => post
      ? `<a class="${cls}" href="#/post/${encodeURIComponent(post.slug)}"><span class="pager-dir">${dir}</span><span class="pager-title">${esc(post.title)}</span></a>`
      : '';

    app.innerHTML = `
      <article class="post">
        <a class="back" href="#/">Back to all writeups</a>
        <header class="post-head">
          <h1>${esc(p.title)}</h1>
          <dl class="case">
            ${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${k === 'Difficulty' ? v : esc(v)}${k === 'Date' && p.minutes ? `<span class="sub">${p.minutes} min read</span>` : ''}</dd></div>`).join('')}
          </dl>
          ${(p.tags || []).length
            ? `<ul class="tags">${p.tags.map((t) => `<li><a href="#/?tag=${encodeURIComponent(t)}">${esc(t)}</a></li>`).join('')}</ul>`
            : ''}
        </header>
        <div class="post-grid">
          <div class="post-main">
            <div class="toc-inline-slot"></div>
            <div class="prose"></div>
            <nav class="pager" aria-label="More writeups">
              ${pagerLink(newer, 'newer', 'Newer')}
              ${pagerLink(older, 'older', 'Older')}
            </nav>
          </div>
          <aside class="toc toc-side" aria-label="On this page"></aside>
        </div>
      </article>`;

    const prose = app.querySelector('.prose');
    prose.innerHTML = html;
    enhance(prose);
    buildToc(prose);
  }

  function enhance(el) {
    // Heading ids (for the table of contents)
    const used = new Set();
    el.querySelectorAll('h2, h3, h4').forEach((h) => {
      const base = slugify(h.textContent);
      let id = base;
      let n = 1;
      while (used.has(id)) id = `${base}-${++n}`;
      used.add(id);
      h.id = id;
    });

    // Code blocks: highlight, label, copy button
    el.querySelectorAll('pre > code').forEach((code) => {
      const pre = code.parentElement;
      const m = /language-([\w+#.-]+)/.exec(code.className);
      const lang = m ? m[1] : '';
      if (lang && window.hljs && hljs.getLanguage(lang)) {
        code.classList.add('hljs');
        hljs.highlightElement(code);
      }
      const wrap = document.createElement('div');
      wrap.className = 'code';
      wrap.innerHTML = `<div class="code-bar"><span>${esc(lang)}</span><button type="button" class="copy">Copy</button></div>`;
      pre.replaceWith(wrap);
      wrap.appendChild(pre);
    });

    // Tables scroll sideways instead of breaking the layout
    el.querySelectorAll('table').forEach((t) => {
      const w = document.createElement('div');
      w.className = 'table-wrap';
      t.replaceWith(w);
      w.appendChild(t);
    });

    // > [!NOTE] / [!TIP] / [!WARNING] / [!FLAG] callouts
    const titles = { note: 'Note', tip: 'Tip', warning: 'Warning', flag: 'Flag' };
    el.querySelectorAll('blockquote').forEach((bq) => {
      const first = bq.firstElementChild;
      if (!first || first.tagName !== 'P') return;
      const m = /^\s*\[!(NOTE|TIP|WARNING|FLAG)\]\s*/i.exec(first.textContent);
      if (!m) return;
      const type = m[1].toLowerCase();
      const node = first.firstChild;
      if (node && node.nodeType === Node.TEXT_NODE) node.textContent = node.textContent.replace(/^\s*\[![A-Za-z]+\]\s*/, '');
      if (!first.textContent.trim()) first.remove();
      bq.classList.add('callout', 'callout-' + type);
      const title = document.createElement('div');
      title.className = 'callout-title';
      title.textContent = titles[type];
      bq.prepend(title);
    });

    // Images: paths are relative to posts/, so `img/shot.png` works
    el.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (!/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(src)) img.setAttribute('src', 'posts/' + src.replace(/^\.\//, ''));
      img.loading = 'lazy';
    });

    // Links: external ones open in a new tab; `other-post.md` links to that writeup
    el.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      const md = /^(?![a-z][a-z0-9+.-]*:|\/|#)(.+)\.md$/i.exec(href);
      if (md) {
        a.setAttribute('href', '#/post/' + encodeURIComponent(md[1].replace(/^\.\//, '')));
        return;
      }
      if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(href)) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    });
  }

  function buildToc(prose) {
    const heads = [...prose.querySelectorAll('h2, h3')];
    if (heads.length < 2) return;

    const list = `<ol>${heads
      .map((h) => `<li class="toc-${h.tagName.toLowerCase()}"><a href="#${esc(h.id)}" data-target="${esc(h.id)}">${esc(h.textContent)}</a></li>`)
      .join('')}</ol>`;

    const side = app.querySelector('.toc-side');
    side.innerHTML = `<p class="toc-title">On this page</p>${list}`;

    const inline = app.querySelector('.toc-inline-slot');
    inline.classList.add('toc', 'toc-inline');
    inline.innerHTML = `<details><summary>On this page</summary>${list}</details>`;

    const links = [...side.querySelectorAll('a')];
    let ticking = false;
    const update = () => {
      ticking = false;
      let current = heads[0];
      for (const h of heads) {
        if (h.getBoundingClientRect().top <= 140) current = h; else break;
      }
      links.forEach((a) => a.classList.toggle('active', a.dataset.target === current.id));
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    stopTocTracking = () => window.removeEventListener('scroll', onScroll);
    update();
  }

  /* ---------- global click handling ---------- */

  const lightbox = document.getElementById('lightbox');
  const closeLightbox = () => { lightbox.hidden = true; lightbox.querySelector('img').removeAttribute('src'); };

  document.addEventListener('click', (e) => {
    // In-page anchors (#section) would otherwise be read as routes.
    const a = e.target.closest('a[href^="#"]');
    if (a) {
      const href = a.getAttribute('href');
      if (href.length > 1 && !href.startsWith('#/')) {
        const target = document.getElementById(decodeURIComponent(href.slice(1)));
        if (target) {
          e.preventDefault();
          target.scrollIntoView();
          if (target === app) app.focus();
          const det = a.closest('details');
          if (det) det.open = false;
        }
        return;
      }
    }

    const copy = e.target.closest('.copy');
    if (copy) {
      const text = copy.closest('.code').querySelector('code').textContent;
      const done = () => {
        copy.textContent = 'Copied';
        setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
      };
      const fallback = () => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { if (document.execCommand('copy')) done(); } catch (err) { /* ignore */ }
        ta.remove();
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
      return;
    }

    const img = e.target.closest('.prose img');
    if (img && !img.closest('a')) {
      lightbox.querySelector('img').src = img.currentSrc || img.src;
      lightbox.hidden = false;
      return;
    }

    if (e.target.closest('#lightbox')) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
  });

  /* ---------- boot ---------- */

  window.addEventListener('hashchange', route);
  initChrome();
  loadPosts().then(route);
})();
