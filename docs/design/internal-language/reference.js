/* Night shift study. Synthetic interactions only: no storage or network writes. */
(() => {
  const root = document.documentElement;
  const tabs = [...document.querySelectorAll('[role="tab"][data-depth]')];
  const depths = {
    paper: {
      summary: 'White sheets overlap a dark backing. Offset edges, registration marks and framed icon tiles create depth without a gradient across the data.',
      tradeoff: 'Keep sheet offsets small so the workspace still reads as one surface.',
    },
    console: {
      summary: 'Light work panels sit inside a dark, recessed frame. Beveled controls, inset borders and shadowed icon wells separate the surface levels.',
      tradeoff: 'The darkest option. Reserve dark panels for navigation and secondary tools; keep the count sheet white.',
    },
    signal: {
      summary: 'Raised white tiles sit above a quieter backing. Accent edge strips, restrained ambient light and softly lit icon tiles make elevation visible.',
      tradeoff: 'The most contemporary option. Keep light local to edges and framing so it does not obscure labels or imply a status.',
    },
  };
  const accents = {
    patina: { name: 'Patina teal', light: '#7BC5BE', ink: '#1B6460', rationale: 'Patina teal provides a cool counterpoint to the dark red and fits the printed, slightly weathered framing. Red remains the main action color.' },
    ice: { name: 'Ice blue', light: '#A5C9F0', ink: '#245C83', rationale: 'Ice blue gives the dark framing a clearer, more technical character. Use it for icon wells and edge details; keep the main action red.' },
    citron: { name: 'Muted citron', light: '#C2D677', ink: '#4F641C', rationale: 'Muted citron creates a brighter graphic contrast with the red. It is the liveliest option; use it sparingly around icons and selection.' },
  };
  function setDepth(value, focus = false) {
    const depth = depths[value] ? value : 'paper';
    root.dataset.depth = depth;
    for (const tab of tabs) {
      const selected = tab.dataset.depth === depth;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    }
    document.getElementById('direction-panel').setAttribute('aria-labelledby', `tab-${depth}`);
    document.getElementById('direction-summary').textContent = depths[depth].summary;
    const tradeoff = document.getElementById('direction-tradeoff');
    const label = document.createElement('strong'); label.textContent = 'Tradeoff: ';
    tradeoff.replaceChildren(label, depths[depth].tradeoff);
  }
  function luminance(hex) {
    const rgb = hex.match(/[a-f\d]{2}/gi).map(value => {
      const channel = parseInt(value, 16) / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  }
  function ratio(a, b) {
    const x = luminance(a), y = luminance(b);
    return ((Math.max(x, y) + .05) / (Math.min(x, y) + .05)).toFixed(2);
  }
  function setAccent(value) {
    const accent = accents[value] ? value : 'patina';
    root.dataset.accent = accent;
    for (const button of document.querySelectorAll('button[data-accent]')) button.setAttribute('aria-pressed', String(button.dataset.accent === accent));
    const color = accents[accent];
    document.getElementById('accent-name').textContent = color.name;
    document.getElementById('accent-value').textContent = `${color.light} / ${color.ink}`;
    document.getElementById('accent-rationale').textContent = color.rationale;
    document.getElementById('accent-dark-ratio').textContent = `${ratio(color.light, '#171717')}:1 · normal text`;
    document.getElementById('accent-white-ratio').textContent = `${ratio(color.ink, '#FFFFFF')}:1 · normal text`;
  }
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('click', () => setDepth(tab.dataset.depth));
    tab.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
      if (next === null) return;
      event.preventDefault(); setDepth(tabs[next].dataset.depth, true);
    });
  }
  for (const button of document.querySelectorAll('button[data-accent]')) button.addEventListener('click', () => setAccent(button.dataset.accent));
  const query = new URLSearchParams(location.search);
  setDepth(query.get('depth'));
  setAccent(query.get('accent'));
  document.getElementById('details-toggle').addEventListener('change', event => { root.dataset.quiet = String(!event.target.checked); });

  // One moving red surface. Hover previews navigation; selection still changes on click.
  const nav = document.querySelector('.app-nav');
  const navButtons = [...nav.querySelectorAll('button')];
  let hoveredNavButton = null;
  const activeNavButton = () => nav.querySelector('.current');
  const keyboardNavButton = () => navButtons.find(button => button.matches(':focus-visible'));
  function moveNavHighlight(button, instant = false) {
    if (!button) return;
    if (instant) nav.classList.remove('nav-highlight-animated');
    nav.classList.add('has-nav-highlight');
    nav.style.setProperty('--nav-highlight-x', `${button.offsetLeft}px`);
    nav.style.setProperty('--nav-highlight-y', `${button.offsetTop}px`);
    nav.style.setProperty('--nav-highlight-width', `${button.offsetWidth}px`);
    nav.style.setProperty('--nav-highlight-height', `${button.offsetHeight}px`);
    if (instant) nav.getBoundingClientRect();
    nav.classList.add('nav-highlight-animated');
  }
  function restoreNavHighlight(instant = false) {
    moveNavHighlight(keyboardNavButton() ?? hoveredNavButton ?? activeNavButton(), instant);
  }
  for (const button of navButtons) {
    button.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch') return;
      hoveredNavButton = button;
      moveNavHighlight(button);
    });
  }
  nav.addEventListener('pointerleave', event => {
    if (event.pointerType === 'touch') return;
    hoveredNavButton = null;
    restoreNavHighlight();
  });
  nav.addEventListener('focusin', event => {
    const button = event.target.closest('button');
    if (button?.matches(':focus-visible')) moveNavHighlight(button);
  });
  nav.addEventListener('focusout', () => queueMicrotask(() => restoreNavHighlight()));
  const navResize = new ResizeObserver(() => restoreNavHighlight(true));
  navResize.observe(nav);
  for (const button of navButtons) navResize.observe(button);
  restoreNavHighlight(true);

  function showView(view) {
    document.getElementById('home-view').hidden = view !== 'home';
    document.getElementById('cash-view').hidden = view !== 'cash';
    for (const button of document.querySelectorAll('.app-nav [data-view]')) {
      const current = button.dataset.view === view;
      button.classList.toggle('current', current);
      button.setAttribute('aria-pressed', String(current));
    }
    restoreNavHighlight();
    document.getElementById('demo-notice').textContent = view === 'cash' ? 'Demo cash count · No record will be saved' : 'Demo workspace';
    if (view === 'cash') document.getElementById('demo-hundreds').focus();
  }
  for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => showView(button.dataset.view));
  for (const button of document.querySelectorAll('[data-demo-notice]')) button.addEventListener('click', () => { document.getElementById('demo-notice').textContent = button.dataset.demoNotice; });

  function status(element, name, text) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    for (const [key, value] of Object.entries({ class: 'icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(key, value);
    const use = document.createElementNS(ns, 'use'); use.setAttribute('href', `#i-${name}`); svg.append(use);
    element.replaceChildren(svg, document.createTextNode(text));
  }
  const inputs = [...document.querySelectorAll('[data-denomination]')];
  const save = document.getElementById('demo-save');
  const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  function calculate() {
    let total = 0, valid = true;
    for (const input of inputs) {
      const acceptable = /^\d{1,3}$/.test(input.value);
      input.setAttribute('aria-invalid', String(!acceptable));
      const output = document.getElementById(input.id === 'demo-hundreds' ? 'amount-hundreds' : 'amount-twenties');
      output.textContent = acceptable ? money(Number(input.value) * Number(input.dataset.denomination)) : '—';
      if (acceptable) total += Number(input.value) * Number(input.dataset.denomination);
      else valid = false;
    }
    document.getElementById('demo-count-error').hidden = valid;
    document.getElementById('drawer-total').textContent = valid ? money(total) : '—';
    document.getElementById('turn-in').textContent = valid ? money(total - 100) : '—';
    save.disabled = !valid;
    status(document.getElementById('demo-save-state'), 'clock', 'Demo changes only');
    return valid;
  }
  for (const input of inputs) input.addEventListener('input', calculate);
  save.addEventListener('click', () => {
    if (!calculate()) return;
    status(document.getElementById('demo-save-state'), 'check', 'Demo feedback — no record saved');
  });
  for (const button of document.querySelectorAll('[data-feedback]')) button.addEventListener('click', () => { document.getElementById('component-feedback').textContent = button.dataset.feedback; });
})();
