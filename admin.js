/*
  Admin frontend. Set API_URL to the same deployed Apps Script URL as app.js.
  Authentication and permission checks happen in Code.gs, not in this file.
*/
const ADMIN_CONFIG = { API_URL: "https://script.google.com/macros/s/AKfycbzScsJULF_qlURlwPTN790UtKTz9oV5nbD-BFNQtN1-b9UziSNmNXSqOQ_U3ftQad0/exec" };
const A = s => document.querySelector(s);
const adminState = { token:"", email:"", trips:[], settings:{}, photos:[] };

function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function showMessage(selector,message,isError=true){const el=A(selector);el.textContent=message;el.style.color=isError?"#d9512b":"#527447";}
function apiReady(){if(!ADMIN_CONFIG.API_URL||ADMIN_CONFIG.API_URL.includes("PASTE_YOUR"))throw new Error("Set the Apps Script Web App URL in admin.js first.");}
async function apiPost(payload){
  apiReady();
  const response=await fetch(ADMIN_CONFIG.API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload),redirect:"follow"});
  if(!response.ok)throw new Error("The server did not respond. Check deployment access and the API URL.");
  const data=await response.json();
  if(!data.ok)throw new Error(data.error||"Request failed.");
  return data;
}
async function apiGet(action,extra={}){
  apiReady();const url=new URL(ADMIN_CONFIG.API_URL);url.searchParams.set("action",action);
  Object.entries(extra).forEach(([k,v])=>url.searchParams.set(k,v));
  const response=await fetch(url.toString(),{redirect:"follow"});
  const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||"Request failed.");return data;
}
A("#login-form").addEventListener("submit",async e=>{
  e.preventDefault();const button=e.submitter;button.disabled=true;showMessage("#login-message","Checking access…",false);
  try{
    const result=await apiPost({action:"login",email:A("#login-email").value.trim(),password:A("#login-password").value});
    adminState.token=result.token;adminState.email=A("#login-email").value.trim();
    A("#login-panel").classList.add("hidden");A("#dashboard").classList.remove("hidden");
    await refreshAdminData();showMessage("#login-message","",false);
  }catch(err){showMessage("#login-message",err.message);}
  finally{button.disabled=false;}
});
A("#logout-button").addEventListener("click",async()=>{
  try{await apiPost({action:"logout",token:adminState.token});}catch(_){}
  adminState.token="";adminState.trips=[];adminState.photos=[];
  A("#dashboard").classList.add("hidden");A("#login-panel").classList.remove("hidden");A("#login-password").value="";
});
async function refreshAdminData(){
  const result=await apiPost({action:"adminData",token:adminState.token});
  adminState.trips=result.trips||[];adminState.settings=result.settings||{};
  fillSettings();renderAdminTrips();
}
function fillSettings(){
  const s=adminState.settings;
  A("#setting-name").value=s.groupName||"RIDE JOURNAL";A("#setting-year").value=s.establishedYear||2020;
  A("#setting-hero").value=s.heroImage||"";A("#setting-hero-description").value=s.heroDescription||"";
  A("#setting-about-heading").value=s.aboutHeading||"NOT JUST A RIDE. A WAY OF LIFE.";
  A("#setting-about-short").value=s.aboutShort||"";A("#setting-about-long").value=s.aboutLong||"";
  A("#setting-footer").value=s.footerNote||"";
}
document.querySelectorAll(".tab").forEach(button=>button.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===button));
  document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("hidden",p.id!==button.dataset.tab));
}));
A("#photo-input").addEventListener("change",async e=>{
  const files=[...e.target.files];if(!files.length)return;
  showMessage("#trip-message","Preparing photos for upload…",false);
  for(const file of files){
    try{const compressed=await resizeImage(file);adminState.photos.push({dataUrl:compressed,caption:"",name:file.name});}
    catch(err){showMessage("#trip-message",`Could not read ${file.name}: ${err.message}`);}
  }
  renderPhotoPreview();showMessage("#trip-message",`${adminState.photos.length} photo(s) ready. Add a caption under each photo if needed.`,false);
  e.target.value="";
});
function resizeImage(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error("File read failed"));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error("Not a valid image"));
      img.onload=()=>{
        const max=1500,scale=Math.min(1,max/Math.max(img.width,img.height));
        const canvas=document.createElement("canvas");canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
        const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL("image/jpeg",.78));
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function renderPhotoPreview(){
  const host=A("#photo-preview");
  if(!adminState.photos.length){host.innerHTML='<div class="empty-upload">No photos selected yet. Add at least one image for a visual trip story.</div>';A("#cover-select").innerHTML='<option value="">Use first uploaded photo</option>';return;}
  host.innerHTML=adminState.photos.map((p,i)=>`<div class="photo-tile"><img src="${p.dataUrl||p.url}" alt="Trip photo ${i+1}"><button type="button" class="remove-photo" data-remove-photo="${i}" aria-label="Remove photo">×</button><input type="text" data-photo-caption="${i}" value="${esc(p.caption||"")}" placeholder="Photo caption (optional)"></div>`).join("");
  A("#cover-select").innerHTML='<option value="">Use first uploaded photo</option>'+adminState.photos.map((p,i)=>`<option value="${i}">Photo ${i+1}${p.name?" — "+esc(p.name):""}</option>`).join("");
  host.querySelectorAll("[data-photo-caption]").forEach(input=>input.addEventListener("input",()=>{adminState.photos[Number(input.dataset.photoCaption)].caption=input.value;}));
  host.querySelectorAll("[data-remove-photo]").forEach(button=>button.addEventListener("click",()=>{adminState.photos.splice(Number(button.dataset.removePhoto),1);renderPhotoPreview();}));
}
A("#trip-form").addEventListener("submit",async e=>{
  e.preventDefault();const button=A("#save-trip-button");button.disabled=true;showMessage("#trip-message","Saving story and uploading photographs…",false);
  try{
    const photos=[];
    for(let i=0;i<adminState.photos.length;i++){
      const p=adminState.photos[i];
      if(p.url&&!p.dataUrl){photos.push({url:p.url,caption:p.caption||""});continue;}
      const uploaded=await apiPost({action:"uploadPhoto",token:adminState.token,dataUrl:p.dataUrl,filename:p.name||`trip-photo-${Date.now()}-${i}.jpg`});
      photos.push({url:uploaded.url,fileId:uploaded.fileId,caption:p.caption||""});
    }
    const coverIndex=A("#cover-select").value===""?0:Number(A("#cover-select").value);
    const coverUrl=photos[coverIndex]?.url||photos[0]?.url||"";
    const payload={
      id:A("#trip-id").value,
      title:A("#trip-title").value.trim(),
      destination:A("#trip-destination").value.trim(),
      tripDate:A("#trip-date").value,
      category:A("#trip-category").value.trim(),
      shortCaption:A("#trip-short").value.trim(),
      story:A("#trip-story").value.trim(),
      status:A("#trip-status").value,
      photos:photos,
      coverUrl:coverUrl
    };
    await apiPost({action:"saveTrip",token:adminState.token,trip:payload});
    showMessage("#trip-message","Trip story saved successfully.",false);
    resetTripForm(false);await refreshAdminData();
  }catch(err){showMessage("#trip-message",err.message);}
  finally{button.disabled=false;}
});
function resetTripForm(clearMessage=true){
  A("#trip-form").reset();A("#trip-id").value="";adminState.photos=[];renderPhotoPreview();
  if(clearMessage)showMessage("#trip-message","",false);
}
A("#reset-trip-button").addEventListener("click",()=>resetTripForm());
A("#settings-form").addEventListener("submit",async e=>{
  e.preventDefault();const button=e.submitter;button.disabled=true;showMessage("#settings-message","Saving website details…",false);
  try{
    const settings={
      groupName:A("#setting-name").value.trim(),establishedYear:A("#setting-year").value,
      heroImage:A("#setting-hero").value.trim(),heroDescription:A("#setting-hero-description").value.trim(),
      aboutHeading:A("#setting-about-heading").value.trim(),aboutShort:A("#setting-about-short").value.trim(),
      aboutLong:A("#setting-about-long").value.trim(),footerNote:A("#setting-footer").value.trim()
    };
    await apiPost({action:"saveSettings",token:adminState.token,settings});
    adminState.settings=settings;showMessage("#settings-message","Website details saved.",false);
  }catch(err){showMessage("#settings-message",err.message);}
  finally{button.disabled=false;}
});
function renderAdminTrips(){
  const host=A("#admin-trip-list");
  if(!adminState.trips.length){host.innerHTML='<p class="muted">No trip stories yet. Create your first story in the Trip Editor.</p>';return;}
  host.innerHTML=adminState.trips.map(t=>{
    const photos=Array.isArray(t.photos)?t.photos:[];
    const status=String(t.status||"draft").toUpperCase();
    return `<article class="admin-trip-row"><img src="${esc(t.coverUrl||photos[0]?.url||"")}" alt=""><div><h3>${esc(t.title||"Untitled story")}</h3><p>${esc(t.destination||"")} · ${esc(t.tripDate||"No date")} · ${photos.length} photo(s) · ${esc(status)}</p></div><div class="admin-trip-actions"><button data-edit="${esc(t.id)}">EDIT</button><button data-delete="${esc(t.id)}" class="delete">DELETE</button></div></article>`;
  }).join("");
  host.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editTrip(b.dataset.edit)));
  host.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteTrip(b.dataset.delete)));
}
function editTrip(id){
  const t=adminState.trips.find(x=>String(x.id)===String(id));if(!t)return;
  A("#trip-id").value=t.id;A("#trip-title").value=t.title||"";A("#trip-destination").value=t.destination||"";
  A("#trip-date").value=t.tripDate||"";A("#trip-category").value=t.category||"";A("#trip-short").value=t.shortCaption||"";
  A("#trip-story").value=t.story||"";A("#trip-status").value=t.status||"draft";
  adminState.photos=(t.photos||[]).map(p=>({url:p.url,caption:p.caption||"",name:p.name||""}));
  renderPhotoPreview();
  const selected=(t.photos||[]).findIndex(p=>p.url===t.coverUrl);A("#cover-select").value=selected>=0?String(selected):"";
  document.querySelector('[data-tab="trip-editor"]').click();window.scrollTo({top:0,behavior:"smooth"});
  showMessage("#trip-message","Editing existing story. Saving will update it.",false);
}
async function deleteTrip(id){
  const t=adminState.trips.find(x=>String(x.id)===String(id));if(!t||!confirm(`Delete "${t.title}" from the journal? This removes its database record.`))return;
  try{await apiPost({action:"deleteTrip",token:adminState.token,id});await refreshAdminData();}
  catch(err){alert(err.message);}
}
renderPhotoPreview();
