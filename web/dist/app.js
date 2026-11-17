'use strict';

const form = document.querySelector('#clean-form');
const source = document.querySelector('#source');
const output = document.querySelector('#output');
const result = document.querySelector('#result');
const shortHelp = document.querySelector('#short-help');
const openShort = document.querySelector('#open-short');
const status = document.querySelector('#status');
const submit = document.querySelector('#clean');
const install = document.querySelector('#install');
const native = window.PrivateLinksAndroid;
const { languages, text } = PrivateLinksLanguages;
const languageMenu = document.querySelector('#language-menu');
const currentLanguage = document.querySelector('#current-language');
const localeButtons = [...document.querySelectorAll('[data-locale]')];
const theme = document.querySelector('#theme');
const tabs = [...document.querySelectorAll('.bottom-nav a')];
const panels = ['cleaner', 'history', 'about'].map(id => document.getElementById(id));
const historyList = document.querySelector('#history-list');
const emptyHistory = document.querySelector('#history-empty');
const historyStatus = document.querySelector('#history-status');
const clearHistory = document.querySelector('#clear-history');
const clearDialog = document.querySelector('#clear-dialog');
const historyKey = 'private-links.history';
const localeKey = 'private-links.locale';
const themeKey = 'private-links.theme';
let locale = 'en-GB';
let revision = 0;
let pending;

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function t(key) {
  return text(locale, key);
}

function message(key = '', tone = '', target = status) {
  target.dataset.message = key;
  target.dataset.tone = tone;
  target.textContent = t(key);
  target.hidden = !key;
}

function entries() {
  try {
    const saved = JSON.parse(read(historyKey) ?? '[]');
    return Array.isArray(saved) ? saved.filter(entry =>
      entry && typeof entry.id === 'string' && typeof entry.url === 'string' &&
      Number.isFinite(entry.created) && !Number.isNaN(new Date(entry.created).getTime())) : [];
  } catch {
    return [];
  }
}

function storeHistory(updated) {
  if (!save(historyKey, updated.length ? JSON.stringify(updated) : null)) {
    message('unavailable', 'error', historyStatus);
    return false;
  }
  renderHistory();
  return true;
}

function copyToClipboard(value) {
  if (native) {
    if (!native.copy(value)) throw new Error();
    return;
  }
  if (!navigator.clipboard?.writeText) throw new Error();
  return navigator.clipboard.writeText(value);
}

function renderHistory() {
  const saved = entries();
  historyList.replaceChildren();
  emptyHistory.hidden = saved.length > 0;
  clearHistory.hidden = saved.length === 0;
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  for (const entry of saved) {
    const row = document.createElement('li');
    row.className = 'history-entry';
    const detail = document.createElement('div');
    const url = document.createElement('p');
    url.textContent = entry.url;
    url.dir = 'ltr';
    const date = document.createElement('time');
    date.dateTime = new Date(entry.created).toISOString();
    date.textContent = dateFormat.format(entry.created);
    detail.append(url, date);
    const actions = document.createElement('div');
    actions.className = 'history-actions';
    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'secondary';
    copyButton.textContent = t('copy');
    copyButton.addEventListener('click', async () => {
      try {
        await copyToClipboard(entry.url);
        message('copied', 'success', historyStatus);
      } catch {
        message('historyCopyFailed', 'warning', historyStatus);
      }
    });
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'secondary danger';
    deleteButton.textContent = t('remove');
    deleteButton.addEventListener('click', () => {
      const rowIndex = [...historyList.children].indexOf(row);
      if (storeHistory(entries().filter(savedEntry => savedEntry.id !== entry.id))) {
        message('deleted', 'success', historyStatus);
        const next = historyList.children[Math.min(rowIndex, historyList.children.length - 1)];
        (next?.querySelector('.danger') ?? tabs[1]).focus();
      }
    });
    actions.append(copyButton, deleteButton);
    row.append(detail, actions);
    historyList.append(row);
  }
}

function setLocale(value) {
  locale = languages.includes(value) ? value : 'en-GB';
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar-IQ' ? 'rtl' : 'ltr';
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  source.placeholder = t('placeholder');
  currentLanguage.setAttribute('aria-label', t('language'));
  document.querySelector('.bottom-nav').setAttribute('aria-label', t('tabs'));
  for (const button of localeButtons) {
    const selected = button.dataset.locale === locale;
    const name = button.querySelector('span').textContent;
    button.setAttribute('aria-label', name);
    button.setAttribute('aria-pressed', String(selected));
    if (selected) {
      currentLanguage.querySelector('.flag').replaceWith(button.querySelector('.flag').cloneNode(true));
      const label = currentLanguage.querySelector('span');
      label.textContent = name;
      label.lang = locale;
    }
  }
  message(status.dataset.message, status.dataset.tone);
  message(historyStatus.dataset.message, historyStatus.dataset.tone, historyStatus);
  renderHistory();
}

function setTheme(value) {
  const light = value === 'light';
  theme.value = light ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme.value;
  document.querySelector('meta[name="theme-color"]').content = light ? '#f8f9f5' : '#000000';
}

function showPage() {
  const requested = location.hash.slice(1);
  const page = panels.some(panel => panel.id === requested) ? requested : 'cleaner';
  for (const [index, panel] of panels.entries()) {
    panel.hidden = panel.id !== page;
    if (panel.hidden) tabs[index].removeAttribute('aria-current');
    else tabs[index].setAttribute('aria-current', 'page');
  }
  if (page === 'history') renderHistory();
  window.scrollTo(0, 0);
}

for (const button of localeButtons) {
  button.addEventListener('click', () => {
    setLocale(button.dataset.locale);
    save(localeKey, locale);
    languageMenu.open = false;
    currentLanguage.focus();
  });
}
document.addEventListener('click', event => {
  if (!languageMenu.contains(event.target)) languageMenu.open = false;
});
languageMenu.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !languageMenu.open) return;
  languageMenu.open = false;
  currentLanguage.focus();
});
theme.addEventListener('change', () => {
  setTheme(theme.value);
  save(themeKey, theme.value);
});
clearHistory.addEventListener('click', () => {
  clearDialog.returnValue = '';
  clearDialog.showModal();
});
clearDialog.addEventListener('close', () => {
  if (clearDialog.returnValue === 'clear' && storeHistory([])) {
    message('cleared', 'success', historyStatus);
    tabs[1].focus();
  }
});
window.addEventListener('storage', event => {
  if (event.key === historyKey || event.key === null) renderHistory();
});
window.addEventListener('hashchange', showPage);
setTheme(read(themeKey));
setLocale(read(localeKey));
showPage();

function reset() {
  revision++;
  pending = null;
  result.hidden = shortHelp.hidden = true;
  output.value = '';
  openShort.removeAttribute('href');
  submit.disabled = false;
  message('');
}

async function copy(value, id) {
  try {
    await copyToClipboard(value);
    if (id === revision) message('copied', 'success');
  } catch {
    if (id === revision) message('copyAgain', 'warning');
  }
}

function showCleaned(link, id) {
  output.value = link.url;
  result.hidden = false;
  copy(link.url, id);
  const previous = entries();
  const entry = { id: crypto.randomUUID?.() ?? String(crypto.getRandomValues(new Uint32Array(4))), url: link.url, created: Date.now() };
  storeHistory([entry, ...previous]);
}

function showShort(link) {
  message('short', 'warning');
  const target = new URL(link.url);
  target.protocol = 'https:';
  openShort.href = target.href;
  shortHelp.hidden = false;
}

function run() {
  reset();
  const id = revision;
  let link;
  try {
    link = PrivateLinks.clean(source.value);
  } catch (error) {
    message(error.message === 'Paste a link or a message that contains one.' ? 'missing' : 'invalid', 'error');
    return;
  }
  if (link.kind === 'unknown') {
    message('unsupported', 'warning');
  } else if (link.kind === 'short') {
    if (!native && link.name !== 'Facebook') {
      showShort(link);
      return;
    }
    pending = { id, link };
    submit.disabled = true;
    message('checking');
    if (native) native.resolve(link.url, id);
    else resolveFacebook(link.url, id);
  } else {
    showCleaned(link, id);
  }
}

async function resolveFacebook(url, id) {
  try {
    const response = await fetch('./resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(7000),
    });
    if (response.ok) {
      const data = await response.json();
      window.privateLinksResolved(id, data.url);
      return;
    }
  } catch {
    // The static preview or network may be unavailable.
  }
  window.privateLinksResolved(id, null);
}

form.addEventListener('submit', event => {
  event.preventDefault();
  run();
});
source.addEventListener('input', reset);
document.querySelector('#example').addEventListener('click', () => {
  reset();
  source.value = 'https://www.instagram.com/reel/DfFvOJZIhTB/?utm_source=ig_web_copy_link&xtok=example&srtk=example';
  source.focus();
});
document.querySelector('#copy').addEventListener('click', () => copy(output.value, revision));
output.addEventListener('focus', () => output.select());

window.privateLinksReceive = value => {
  if (location.hash !== '#cleaner') {
    history.replaceState(null, '', '#cleaner');
    showPage();
  }
  source.value = value;
  run();
};
window.privateLinksResolved = (id, target) => {
  if (id !== revision || pending?.id !== id) return;
  const { link } = pending;
  pending = null;
  submit.disabled = false;
  if (target) {
    try {
      const cleaned = PrivateLinks.clean(target, true);
      if (cleaned.kind === 'clean' && cleaned.name === link.name) {
        showCleaned(cleaned, id);
        return;
      }
    } catch {
      // A redirect can be expired or malformed.
    }
  }
  if (native) message('short', 'warning');
  else message('resolveFailed', 'warning');
};

if (native?.openInfoLink) {
  for (const link of document.querySelectorAll('.project-note a, .about-links a')) {
    link.addEventListener('click', event => {
      event.preventDefault();
      native.openInfoLink(link.href);
    });
  }
}

if (!native) {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    install.hidden = false;
    install.onclick = async () => {
      await event.prompt();
      install.hidden = true;
    };
  });
  const shared = document.querySelector('#shared-input');
  if (shared) {
    const input = JSON.parse(shared.textContent);
    shared.remove();
    history.replaceState(null, '', './');
    window.privateLinksReceive(input);
  }
}
