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
    appshell = document.querySelector(".appshell"),
    backbutton = document.querySelector(".backbutton"),
    readmebutton = document.querySelector(".readmebutton"),
    commentsbutton = document.querySelector(".commentsbutton"),
    medialightbox = document.querySelector(".medialightbox"),
    mediabackdrop = document.querySelector(".mediabackdrop"),
    mediaclose = document.querySelector(".mediaclose"),
    mediacontent = document.querySelector(".mediacontent"),
    mediaregionlayer = document.querySelector(".mediaregionlayer"),
    medicomments = document.querySelector(".mediacomments"),
    medicommentslist = document.querySelector(".mediacommentslist"),
    mediainfo = document.querySelector(".mediainfo"),
    mqnarrow = window.matchMedia("(max-aspect-ratio: 3/4)");

  const commentsIndexApi = "https://api.soggy.cat/v1/comments";
  const commentscache = new Map();
  let commentsindexpromise = null;
  let commentsindexbyfile = null;
  let lightboxfilename = "";
  let lightboxcomments = [];
  let lightboximg = null;

  const state = {
    tree: [], branch: "main",
    cwd: "", filter: "",
    listmode: false, truncated: false,
    commentsOpen: false,
  };

  let pathhistory = [];
  const svg = {
    folder: '<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#FBE6A3"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z"/></svg>',
    image: '<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#df9d9b"><path d="M200-120q-33 0-56-23t-24-57v-560q0-33 24-56t56-24h560q33 0 57 24t23 56v560q0 33-23 57t-57 23zm0-80h560v-560H200zm40-80h480L570-480 450-320l-90-120zm-40 80v-560z"/></svg>',
    video: '<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#aac1f0"><path d="m160-800 80 160h120l-80-160h80l80 160h120l-80-160h80l80 160h120l-80-160h120q33 0 57 24t23 56v480q0 33-23 57t-57 23H160q-33 0-56-23t-24-57v-480q0-33 24-56t56-24m0 240v320h640v-320zm0 0v320z"/></svg>',
    audio: '<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#9dc384"><path d="M127-167q-47-47-47-113t47-113 113-47q23 0 43 6t37 16v-342l480-80v480q0 66-47 113t-113 47-113-47-47-113 47-113 113-47q23 0 43 6t37 16v-165l-320 63v320q0 66-47 113t-113 47-113-47"/></svg>',
    generic: '<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#9aa0a6"><path d="M320-240h320v-80H320zm0-160h320v-80H320zm0-160h160v-80H320zm-80 400q-33 0-56.5-23.5T160-240v-480q0-33 23.5-56.5T240-800h320l240 240v320q0 33-23.5 56.5T720-160zm280-360v-200H240v480h480v-280z"/></svg>',
  };

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function norm(p) { return (p || "").replace(/\/+$/, "") }
  function repopath(path) {
    const p = (path || "").replace(/^\/+/, "");
    return p ? `${rootprefix}/${p}` : rootprefix;
  }
  function rawurl(path) {
    return `https://raw.githubusercontent.com/ssoggycat/drive-3/${state.branch}/${repopath(path).split("/").map(encodeURIComponent).join("/")}`;
  }
  function setrefreshtime(h) {
    refreshtime.textContent = Number.isFinite(h) && h >= 0 ? `${h}h` : "--";
  }

  function loadcache() {
    try {
      const d = JSON.parse(localStorage.getItem(cachekey) || "null");
      if (!d || !Array.isArray(d.tree) || typeof d.savedat !== "number") return null;
      if (Date.now() - d.savedat > ttlms) return null;
      return d;
    } catch { return null }
  }

  function savecache(data) {
    try { localStorage.setItem(cachekey, JSON.stringify({ ...data, savedat: Date.now() })) } catch (_) { }
  }
  function clearcache() {
    try { localStorage.removeItem(cachekey) } catch (_) { }
  }

  async function githubfetch(path) {
    return (await fetch(`https://api.github.com${path}`,
      { headers: { Accept: "application/vnd.github+json" } })).json();
  }

  async function fetchtreefresh() {
    const meta = await githubfetch(`/repos/ssoggycat/drive-3`);
    state.branch = meta.default_branch || "main";
    const branch = await githubfetch(`/repos/ssoggycat/drive-3/branches/${state.branch}`);
    const commit = await githubfetch(`/repos/ssoggycat/drive-3/commits/${branch.commit.sha}`);
    const tree = await githubfetch(`/repos/ssoggycat/drive-3/git/trees/${commit.commit.tree.sha}?recursive=1`);
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
    return [...out.values()].sort((a, b) => (a.kind !== b.kind ? (a.kind === "folder" ? -1 : 1) : a.name.localeCompare(b.name)));
  }

  function iconfor(name) {
    if (imageext.test(name)) return svg.image;
    if (videoext.test(name)) return svg.video;
    if (audioext.test(name)) return svg.audio;
    return svg.generic;
  }

  function updatereadmepreference(open) {
    localStorage.setItem(mqnarrow.matches ? "readmeNarrow" : "readmeWide", open ? "1" : "0");
  }
  function readmestartstate() {
    return mqnarrow.matches ? localStorage.getItem("readmeNarrow") === "1" : localStorage.getItem("readmeWide") !== "0";
  }
  function togglereadme() {
    if (!appshell) return;
    const open = !appshell.classList.contains("readmeopen");
    appshell.classList.toggle("readmeopen", open);
    if (readmebutton) readmebutton.classList.toggle("readmeclosed", !open);
    updatereadmepreference(open);
  }
  function updatenarrowclass() {
    appshell.classList.toggle("narrowaspect", mqnarrow.matches);
  }
  (mqnarrow.addEventListener ? mqnarrow.addEventListener("change", updatenarrowclass) : mqnarrow.addListener(updatenarrowclass));
  updatenarrowclass();

  if (appshell) {
    appshell.classList.toggle("readmeopen", readmestartstate());
    if (readmebutton)
      readmebutton.classList.toggle("readmeclosed", !appshell.classList.contains("readmeopen"));
    appshell.classList.add("initialized");
  }

  function updatebackdisabled() {
    if (!backbutton) return;
    backbutton.disabled = pathhistory.length === 0;
    backbutton.setAttribute("aria-disabled", pathhistory.length > 0 ? "false" : "true");
  }

  function rendergrid() {
    const all = listchildren(state.cwd).filter((x) => x.name.toLowerCase().includes(state.filter.toLowerCase()));
    const folders = all.filter((x) => x.kind === "folder");
    const files = all.filter((x) => x.kind === "file");
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
        card.innerHTML = `<div class="filehead">${iconfor(f.name)}<span class="name"></span><button type="button" class="cardmore" aria-label="More">⋮</button></div><div class="thumb">${isimg ? `<img src="${rawurl(f.path)}" alt="" loading="lazy" />` : '<div class="thumbfallback">click to open</div>'}</div>`;
        card.querySelector(".name").textContent = f.name;
        card.addEventListener("click", (e) => {
          if (e.target instanceof Element && e.target.closest(".cardmore")) return;
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
    state.commentsOpen = show;
    if (commentsbutton)
      commentsbutton.classList.toggle("commentsmuted", !show);
  }

  async function loadcommentsindex() {
    if (commentsindexbyfile) return commentsindexbyfile;
    if (!commentsindexpromise) {
      commentsindexpromise = (async () => {
        const res = await fetch(commentsIndexApi, { cache: "force-cache" });
        if (!res.ok) return new Map();
        const j = await res.json();
        const files = Array.isArray(j?.files) ? j.files : [];
        const map = new Map();
        for (const f of files) {
          if (typeof f?.basename === "string") map.set(f.basename, Array.isArray(f?.comments) ? f.comments : []);
        }
        return map;
      })().catch(() => new Map());
    }
    commentsindexbyfile = await commentsindexpromise;
    return commentsindexbyfile;
  }

  async function fetchcomments(filename) {
    if (!filename) return [];
    if (commentscache.has(filename)) return commentscache.get(filename);
    try {
      const idx = await loadcommentsindex();
      const rows = idx.get(filename) || [];
      commentscache.set(filename, rows);
      return rows;
    } catch { return [] }
  }

  function formattime(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n)) return "";
    try {
      return new Date(n).toLocaleDateString(undefined, { year: "2-digit", month: "short", day: "2-digit" });
    } catch { return "" }
  }

  function rendercommentpanel(comments) {
    if (!medicomments || !medicommentslist) return;
    if (!state.commentsOpen) {
      medicomments.hidden = true;
      medicommentslist.innerHTML = "";
      return;
    }
    medicomments.hidden = false;
    medicommentslist.innerHTML = "";
    const login = document.createElement("div");
    login.className = "mediacomment";
    login.innerHTML =
      `<div class="mediacommenttext">` +
      `<a class="discordlogin" href="https://discord.com/oauth2/authorize?client_id=1501279291848003744&response_type=code&redirect_uri=http%3A%2F%2F127.0.0.1%3A6969&scope=identify" target="_blank" rel="noopener noreferrer">sign in with discord</a>` +
      `</div>`;
    medicommentslist.appendChild(login);
    if (!comments.length) {
      const empty = document.createElement("div");
      empty.className = "mediacomment";
      empty.innerHTML = `<div class="mediacommenttext">no comments for this file</div>`;
      medicommentslist.appendChild(empty);
      return;
    }
    for (const c of comments) {
      const card = document.createElement("div");
      card.className = "mediacomment";
      const author = esc(c.author || "unknown");
      const txt = esc(c.plain || "");
      const when = esc(formattime(c.id));
      const pfp = typeof c.authorpfp === "string" ? c.authorpfp : "";
      const src = String(pfp);
      const isgoogle = src.includes("googleusercontent.com");
      const isdiscord = src.includes("discordapp.com") || src.includes("discord.com");
      const badge = isgoogle ? "assets/svg/drive.svg" : isdiscord ? "assets/svg/discord.svg" : "";
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
        `<div class="mediacommenttext">${txt}</div>` +
        `</div>` +
        `</div>`;
      medicommentslist.appendChild(card);
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
    if (!state.commentsOpen) return;
    layoutregionlayer();
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
      mediaregionlayer.appendChild(box);
    }
  }

  async function openlightbox(url, pathname, video) {
    if (!mediacontent || !medialightbox || !mediainfo) return;
    mediacontent.innerHTML = "";
    if (mediaregionlayer) mediaregionlayer.innerHTML = "";
    mediainfo.textContent = pathname.split("/").pop() || pathname;
    const filename = pathname.split("/").pop() || "";
    lightboxfilename = filename;
    if (video) {
      const v = document.createElement("video");
      v.controls = true;
      v.src = url;
      v.autoplay = true;
      mediacontent.appendChild(v);
      rendercommentpanel([]);
    } else {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      mediacontent.appendChild(img);
      lightboximg = img;
      const comments = await fetchcomments(filename);
      lightboxcomments = comments;
      rendercommentpanel(comments);
      img.addEventListener("load", () => renderregions(lightboxcomments), { once: true });
      renderregions(comments);
    }
    medialightbox.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => medialightbox.classList.add("medialightbox-visible"));
    if (mediaclose) mediaclose.focus();
  }

  function closelightbox() {
    if (!mediacontent || !medialightbox) return;
    medialightbox.classList.remove("medialightbox-visible");
    window.setTimeout(() => {
      medialightbox.hidden = true;
      mediacontent.innerHTML = "";
      if (mediaregionlayer) mediaregionlayer.innerHTML = "";
      if (medicommentslist) medicommentslist.innerHTML = "";
      if (medicomments) medicomments.hidden = true;
      lightboxfilename = "";
      lightboxcomments = [];
      lightboximg = null;
      document.body.style.overflow = "";
    }, 220);
  }

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
        return;
      }
    }
    drivegrid.innerHTML = '<div class="loadingstate">loading from github..</div>';
    try {
      const fresh = await fetchtreefresh();
      state.tree = fresh.tree;
      state.branch = fresh.branch;
      state.truncated = fresh.truncated;
      savecache({ tree: state.tree, branch: state.branch, truncated: state.truncated });
      setrefreshtime(0);
      pathhistory = [];
      updatebackdisabled();
      rendergrid();
    } catch (e) {
      drivegrid.innerHTML = `<div class="errorstate">couldnt load repo :( ${esc(e.message || String(e))}</div>`;
    }
  }

  function setview(listmode) {
    state.listmode = listmode;
    viewlist.classList.toggle("active", listmode);
    viewsquare.classList.toggle("active", !listmode);
    rendergrid();
  }

  function updatereadmeicon() {
    if (!readmebutton || !appshell) return;
    readmebutton.classList.toggle("readmeclosed", !appshell.classList.contains("readmeopen"));
  }

  searchinput.addEventListener("input", () => { state.filter = searchinput.value.trim(); rendergrid() });
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
  if (commentsbutton) commentsbutton.addEventListener("click", () => {
    setcommentsopen(!state.commentsOpen);
    if (medialightbox && !medialightbox.hidden) {
      rendercommentpanel(lightboxcomments);
      renderregions(lightboxcomments);
    }
  });

  window.addEventListener("resize", () => {
    if (medialightbox && !medialightbox.hidden) renderregions(lightboxcomments);
  });
  if (mediaclose) mediaclose.addEventListener("click", closelightbox);
  if (mediabackdrop) mediabackdrop.addEventListener("click", closelightbox);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (medialightbox && !medialightbox.hidden) {
      closelightbox();
      return;
    }
    if (appshell && mqnarrow.matches && appshell.classList.contains("readmeopen")) {
      appshell.classList.remove("readmeopen");
      updatereadmepreference(false);
      updatereadmeicon();
    }
  });

  updatebackdisabled();
  updatereadmeicon();
  setcommentsopen(false);
  loadtree(false);

})();