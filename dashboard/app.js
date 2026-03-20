const API = window.location.origin;

async function fetchJSON(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts);
  return res.json();
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

function formatDuration(sec) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function statusClass(status) {
  return `status-${status}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderFileBadges(container, files) {
  container.innerHTML = "";
  Object.keys(files)
    .filter((k) => files[k])
    .forEach((k) => {
      const span = document.createElement("span");
      span.className = "file-badge";
      span.textContent = k;
      container.appendChild(span);
    });
}

function createReleaseCell(release) {
  const td = document.createElement("td");
  td.className = statusClass(release.status);
  td.textContent = release.status;
  if (release.url) {
    td.appendChild(document.createTextNode(" "));
    const a = document.createElement("a");
    a.href = release.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "\u2197";
    td.appendChild(a);
  }
  return td;
}

function selectTrack(id) {
  toast(`Selected track: ${id.substring(0, 8)}...`);
}

async function loadTracks() {
  const data = await fetchJSON("/api/tracks");
  const tbody = document.getElementById("tracks-body");
  const empty = document.getElementById("empty-state");

  if (!data.tracks || data.tracks.length === 0) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";
  tbody.innerHTML = "";

  data.tracks.forEach((t) => {
    const tr = document.createElement("tr");
    tr.dataset.id = t.id;
    tr.addEventListener("click", () => selectTrack(t.id));

    const tdTitle = document.createElement("td");
    const strong = document.createElement("strong");
    strong.textContent = t.title;
    tdTitle.appendChild(strong);
    tr.appendChild(tdTitle);

    const tdArtist = document.createElement("td");
    tdArtist.textContent = t.artist;
    tr.appendChild(tdArtist);

    const tdGenre = document.createElement("td");
    tdGenre.textContent = t.genre;
    tr.appendChild(tdGenre);

    const tdDuration = document.createElement("td");
    tdDuration.textContent = formatDuration(t.duration_seconds);
    tr.appendChild(tdDuration);

    const tdFiles = document.createElement("td");
    const badgesDiv = document.createElement("div");
    badgesDiv.className = "file-badges";
    renderFileBadges(badgesDiv, t.files);
    tdFiles.appendChild(badgesDiv);
    tr.appendChild(tdFiles);

    tr.appendChild(createReleaseCell(t.releases.soundcloud));
    tr.appendChild(createReleaseCell(t.releases.youtube));

    tbody.appendChild(tr);
  });

  // Update stats
  document.getElementById("stat-total").textContent = data.tracks.length;
  document.getElementById("stat-sc").textContent = data.tracks.filter(
    (t) => t.releases.soundcloud.status === "uploaded"
  ).length;
  document.getElementById("stat-yt").textContent = data.tracks.filter(
    (t) => t.releases.youtube.status === "uploaded"
  ).length;
  document.getElementById("stat-pending").textContent = data.tracks.filter(
    (t) =>
      t.releases.soundcloud.status === "pending" &&
      t.releases.youtube.status === "pending"
  ).length;
}

async function loadAuthStatus() {
  const data = await fetchJSON("/api/auth/status");
  const el = document.getElementById("auth-status");
  el.innerHTML = "";

  const scBadge = document.createElement("span");
  scBadge.className = `badge ${data.soundcloud.connected ? "badge-connected" : "badge-disconnected"}`;
  scBadge.textContent = `SC: ${data.soundcloud.connected ? "ON" : "OFF"}`;
  el.appendChild(scBadge);

  const ytBadge = document.createElement("span");
  ytBadge.className = `badge ${data.youtube.connected ? "badge-connected" : "badge-disconnected"}`;
  ytBadge.textContent = `YT: ${data.youtube.connected ? "ON" : "OFF"}`;
  el.appendChild(ytBadge);
}

document.getElementById("btn-scan").addEventListener("click", async () => {
  toast("Scanning for new tracks...");
  const result = await fetchJSON("/api/scan", { method: "POST" });
  if (result.added && result.added.length > 0) {
    toast(`Added ${result.added.length} new tracks!`);
  } else {
    toast("No new tracks found");
  }
  loadTracks();
});

// Init
loadTracks();
loadAuthStatus();
