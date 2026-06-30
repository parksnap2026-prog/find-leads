'use strict';

const state = {
  page:          1,
  perPage:       20,
  totalPages:    1,
  total:         0,
  allResults:    [],   // full result set from last search (never re-fetched on page change)
  results:       [],   // current page slice (after filters)
  radius:        20000,
  hasGoogleKey:  false,
  scanning:      false,
  selectedIds:   new Set(),
  agentResults:  {},
  callLog:       {},   // {bizId: {called, calledAt, name}} — loaded from server
  currentCity:   '',
  currentCountry:'',
  currentSource: '',
  radiusUsed:    null,
  filterPhone:     false,
  filterEmail:     false,
  filterWebsite:   false,
  filterNoWebsite: false,
  sortDir:       null,   // null | 'asc' | 'desc'
  templates:     [],
  composeTemplateId: null,
  composeIndex:  0,
};

// ── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const businessTypeSelect = $('businessType');
const countrySearch      = $('countrySearch');
const countryList        = $('countryList');
const citySearch         = $('citySearch');
const cityList           = $('cityList');
const cityLoading        = $('cityLoading');
const searchBtn          = $('searchBtn');
const composeBtn         = $('composeBtn');
const composeBtnCount    = $('composeBtnCount');
const composeModal       = $('composeModal');
const closeCompose       = $('closeCompose');
const offerTabs          = $('offerTabs');
const composeNav         = $('composeNav');
const composePrev        = $('composePrev');
const composeNext        = $('composeNext');
const composeCounter     = $('composeCounter');
const composeBizName     = $('composeBizName');
const composeSubject     = $('composeSubject');
const composeBodyEl      = $('composeBody');
const copyBodyBtn        = $('copyBodyBtn');
const copyAllBtn         = $('copyAllBtn');
const openEmailBtn       = $('openEmailBtn');
const copyFeedback       = $('copyFeedback');
const testModeCheck      = $('testModeCheck');
const testAddrsHint      = $('testAddrsHint');
const sendEmailBtn       = $('sendEmailBtn');
const sendResults        = $('sendResults');

const TEST_ADDRESSES = ['jordanarizanov@gmail.com', 'krstev_kire@yahoo.com'];

let _searchAbort    = null;   // AbortController for the in-flight search request
let _stopFindSites  = false;  // flag to cancel findAllWebsites loop

// Fallback stubs used while templates haven't loaded yet
const _TPL_STUBS = [
  { id: 'create_build',    label: 'Create & Build'    },
  { id: 'update_maintain', label: 'Update & Maintain' },
  { id: 'ai_agent',        label: 'Implement AI Agent' },
];

function tplCellHtml(sentEntry, tpl) {
  if (!sentEntry || !sentEntry.history) return `<td class="col-tpl"><span class="tpl-badge none">—</span></td>`;
  const realSends = sentEntry.history.filter(h => !h.test && h.template === tpl.label);
  const testSends = sentEntry.history.filter(h =>  h.test && h.template === tpl.label);
  if (realSends.length) {
    const d = new Date(realSends[realSends.length - 1].sentAt).toLocaleDateString();
    return `<td class="col-tpl"><span class="tpl-badge sent" title="Sent ${realSends.length}× — last ${d}">✉ ${realSends.length}×</span></td>`;
  }
  if (testSends.length) {
    return `<td class="col-tpl"><span class="tpl-badge test" title="Tested ${testSends.length}×">test</span></td>`;
  }
  return `<td class="col-tpl"><span class="tpl-badge none">—</span></td>`;
}

// ── Sent-log (persisted in localStorage) ─────────────────────────────────────
const SENT_KEY = 'webpower_sent_log';
let sentLog = {};
try { sentLog = JSON.parse(localStorage.getItem(SENT_KEY) || '{}'); } catch {}

// ── Search history (persisted server-side, shared across all users) ───────────
function saveSearchHistory(entry) {
  fetch('/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  }).catch(() => {});
}

// ── Session state: persist last search across page navigation ─────────────────
const SESSION_KEY = 'wp_last_search';

function saveSessionState() {
  try {
    // Exclude agentResults — can be large and exceed sessionStorage quota
    const payload = JSON.stringify({
      params: {
        country:      state.currentCountry,
        countryName:  countrySearch.value,
        city:         state.currentCity,
        businessType: businessTypeSelect.value,
        radius:       state.radius,
        source:       state.currentSource,
      },
      allResults: state.allResults,
    });
    sessionStorage.setItem(SESSION_KEY, payload);
  } catch (_) {
    // If quota exceeded, save only params (no results) so form at least restores
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        params: {
          country:      state.currentCountry,
          countryName:  countrySearch.value,
          city:         state.currentCity,
          businessType: businessTypeSelect.value,
          radius:       state.radius,
          source:       state.currentSource,
        },
        allResults: [],
      }));
    } catch (_2) {}
  }
}

function restoreSessionState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (!saved || !saved.allResults || !saved.allResults.length) return false;
    const p = saved.params;
    const found = COUNTRIES.find(c => c.code === p.country);
    if (found) selectCountry(found.code, found.name);
    selectedCity = p.city;
    citySearch.value = p.city;
    if (Array.from(businessTypeSelect.options).some(o => o.value === p.businessType)) {
      businessTypeSelect.value = p.businessType;
    }
    const rOpt = Array.from($('radiusSelect').options).find(o => parseInt(o.value) === p.radius);
    if (rOpt) { $('radiusSelect').value = String(p.radius); state.radius = p.radius; }
    state.allResults     = saved.allResults;
    state.currentCity    = p.city;
    state.currentCountry = p.country;
    state.currentSource  = p.source || '';
    state.agentResults   = {};
    return true;
  } catch (_) { return false; }
}

function saveSentLog() {
  try { localStorage.setItem(SENT_KEY, JSON.stringify(sentLog)); } catch {}
}

function recordSent(biz, templateLabel, isTest = false) {
  if (!sentLog[biz.id]) sentLog[biz.id] = { name: biz.name, realCount: 0, testCount: 0, history: [] };
  const entry = sentLog[biz.id];
  entry.name = biz.name;
  if (isTest) {
    entry.testCount = (entry.testCount || 0) + 1;
    entry.lastTestedAt = new Date().toISOString();
  } else {
    entry.realCount = (entry.realCount || 0) + 1;
    entry.lastSentAt   = new Date().toISOString();
    entry.lastTemplate = templateLabel;
  }
  entry.history.push({ sentAt: new Date().toISOString(), template: templateLabel, test: isTest });
  saveSentLog();
}
const addUrlToggleBtn    = $('addUrlToggleBtn');
const addUrlBar          = $('addUrlBar');
const addUrlInput        = $('addUrlInput');
const addUrlBtn          = $('addUrlBtn');
const addUrlStatus       = $('addUrlStatus');
const findWebsitesBtn    = $('findWebsitesBtn');
const scanAllBtn         = $('scanAllBtn');
const selectAllBtn       = $('selectAllBtn');
const exportBtn          = $('exportBtn');
const masterCheck        = $('masterCheck');
const tableBody          = $('tableBody');
const pagination         = $('pagination');
const resultsSection     = $('resultsSection');
const resultsSummary     = $('resultsSummary');
const selectionSummary   = $('selectionSummary');
const filterPhoneCb      = $('filterPhone');
const filterEmailCb      = $('filterEmail');
const filterWebsiteCb    = $('filterWebsite');
const filterNoWebsiteCb  = $('filterNoWebsite');
const filterCount        = $('filterCount');
const loadingState       = $('loadingState');
const emptyState         = $('emptyState');
const errorState         = $('errorState');
const errorMsg           = $('errorMsg');
const emptyMsg           = $('emptyMsg');
const sourceTag          = $('sourceTag');

// ── Country / city state ──────────────────────────────────────────────────────
let COUNTRIES = [];
let selectedCountryCode = '';
let currentCities       = [];
let selectedCity        = '';

function buildCountryList() {
  const opts = Array.from($('countryInput').options);
  COUNTRIES = opts
    .filter(o => o.value)
    .map(o => ({ code: o.value, name: o.text }));
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  buildCountryList();

  const cfg = await fetch('/api/config').then(r => r.json());
  state.hasGoogleKey = cfg.has_google_key;

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— Select business type —';
  placeholder.disabled = true;
  placeholder.selected = true;
  businessTypeSelect.appendChild(placeholder);

  for (const [val, label] of Object.entries(cfg.business_types)) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    businessTypeSelect.appendChild(opt);
  }

  initCountrySearch();
  initCitySearch();

  $('settingsBtn').addEventListener('click', () => $('settingsModal').style.display = 'flex');
  $('closeSettings').addEventListener('click', () => $('settingsModal').style.display = 'none');
  $('settingsModal').addEventListener('click', e => {
    if (e.target === $('settingsModal')) $('settingsModal').style.display = 'none';
  });
  $('saveKeyBtn').addEventListener('click', saveApiKey);
  $('radiusSelect').addEventListener('change', e => { state.radius = parseInt(e.target.value); });
  $('perPageSelect').addEventListener('change', e => { state.perPage = parseInt(e.target.value); });

  // Load templates once on startup
  fetch('/api/templates').then(r => r.json()).then(tpls => {
    state.templates = tpls;
    buildOfferTabs();
  }).catch(() => {});

  composeBtn.addEventListener('click', openCompose);
  closeCompose.addEventListener('click', () => { composeModal.style.display = 'none'; });
  composeModal.addEventListener('click', e => { if (e.target === composeModal) composeModal.style.display = 'none'; });
  composePrev.addEventListener('click', () => { state.composeIndex--; refreshCompose(); });
  composeNext.addEventListener('click', () => { state.composeIndex++; refreshCompose(); });
  copyBodyBtn.addEventListener('click', () => doCopy('body'));
  copyAllBtn.addEventListener('click',  () => doCopy('all'));
  openEmailBtn.addEventListener('click', doOpenEmail);
  sendEmailBtn.addEventListener('click', doSendEmail);
  testModeCheck.addEventListener('change', () => {
    testAddrsHint.classList.toggle('hidden', !testModeCheck.checked);
  });

  searchBtn.addEventListener('click', () => {
    if (_searchAbort) { _searchAbort.abort(); }
    else { doSearch(); }
  });
  findWebsitesBtn.addEventListener('click', () => {
    if (state.scanning) { _stopFindSites = true; }
    else { findAllWebsites(); }
  });
  scanAllBtn.addEventListener('click', scanAllAgents);
  addUrlToggleBtn.addEventListener('click', () => {
    const open = addUrlBar.style.display !== 'none' && addUrlBar.style.display !== '';
    addUrlBar.style.display = open ? 'none' : 'flex';
    if (!open) addUrlInput.focus();
  });
  addUrlBtn.addEventListener('click', addByUrl);
  addUrlInput.addEventListener('keydown', e => { if (e.key === 'Enter') addByUrl(); });
  selectAllBtn.addEventListener('click', toggleSelectAllPage);
  exportBtn.addEventListener('click', exportCSV);
  masterCheck.addEventListener('change', onMasterCheck);

  filterPhoneCb.addEventListener('change', () => {
    state.filterPhone = filterPhoneCb.checked;
    renderPage(1);
  });
  filterEmailCb.addEventListener('change', () => {
    state.filterEmail = filterEmailCb.checked;
    renderPage(1);
  });
  filterWebsiteCb.addEventListener('change', () => {
    state.filterWebsite = filterWebsiteCb.checked;
    if (filterWebsiteCb.checked) { state.filterNoWebsite = false; filterNoWebsiteCb.checked = false; }
    renderPage(1);
  });
  filterNoWebsiteCb.addEventListener('change', () => {
    state.filterNoWebsite = filterNoWebsiteCb.checked;
    if (filterNoWebsiteCb.checked) { state.filterWebsite = false; filterWebsiteCb.checked = false; }
    renderPage(1);
  });

  $('sortNameTh').addEventListener('click', () => {
    state.sortDir = state.sortDir === 'asc' ? 'desc' : state.sortDir === 'desc' ? null : 'asc';
    updateSortIcon();
    renderPage(state.page);
  });

  businessTypeSelect.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  // Load call log from server on startup
  loadCallLog();

  // Auto-fill + search from URL params (used by History page re-run links)
  const _qp = new URLSearchParams(window.location.search);
  if (_qp.get('country') && _qp.get('city') && _qp.get('type')) {
    const _country = _qp.get('country');
    const _city    = _qp.get('city');
    const _type    = _qp.get('type');
    const _radius  = parseInt(_qp.get('radius') || '20000');
    const _found   = COUNTRIES.find(c => c.code === _country);
    if (_found) {
      selectCountry(_found.code, _found.name);
      selectedCity     = _city;
      citySearch.value = _city;
    }
    if (Array.from(businessTypeSelect.options).some(o => o.value === _type)) {
      businessTypeSelect.value = _type;
    }
    const _rOpt = Array.from($('radiusSelect').options).find(o => parseInt(o.value) === _radius);
    if (_rOpt) { $('radiusSelect').value = _radius; state.radius = _radius; }
    setTimeout(doSearch, 400);
  } else {
    // Restore last search from session (survives navigating to /history and back)
    if (restoreSessionState()) {
      renderPage(1);
    }
  }
}

// ── Searchable country dropdown ───────────────────────────────────────────────
function initCountrySearch() {
  countrySearch.addEventListener('focus', () => renderCountryList(countrySearch.value));
  countrySearch.addEventListener('input', () => renderCountryList(countrySearch.value));

  // Keyboard navigation
  countrySearch.addEventListener('keydown', e => {
    const items = countryList.querySelectorAll('.ss-item');
    const active = countryList.querySelector('.ss-item.active');
    const idx = active ? Array.from(items).indexOf(active) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = items[idx + 1] || items[0];
      if (next) { active && active.classList.remove('active'); next.classList.add('active'); next.scrollIntoView({block:'nearest'}); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = items[idx - 1] || items[items.length - 1];
      if (prev) { active && active.classList.remove('active'); prev.classList.add('active'); prev.scrollIntoView({block:'nearest'}); }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active) active.click();
      else if (items.length === 1) items[0].click();
    } else if (e.key === 'Escape') {
      closeCountryList();
    }
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!$('countryWrap').contains(e.target)) closeCountryList();
  });
}

function renderCountryList(query) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
    : COUNTRIES;

  countryList.innerHTML = '';

  if (!filtered.length) {
    countryList.innerHTML = '<li class="ss-empty">No countries match</li>';
  } else {
    filtered.slice(0, 80).forEach(c => {
      const li = document.createElement('li');
      li.className = 'ss-item';
      li.dataset.code = c.code;
      li.dataset.name = c.name;
      // highlight matching part
      if (q) {
        const i = c.name.toLowerCase().indexOf(q);
        if (i >= 0) {
          li.innerHTML = escHtml(c.name.slice(0, i))
            + `<strong>${escHtml(c.name.slice(i, i + q.length))}</strong>`
            + escHtml(c.name.slice(i + q.length));
        } else {
          li.textContent = c.name;
        }
      } else {
        li.textContent = c.name;
      }
      li.addEventListener('mousedown', e => {
        e.preventDefault(); // prevent input blur before click registers
        selectCountry(c.code, c.name);
      });
      countryList.appendChild(li);
    });
  }

  countryList.style.display = 'block';
}

function selectCountry(code, name) {
  selectedCountryCode = code;
  countrySearch.value = name;
  closeCountryList();
  loadCities(code);
}

function closeCountryList() {
  countryList.style.display = 'none';
}

// ── City searchable dropdown ──────────────────────────────────────────────────
function initCitySearch() {
  citySearch.addEventListener('focus', () => {
    if (currentCities.length) renderCityList(citySearch.value);
  });
  citySearch.addEventListener('input', () => renderCityList(citySearch.value));

  citySearch.addEventListener('keydown', e => {
    const items = cityList.querySelectorAll('.ss-item');
    const active = cityList.querySelector('.ss-item.active');
    const idx = active ? Array.from(items).indexOf(active) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = items[idx + 1] || items[0];
      if (next) { active && active.classList.remove('active'); next.classList.add('active'); next.scrollIntoView({block:'nearest'}); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = items[idx - 1] || items[items.length - 1];
      if (prev) { active && active.classList.remove('active'); prev.classList.add('active'); prev.scrollIntoView({block:'nearest'}); }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active) active.click();
      else if (items.length === 1) items[0].click();
      else doSearch();
    } else if (e.key === 'Escape') {
      closeCityList();
    }
  });

  document.addEventListener('click', e => {
    if (!$('cityWrap').contains(e.target)) closeCityList();
  });
}

function renderCityList(query) {
  if (!currentCities.length) return;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? currentCities.filter(c => c.toLowerCase().includes(q))
    : currentCities;

  cityList.innerHTML = '';
  if (!filtered.length) {
    cityList.innerHTML = '<li class="ss-empty">No cities match</li>';
  } else {
    filtered.slice(0, 100).forEach(city => {
      const li = document.createElement('li');
      li.className = 'ss-item';
      if (q) {
        const i = city.toLowerCase().indexOf(q);
        if (i >= 0) {
          li.innerHTML = escHtml(city.slice(0, i))
            + `<strong>${escHtml(city.slice(i, i + q.length))}</strong>`
            + escHtml(city.slice(i + q.length));
        } else {
          li.textContent = city;
        }
      } else {
        li.textContent = city;
      }
      li.addEventListener('mousedown', e => {
        e.preventDefault();
        selectCity(city);
      });
      cityList.appendChild(li);
    });
  }
  cityList.style.display = 'block';
}

function selectCity(city) {
  selectedCity        = city;
  citySearch.value    = city;
  closeCityList();
}

function closeCityList() {
  cityList.style.display = 'none';
}

// ── City loader ───────────────────────────────────────────────────────────────
async function loadCities(countryCode) {
  selectedCity        = '';
  citySearch.value    = '';
  citySearch.disabled = true;
  citySearch.placeholder = 'Loading cities…';
  cityLoading.style.display = 'flex';
  currentCities = [];

  if (!countryCode) {
    citySearch.placeholder = 'Select country first…';
    cityLoading.style.display = 'none';
    return;
  }

  try {
    const res  = await fetch(`/api/cities/${encodeURIComponent(countryCode)}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      citySearch.placeholder = 'Could not load cities';
      return;
    }

    currentCities           = data;
    citySearch.disabled     = false;
    citySearch.placeholder  = `Type to search ${data.length} cities…`;
  } catch {
    citySearch.placeholder = 'Error loading cities';
  } finally {
    cityLoading.style.display = 'none';
  }
}

// ── API key save ─────────────────────────────────────────────────────────────
async function saveApiKey() {
  const key = $('apiKeyInput').value.trim();
  if (!key) return;
  const res = await fetch('/api/set-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: key }),
  }).then(r => r.json());

  const status = $('keyStatus');
  if (res.ok) {
    state.hasGoogleKey = true;
    status.textContent  = 'API key saved for this session.';
    status.style.color  = '#22c55e';
  } else {
    status.textContent  = res.error || 'Failed to save key.';
    status.style.color  = '#ef4444';
  }
}

// ── Call log ──────────────────────────────────────────────────────────────────
async function loadCallLog() {
  try {
    const data = await fetch('/api/call-log').then(r => r.json());
    state.callLog = data || {};
  } catch (_) {}
}

async function toggleCalled(bizId, bizName, checked, phone, city, country) {
  const now = new Date().toISOString();
  if (checked) {
    state.callLog[bizId] = { called: true, calledAt: now, name: bizName, phone, city, country };
  } else {
    delete state.callLog[bizId];
  }
  const row = tableBody.querySelector(`tr[data-id="${CSS.escape(bizId)}"]`);
  if (row) row.classList.toggle('row-called', checked);
  try {
    await fetch('/api/call-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bizId, name: bizName, called: checked, calledAt: now, phone, city, country }),
    });
  } catch (_) {}
}

// ── Search button helpers ─────────────────────────────────────────────────────
const _SEARCH_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const _STOP_ICON   = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;

function _setSearchBtnSearching() {
  searchBtn.classList.add('searching');
  searchBtn.innerHTML = _STOP_ICON + ' Searching…';
}
function _setSearchBtnIdle() {
  searchBtn.classList.remove('searching');
  searchBtn.innerHTML = _SEARCH_ICON + ' Search';
}

// ── Search (fetches once, caches all results) ─────────────────────────────────
async function doSearch() {
  const country = selectedCountryCode;
  const city    = selectedCity || citySearch.value.trim();

  if (!businessTypeSelect.value) { showError('Please select a business type.'); return; }
  if (!country) { showError('Please select a country.'); return; }
  if (!city)    { showError('Please type or select a city.'); return; }

  state.selectedIds.clear();
  state.agentResults = {};
  state.sortDir      = null;
  updateSortIcon();
  showLoading();

  _searchAbort = new AbortController();
  _setSearchBtnSearching();

  const body = {
    country,
    city,
    business_type: businessTypeSelect.value,
    radius:        state.radius,
    source:        state.hasGoogleKey ? 'google' : 'osm',
  };

  try {
    const res  = await fetch('/api/search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  _searchAbort.signal,
    });
    const data = await res.json();

    if (!res.ok) { showError(data.error || 'Search failed.'); return; }
    if (!data.results || data.results.length === 0) {
      showEmpty('No businesses found for that city. Try a wider radius in Settings.');
      return;
    }

    state.allResults     = data.results;
    state.currentCity    = city;
    state.currentCountry = country;
    state.currentSource  = data.source;
    state.radiusUsed     = data.radius_used || null;

    saveSearchHistory({
      id:            Date.now(),
      searchedAt:    new Date().toISOString(),
      city,
      countryCode:   country,
      countryName:   countrySearch.value,
      businessType:  businessTypeSelect.value,
      businessLabel: businessTypeSelect.options[businessTypeSelect.selectedIndex]?.text || businessTypeSelect.value,
      radius:        state.radius,
      resultCount:   data.results.length,
    });

    await loadCallLog();
    renderPage(1);
    saveSessionState();
    scanAllAgents();  // auto-scan agents + emails after every search
  } catch (err) {
    if (err.name === 'AbortError') {
      showEmpty('Search cancelled.');
    } else {
      showError('Network error: ' + err.message);
    }
  } finally {
    _searchAbort = null;
    _setSearchBtnIdle();
  }
}

// ── Filter + sort helpers ─────────────────────────────────────────────────────
function getFiltered() {
  let r = state.allResults;
  if (state.filterPhone)     r = r.filter(b => b.phone);
  if (state.filterEmail)     r = r.filter(b => b.email);
  if (state.filterWebsite)   r = r.filter(b => b.website);
  if (state.filterNoWebsite) r = r.filter(b => !b.website);
  return r;
}

function getSorted(results) {
  if (!state.sortDir) return results;
  return [...results].sort((a, b) => {
    const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    return state.sortDir === 'asc' ? cmp : -cmp;
  });
}

function updateSortIcon() {
  const th   = $('sortNameTh');
  const icon = $('sortIcon');
  if (!th || !icon) return;
  th.classList.toggle('sort-asc',  state.sortDir === 'asc');
  th.classList.toggle('sort-desc', state.sortDir === 'desc');
  icon.textContent = state.sortDir === 'asc' ? '↑' : state.sortDir === 'desc' ? '↓' : '⇅';
}

// ── Page renderer (no API call) ───────────────────────────────────────────────
function renderPage(page) {
  const filtered   = getSorted(getFiltered());
  const total      = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / state.perPage));
  state.page       = Math.min(page, totalPages);
  const start      = (state.page - 1) * state.perPage;
  state.results    = filtered.slice(start, start + state.perPage);
  state.total      = total;
  state.totalPages = totalPages;
  renderResults();
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderResults() {
  hideAll();
  resultsSection.style.display = 'block';

  const filtered    = getFiltered();
  const label       = businessTypeSelect.options[businessTypeSelect.selectedIndex].text;
  const countryName = countrySearch.value;
  resultsSummary.innerHTML =
    `<strong>${filtered.length}</strong> ${label} in <strong>${state.currentCity}, ${countryName}</strong> &middot; page ${state.page}/${state.totalPages}`;

  // filter count hint
  const activeFilters = [
    state.filterPhone     && 'phone',
    state.filterEmail     && 'email',
    state.filterWebsite   && 'website',
    state.filterNoWebsite && 'no website',
  ].filter(Boolean);
  filterCount.textContent = activeFilters.length
    ? `(${state.allResults.length} total, filtered by ${activeFilters.join(' + ')})`
    : '';

  sourceTag.style.display = 'flex';
  const srcLabel = state.currentSource === 'google' ? 'Google Places' : 'OpenStreetMap';
  const radiusNote = state.radiusUsed && state.radiusUsed > (state.radius || 5000)
    ? ` &mdash; <span style="color:#f59e0b">radius auto-expanded to ${(state.radiusUsed / 1000).toFixed(0)} km (sparse OSM coverage)</span>`
    : '';
  sourceTag.innerHTML = `<span class="source-dot"></span> Data from <strong>${srcLabel}</strong>${radiusNote}`;

  tableBody.innerHTML = '';
  masterCheck.checked       = false;
  masterCheck.indeterminate = false;

  state.results.forEach((biz, i) => {
    const rowNum  = (state.page - 1) * state.perPage + i + 1;
    const checked = state.selectedIds.has(biz.id);
    const sent    = sentLog[biz.id];
    const tr = document.createElement('tr');
    tr.dataset.id  = biz.id;
    tr.dataset.url = biz.website || '';
    if (checked) tr.classList.add('row-selected');
    if (sent)    tr.classList.add('row-sent');

    const webLinkHtml = url =>
      `<a class="web-link" href="${escHtml(url)}" target="_blank" rel="noopener">
         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
           <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
         </svg>${shortenUrl(url)}
       </a>`;

    const webCell = biz.website
      ? webLinkHtml(biz.website)
      : biz.websiteNotFound
        ? `<span class="badge badge-gray"><span class="badge-dot"></span>No website found</span>`
        : `<button class="find-site-btn" data-id="${escHtml(biz.id)}" data-name="${escHtml(biz.name)}" data-addr="${escHtml(biz.address)}">Find website</button>`;

    const emailCell = emailCellHtml(biz.email);

    const cached    = biz.website && state.agentResults[biz.website];
    const agentCell = !biz.website
      ? '<span class="no-data">—</span>'
      : cached
        ? agentBadgeHtml(cached)
        : `<button class="check-btn" data-url="${escHtml(biz.website)}">Check</button>`;

    const mailCell = mailCellHtml(sent);
    const tplCells = (state.templates.length ? state.templates : _TPL_STUBS).map(t => tplCellHtml(sent, t)).join('');
    const isCalled = !!(state.callLog[biz.id] && state.callLog[biz.id].called);
    if (isCalled) tr.classList.add('row-called');

    tr.innerHTML = `
      <td class="col-check"><input type="checkbox" class="row-check" data-id="${escHtml(biz.id)}" ${checked ? 'checked' : ''}></td>
      <td class="cell-num">${rowNum}</td>
      <td class="cell-name">${escHtml(biz.name)}</td>
      <td class="cell-addr">${escHtml(biz.address)}</td>
      <td class="cell-phone">${biz.phone ? escHtml(biz.phone) : '<span class="no-data">—</span>'}</td>
      <td class="cell-email">${emailCell}</td>
      <td class="cell-web" id="web-cell-${escHtml(biz.id)}">${webCell}</td>
      <td class="cell-agent" id="agent-${escHtml(biz.id)}">${agentCell}</td>
      ${tplCells}
      <td class="cell-mail" id="mail-${escHtml(biz.id)}">${mailCell}</td>
      <td class="col-called" title="${isCalled ? 'Called on ' + new Date(state.callLog[biz.id].calledAt).toLocaleDateString() : 'Mark as called'}">
        <input type="checkbox" class="called-check"
          data-id="${escHtml(biz.id)}"
          data-name="${escHtml(biz.name)}"
          data-phone="${escHtml(biz.phone || '')}"
          ${isCalled ? 'checked' : ''}>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  // row checkbox listeners
  tableBody.querySelectorAll('.row-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.id;
      if (cb.checked) state.selectedIds.add(id);
      else             state.selectedIds.delete(id);
      cb.closest('tr').classList.toggle('row-selected', cb.checked);
      updateMasterCheck();
      updateSelectionSummary();
    });
  });

  // called checkbox listeners
  tableBody.querySelectorAll('.called-check').forEach(cb => {
    cb.addEventListener('change', () => {
      toggleCalled(
        cb.dataset.id,
        cb.dataset.name,
        cb.checked,
        cb.dataset.phone || '',
        state.currentCity,
        countrySearch.value,
      );
      const td = cb.closest('td');
      if (td) td.title = cb.checked ? ('Called on ' + new Date().toLocaleDateString()) : 'Mark as called';
    });
  });

  // per-row check buttons
  tableBody.querySelectorAll('.check-btn').forEach(btn => {
    btn.addEventListener('click', () => checkSingle(btn.dataset.url, btn));
  });

  // per-row find-website buttons
  tableBody.querySelectorAll('.find-site-btn').forEach(btn => {
    btn.addEventListener('click', () => findSite(btn.dataset.id, btn.dataset.name, btn.dataset.addr, btn));
  });

  updateSelectionSummary();
  renderPagination();
}

// ── Checkbox helpers ──────────────────────────────────────────────────────────
function onMasterCheck() {
  const checked = masterCheck.checked;
  tableBody.querySelectorAll('.row-check').forEach(cb => {
    cb.checked = checked;
    const id = cb.dataset.id;
    if (checked) state.selectedIds.add(id);
    else          state.selectedIds.delete(id);
    cb.closest('tr').classList.toggle('row-selected', checked);
  });
  updateSelectionSummary();
}

function updateMasterCheck() {
  const all  = tableBody.querySelectorAll('.row-check');
  const done = tableBody.querySelectorAll('.row-check:checked');
  masterCheck.checked       = done.length === all.length && all.length > 0;
  masterCheck.indeterminate = done.length > 0 && done.length < all.length;
}

function updateSelectionSummary() {
  const n = state.selectedIds.size;
  if (n > 0) {
    selectionSummary.textContent   = `${n} business${n > 1 ? 'es' : ''} selected`;
    selectionSummary.style.display = 'block';
    selectAllBtn.textContent       = 'Deselect all';
    composeBtn.style.display       = 'flex';
    composeBtnCount.textContent    = n;
  } else {
    selectionSummary.style.display = 'none';
    selectAllBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> Select all`;
    composeBtn.style.display = 'none';
  }
}

function toggleSelectAllPage() {
  const hasSelected = state.selectedIds.size > 0;
  if (hasSelected) {
    state.selectedIds.clear();
    tableBody.querySelectorAll('.row-check').forEach(cb => {
      cb.checked = false;
      cb.closest('tr').classList.remove('row-selected');
    });
    masterCheck.checked = masterCheck.indeterminate = false;
  } else {
    tableBody.querySelectorAll('.row-check').forEach(cb => {
      cb.checked = true;
      state.selectedIds.add(cb.dataset.id);
      cb.closest('tr').classList.add('row-selected');
    });
    masterCheck.checked = true;
    masterCheck.indeterminate = false;
  }
  updateSelectionSummary();
}

// ── Compose ───────────────────────────────────────────────────────────────────
function buildOfferTabs() {
  offerTabs.innerHTML = '';
  state.templates.forEach((tpl, i) => {
    const btn = document.createElement('button');
    btn.className   = 'offer-tab';
    btn.dataset.id  = tpl.id;
    btn.style.setProperty('--tab-color', tpl.color || '#6366f1');
    btn.innerHTML   = `<span class="offer-tab-label">${escHtml(tpl.label)}</span>
                       <span class="offer-tab-desc">${escHtml(tpl.description)}</span>`;
    btn.addEventListener('click', () => selectOfferTab(tpl.id));
    offerTabs.appendChild(btn);
    if (i === 0 && !state.composeTemplateId) state.composeTemplateId = tpl.id;
  });
}

function selectOfferTab(id) {
  state.composeTemplateId = id;
  offerTabs.querySelectorAll('.offer-tab').forEach(b => {
    b.classList.toggle('offer-tab--active', b.dataset.id === id);
  });
  sendResults.innerHTML = '';
  loadComposedMessage();
}

function openCompose() {
  if (!state.selectedIds.size) return;
  state.composeIndex = 0;
  composeModal.style.display = 'flex';
  // Activate first tab
  if (state.templates.length && !state.composeTemplateId) {
    state.composeTemplateId = state.templates[0].id;
  }
  selectOfferTab(state.composeTemplateId);
  refreshCompose();
}

function getSelectedBusinesses() {
  return state.allResults.filter(b => state.selectedIds.has(b.id));
}

function refreshCompose() {
  sendResults.innerHTML = '';
  const selected = getSelectedBusinesses();
  const total    = selected.length;
  state.composeIndex = Math.max(0, Math.min(state.composeIndex, total - 1));

  const biz = selected[state.composeIndex];
  const withEmail    = selected.filter(b => b.email || state.agentResults[b.website]?.emails?.[0]);
  const missingEmail = total - withEmail.length;

  composeCounter.textContent  = `${state.composeIndex + 1} / ${total}`;
  composeBizName.textContent  = biz ? biz.name : '';
  composePrev.disabled        = state.composeIndex === 0;
  composeNext.disabled        = state.composeIndex === total - 1;
  composeNav.style.display    = total > 1 ? 'flex' : 'none';

  // Email count hint
  let emailHint = $('composeEmailHint');
  if (!emailHint) {
    emailHint = document.createElement('div');
    emailHint.id = 'composeEmailHint';
    emailHint.style.cssText = 'font-size:.78rem;margin-bottom:6px;padding:4px 10px;border-radius:6px;';
    $('composeNav').insertAdjacentElement('afterend', emailHint);
  }
  if (missingEmail > 0) {
    emailHint.style.background = 'rgba(245,158,11,.12)';
    emailHint.style.color = '#f59e0b';
    emailHint.innerHTML = `⚠ <strong>${withEmail.length}</strong> of ${total} selected have an email address — <strong>${missingEmail}</strong> will be skipped when sending`;
  } else {
    emailHint.style.background = 'rgba(34,197,94,.1)';
    emailHint.style.color = '#22c55e';
    emailHint.innerHTML = `✓ All ${total} selected have email addresses`;
  }

  // Show already-sent warning
  const warnEl = $('composeSentWarn');
  const sent   = biz && sentLog[biz.id];
  if (sent && (sent.realCount || sent.testCount)) {
    const parts = [];
    if (sent.realCount) {
      const d = new Date(sent.lastSentAt).toLocaleDateString();
      parts.push(`sent <strong>${sent.realCount}×</strong> for real — last ${escHtml(d)} via <em>${escHtml(sent.lastTemplate || '')}</em>`);
    }
    if (sent.testCount) parts.push(`tested <strong>${sent.testCount}×</strong>`);
    warnEl.innerHTML = `ℹ Already ${parts.join(' · ')} — you can still send again`;
    warnEl.style.display = 'block';
  } else {
    warnEl.style.display = 'none';
  }

  loadComposedMessage();
}

async function loadComposedMessage() {
  const selected = getSelectedBusinesses();
  const biz      = selected[state.composeIndex];
  if (!biz || !state.composeTemplateId) return;

  composeSubject.value  = 'Loading…';
  composeBodyEl.value   = '';

  try {
    const res  = await fetch('/api/compose', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        template_id:   state.composeTemplateId,
        name:          biz.name,
        business_type: businessTypeSelect.value,
        city:          state.currentCity,
      }),
    });
    const data = await res.json();
    if (!res.ok) { composeSubject.value = ''; composeBodyEl.value = data.error || 'Error'; return; }
    composeSubject.value = data.subject;
    composeBodyEl.value  = data.body;
  } catch (err) {
    composeSubject.value = '';
    composeBodyEl.value  = 'Network error: ' + err.message;
  }
}

function doCopy(mode) {
  const text = mode === 'all'
    ? `Subject: ${composeSubject.value}\n\n${composeBodyEl.value}`
    : composeBodyEl.value;
  navigator.clipboard.writeText(text).then(() => {
    copyFeedback.style.color   = '#22c55e';
    copyFeedback.textContent   = 'Copied!';
    setTimeout(() => { copyFeedback.textContent = ''; }, 2000);
  }).catch(() => {
    // Fallback for older browsers
    composeBodyEl.select();
    document.execCommand('copy');
    copyFeedback.style.color = '#22c55e';
    copyFeedback.textContent = 'Copied!';
    setTimeout(() => { copyFeedback.textContent = ''; }, 2000);
  });
}

function doOpenEmail() {
  const selected = getSelectedBusinesses();
  const biz      = selected[state.composeIndex];
  const email    = biz && biz.email ? biz.email : '';
  const subject  = encodeURIComponent(composeSubject.value);
  const body     = encodeURIComponent(composeBodyEl.value);
  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
}

async function doSendEmail() {
  const selected = getSelectedBusinesses();
  const testMode = testModeCheck.checked;

  sendEmailBtn.disabled    = true;
  sendEmailBtn.textContent = 'Sending…';
  sendResults.innerHTML    = '';

  const svgIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

  try {
    if (testMode) {
      // Compose + send a personalised message for EVERY selected business to test addresses
      const rows = [];
      for (const biz of selected) {
        let composed;
        try {
          const cr = await fetch('/api/compose', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              template_id:   state.composeTemplateId,
              name:          biz.name,
              business_type: businessTypeSelect.value,
              city:          state.currentCity,
            }),
          });
          composed = await cr.json();
        } catch {
          rows.push({ addr: biz.name, ok: false, msg: 'compose error' });
          continue;
        }

        const tplTest = state.templates.find(t => t.id === state.composeTemplateId);
        const fd = new FormData();
        fd.append('to',       TEST_ADDRESSES.join('\n'));
        fd.append('subject',  composed.subject);
        fd.append('body',     composed.body);
        fd.append('biz_name', biz.name);
        fd.append('template', tplTest ? tplTest.label : (state.composeTemplateId || ''));
        fd.append('city',     state.currentCity);
        fd.append('country',  countrySearch.value);
        fd.append('biz_type', businessTypeSelect.options[businessTypeSelect.selectedIndex]?.text || '');
        fd.append('is_test',  'true');

        try {
          const sr   = await fetch('/api/send-mail', { method: 'POST', body: fd });
          const data = await sr.json();
          if (data.ok) {
            const tpl = state.templates.find(t => t.id === state.composeTemplateId);
            recordSent(biz, tpl ? tpl.label : state.composeTemplateId, true);
          }
          rows.push({ addr: biz.name, ok: !!data.ok, msg: data.ok ? 'test sent' : (data.error || 'failed') });
        } catch {
          rows.push({ addr: biz.name, ok: false, msg: 'send error' });
        }
      }
      showSendResult(rows);
      renderPage(state.page);
      refreshCompose();

    } else {
      // Real send — loop ALL selected businesses that have an email
      const toSend = selected.filter(b => {
        const agent = b.website && state.agentResults[b.website];
        return b.email || (agent && agent.emails && agent.emails[0]);
      });

      if (!toSend.length) {
        showSendResult([{ addr: '—', ok: false, msg: 'None of the selected businesses have an email address — scan websites first.' }]);
        return;
      }

      const rows = [];
      for (const biz of toSend) {
        const email = biz.email || state.agentResults[biz.website]?.emails?.[0];
        let composed;
        try {
          const cr = await fetch('/api/compose', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              template_id:   state.composeTemplateId,
              name:          biz.name,
              business_type: businessTypeSelect.value,
              city:          state.currentCity,
            }),
          });
          composed = await cr.json();
        } catch {
          rows.push({ addr: biz.name, ok: false, msg: 'compose error' });
          continue;
        }

        const tplReal = state.templates.find(t => t.id === state.composeTemplateId);
        const fd = new FormData();
        fd.append('to',       email);
        fd.append('subject',  composed.subject);
        fd.append('body',     composed.body);
        fd.append('biz_name', biz.name);
        fd.append('template', tplReal ? tplReal.label : (state.composeTemplateId || ''));
        fd.append('city',     state.currentCity);
        fd.append('country',  countrySearch.value);
        fd.append('biz_type', businessTypeSelect.options[businessTypeSelect.selectedIndex]?.text || '');
        fd.append('is_test',  'false');

        try {
          const sr   = await fetch('/api/send-mail', { method: 'POST', body: fd });
          const data = await sr.json();
          if (data.ok) {
            const tpl = state.templates.find(t => t.id === state.composeTemplateId);
            recordSent(biz, tpl ? tpl.label : state.composeTemplateId, false);
          }
          rows.push({ addr: `${biz.name} <${email}>`, ok: !!data.ok, msg: data.ok ? 'sent' : (data.error || 'failed') });
        } catch {
          rows.push({ addr: biz.name, ok: false, msg: 'send error' });
        }
      }

      // Show skipped (no email) as info rows
      const skipped = selected.filter(b => !toSend.includes(b));
      skipped.forEach(b => rows.push({ addr: b.name, ok: null, msg: 'skipped — no email' }));

      showSendResult(rows);
      renderPage(state.page);
      refreshCompose();
    }
  } catch (e) {
    showSendResult([{ addr: '—', ok: false, msg: 'Network error: ' + e.message }]);
  } finally {
    sendEmailBtn.disabled = false;
    sendEmailBtn.innerHTML = `${svgIcon} Send`;
  }
}

function showSendResult(rows) {
  sendResults.innerHTML = rows.map(r => {
    const cls  = r.ok === null ? 'info' : r.ok ? 'ok' : 'err';
    const icon = r.ok === null ? '–'    : r.ok ? '✓'  : '✗';
    return `<div class="send-result-row ${cls}">${icon} ${escHtml(r.addr)} — ${escHtml(r.msg)}</div>`;
  }).join('');
}

// ── Add by URL or name query ──────────────────────────────────────────────────
async function addByUrl() {
  const input = addUrlInput.value.trim();
  if (!input) return;

  const isUrl = /^https?:\/\//i.test(input) || /^www\./i.test(input);

  addUrlBtn.disabled       = true;
  addUrlStatus.style.color = '#94a3b8';
  addUrlStatus.textContent = isUrl ? 'Fetching…' : 'Searching…';

  try {
    const endpoint = isUrl ? '/api/fetch-business' : '/api/find-by-query';
    const body     = isUrl ? { url: input } : { query: input };

    const res  = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      addUrlStatus.style.color = '#ef4444';
      addUrlStatus.textContent = data.error || 'Failed to fetch';
      return;
    }

    // Cache the agent/scan result so the badge renders immediately
    if (data.agent_data && data.website) {
      state.agentResults[data.website] = data.agent_data;
    }

    // Try to merge with an existing row (same id, same website, or same name)
    const normName = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const mergeIdx = state.allResults.findIndex(b =>
      b.id === data.id ||
      (data.website && b.website === data.website) ||
      (data.name && b.name && normName(b.name) === normName(data.name))
    );

    if (mergeIdx !== -1) {
      const target = state.allResults[mergeIdx];
      if (data.website)  target.website = data.website;
      if (data.phone)    target.phone   = data.phone;
      if (data.email)    target.email   = data.email;
      if (data.agent_data) state.agentResults[data.website] = data.agent_data;
    } else {
      // New entry — prepend
      state.allResults.unshift(data);
    }

    addUrlInput.value        = '';
    addUrlStatus.style.color = '#22c55e';
    addUrlStatus.textContent = `Added: ${data.name}${data.website ? ' — ' + new URL(data.website).hostname.replace('www.','') : ''}`;
    renderPage(1);
  } catch (err) {
    addUrlStatus.style.color = '#ef4444';
    addUrlStatus.textContent = 'Network error: ' + err.message;
  } finally {
    addUrlBtn.disabled = false;
  }
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportCSV() {
  const toExport = state.selectedIds.size > 0
    ? state.allResults.filter(r => state.selectedIds.has(r.id))
    : state.allResults;

  if (!toExport.length) { alert('No results to export.'); return; }

  const tpls    = state.templates.length ? state.templates : _TPL_STUBS;
  const tplHdrs = tpls.map(t => t.label);
  const headers = ['Name', 'Address', 'Phone', 'Email', 'Website', 'AI Agent', 'Agent Platform',
                   ...tplHdrs, 'Mail Sent', 'Times Sent', 'Last Sent Date', 'Called', 'Called Date'];
  const rows = toExport.map(b => {
    const agent  = b.website && state.agentResults[b.website];
    const phone  = (agent && agent.phones && agent.phones[0]) || b.phone || '';
    const email  = (agent && agent.emails && agent.emails[0]) || b.email || '';
    const sent   = sentLog[b.id];
    const call   = state.callLog[b.id];
    const tplCols = tpls.map(t => {
      if (!sent || !sent.history) return '';
      const r = sent.history.filter(h => !h.test && h.template === t.label);
      if (r.length) return new Date(r[r.length-1].sentAt).toLocaleDateString();
      const ts = sent.history.filter(h => h.test && h.template === t.label);
      return ts.length ? 'Tested' : '';
    });
    return [
      b.name,
      b.address,
      phone,
      email,
      b.website,
      !b.website  ? 'No website'
        : !agent  ? 'Not checked'
        : agent.is_social ? 'Social media'
        : agent.has_agent ? 'Yes' : 'No',
      agent && agent.has_agent ? (agent.platforms || []).join('; ') : '',
      ...tplCols,
      sent && sent.realCount ? 'Yes' : (sent && sent.testCount ? 'Tested only' : 'No'),
      sent ? (sent.realCount || 0) : 0,
      sent && sent.lastSentAt ? new Date(sent.lastSentAt).toLocaleDateString() : '',
      call && call.called ? 'Yes' : 'No',
      call && call.calledAt ? new Date(call.calledAt).toLocaleDateString() : '',
    ];
  });

  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const countryName = countrySearch.value.replace(/[^a-z0-9]/gi, '_');
  a.href     = url;
  a.download = `businesses_${state.currentCity}_${countryName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Single agent check ────────────────────────────────────────────────────────
async function checkSingle(url, btnEl) {
  const cell = btnEl.closest('td');
  cell.innerHTML = `<span class="mini-spinner"></span> Checking…`;

  const res = await fetch('/api/check-agent', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url }),
  }).then(r => r.json());

  if (url) state.agentResults[url] = res;
  cell.innerHTML = agentBadgeHtml(res);

  const biz = state.allResults.find(b => b.website === url);
  if (biz) {
    const tr = cell.closest('tr');
    // Backfill email
    if (res.emails && res.emails.length && !biz.email) {
      biz.email = res.emails[0];
      if (tr) {
        const td = tr.querySelector('.cell-email');
        if (td) td.innerHTML = emailCellHtml(biz.email);
      }
    }
    // Backfill phone
    if (res.phones && res.phones.length && !biz.phone) {
      biz.phone = res.phones[0];
      if (tr) {
        const td = tr.querySelector('.cell-phone');
        if (td) td.textContent = biz.phone;
      }
    }
  }
}

// ── Find website for a single business ───────────────────────────────────────
function _webLinkHtml(url) {
  return `<a class="web-link" href="${escHtml(url)}" target="_blank" rel="noopener">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>${shortenUrl(url)}</a>`;
}

async function findSite(bizId, name, address, btnEl, city, country) {
  const webCell   = btnEl ? btnEl.closest('td') : document.getElementById('web-cell-' + bizId);
  const agentCell = document.getElementById('agent-' + bizId);
  if (webCell) webCell.innerHTML = `<span class="mini-spinner"></span>`;

  const parts = [name, address, city || state.currentCity, country || countrySearch.value];
  const query = parts.filter(Boolean).join(', ');
  try {
    const res  = await fetch('/api/find-by-query', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query }),
    });
    const data = await res.json();

    if (!res.ok || !data.website) {
      // Mark the business object so re-renders show "No website found" not the button
      const biz = state.allResults.find(b => b.id === bizId);
      if (biz) biz.websiteNotFound = true;
      if (webCell) webCell.innerHTML = `<span class="badge badge-gray"><span class="badge-dot"></span>No website found</span>`;
      if (agentCell) agentCell.innerHTML = '<span class="no-data">—</span>';
      return null;
    }

    const biz = state.allResults.find(b => b.id === bizId);
    if (biz) {
      biz.website = data.website;
      if (!biz.phone && data.phone) biz.phone = data.phone;
      if (!biz.email && data.email) biz.email = data.email;
      if (data.agent_data) state.agentResults[data.website] = data.agent_data;

      const tr = webCell ? webCell.closest('tr') : null;
      if (tr) {
        tr.dataset.url = data.website;

        // Website cell → show link
        if (webCell) webCell.innerHTML = _webLinkHtml(data.website);

        // Agent cell → show badge or Check button
        if (agentCell) {
          agentCell.innerHTML = data.agent_data
            ? agentBadgeHtml(data.agent_data)
            : `<button class="check-btn" data-url="${escHtml(data.website)}">Check</button>`;
          agentCell.querySelectorAll('.check-btn').forEach(b =>
            b.addEventListener('click', () => checkSingle(b.dataset.url, b))
          );
        }

        if (data.email && !tr.querySelector('.cell-email a')) {
          const emailTd = tr.querySelector('.cell-email');
          if (emailTd) emailTd.innerHTML = emailCellHtml(data.email);
        }
        if (data.phone) {
          const phoneTd = tr.querySelector('.cell-phone');
          if (phoneTd && phoneTd.textContent.trim() === '—') phoneTd.textContent = data.phone;
        }
      }
    }
    return data.website;
  } catch {
    if (webCell) webCell.innerHTML = `<span class="badge badge-yellow"><span class="badge-dot"></span>Error</span>`;
    return null;
  }
}

const _FIND_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const _STOP_FIND = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;

// ── Find websites for ALL no-website businesses across all pages ──────────────
async function findAllWebsites() {
  if (state.scanning) return;
  const noSite = state.allResults.filter(b => !b.website && !b.websiteNotFound && b.name);
  if (!noSite.length) return;

  state.scanning   = true;
  _stopFindSites   = false;
  scanAllBtn.disabled = true;

  // Button turns red → click again to stop
  findWebsitesBtn.classList.add('searching');
  findWebsitesBtn.innerHTML = _STOP_FIND + ' Stop';

  // Spinner on any visible cells
  noSite.forEach(b => {
    const cell = document.getElementById('web-cell-' + b.id);
    if (cell) cell.innerHTML = `<span class="mini-spinner"></span>`;
  });

  const total = noSite.length;

  for (let i = 0; i < noSite.length; i += 2) {
    if (_stopFindSites) break;
    findWebsitesBtn.innerHTML = _STOP_FIND + ` Stop (${i + 1}–${Math.min(i + 2, total)} / ${total})`;
    await Promise.all(noSite.slice(i, i + 2).map(b =>
      findSite(b.id, b.name, b.address, null)
    ));
    if (i + 2 < noSite.length && !_stopFindSites) await new Promise(r => setTimeout(r, 800));
  }

  renderPage(state.page);
  findWebsitesBtn.classList.remove('searching');
  findWebsitesBtn.innerHTML = _FIND_ICON + ' Find websites';
  scanAllBtn.disabled       = false;
  state.scanning  = false;
  _stopFindSites  = false;
}

// ── Scan agents + emails for all businesses that have a website ───────────────
async function scanAllAgents() {
  if (state.scanning) return;
  const allWithSite = state.allResults.filter(b => b.website);
  if (!allWithSite.length) return;

  state.scanning = true;
  scanAllBtn.disabled      = true;
  findWebsitesBtn.disabled = true;

  // Show spinners on visible cells
  state.results.forEach(b => {
    if (!b.website) return;
    const cell = document.getElementById('agent-' + b.id);
    if (cell) cell.innerHTML = `<span class="mini-spinner"></span>`;
  });

  const orig = scanAllBtn.innerHTML;
  scanAllBtn.textContent = `Scanning ${allWithSite.length}…`;

  const urls = allWithSite.map(b => b.website);
  const res  = await fetch('/api/check-agents-batch', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ urls }),
  }).then(r => r.json());

  allWithSite.forEach(b => {
    const scraped = res[b.website];
    if (!scraped) return;

    state.agentResults[b.website] = scraped;

    if (scraped.emails && scraped.emails.length && !b.email) b.email = scraped.emails[0];
    if (scraped.phones && scraped.phones.length && !b.phone)  b.phone = scraped.phones[0];

    const agentCell = document.getElementById('agent-' + b.id);
    if (agentCell) {
      agentCell.innerHTML = agentBadgeHtml(scraped);
      const tr = agentCell.closest('tr');
      if (tr) {
        if (b.email) {
          const td = tr.querySelector('.cell-email');
          if (td) td.innerHTML = emailCellHtml(b.email);
        }
        if (b.phone) {
          const td = tr.querySelector('.cell-phone');
          if (td) td.textContent = b.phone;
        }
      }
    }
  });

  scanAllBtn.innerHTML     = orig;
  scanAllBtn.disabled      = false;
  findWebsitesBtn.disabled = false;
  state.scanning = false;
  saveSessionState();
}

// ── Mail-sent cell ────────────────────────────────────────────────────────────
function mailCellHtml(entry) {
  if (!entry) return '<span class="no-data">—</span>';
  const real = entry.realCount || 0;
  const test = entry.testCount || 0;
  if (real > 0) {
    const d = new Date(entry.lastSentAt).toLocaleDateString();
    return `<span class="mail-badge real" title="Sent ${real}× — last ${d} (${escHtml(entry.lastTemplate || '')})">✉ ×${real}</span>`;
  }
  return `<span class="mail-badge test" title="Tested ${test}× — not yet sent for real">✓ test ×${test}</span>`;
}

// ── Email cell ────────────────────────────────────────────────────────────────
function emailCellHtml(email) {
  return email
    ? `<a class="web-link" href="mailto:${escHtml(email)}">${escHtml(email)}</a>`
    : '<span class="no-data">—</span>';
}

// ── Agent badge ───────────────────────────────────────────────────────────────
function agentBadgeHtml(result) {
  if (!result.checked)
    return `<span class="badge badge-gray"><span class="badge-dot"></span>Not checked</span>`;
  if (result.error && !result.has_agent)
    return `<span class="badge badge-yellow" title="${escHtml(result.error)}"><span class="badge-dot"></span>Error</span>`;
  if (result.is_social)
    return `<span class="badge badge-gray" title="Social media page — agent detection not applicable"><span class="badge-dot"></span>Social media</span>`;
  if (result.has_agent) {
    const p = (result.platforms || []).join(', ') || 'Detected';
    return `<span class="badge badge-green" title="${escHtml(p)}"><span class="badge-dot"></span>${escHtml(p)}</span>`;
  }
  return `<span class="badge badge-red"><span class="badge-dot"></span>No agent</span>`;
}

// ── Pagination ────────────────────────────────────────────────────────────────
function renderPagination() {
  pagination.innerHTML = '';
  if (state.totalPages <= 1) return;

  const makeBtn = (label, page, disabled = false, active = false) => {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (active ? ' active' : '');
    btn.innerHTML = label;
    btn.disabled  = disabled;
    btn.addEventListener('click', () => renderPage(page));
    return btn;
  };

  pagination.appendChild(makeBtn('&#8592;', state.page - 1, state.page <= 1));

  pageNumbers(state.page, state.totalPages).forEach(p => {
    if (p === '…') {
      const ell = document.createElement('span');
      ell.className = 'page-ellipsis';
      ell.textContent = '…';
      pagination.appendChild(ell);
    } else {
      pagination.appendChild(makeBtn(p, p, false, p === state.page));
    }
  });

  pagination.appendChild(makeBtn('&#8594;', state.page + 1, state.page >= state.totalPages));
}

function pageNumbers(cur, total) {
  const delta = 2, out = [];
  let prev = null;
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || (p >= cur - delta && p <= cur + delta)) {
      if (prev !== null && p - prev > 1) out.push('…');
      out.push(p);
      prev = p;
    }
  }
  return out;
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function showLoading() { hideAll(); loadingState.style.display = 'flex'; }
function showEmpty(msg) {
  hideAll();
  emptyMsg.innerHTML = escHtml(msg) +
    ' <span style="color:#94a3b8">— or use <strong>Add by URL</strong> above to add one manually.</span>';
  emptyState.style.display = 'flex';
}
function showError(msg) { hideAll(); errorMsg.textContent = msg; errorState.style.display = 'flex'; }
function hideAll() {
  resultsSection.style.display  = 'none';
  loadingState.style.display    = 'none';
  emptyState.style.display      = 'none';
  errorState.style.display      = 'none';
  sourceTag.style.display       = 'none';
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function shortenUrl(url) {
  try {
    let host = new URL(url).hostname.replace(/^www\./,'');
    return host.length > 28 ? host.slice(0,26)+'…' : host;
  } catch { return url.slice(0,30); }
}

init();
