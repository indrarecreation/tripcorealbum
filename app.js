/*
  PUBLIC FRONTEND CONFIGURATION
  Paste your deployed Google Apps Script Web App URL into API_URL.
  Example: https://script.google.com/macros/s/DEPLOYMENT_ID/exec
*/
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbzScsJULF_qlURlwPTN790UtKTz9oV5nbD-BFNQtN1-b9UziSNmNXSqOQ_U3ftQad0/exec",
  GROUP_NAME: "RIDE JOURNAL",
  ESTABLISHED_YEAR: 2020,
  HERO_IMAGE: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=2200&q=85"
};

const $ = (selector) => document.querySelector(selector);
const state = { trips: [], filter: "all", settings: {} };

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function dateLabel(value) {
  if (!value) return "DATE NOT SET";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-IN", {day:"2-digit",month:"short",year:"numeric"});
}
function photoUrl(photo) {
  if (typeof photo === "string") return photo;
  return photo && (photo.url || photo.imageUrl || photo.src) || "";
}
function photosOf(trip) {
  let photos = trip.photos || trip.Photos || [];
  if (typeof photos === "string") {
    try { photos = JSON.parse(photos); } catch (_) { photos = photos ? [photos] : []; }
  }
  if (!Array.isArray(photos)) photos = [];
  const cover = trip.coverUrl || trip.CoverURL || trip.cover || "";
  const list = photos.map(p => typeof p === "string" ? {url:p,caption:""} : p).filter(p => p && (p.url || p.imageUrl));
  if (cover && !list.some(p => (p.url || p.imageUrl) === cover)) list.unshift({url:cover,caption:"Cover photograph"});
  return list;
}
function tripValue(trip, ...keys) {
  for (const key of keys) if (trip[key] !== undefined && trip[key] !== null && trip[key] !== "") return trip[key];
  return "";
}
function setText(selector, value) { const el = $(selector); if (el && value !== undefined && value !== null) el.textContent = value; }

async function apiGet(action = "publicData") {
  if (!CONFIG.API_URL || CONFIG.API_URL.includes("PASTE_YOUR")) throw new Error("Add your Apps Script Web App URL in app.js.");
  const url = new URL(CONFIG.API_URL);
  url.searchParams.set("action", action);
  // Apps Script deployments can redirect; keep requests simple to avoid preflight.
  const response = await fetch(url.toString(), {method:"GET", redirect:"follow"});
  if (!response.ok) throw new Error("Could not load the journal. Check the Apps Script deployment.");
  const data = await response.json();
  if (data.ok === false) throw new Error(data.error || "API request failed.");
  return data;
}
async function loadJournal() {
  try {
    const data = await apiGet("publicData");
    state.trips = Array.isArray(data.trips) ? data.trips : [];
    state.settings = data.settings || {};
    applySettings();
    renderStats();
    renderFilters();
    renderTrips();
  } catch (error) {
    $("#trip-grid").innerHTML = `<div class="loading-card"><p>${escapeHTML(error.message)}</p><p>Once the backend is deployed and configured, published trips will appear here.</p></div>`;
    setText("#archive-count", "JOURNAL CONNECTION NEEDED");
    $("#empty-state").classList.add("hidden");
  }
}
function applySettings() {
  const s = state.settings;
  const name = s.groupName || CONFIG.GROUP_NAME;
  document.title = `${name} — Our Roads, Our Stories`;
  setText("#brand-name", name);
  setText("#footer-brand", name);
  setText("#since-year", s.establishedYear || CONFIG.ESTABLISHED_YEAR);
  setText("#hero-year", s.establishedYear || CONFIG.ESTABLISHED_YEAR);
  setText("#current-year", new Date().getFullYear());
  if (s.heroImage || CONFIG.HERO_IMAGE) $("#hero-image").style.backgroundImage = `url("${s.heroImage || CONFIG.HERO_IMAGE}")`;
  if (s.heroTitle) $("#hero-title").innerHTML = escapeHTML(s.heroTitle).replace(/\n/g,"<br>");
  if (s.heroDescription) setText("#hero-description", s.heroDescription);
  if (s.aboutHeading) $("#about-heading").innerHTML = escapeHTML(s.aboutHeading).replace(/\n/g,"<br>").replace(/&lt;em&gt;/g,"<em>").replace(/&lt;\/em&gt;/g,"</em>");
  if (s.aboutShort) setText("#about-short", s.aboutShort);
  if (s.aboutLong) setText("#about-long", s.aboutLong);
  if (s.footerNote) setText("#footer-note", s.footerNote);
}
function renderStats() {
  const photos = state.trips.reduce((sum,t) => sum + photosOf(t).length, 0);
  setText("#stat-trips", String(state.trips.length).padStart(2,"0"));
  setText("#stat-photos", String(photos).padStart(2,"0"));
  setText("#stat-years", String(Math.max(0,new Date().getFullYear() - Number(state.settings.establishedYear || CONFIG.ESTABLISHED_YEAR))).padStart(2,"0"));
}
function renderFilters() {
  const categories = [...new Set(state.trips.map(t => tripValue(t,"category","Category","type","Type")).filter(Boolean))];
  $("#filters").innerHTML = `<button class="filter ${state.filter==="all"?"active":""}" data-filter="all">ALL TRIPS</button>` +
    categories.map(c => `<button class="filter ${state.filter===c?"active":""}" data-filter="${escapeHTML(c)}">${escapeHTML(c.toUpperCase())}</button>`).join("");
}
function renderTrips() {
  const trips = state.trips.filter(t => state.filter === "all" || tripValue(t,"category","Category","type","Type") === state.filter);
  setText("#archive-count", `${String(trips.length).padStart(2,"0")} STORIES IN THIS SELECTION`);
  $("#trip-grid").innerHTML = "";
  if (!trips.length) {
    $("#empty-state").classList.remove("hidden");
    return;
  }
  $("#empty-state").classList.add("hidden");
  $("#trip-grid").innerHTML = trips.map((trip, index) => {
    const photos = photosOf(trip);
    const image = photoUrl(photos[0]) || CONFIG.HERO_IMAGE;
    const title = tripValue(trip,"title","Title","tripName","TripName") || "Untitled journey";
    const destination = tripValue(trip,"destination","Destination","location","Location") || "Destination unknown";
    const date = tripValue(trip,"tripDate","TripDate","date","Date");
    const category = tripValue(trip,"category","Category","type","Type") || "FIELD NOTES";
    const id = tripValue(trip,"id","ID") || String(index);
    return `<article class="trip-card" tabindex="0" role="button" data-trip-id="${escapeHTML(id)}" aria-label="Open ${escapeHTML(title)}">
      <div class="trip-photo"><img loading="lazy" src="${escapeHTML(image)}" alt="${escapeHTML(title)}" onerror="this.src='${CONFIG.HERO_IMAGE}'"><span class="trip-number">${String(index+1).padStart(2,"0")} / ${String(trips.length).padStart(2,"0")}</span><span class="trip-photo-count">↗ ${photos.length} PHOTOS</span></div>
      <div class="trip-card-info"><span class="trip-category">${escapeHTML(category.toUpperCase())} · ${escapeHTML(destination.toUpperCase())}</span><h3>${escapeHTML(title)}</h3><div class="trip-card-bottom"><span>${escapeHTML(dateLabel(date))}</span><span class="trip-arrow">↗</span></div></div>
    </article>`;
  }).join("");
  $("#trip-grid").querySelectorAll(".trip-card").forEach(card => {
    const open = () => openTrip(card.dataset.tripId);
    card.addEventListener("click", open);
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }});
  });
}
function openTrip(id) {
  const trip = state.trips.find((t,i) => String(tripValue(t,"id","ID") || i) === String(id));
  if (!trip) return;
  const photos = photosOf(trip);
  const title = tripValue(trip,"title","Title","tripName","TripName") || "Untitled journey";
  const destination = tripValue(trip,"destination","Destination","location","Location") || "";
  const date = tripValue(trip,"tripDate","TripDate","date","Date");
  const category = tripValue(trip,"category","Category","type","Type") || "TRIP STORY";
  $("#story-cover").style.backgroundImage = `url("${photoUrl(photos[0]) || CONFIG.HERO_IMAGE}")`;
  setText("#story-meta", `${category.toUpperCase()} / ${dateLabel(date)} / ${destination.toUpperCase()}`);
  setText("#story-title", title);
  setText("#story-subtitle", tripValue(trip,"shortCaption","ShortCaption","subtitle","Subtitle") || destination);
  setText("#story-copy", tripValue(trip,"story","Story","caption","Caption","description","Description") || "Every ride leaves a mark. This is one of ours.");
  $("#story-gallery").innerHTML = photos.map((p,i) => `<figure><img loading="lazy" src="${escapeHTML(photoUrl(p))}" alt="${escapeHTML(p.alt || title)}"><figcaption>${escapeHTML(p.caption || p.Caption || (i===0 ? "The journey begins." : ""))}</figcaption></figure>`).join("");
  $("#trip-modal").classList.remove("hidden");
  $("#trip-modal").setAttribute("aria-hidden","false");
  document.body.style.overflow = "hidden";
}
function closeTrip() {
  $("#trip-modal").classList.add("hidden");
  $("#trip-modal").setAttribute("aria-hidden","true");
  document.body.style.overflow = "";
}
$("#filters").addEventListener("click", e => {
  const button = e.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  renderFilters(); renderTrips();
});
document.querySelectorAll("[data-close-modal]").forEach(el => el.addEventListener("click", closeTrip));
document.addEventListener("keydown", e => { if (e.key === "Escape") closeTrip(); });
$("#menu-toggle").addEventListener("click", () => $("#main-nav").classList.toggle("open"));
$("#main-nav").querySelectorAll("a").forEach(a => a.addEventListener("click", () => $("#main-nav").classList.remove("open")));
setText("#current-year", new Date().getFullYear());
loadJournal();
