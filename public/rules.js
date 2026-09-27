export function makeRules(viewer, excludedSites = [], allowFile = false) {
 const excludedRequestDomains = excludedSites.map(s=>s.trim().toLowerCase()).filter(Boolean);
 const shared = {resourceTypes:['main_frame'],excludedRequestMethods:['post'],excludedRequestDomains};
 const redirect={type:'redirect',redirect:{regexSubstitution:viewer+'?source=\\0'}};
 const rules=[
  {id:1,priority:100,action:{type:'allow'},condition:{resourceTypes:['main_frame'],responseHeaders:[{header:'content-disposition',values:['attachment*']}]}},
  {id:2,priority:10,action:redirect,condition:{...shared,regexFilter:'^https?://.*',responseHeaders:[{header:'content-type',values:['application/pdf','application/pdf;*']}] }},
  {id:3,priority:9,action:redirect,condition:{...shared,regexFilter:'^https?://[^?#]*\\.[pP][dD][fF]([?#].*)?$',responseHeaders:[{header:'content-type',values:['application/octet-stream','application/octet-stream;*']}] }}
 ];
 if(allowFile)rules.push({id:4,priority:10,action:redirect,condition:{resourceTypes:['main_frame'],regexFilter:'^file://[^?#]*\\.[pP][dD][fF]([?#].*)?$'}});
 return rules;
}
