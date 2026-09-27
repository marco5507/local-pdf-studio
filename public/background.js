import {makeRules} from './rules.js';
import {createDriveTabOpener} from './drive-tabs.js';
const driveTabs = createDriveTabOpener(chrome);
let updating = Promise.resolve();
function updateRules(){updating=updating.catch(()=>{}).then(async()=>{
 const {preferences={}}=await chrome.storage.local.get('preferences');
 const access=await chrome.permissions.contains({origins:['http://*/*','https://*/*']});
 const file=await chrome.extension.isAllowedFileSchemeAccess();
 const old=await chrome.declarativeNetRequest.getDynamicRules();
 const addRules=preferences.autoOpen&&access?makeRules(chrome.runtime.getURL('index.html'),preferences.excludedSites,file):[];
 await chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds:old.map(r=>r.id),addRules});
 }); return updating;}
chrome.runtime.onInstalled.addListener(async(details)=>{await chrome.contextMenus.removeAll();chrome.contextMenus.create({id:'open-pdf',title:'Open in Local PDF Studio',contexts:['link']});await updateRules();if(details.reason==='install')chrome.tabs.create({url:chrome.runtime.getURL('index.html')+'#settings'});});
chrome.runtime.onStartup.addListener(updateRules);
chrome.storage.onChanged.addListener((c,a)=>{if(a==='local'&&c.preferences)updateRules();});
chrome.permissions.onAdded.addListener(updateRules);
chrome.permissions.onRemoved.addListener(updateRules);
chrome.action.onClicked.addListener(()=>chrome.tabs.create({url:'index.html'}));
chrome.contextMenus.onClicked.addListener((info)=>{if(info.menuItemId==='open-pdf'&&info.linkUrl)chrome.tabs.create({url:chrome.runtime.getURL('index.html')+'?file='+encodeURIComponent(info.linkUrl)});});
chrome.runtime.onMessage.addListener((m,s,respond)=>{
 if(s.id!==chrome.runtime.id)return;
 if(m?.type==='open-drive-pdf'){
  driveTabs.open(m,s).then(respond,e=>respond({ok:false,error:e.message}));return true;
 }
 if(m?.type==='refreshRules'){updateRules().then(()=>respond({ok:true}),e=>respond({error:e.message}));return true;}
 if(m?.type==='bypass'&&Number.isInteger(s.tab?.id)){
  const id=100000+s.tab.id;
  chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[id],addRules:[{id,priority:1000,action:{type:'allow'},condition:{tabIds:[s.tab.id],resourceTypes:['main_frame']}}]}).then(()=>respond({ok:true}));return true;
 }
});
chrome.tabs.onRemoved.addListener(tabId=>{void driveTabs.forget(tabId);void chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[100000+tabId]});});
