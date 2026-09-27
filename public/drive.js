// Observe only identities exposed by Drive. Leave its DOM and navigation alone;
// the background worker creates or focuses one separate PDF Studio tab.
(() => {
 if (window.top !== window || location.hostname !== 'drive.google.com') return;
 let preferences = {}, pending, observedKey = '', observedHref = location.href;
 const pdfName = value => /\.pdf(?:\s|$)/i.test(value || '');
 const driveID = url => {try {const u = new URL(url, location.href); return u.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] || (['/open', '/uc'].includes(u.pathname) ? u.searchParams.get('id') : null);} catch {return null;}};
 function enabled() {return preferences.autoOpen && !preferences.excludedSites?.some(s => location.hostname === s || location.hostname.endsWith('.' + s));}
 function handoff(id, name, link) {
  if (!enabled() || !id || !/^[\w-]+$/.test(id)) return;
  const source = new URL(`https://drive.google.com/file/d/${id}/view`), here = new URL(location.href), target = new URL(link || location.href, location.href);
  for (const key of ['resourcekey', 'authuser']) {
   const value = target.searchParams.get(key) || here.searchParams.get(key);
   if (value) source.searchParams.set(key, value);
  }
  const account = here.pathname.match(/\/drive\/u\/(\d+)/)?.[1];
  if (account && !source.searchParams.has('authuser')) source.searchParams.set('authuser', account);
  // Suppress repeated mutation callbacks while the worker is still responding.
  observedKey = id;
  void chrome.runtime.sendMessage({type: 'open-drive-pdf', source: source.href, name: name || 'document.pdf'}).catch(() => {});
 }
 function fromElement(target) {
  const row = target instanceof Element ? target.closest('[data-id],a[href*="/file/d/"]') : null;
  if (!row) return null;
  const label = [row.getAttribute('aria-label'), row.getAttribute('data-tooltip'), row.textContent].filter(Boolean).join(' ');
  if (!pdfName(label) && !row.querySelector('[data-mime-type="application/pdf"], [role="img"][aria-label*="PDF" i], img[alt*="PDF" i]')) return null;
  const link = row.getAttribute('href'), id = row.getAttribute('data-id') || driveID(link);
  return id && /^[\w-]+$/.test(id) ? {id, link, name: label.match(/[^\n]*?\.pdf/i)?.[0].trim() || 'document.pdf'} : null;
 }
 function onOpen(event) {
  const candidate = fromElement(event.target);
  if (!candidate) return;
  pending = candidate;
  setTimeout(() => {if (pending === candidate) {pending = null; handoff(candidate.id, candidate.name, candidate.link);}}, 400);
 }
 document.addEventListener('dblclick', onOpen, true);
 document.addEventListener('keydown', event => {if (event.key === 'Enter' && !event.repeat && !event.ctrlKey && !event.metaKey && !['INPUT', 'TEXTAREA'].includes(event.target?.tagName)) onOpen(event);}, true);
 function inspect() {
  if (location.href !== observedHref) {observedHref = location.href; observedKey = '';}
  if (!enabled()) return;
  const id = driveID(location.href);
  if (!id || id === observedKey) return;
  const name = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || document.title;
  if (pdfName(name)) handoff(id, name.replace(/\s*[-–]\s*Google Drive.*$/i, ''));
 }
 let timer;
 new MutationObserver(() => {clearTimeout(timer); timer = setTimeout(inspect, 350);}).observe(document.documentElement, {subtree: true, childList: true});
 chrome.storage.local.get('preferences').then(({preferences: p = {}}) => {preferences = p; inspect();});
 chrome.storage.onChanged.addListener((changes, area) => {if (area === 'local' && changes.preferences) {const wasEnabled = enabled(); preferences = changes.preferences.newValue || {}; if (!wasEnabled && enabled()) observedKey = ''; inspect();}});
 window.addEventListener('popstate', inspect);
})();
