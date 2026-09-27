// The background worker owns Drive viewer creation. Concurrent requests are
// serialized; an existing viewer is focused without navigating away from edits.
export function driveSource(value) {
 try {
  const u = new URL(value);
  if (u.origin !== 'https://drive.google.com' || u.username || u.password) return null;
  const id = u.pathname.match(/\/file\/d\/([\w-]+)(?:\/|$)/)?.[1]
   || (['/open', '/uc'].includes(u.pathname) ? u.searchParams.get('id') : null);
  if (!id || !/^[\w-]+$/.test(id)) return null;
  const source = new URL(`https://drive.google.com/file/d/${id}/view`);
  for (const key of ['authuser', 'resourcekey']) {
   const value = u.searchParams.get(key);
   if (value) source.searchParams.set(key, value);
  }
  return {id, source: source.href, account: source.searchParams.get('authuser') || '0'};
 } catch { return null; }
}

export function driveRequest(message, sender, extensionID) {
 if (message?.type !== 'open-drive-pdf' || sender.id !== extensionID || sender.frameId !== 0 || !Number.isInteger(sender.tab?.id)) return null;
 try {if (new URL(sender.url).origin !== 'https://drive.google.com') return null;} catch {return null;}
 const file = driveSource(message.source);
 if (!file) return null;
 const incognito = !!sender.tab.incognito;
 return {...file, incognito, key: JSON.stringify([incognito, file.account, file.id]), name: String(message.name || 'document.pdf').slice(0, 240), openerTabId: sender.tab.id, windowId: sender.tab.windowId};
}

export function createDriveTabOpener(api) {
 let queue = Promise.resolve(), entries;
 const viewer = new URL(api.runtime.getURL('index.html'));
 const keyFor = (url, incognito) => {
  try {
   const u = new URL(url);
   if (u.protocol !== viewer.protocol || u.host !== viewer.host || u.pathname !== viewer.pathname) return null;
   const file = driveSource(u.searchParams.get('drive'));
   return file ? JSON.stringify([!!incognito, file.account, file.id]) : null;
  } catch {return null;}
 };
 const load = async () => entries ||= (await api.storage.session.get('driveViewerTabs').catch(() => ({}))).driveViewerTabs || {};
 const persist = () => api.storage.session.set({driveViewerTabs: entries}).catch(() => {});
 const serial = action => {const next = queue.catch(() => {}).then(action); queue = next; return next;};
 async function focus(tabId) {
  const tab = await api.tabs.update(tabId, {active: true});
  if (Number.isInteger(tab.windowId)) await api.windows.update(tab.windowId, {focused: true}).catch(() => {});
  return {ok: true, tabId, reused: true};
 }
 return {
  open(message, sender) {
   const request = driveRequest(message, sender, api.runtime.id);
   if (!request) return Promise.resolve({ok: false, error: 'Invalid Google Drive request.'});
   return serial(async () => {
    const {preferences = {}} = await api.storage.local.get('preferences');
    if (!preferences.autoOpen || preferences.excludedSites?.some(s => 'drive.google.com' === s || 'drive.google.com'.endsWith('.' + s))) return {ok: false, disabled: true};
    if (!await api.permissions.contains({origins: ['https://drive.google.com/*']})) return {ok: false, disabled: true};
    // The viewer's existing "Open original" fallback exempts this tab from
    // automatic opening until it closes, including the Drive content script.
    const bypass = (await api.declarativeNetRequest.getSessionRules()).some(rule => rule.id === 100000 + request.openerTabId);
    if (bypass) return {ok: false, disabled: true};
    await load();
    // Discover loaded viewers after worker/browser restarts. The session index
    // also covers a tab whose initial navigation has not finished yet.
    const contexts = await api.runtime.getContexts({contextTypes: ['TAB'], frameIds: [0], incognito: request.incognito});
    const known = entries[request.key];
    if (Number.isInteger(known)) {
     try {
      const tab = await api.tabs.get(known), context = contexts.find(c => c.tabId === known);
      if (keyFor(tab.pendingUrl || tab.url || context?.documentUrl, tab.incognito) === request.key) return await focus(known);
     } catch { /* The viewer may have just closed. */ }
     delete entries[request.key];
    }
    for (const context of contexts) {
     if (keyFor(context.documentUrl, context.incognito) !== request.key) continue;
     try {
      const tab = await api.tabs.get(context.tabId);
      if (keyFor(tab.pendingUrl || tab.url || context.documentUrl, tab.incognito) !== request.key) continue;
      const result = await focus(context.tabId);
      entries[request.key] = context.tabId; await persist(); return result;
     } catch { /* Try another context if this one just closed. */ }
    }
    const url = new URL(viewer);
    url.searchParams.set('drive', request.source); url.searchParams.set('name', request.name);
    const tab = await api.tabs.create({url: url.href, active: true, openerTabId: request.openerTabId, ...(Number.isInteger(request.windowId) ? {windowId: request.windowId} : {})});
    entries[request.key] = tab.id; await persist();
    return {ok: true, tabId: tab.id, reused: false};
   });
  },
  forget(tabId) {
   return serial(async () => {await load(); for (const [key, id] of Object.entries(entries)) if (id === tabId) delete entries[key]; await persist();});
  }
 };
}
