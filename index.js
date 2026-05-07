(function () {
  "use strict";

  const rootprefix = "soggy cat";
  const cachekey = "sogtree";
  const ttlms = 24 * 60 * 60 * 1000;

  const imageext = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i,
    videoext = /\.(mp4|webm|mov|mkv)$/i,
    audioext = /\.(mp3|wav|ogg|flac|m4a|aac)$/i;

  const drivegrid = document.querySelector(".drivegrid"),
    searchinput = document.querySelector(".searchinput"),
    refreshbutton = document.querySelector(".refreshbutton"),
    refreshtime = document.querySelector(".refreshtime"),
    viewlist = document.querySelector(".viewlist"),
    viewsquare = document.querySelector(".viewsquare"),
    goog = document.querySelector(".goog"),
    backbutton = document.querySelector(".backbutton"),
    readmebutton = document.querySelector(".readmebutton"),
    commentsbutton = document.querySelector(".commentsbutton"),
    readmeclose = document.querySelector(".readmeclose"),
    loginhint = document.querySelector(".loginhint"),
    discordavatarbutton = document.querySelector(".discordavatarbutton"),
    discordavatar = document.querySelector(".discordavatar"),
    discordmenu = document.querySelector(".discordmenu"),
    discordmenuavatar = document.querySelector(".discordmenuavatar"),
    discordmenuname = document.querySelector(".discordmenuname"),
    discordmenulogout = document.querySelector(".discordmenulogout"),
    medialightbox = document.querySelector(".medialightbox"),
    mediabox = document.querySelector(".mediabox"),
    mediabackdrop = document.querySelector(".mediabackdrop"),
    mediaclose = document.querySelector(".mediaclose"),
    mediacontent = document.querySelector(".mediacontent"),
    medianavleft = document.querySelector(".medianavleft"),
    medianavright = document.querySelector(".medianavright"),
    mediaregionlayer = document.querySelector(".mediaregionlayer"),
    medicomments = document.querySelector(".mediacomments"),
    medicommentslist = document.querySelector(".mediacommentslist"),
    mediainfo = document.querySelector(".mediainfo"),
    mqnarrow = window.matchMedia("(max-aspect-ratio: 3/4)");

  const readmedoc = document.querySelector(".readmecontent");
  const readmenavbtns = document.querySelectorAll(".readmenavbtn");
  const discordavatardefaulthtml = discordavatarbutton ? discordavatarbutton.innerHTML : "";

  // comment urls, don't modify unless moving the worker!
  const commentsarchiveurl = "assets/static/drivearchive.json";
  const commentsindexapi = "https://api.soggy.cat/v1/comments";
  const commentsliveapibase = "https://api.soggy.cat";
  const commentscache = new Map();

  let commentsindexpromise = null;
  let commentsindexbyfile = null;
  let lightboxfilename = "";
  let lightboxcomments = [];
  let lightboximg = null;
  let lightboxnavitems = [];
  let lightboxnavindex = -1;
  let activereplyto = null;
  let activefocuskey = null;
  let activeregion = null;
  let regionselectstart = null;

  /*//////////////////////////////////////////////////////////////////////*/

  const state = {
    tree: [], branch: "main",
    cwd: "", filter: "",
    listmode: false, truncated: false,
    commentsopen: false
  };
  const devtools = {
    isopen: false,
    orientation: undefined
  };
  const threshold = 170;

  function helloimyourneighbor() {
    try {
      new Audio("assets/audio/hello.mp3").play();
    } catch {}
  }
  const emitevent = (isopen, orientation) => {
    globalThis.dispatchEvent(new globalThis.CustomEvent("devtoolschange", { detail: { isopen, orientation } }));
    if (isopen) { helloimyourneighbor(); }
  };
  const main = ({ emitevents = true } = {}) => {
    const widththresh = globalThis.outerWidth - globalThis.innerWidth > threshold;
    const heightthresh = globalThis.outerHeight - globalThis.innerHeight > threshold;
    const orientation = widththresh ? "vertical" : "horizontal";
    if (!(heightthresh && widththresh) && ((globalThis.Firebug && globalThis.Firebug.chrome && globalThis.Firebug.chrome.isInitialized) || widththresh || heightthresh)) {
      if ((!devtools.isopen || devtools.orientation !== orientation) && emitevents) { emitevent(true, orientation); }
      devtools.isopen = true;
      devtools.orientation = orientation;
    } else {
      if (devtools.isopen && emitevents) { emitevent(false, undefined); }
      devtools.isopen = false;
      devtools.orientation = undefined;
    }
  };
  main({ emitevents: false });
  setInterval(main, 500);

  /*//////////////////////////////////////////////////////////////////////*/

  function discordloggedin() {
    return !!getsetting("discord_user", null) || !!getsetting("discord_token", "") || !!getsetting("discord_code", "");
  }
  function getdiscorduser() {
    const u = getsetting("discord_user", null);
    return u && typeof u === "object" ? u : null;
  }
  function setdiscordavatarurl(url) {
    if (!discordavatarbutton) return;
    const safe = (typeof url === "string" && url) ? url : "";
    if (!safe) return;
    discordavatarbutton.innerHTML = `<img class="discordavatarimg" alt="" referrerpolicy="no-referrer" src="${esc(safe)}">`;
  }
  function updatediscordmenu() {
    const u = getdiscorduser();
    if (discordmenuname)
      discordmenuname.textContent = u?.username || (getsetting("discord_code", "") ? "signed in (pending)" : "not signed in");
    if (discordmenulogout)
      discordmenulogout.hidden = !u;
    if (discordmenuavatar) {
      if (u?.avatar)
        discordmenuavatar.innerHTML = `<img class="discordavatarimg" alt="" referrerpolicy="no-referrer" src="${esc(u.avatar)}">`;
      else
        discordmenuavatar.innerHTML = `<div style="width:100%;height:100%;opacity:.6;display:grid;place-items:center">?</div>`;
    }
  }
  function updatediscordavatar() {
    const u = getdiscorduser();
    if (u?.avatar) setdiscordavatarurl(u.avatar);
    else if (discordavatarbutton) discordavatarbutton.innerHTML = discordavatardefaulthtml;
    if (discordavatarbutton) {
      const t = discordloggedin() ? "view your profile" : "log in with discord";
      discordavatarbutton.title = t;
      discordavatarbutton.setAttribute("aria-label", t);
    }
    updatediscordmenu();
    updateloginhint();
  }
  function updateloginhint() {
    if (!loginhint) return;
    loginhint.hidden = true;
    loginhint.classList.remove("fade");
  }
  function builddiscordauthorizeurl() {
    const base = "https://discord.com/oauth2/authorize";
    const redirect = `${location.origin}${location.pathname}`;
    const st = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
    setsetting("discord_oauth_state", st);
    const qs = new URLSearchParams({
      client_id: "1501279291848003744",
      response_type: "code",
      redirect_uri: redirect,
      scope: "identify",
      state: st
    });
    return `${base}?${qs.toString()}`;
  }
  function opendiscordpopup() {
    const url = builddiscordauthorizeurl();
    const w = 480, h = 720;
    const left = Math.max(0, Math.floor((window.screen.width - w) / 2));
    const top = Math.max(0, Math.floor((window.screen.height - h) / 2));
    const feat = `popup=yes,width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`;
    const win = window.open(url, "discord_oauth", feat);
    if (win) win.focus();
  }
  function handlediscordoauthcallbackifpresent() {
    const sp = new URLSearchParams(location.search || "");
    const code = sp.get("code");
    const incomingstate = sp.get("state");
    if (!code) return;
    const expected = getsetting("discord_oauth_state", "");
    if (expected && incomingstate && incomingstate !== expected) {
      sp.delete("code"); sp.delete("state");
      history.replaceState({}, "", `${location.pathname}${sp.toString() ? `?${sp.toString()}` : ""}${location.hash || ""}`);
      return;
    }
    const frompopup = !!(window.opener && window.opener !== window);
    if (!frompopup) {
      try { setsetting("discord_code", code); } catch (_) {}
      updatediscordmenu();
    }
    if (frompopup) {
      try { window.opener.postMessage({ type: "discord_oauth_code", code }, location.origin); } catch (_) {}
      window.setTimeout(() => { try { window.close(); } catch (_) {} }, 60);
    }
    sp.delete("code"); sp.delete("state");
    history.replaceState({}, "", `${location.pathname}${sp.toString() ? `?${sp.toString()}` : ""}${location.hash || ""}`);
  }
  async function resolvediscorduser() {
    if (!commentsliveapibase) return;
    if (getsetting("discord_token", "") && getdiscorduser()) return;
    const code = getsetting("discord_code", "");
    if (!code) return;
    try {
      const res = await fetch(`${commentsliveapibase}/me?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      if (!j || typeof j !== "object") return;
      if (typeof j.username === "string" && typeof j.avatar === "string") {
        setsetting("discord_user", { username: j.username, avatar: j.avatar });
        if (typeof j.token === "string" && j.token) setsetting("discord_token", j.token);
        setsetting("discord_code", "");
        updatediscordavatar();
      }
    } catch (_) {}
  }

  /*//////////////////////////////////////////////////////////////////////*/

  function loadsettings() {
    try {
      const s = JSON.parse(localStorage.getItem("settings") || "{}");
      return s && typeof s === "object" ? s : {};
    } catch { return {}; }
  }
  function savesettings(next) {
    try { localStorage.setItem("settings", JSON.stringify(next)); } catch (_) {}
  }
  function setsetting(key, value) {
    const s = loadsettings();
    s[key] = value;
    savesettings(s);
  }
  function getsetting(key, fallback) {
    const s = loadsettings();
    return s[key] === undefined ? fallback : s[key];
  }

  /*//////////////////////////////////////////////////////////////////////*/

  // non-html icons, use svgomg with reasonable settings!
  let pathhistory = [];
  const svg = {
    folder: '<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#FBE6A3"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z"/></svg>',
    image: '<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#df9d9b"><path d="M200-120q-33 0-56-23t-24-57v-560q0-33 24-56t56-24h560q33 0 57 24t23 56v560q0 33-23 57t-57 23zm0-80h560v-560H200zm40-80h480L570-480 450-320l-90-120zm-40 80v-560z"/></svg>',
    video: '<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#aac1f0"><path d="m160-800 80 160h120l-80-160h80l80 160h120l-80-160h80l80 160h120l-80-160h120q33 0 57 24t23 56v480q0 33-23 57t-57 23H160q-33 0-56-23t-24-57v-480q0-33 24-56t56-24m0 240v320h640v-320zm0 0v320z"/></svg>',
    audio: '<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#9dc384"><path d="M127-167q-47-47-47-113t47-113 113-47q23 0 43 6t37 16v-342l480-80v480q0 66-47 113t-113 47-113-47-47-113 47-113 113-47q23 0 43 6t37 16v-165l-320 63v320q0 66-47 113t-113 47-113-47"/></svg>',
    generic: '<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#9aa0a6"><path d="M320-240h320v-80H320zm0-160h320v-80H320zm0-160h160v-80H320zm-80 400q-33 0-56.5-23.5T160-240v-480q0-33 23.5-56.5T240-800h320l240 240v320q0 33-23.5 56.5T720-160zm280-360v-200H240v480h480v-280z"/></svg>'
  };

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function norm(p) { return (p || "").replace(/\/+$/, ""); }
  function repopath(path) {
    const p = (path || "").replace(/^\/+/, "");
    return p ? `${rootprefix}/${p}` : rootprefix;
  }
  function rawurl(path) {
    return `https://raw.githubusercontent.com/ssoggycat/drive-3/${state.branch}/${repopath(path).split("/").map(encodeURIComponent).join("/")}`;
  }

  /*//////////////////////////////////////////////////////////////////////*/

  function setrefreshtime(h) {
    refreshtime.textContent = Number.isFinite(h) && h >= 0 ? `${h}h` : "--";
  }
  function loadcache() {
    try {
      const d = JSON.parse(localStorage.getItem(cachekey) || "null");
      if (!d || !Array.isArray(d.tree) || typeof d.savedat !== "number") return null;
      if (Date.now() - d.savedat > ttlms) return null;
      return d;
    } catch { return null; }
  }
  function savecache(data) {
    try {localStorage.setItem(cachekey, JSON.stringify({ ...data, savedat: Date.now() })); } catch (_) {}
  }
  function clearcache() {
    try {localStorage.removeItem(cachekey); } catch (_) {}
  }

  async function githubfetch(path) {
    return (await fetch(`https://api.github.com${path}`,
      {headers: {Accept: "application/vnd.github+json"}})).json();
  }
  async function fetchtreefresh() {
    const meta = await githubfetch(`/repos/ssoggycat/drive-3`);
    state.branch = meta.default_branch || "main";
    const branch = await githubfetch(`/repos/ssoggycat/drive-3/branches/${state.branch}`);
    const gitcommit = await githubfetch(`/repos/ssoggycat/drive-3/git/commits/${branch.commit.sha}`);
    const tree = await githubfetch(`/repos/ssoggycat/drive-3/git/trees/${gitcommit.tree.sha}?recursive=1`);
    const filtered = (Array.isArray(tree.tree) ? tree.tree : [])
      .filter((x) => x.path === rootprefix || x.path.startsWith(`${rootprefix}/`))
      .map((x) => ({ ...x, path: x.path.slice(`${rootprefix}/`.length) }))
      .filter((x) => x.path && !x.path.split("/").some((seg) => seg.startsWith(".")));
    return { tree: filtered, branch: state.branch, truncated: !!tree.truncated };
  }

  function listchildren(prefix) {
    const p = norm(prefix);
    const out = new Map();
    for (const item of state.tree) {
      if (item.type !== "blob" && item.type !== "tree") continue;
      const rel = !p ? item.path : item.path.startsWith(`${p}/`) ? item.path.slice(p.length + 1) : null;
      if (!rel) continue;
      const parts = rel.split("/").filter(Boolean);
      const name = parts[0];
      if (!name || name.startsWith(".")) continue;
      if (parts.length === 1) out.set(name, { kind: item.type === "tree" ? "folder" : "file", name, path: item.path });
      else if (!out.has(name)) out.set(name, { kind: "folder", name, path: p ? `${p}/${name}` : name });
    }
    return [...out.values()].sort((a, b) => a.kind !== b.kind ? (a.kind === "folder" ? -1 : 1) : a.name.localeCompare(b.name));
  }

  /*//////////////////////////////////////////////////////////////////////*/

  function iconfor(name) {
    if (imageext.test(name)) return svg.image;
    if (videoext.test(name)) return svg.video;
    if (audioext.test(name)) return svg.audio;
    return svg.generic;
  }
  function basename(p) {
    const s = String(p || "");
    const i = s.lastIndexOf("/");
    return i >= 0 ? s.slice(i + 1) : s;
  }
  function extname(name) {
    const b = basename(name);
    const i = b.lastIndexOf(".");
    return i >= 0 ? b.slice(i + 1).toLowerCase() : "";
  }
  function formatbytes(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n < 0) return "";
    if (n < 1024) return `${Math.round(n)} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let v = n / 1024;
    let idx = 0;
    while (v >= 1024 && idx < units.length - 1) {
      v /= 1024;
      idx++;
    }
    return `${v.toFixed(v >= 10 ? 1 : 2)} ${units[idx]}`;
  }
  function formattimecompact(sec) {
    const n = Number(sec);
    if (!Number.isFinite(n) || n <= 0) return "";
    const s = Math.floor(n % 60);
    const m = Math.floor((n / 60) % 60);
    const h = Math.floor(n / 3600);
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }
  function updatemediainfo(pathname, extra = {}) {
    if (!mediainfo) return;
    const file = basename(pathname) || pathname;
    const item = state.tree.find(x => x.type === "blob" && x.path === pathname);
    const ext = extname(file);
    const kind = imageext.test(file)
      ? "image"
      : videoext.test(file)
      ? "video"
      : audioext.test(file)
      ? "audio"
      : "file";
    const meta = [];
    const sz = formatbytes(item?.size);
    if (sz) meta.push(sz);
    if (extra.width && extra.height) meta.push(`${extra.width} x ${extra.height}px`);
    const dur = formattimecompact(extra.duration);
    if (dur) meta.push(dur);
    meta.push(ext ? `${kind}/${ext}` : kind);
    mediainfo.innerHTML =
      `<div class="mediainfofilename">${esc(file)}</div>` +
      meta.map(x => `<div class="mediainfometa">${esc(x)}</div>`).join("");
  }
  function thumburl(path) {
    const normalized = String(path || "").replace(/\\/g, "/");
    const b = basename(path);
    const noext = b.replace(/\.[^.]+$/, "");
    const invds = normalized.startsWith("vids/") || normalized.includes("/vids/");
    const base = invds ? "https://mirror.guweh.com/webp/vids" : "https://mirror.guweh.com/webp";
    return `${base}/${encodeURIComponent(noext)}.webp`;
  }

  /*//////////////////////////////////////////////////////////////////////*/

  // hash instead of a url param, because, well, it's shorter
  function hashfilepath() {
    const h = String(location.hash || "");
    if (!h || h === "#") return "";
    const m = h.match(/^#file=(.+)$/);
    const raw = m ? m[1] : h.startsWith("#") ? h.slice(1) : h;
    try {return decodeURIComponent(raw); } catch {return ""}
  }
  function sethashfilepath(path) {
    const p = String(path || "");
    const nh = p ? `#${encodeURI(p)}` : "";
    if (location.hash !== nh) history.replaceState({}, "", `${location.pathname}${location.search}${nh}`);
  }
  function openfromhashifany() {
    const p = hashfilepath();
    if (!p) return;
    const normp = String(p).replace(/^\/+/, "");
    const folderonly = state.tree.some(x => x.type === "tree" && x.path === normp);
    if (folderonly) {
      if (state.cwd !== normp) {
        pathhistory = [""];
        state.cwd = normp;
        updatebackdisabled();
        rendergrid();
      }
      return;
    }
    const item = state.tree.find(x => x.type === "blob" && x.path === normp);
    if (!item) return;
    const folder = normp.includes("/") ? normp.slice(0, normp.lastIndexOf("/")) : "";
    if (state.cwd !== folder) {
      pathhistory = [""];
      state.cwd = folder;
      updatebackdisabled();
      rendergrid();
    }
    openlightbox(rawurl(normp), normp, videoext.test(normp));
  }

  /*//////////////////////////////////////////////////////////////////////*/

  function updatereadmepreference(open) {
    setsetting(mqnarrow.matches ? "readmenarrow" : "readmewide", open ? 1 : 0);
  }
  function readmestartstate() {
    return mqnarrow.matches ? getsetting("readmenarrow", 0) === 1 : getsetting("readmewide", 1) !== 0;
  }
  function togglereadme() {
    if (!goog) return;
    const open = !goog.classList.contains("readmeopen");
    goog.classList.toggle("readmeopen", open);
    if (readmebutton) readmebutton.classList.toggle("readmeclosed", !open);
    updatereadmepreference(open);
  }
  function updatenarrowclass() {
    goog.classList.toggle("narrowaspect", mqnarrow.matches);
  }
  (mqnarrow.addEventListener
    ? mqnarrow.addEventListener("change", updatenarrowclass)
    : mqnarrow.addListener(updatenarrowclass));
  updatenarrowclass();

  if (goog) {
    goog.classList.toggle("readmeopen", readmestartstate());
    if (readmebutton)
      readmebutton.classList.toggle("readmeclosed", !goog.classList.contains("readmeopen"));
    goog.classList.add("initialized");
  }

  /*//////////////////////////////////////////////////////////////////////*/

  function updatebackdisabled() {
    if (!backbutton) return;
    backbutton.disabled = pathhistory.length === 0;
    backbutton.setAttribute("aria-disabled", pathhistory.length > 0 ? "false" : "true");
  }
  function rendergrid() {
    const all = listchildren(state.cwd).filter(x => x.name.toLowerCase().includes(state.filter.toLowerCase()));
    const folders = all.filter(x => x.kind === "folder");
    const files = all.filter(x => x.kind === "file");
    drivegrid.innerHTML = "";
    if (!all.length) {
      drivegrid.innerHTML = `<div class="emptystate">${state.filter ? "No files match your search." : "This folder is empty."}</div>`;
      return;
    }
    if (folders.length) {
      const row = document.createElement("div");
      row.className = "folderrow";
      for (const f of folders) {
        const card = document.createElement("div");
        card.className = "foldercard";
        card.innerHTML = `${svg.folder}<span class="name"></span>`;
        card.querySelector(".name").textContent = f.name;
        card.addEventListener("click", () => navigate(f.path, { stack: true }));
        row.appendChild(card);
      }
      drivegrid.appendChild(row);
    }
    if (files.length) {
      const grid = document.createElement("div");
      grid.className = `filegrid${state.listmode ? " listmode" : ""}`;
      for (const f of files) {
        const card = document.createElement("div");
        card.className = "filecard";
        const isimg = imageext.test(f.name);
        const isvid = videoext.test(f.name);
        const thumb = (isimg || isvid)
          ? `<img class="thumbimg thumbimgpending" data-src="${thumburl(f.path)}" alt="" loading="lazy">`
          : "";
        card.innerHTML =
          `<div class="filehead">${iconfor(f.name)}<span class="name"></span></div>` +
          `<div class="thumb">` +
          `<div class="thumbicon">${iconfor(f.name)}</div>` +
          `${thumb || '<div class="thumbfallback">click to open</div>'}` +
          `</div>`;
        card.querySelector(".name").textContent = f.name;
        card.addEventListener("click", e => {
          if (isimg || isvid) {
            openlightbox(rawurl(f.path), f.path, !!isvid);
            return;
          }
          window.open(rawurl(f.path), "_blank", "noopener,noreferrer");
        });
        grid.appendChild(card);
      }
      drivegrid.appendChild(grid);
    }

    // lazy load thumbnails to not murder the performance, especially because people might view the site on mobile
    const imgs = drivegrid.querySelectorAll("img.thumbimg[data-src]");
    if (imgs.length) {
      const root = document.querySelector(".drivecontent") || null;
      const io = new IntersectionObserver((entries, obs) => {
        for (const ent of entries) {
          if (!ent.isIntersecting) continue;
          const img = ent.target;
          const src = img.getAttribute("data-src");
          if (src) {
            img.addEventListener("load", () => img.classList.remove("thumbimgpending"), { once: true });
            img.src = src;
            img.removeAttribute("data-src");
            img.addEventListener("error", () => img.remove(), { once: true });
          }
          obs.unobserve(img);
        }
      }, { root, rootMargin: "50% 0px 50% 0px", threshold: 0.01 });
      for (const img of imgs) io.observe(img);
    }
  }
  function navigate(path, opts) {
    const next = norm(path);
    if (opts?.crumb) pathhistory = [];
    else if (opts?.stack && next !== state.cwd) pathhistory.push(state.cwd);
    state.cwd = next;
    updatebackdisabled();
    rendergrid();
  }

  function gobackfolder() {
    if (!pathhistory.length) return;
    state.cwd = pathhistory.pop() || "";
    updatebackdisabled();
    rendergrid();
  }

  function setcommentsopen(show) {
    state.commentsopen = show;
    if (commentsbutton)
      commentsbutton.classList.toggle("commentsmuted", !show);
    setsetting("commentson", show ? 1 : 0);
    updateloginhint();
  }

  /*//////////////////////////////////////////////////////////////////////*/

  const mdcache = new Map();
  function mdtohtml(md) {
    const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
    let out = "";
    let incode = false;
    for (const line of lines) {
      if (line.startsWith("```")) {
        incode = !incode;
        out += incode ? "<pre><code>" : "</code></pre>";
        continue;
      }
      if (incode) { out += `${esc(line)}\n`; continue; }
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        const lvl = h[1].length;
        out += `<h${lvl}>${h[2]}</h${lvl}>`;
        continue;
      }
      if (!line.trim()) { out += ""; continue; }
      if (line.trim().startsWith("<")) out += line;
      else if (line.includes("<")) out += `<p>${line}</p>`;
      else out += `<p>${esc(line)}</p>`;
    }
    return out;
  }
  async function loadmddoc(name) {
    if (!readmedoc) return;
    const key = String(name || "README.md");
    if (mdcache.has(key)) return mdcache.get(key);
    const islocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
    const bust = islocal ? `?t=${Date.now()}` : "";
    const res = await fetch(`${key}${bust}`, { cache: islocal ? "no-store" : "force-cache" });
    const txt = res.ok ? await res.text() : `# missing\ncould not load ${key}`;
    mdcache.set(key, txt);
    return txt;
  }
  async function showmddoc(name) {
    if (!readmedoc) return;
    const key = String(name || "README.md");
    const txt = await loadmddoc(key);
    readmedoc.innerHTML = mdtohtml(txt);
    for (const b of readmenavbtns)
      b.classList.toggle("active", b.getAttribute("data-doc") === key);
    setsetting("readmedoc", key);
  }

  /*//////////////////////////////////////////////////////////////////////*/

  // comment region handlers
  async function loadcommentsindex() {
    if (commentsindexbyfile) return commentsindexbyfile;
    if (!commentsindexpromise) {
      commentsindexpromise = (async () => {
        let j = null;
        try {
          const res = await fetch(commentsarchiveurl, { cache: "force-cache" });
          if (res.ok) j = await res.json();
        } catch (_) {}
        if (!j) {
          const res = await fetch(commentsindexapi, { cache: "force-cache" });
          if (!res.ok) return new Map();
          j = await res.json();
        }
        const files = Array.isArray(j?.files) ? j.files : [];
        const map = new Map();
        for (const f of files) {
          if (typeof f?.basename === "string")
            map.set(f.basename, Array.isArray(f?.comments) ? f.comments : []);
        }
        return map;
      })().catch(() => new Map());
    }
    commentsindexbyfile = await commentsindexpromise;
    return commentsindexbyfile;
  }

  async function fetchlivecomments(filename) {
    if (!commentsliveapibase || !filename) return [];
    try {
      const res = await fetch(`${commentsliveapibase}/comments?file=${encodeURIComponent(filename)}`, { cache: "no-store" });
      if (!res.ok) return [];
      const j = await res.json();
      return Array.isArray(j?.comments) ? j.comments : [];
    } catch { return []; }
  }
  async function fetchcomments(filename) {
    if (!filename) return [];
    if (commentscache.has(filename)) return commentscache.get(filename);
    try {
      const idx = await loadcommentsindex();
      const archived = idx.get(filename) || [];
      const live = await fetchlivecomments(filename);
      const rows = [...archived, ...live]
        .map(c => {
          const replyingto = (typeof c?.replyingto === "string" && c.replyingto) ? c.replyingto : null;
          const region = Array.isArray(c?.region) && c.region.length === 4 ? c.region.map(Number) : null;
          const replyid = typeof c?.replyid === "string" && c.replyid ? c.replyid : null;
          return { ...c, replyingto, region, replyid };
        })
        .sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));
      commentscache.set(filename, rows);
      return rows;
    } catch { return []; }
  }

  function formattime(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n)) return "";
    try {
      return new Date(n).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    } catch { return ""; }
  }

  function rendercommentpanel(comments) {
    if (!medicomments || !medicommentslist) return;
    if (!state.commentsopen) {
      medicomments.hidden = true;
      medicommentslist.innerHTML = "";
      activereplyto = null; activefocuskey = null;
      activeregion = null; updateloginhint();
      return;
    }
    medicomments.hidden = false;
    medicommentslist.innerHTML = "";
    updateloginhint();

    const loggedin = !!getsetting("discord_token", "");
    comments = (Array.isArray(comments) ? comments : []).filter(c => (c?.plain || "").trim().length > 0);
    if (!comments.length) return;
    const byid = new Map();
    for (const c of comments) {
      const key = c?.replyid ? String(c.replyid) : String(c?.id || "");
      if (key) byid.set(key, c);
    }

    const byparent = new Map();
    for (const c of comments) {
      const parentkey = c?.replyingto ? String(c.replyingto) : "__root__";
      if (!byparent.has(parentkey)) byparent.set(parentkey, []);
      byparent.get(parentkey).push(c);
    }

    for (const arr of byparent.values())
      arr.sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));
    const roots = comments
      .filter(c => !c?.replyingto || !byid.has(String(c.replyingto)))
      .sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));

    for (const root of roots) {
      const chain = [];
      const stack = [{ node: root, depth: 0 }];
      while (stack.length) {
        const cur = stack.pop();
        chain.push(cur);
        const childkey = cur.node?.replyid ? String(cur.node.replyid) : String(cur.node?.id || "");
        const kids = childkey ? (byparent.get(childkey) || []) : [];
        for (let i = kids.length - 1; i >= 0; i--) stack.push({ node: kids[i], depth: cur.depth + 1 });
      }

      const chainwrap = document.createElement("div");
      chainwrap.className = "mediacommentchain";
      for (const item of chain) {
        const c = item.node;
        const cid = String(c.replyid || (c.id ? `id:${c.id}` : ""));
        const card = document.createElement("div");
        card.className = `mediacomment clickable${item.depth > 0 ? " isreply" : ""}`;
        const author = esc(c.author || "unknown");
        const txt = esc(c.plain || "");
        const when = esc(formattime(c.id));
        const pfp = typeof c.authorpfp === "string" ? c.authorpfp : "";
        const src = String(pfp);
        const isgoogle = src.includes("googleusercontent.com");
        const isdiscord = src.includes("discordapp.com") || src.includes("discord.com");
        const badge = isgoogle ? "assets/svg/drive.svg" : isdiscord ? "assets/svg/discord.svg" : "";
        
        // comment template
        card.innerHTML =
          `<div class="mediacommentrow">` +
          `<div class="mediacommentpfpwrap">` +
          `<img class="mediacommentpfp" alt="" referrerpolicy="no-referrer" src="${esc(pfp)}">` +
          (badge ? `<img class="mediacommentsource" alt="" src="${badge}">` : ``) +
          `</div>` +
          `<div>` +
          `<div class="mediacommentmeta">` +
          `<div class="mediacommentauthor">${author}</div>` +
          `<div class="mediacommenttime">${when}</div>` +
          `</div>` +
          `<div class="mediacommentbody"><div class="mediacommenttext">${txt}</div></div>` +
          `</div>` +
          `</div>`;

        card.addEventListener("click", e => {
          if (!state.commentsopen) return;
          if (!cid) return;
          e.stopPropagation();
          activereplyto = c.replyid ? String(c.replyid) : null;
          activefocuskey = cid;
          activeregion = Array.isArray(c.region) ? c.region : null;
          renderregions(comments);
          rendercommentpanel(comments);
        });

        chainwrap.appendChild(card);
        if (loggedin && activefocuskey && activefocuskey === cid) {
          const composer = document.createElement("div");
          composer.className = "mediacomment commentcomposerwrap";
          
          // add comment template
          composer.innerHTML =
            `<textarea class="commentcompose" rows="3" placeholder="reply to a comment.."></textarea>` +
            `<div class="commentcomposeactions">` +
            `<button type="button" class="commentpost">post</button>` +
            `</div>`;

          const postbtn = composer.querySelector(".commentpost");
          const textarea = composer.querySelector(".commentcompose");
          if (postbtn && textarea) postbtn.addEventListener("click", async () => {
            const text = textarea.value.trim();
            if (!text) return;
            const token = getsetting("discord_token", "");
            if (!commentsliveapibase || !token) return;
            postbtn.disabled = true;
            try {

              const body = {
                file: lightboxfilename,
                text, token,
                replyingto: activereplyto || null,
                region: activeregion || null
              };

              const res = await fetch(`${commentsliveapibase}/comments`, {
                method: "POST", headers: {"content-type": "application/json"},
                body: JSON.stringify(body)
              });

              if (res.ok) {
                activereplyto = null;
                activefocuskey = null;
                activeregion = null;
                commentscache.delete(lightboxfilename);
                const refreshed = await fetchcomments(lightboxfilename);
                lightboxcomments = refreshed;
                rendercommentpanel(refreshed);
                renderregions(refreshed);
              }

            } catch (_) {}
            postbtn.disabled = false;
          }); chainwrap.appendChild(composer);
        }
      }; medicommentslist.appendChild(chainwrap);
    }
    if (loggedin && activeregion && !activereplyto) {
      const composer = document.createElement("div");
      composer.className = "mediacomment commentcomposerwrap regioncomposer";
      
      // another comment create template
      composer.innerHTML =
        `<textarea class="commentcompose" rows="3" placeholder="write a comment for this region.."></textarea>` +
        `<div class="commentcomposeactions">` +
        `<button type="button" class="commentpost">post</button>` +
        `</div>`;
        
      medicommentslist.appendChild(composer);
      const postbtn = composer.querySelector(".commentpost");
      const textarea = composer.querySelector(".commentcompose");
      if (postbtn && textarea) postbtn.addEventListener("click", async () => {
        const text = textarea.value.trim();
        if (!text) return;
        const token = getsetting("discord_token", "");
        if (!commentsliveapibase || !token) return;
        postbtn.disabled = true;
        try {
          const body = {
            file: lightboxfilename,
            text, token,
            replyingto: activereplyto || null,
            region: activeregion || null
          };
          const res = await fetch(`${commentsliveapibase}/comments`, {
            method: "POST", headers: {"content-type": "application/json"},
            body: JSON.stringify(body)
          });
          if (res.ok) {
            activereplyto = null; activefocuskey = null;
            activeregion = null;
            commentscache.delete(lightboxfilename);
            const refreshed = await fetchcomments(lightboxfilename);
            lightboxcomments = refreshed;
            rendercommentpanel(refreshed);
            renderregions(refreshed);
          }
        } catch (_) {}
        postbtn.disabled = false;
      });
    }
  }

  function layoutregionlayer() {
    if (!mediaregionlayer || !lightboximg) return;
    const img = lightboximg;
    const stage = img.closest(".mediastage");
    if (!stage) return;
    const ib = img.getBoundingClientRect();
    const sb = stage.getBoundingClientRect();
    mediaregionlayer.style.left = `${Math.max(0, ib.left - sb.left)}px`;
    mediaregionlayer.style.top = `${Math.max(0, ib.top - sb.top)}px`;
    mediaregionlayer.style.width = `${Math.max(0, Math.min(sb.width, ib.width))}px`;
    mediaregionlayer.style.height = `${Math.max(0, Math.min(sb.height, ib.height))}px`;
  }

  function renderregions(comments) {
    if (!mediaregionlayer) return;
    mediaregionlayer.innerHTML = "";
    if (!state.commentsopen) {
      const stage = lightboximg?.closest(".mediastage");
      if (stage) stage.classList.remove("commentfocus");
      mediaregionlayer.classList.remove("selecting");
      return;
    }
    const stage = lightboximg?.closest(".mediastage");
    if (stage) stage.classList.toggle("commentfocus", !!activeregion || !!activefocuskey || !!activereplyto);
    layoutregionlayer();
    let matchedactive = false;
    for (const c of comments) {
      if (!Array.isArray(c.region) || c.region.length !== 4) continue;
      const [x1, y1, x2, y2] = c.region.map(Number);
      if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
      const box = document.createElement("div");
      box.className = "mediaregion";
      box.style.left = `${Math.max(0, Math.min(1, x1)) * 100}%`;
      box.style.top = `${Math.max(0, Math.min(1, y1)) * 100}%`;
      box.style.width = `${Math.max(0, Math.min(1, x2 - x1)) * 100}%`;
      box.style.height = `${Math.max(0, Math.min(1, y2 - y1)) * 100}%`;
      const isactive =
        activeregion &&
        Number(activeregion[0]) === Number(x1) &&
        Number(activeregion[1]) === Number(y1) &&
        Number(activeregion[2]) === Number(x2) &&
        Number(activeregion[3]) === Number(y2);
      if (isactive) matchedactive = true;
      box.classList.toggle("active", !!isactive);
      box.addEventListener("click", e => {
        if (!state.commentsopen || !getsetting("discord_token", "")) return;
        e.stopPropagation();
        activereplyto = null;
        activefocuskey = null;
        activeregion = [x1, y1, x2, y2];
        renderregions(comments);
        rendercommentpanel(comments);
      });
      mediaregionlayer.appendChild(box);
    }
    if (activeregion && !matchedactive) drawdraftregion(activeregion);
    const canselect = !!getsetting("discord_token", "");
    mediaregionlayer.classList.toggle("selecting", canselect);
    mediaregionlayer.classList.toggle("crosshair", canselect);
  }

  function normalizedregionfrompoints(x1, y1, x2, y2) {
    if (!mediaregionlayer) return null;
    const w = mediaregionlayer.clientWidth || 1;
    const h = mediaregionlayer.clientHeight || 1;
    const nx1 = Math.max(0, Math.min(1, Math.min(x1, x2) / w));
    const ny1 = Math.max(0, Math.min(1, Math.min(y1, y2) / h));
    const nx2 = Math.max(0, Math.min(1, Math.max(x1, x2) / w));
    const ny2 = Math.max(0, Math.min(1, Math.max(y1, y2) / h));
    if (Math.abs(nx2 - nx1) < 0.004 || Math.abs(ny2 - ny1) < 0.004) return null;
    return [nx1, ny1, nx2, ny2];
  }

  function drawdraftregion(region) {
    if (!mediaregionlayer) return;
    const old = mediaregionlayer.querySelector(".mediaregiondraft");
    if (old) old.remove();
    if (!Array.isArray(region)) return;
    const [x1, y1, x2, y2] = region;
    const box = document.createElement("div");
    box.className = "mediaregiondraft";
    box.style.left = `${Math.max(0, Math.min(1, x1)) * 100}%`;
    box.style.top = `${Math.max(0, Math.min(1, y1)) * 100}%`;
    box.style.width = `${Math.max(0, Math.min(1, x2 - x1)) * 100}%`;
    box.style.height = `${Math.max(0, Math.min(1, y2 - y1)) * 100}%`;
    mediaregionlayer.appendChild(box);
  }

  /*//////////////////////////////////////////////////////////////////////*/

  // media cards/grid
  async function openlightbox(url, pathname, video) {
    if (!mediacontent || !medialightbox || !mediainfo) return;
    mediacontent.innerHTML = "";
    if (mediaregionlayer) mediaregionlayer.innerHTML = "";
    updatemediainfo(pathname);
    const filename = pathname.split("/").pop() || "";
    lightboxfilename = filename;
    sethashfilepath(pathname);
    activereplyto = null;
    activefocuskey = null;
    activeregion = null;
    const siblings = listchildren(state.cwd)
      .filter(x => x.kind === "file" && imageext.test(x.name))
      .map(x => ({ url: rawurl(x.path), path: x.path, name: x.name }));
    lightboxnavitems = siblings;
    lightboxnavindex = siblings.findIndex(x => x.path === pathname);
    const shownav = !video && siblings.length > 1 && lightboxnavindex !== -1;

    if (medianavleft) {
      medianavleft.hidden = !shownav;
      medianavleft.disabled = !shownav;
    }
    if (medianavright) {
      medianavright.hidden = !shownav;
      medianavright.disabled = !shownav;
    }

    if (video) {
      const v = document.createElement("video");
      v.controls = true;
      v.addEventListener("loadedmetadata", () => {
        updatemediainfo(pathname, {
          width: v.videoWidth || 0,
          height: v.videoHeight || 0,
          duration: v.duration || 0
        });
      }, { once: true });
      v.src = url;
      v.autoplay = true;
      if (v.readyState >= 1) {
        updatemediainfo(pathname, {
          width: v.videoWidth || 0,
          height: v.videoHeight || 0,
          duration: v.duration || 0
        });
      }
      mediacontent.appendChild(v);
      if (medicomments) { medicomments.hidden = true; medicommentslist.innerHTML = ""; }
    } else {
      const img = document.createElement("img");
      img.addEventListener("load", () => {
        updatemediainfo(pathname, {
          width: img.naturalWidth || 0,
          height: img.naturalHeight || 0
        });
        renderregions(lightboxcomments);
      }, {once: true});
      img.src = url;
      img.alt = "";
      mediacontent.appendChild(img);
      lightboximg = img;
      const comments = await fetchcomments(filename);
      lightboxcomments = comments;
      if (medicomments) medicomments.hidden = !state.commentsopen;
      rendercommentpanel(comments);
      if (img.complete && (img.naturalWidth || img.naturalHeight)) {
        updatemediainfo(pathname, {
          width: img.naturalWidth || 0,
          height: img.naturalHeight || 0
        });
      }
      renderregions(comments);
    }
    medialightbox.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() =>
      medialightbox.classList.add("medialightboxvisible"));
  }

  function steplightboximage(delta) {
    if (!medialightbox || medialightbox.hidden) return;
    if (!lightboxnavitems.length || lightboxnavindex === -1) return;
    const next = (lightboxnavindex + delta + lightboxnavitems.length) % lightboxnavitems.length;
    const item = lightboxnavitems[next];
    if (!item) return;
    lightboxnavindex = next;
    openlightbox(item.url, item.path, false);
  }
  function clearcommentfocus() {
    if (!medialightbox || medialightbox.hidden) return;
    if (!activefocuskey && !activereplyto && !activeregion) return;
    activereplyto = null;
    activefocuskey = null;
    activeregion = null;
    renderregions(lightboxcomments);
    rendercommentpanel(lightboxcomments);
  }
  function closelightbox() {
    if (!mediacontent || !medialightbox) return;
    medialightbox.classList.remove("medialightboxvisible");
    window.setTimeout(() => {
      medialightbox.hidden = true;
      mediacontent.innerHTML = "";
      if (mediaregionlayer) mediaregionlayer.innerHTML = "";
      if (medicommentslist) medicommentslist.innerHTML = "";
      if (medicomments) medicomments.hidden = true;
      lightboxfilename = "";
      lightboxcomments = [];
      lightboximg = null;
      lightboxnavitems = [];
      lightboxnavindex = -1;
      activereplyto = null;
      activefocuskey = null;
      activeregion = null;
      regionselectstart = null;
      sethashfilepath("");
      document.body.style.overflow = "";
    }, 220);
  }

  /*//////////////////////////////////////////////////////////////////////*/

  async function loadtree(forcerefresh) {
    if (!forcerefresh) {
      const cached = loadcache();
      if (cached) {
        state.tree = cached.tree;
        state.branch = cached.branch || "main";
        state.truncated = !!cached.truncated;
        setrefreshtime(Math.floor((Date.now() - cached.savedat) / 3600000));
        pathhistory = [];
        updatebackdisabled();
        rendergrid();
        openfromhashifany();
        return;
      }
    }
    const stoploading = startloading();
    try {
      const fresh = await fetchtreefresh();
      stoploading();
      state.tree = fresh.tree;
      state.branch = fresh.branch;
      state.truncated = fresh.truncated;
      savecache({tree: state.tree, branch: state.branch, truncated: state.truncated});
      setrefreshtime(0);  pathhistory = [];
      updatebackdisabled();
      rendergrid();
      openfromhashifany();
    } catch (e) {
      stoploading();
      drivegrid.innerHTML = `<div class="errorstate">couldnt load repo :( ${esc(e.message || String(e))}</div>`;
    }
  }
  function startloading() {
    let dots = 0;
    const icon = '<img class="sogdot" alt="" src="assets/svg/sog.svg">';
    const wrap = document.createElement("div");
    wrap.className = "loadingstate sogloading";
    drivegrid.innerHTML = "";
    drivegrid.appendChild(wrap);
    function tick() {
      dots = (dots % 3) + 1;
      wrap.innerHTML = icon.repeat(dots);
    }
    tick();
    const t = window.setInterval(tick, 450);
    return () => window.clearInterval(t);
  }
  function setview(listmode) {
    state.listmode = listmode;
    viewlist.classList.toggle("active", listmode);
    viewsquare.classList.toggle("active", !listmode);
    setsetting("viewmode", listmode ? "list" : "grid");
    rendergrid();
  }
  function updatereadmeicon() {
    if (!readmebutton || !goog) return;
    readmebutton.classList.toggle("readmeclosed", !goog.classList.contains("readmeopen"));
  }

  /*//////////////////////////////////////////////////////////////////////*/

  searchinput.addEventListener("input", () => {
    state.filter = searchinput.value.trim();
    rendergrid();
  });
  refreshbutton.addEventListener("click", () => {
    clearcache();
    pathhistory = [];
    updatebackdisabled();
    setrefreshtime();
    loadtree(true);
  });
  viewlist.addEventListener("click", () => setview(true));
  viewsquare.addEventListener("click", () => setview(false));
  if (backbutton) backbutton.addEventListener("click", gobackfolder);
  if (readmebutton) readmebutton.addEventListener("click", togglereadme);
  if (readmeclose) readmeclose.addEventListener("click", togglereadme);
  for (const b of readmenavbtns) {
    b.addEventListener("click", () => showmddoc(b.getAttribute("data-doc") || "README.md"));
  }
  if (commentsbutton)
    commentsbutton.addEventListener("click", () => {
      setcommentsopen(!state.commentsopen);
      if (medialightbox && !medialightbox.hidden) {
        rendercommentpanel(lightboxcomments);
        renderregions(lightboxcomments);
      }
    });

  window.addEventListener("resize", () => {
    if (medialightbox && !medialightbox.hidden) renderregions(lightboxcomments);
  });
  if (mediaclose) mediaclose.addEventListener("click", closelightbox);
  if (mediabackdrop) mediabackdrop.addEventListener("click", () => {
    if (activefocuskey || activereplyto || activeregion) clearcommentfocus();
    else closelightbox();
  });
  if (mediabox) mediabox.addEventListener("click", e => {
    if (!medialightbox || medialightbox.hidden) return;
    const t = e.target;
    const inregionlayer = !!mediaregionlayer?.contains(t);
    if (mediacontent?.contains(t)) return;
    if (medicomments?.contains(t)) return;
    if (inregionlayer) return;
    if (mediaclose?.contains?.(t)) return;
    if (medianavleft?.contains?.(t) || medianavright?.contains?.(t)) return;
    clearcommentfocus();
  });
  if (mediaregionlayer) {
    mediaregionlayer.addEventListener("mousedown", e => {
      if (!state.commentsopen || !getsetting("discord_token", "")) return;
      if (e.target !== mediaregionlayer) return;
      const r = mediaregionlayer.getBoundingClientRect();
      regionselectstart = [e.clientX - r.left, e.clientY - r.top];
      activereplyto = null;
      activeregion = null;
      drawdraftregion(null);
      e.preventDefault();
    });
    mediaregionlayer.addEventListener("mousemove", e => {
      if (!regionselectstart) return;
      const r = mediaregionlayer.getBoundingClientRect();
      const current = [e.clientX - r.left, e.clientY - r.top];
      const nr = normalizedregionfrompoints(regionselectstart[0], regionselectstart[1], current[0], current[1]);
      drawdraftregion(nr);
    });
    mediaregionlayer.addEventListener("mouseup", e => {
      if (!regionselectstart) return;
      const r = mediaregionlayer.getBoundingClientRect();
      const current = [e.clientX - r.left, e.clientY - r.top];
      const nr = normalizedregionfrompoints(regionselectstart[0], regionselectstart[1], current[0], current[1]);
      regionselectstart = null;
      drawdraftregion(null);
      if (!nr) return;
      activeregion = nr;
      renderregions(lightboxcomments);
      rendercommentpanel(lightboxcomments);
    });
    mediaregionlayer.addEventListener("mouseleave", () => {
      if (!regionselectstart) return;
      regionselectstart = null;
      drawdraftregion(null);
    });
  }
  if (medianavleft) medianavleft.addEventListener("click", () => steplightboximage(-1));
  if (medianavright) medianavright.addEventListener("click", () => steplightboximage(1));
  function closediscordmenu() {
    if (discordmenu) discordmenu.hidden = true;
  }
  function togglediscordmenu() {
    if (!discordmenu) return;
    discordmenu.hidden = !discordmenu.hidden;
  }
  if (discordavatarbutton)
    discordavatarbutton.addEventListener("click", e => {
      e.stopPropagation();
      if (getdiscorduser()) togglediscordmenu();
      else opendiscordpopup();
    });
  if (loginhint) {
    loginhint.addEventListener("mouseenter", () => window.setTimeout(() => loginhint.classList.add("fade"), 500));
    loginhint.addEventListener("click", () => {
      loginhint.classList.add("fade");
      opendiscordpopup();
    });
  }
  if (medicommentslist) {
    medicommentslist.addEventListener("wheel", e => {
      e.stopPropagation();
    }, {passive: true});
    medicommentslist.addEventListener("touchmove", e => e.stopPropagation(), { passive: true });
  }

  function trapscrollevent(e) {
    if (!medialightbox || medialightbox.hidden) return;
    const t = e.target;
    if ((medicomments && medicomments.contains(t)) || (medicommentslist && medicommentslist.contains(t))) return;
    e.preventDefault();
  }
  document.addEventListener("wheel", trapscrollevent, {passive: false, capture: true});
  document.addEventListener("touchmove", trapscrollevent, {passive: false, capture: true});
  if (discordavatarbutton) {
    discordavatarbutton.addEventListener("mouseenter", () => {
      if (!loginhint) return;
      if (discordloggedin()) return;
      loginhint.hidden = false;
      loginhint.classList.remove("fade");
    });
    discordavatarbutton.addEventListener("mouseleave", () => { if (loginhint) loginhint.hidden = true; });
  }
  if (discordmenulogout)
    discordmenulogout.addEventListener("click", () => {
      setsetting("discord_code", "");
      setsetting("discord_token", "");
      setsetting("discord_user", null);
      updatediscordavatar();
      closediscordmenu();
      if (medialightbox && !medialightbox.hidden) rendercommentpanel(lightboxcomments);
    });
  document.addEventListener("click", () => closediscordmenu());
  if (discordmenu) discordmenu.addEventListener("click", e => e.stopPropagation());
  window.addEventListener("message", e => {
    if (e.origin !== location.origin) return;
    const msg = e.data || {};
    if (msg.type === "discord_oauth_code" && typeof msg.code === "string" && msg.code) {
      setsetting("discord_code", msg.code);
      updatediscordmenu();
      resolvediscorduser();
      if (medialightbox && !medialightbox.hidden) rendercommentpanel(lightboxcomments);
    }
  });
  window.addEventListener("hashchange", () => {
    if (medialightbox && !medialightbox.hidden) closelightbox();
    openfromhashifany();
  });
  document.addEventListener("keydown", e => {
    if (medialightbox && !medialightbox.hidden) {
      if (e.key === "Escape") { closelightbox(); return; }
      if (e.key === "ArrowLeft") { steplightboximage(-1); return; }
      if (e.key === "ArrowRight") { steplightboximage(1); return; }
      return;
    }
    if (e.key !== "Escape") return;
    if (goog && mqnarrow.matches && goog.classList.contains("readmeopen")) {
      goog.classList.remove("readmeopen");
      updatereadmepreference(false);
      updatereadmeicon();
    }
  });

  /*//////////////////////////////////////////////////////////////////////*/
  
  updatebackdisabled();
  updatereadmeicon();
  setcommentsopen(getsetting("commentson", 0) === 1);
  setview(getsetting("viewmode", "grid") === "list");
  updatediscordavatar();
  handlediscordoauthcallbackifpresent();
  if (!(window.opener && window.opener !== window)) resolvediscorduser();
  showmddoc(getsetting("readmedoc", "README.md"));
  loadtree(false);
  window.setTimeout(openfromhashifany, 0);

})();
