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

function renderFileBadges(files) {
  return Object.keys(files)
    .filter((k) => files[k])
    .map((k) => `<span class="file-badge">${k}</span>`)
    .join("");
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
  tbody.innerHTML = data.tracks
    .map(
      (t) => `
    <tr data-id="${t.id}" onclick="selectTrack('${t.id}')">
      <td><strong>${t.title}</strong></td>
      <td>${t.artist}</td>
      <td>${t.genre}</td>
      <td>${formatDuration(t.duration_seconds)}</td>
      <td><div class="file-badges">${renderFileBadges(t.files)}</div></td>
      <td class="${statusClass(t.releases.soundcloud.status)}">${t.releases.soundcloud.status}${t.releases.soundcloud.url ? ` <a href="${t.releases.soundcloud.url}" target="_blank">↗</a>` : ""}</td>
      <td class="${statusClass(t.releases.youtube.status)}">${t.releases.youtube.status}${t.releases.youtube.url ? ` <a href="${t.releases.youtube.url}" target="_blank">↗</a>` : ""}</td>
    </tr>
  `
    )
    .join("");

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
  el.innerHTML = `
    <span class="badge ${data.soundcloud.connected ? "badge-connected" : "badge-disconnected"}">
      SC: ${data.soundcloud.connected ? "ON" : "OFF"}
    </span>
    <span class="badge ${data.youtube.connected ? "badge-connected" : "badge-disconnected"}">
      YT: ${data.youtube.connected ? "ON" : "OFF"}
    </span>
  `;
}

window.selectTrack = function (id) {
  // Could expand to show detail panel
  toast(`Selected track: ${id.substring(0, 8)}...`);
};

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
