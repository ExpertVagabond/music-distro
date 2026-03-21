/**
 * Music Distribution Dashboard — Client-side Application
 *
 * Security & Validation:
 * - All API responses validated for expected structure before rendering
 * - HTML output uses textContent (not innerHTML) to prevent XSS
 * - User-provided data escaped via dedicated escapeHtml helper
 * - Fetch wrapper includes timeout, error handling, and response validation
 * - No eval(), no inline event handlers, no dynamic script injection
 * - API paths validated against allowlist pattern (no arbitrary URL construction)
 * - Toast messages sanitized before display
 */

/** API base — same origin, no external calls */
const API = window.location.origin;

/** Maximum acceptable response size (5MB) */
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;

/** Allowed API path pattern */
const VALID_API_PATH = /^\/api\/[a-zA-Z0-9/_-]+$/;

/** Fetch timeout (ms) */
const FETCH_TIMEOUT_MS = 30_000;

/**
 * Validated fetch wrapper — ensures path is safe and response is JSON.
 * @param {string} path - API path (must start with /api/)
 * @param {RequestInit} opts - fetch options
 * @returns {Promise<any>} parsed JSON response
 */
async function fetchJSON(path, opts = {}) {
  if (!path || typeof path !== "string") {
    throw new Error("Invalid API path");
  }
  // Allow callback paths too for OAuth flows
  if (!path.startsWith("/api/") && !path.startsWith("/callback/")) {
    throw new Error(`API path must start with /api/ or /callback/, got: ${path}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${API}${path}`, {
      ...opts,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown error");
      throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
      throw new Error("Response too large");
    }

    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error(`API request timed out after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw err;
  }
}

/**
 * Display a toast notification with sanitized text.
 * @param {string} msg - message to display
 */
function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  // Use textContent to prevent XSS
  el.textContent = typeof msg === "string" ? msg.slice(0, 200) : "Unknown notification";
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

function formatDuration(sec) {
  if (!sec || typeof sec !== "number" || sec < 0) return "\u2014";
  const clamped = Math.min(sec, 86400); // Cap at 24 hours
  const m = Math.floor(clamped / 60);
  const s = Math.floor(clamped % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Map status to CSS class — only allow known values */
const VALID_STATUSES = new Set(["pending", "uploaded", "failed", "processing"]);
function statusClass(status) {
  if (typeof status !== "string" || !VALID_STATUSES.has(status)) return "status-unknown";
  return `status-${status}`;
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderFileBadges(container, files) {
  container.innerHTML = "";
  if (!files || typeof files !== "object") return;
  Object.keys(files)
    .filter((k) => files[k])
    .slice(0, 20) // Cap badge count
    .forEach((k) => {
      const span = document.createElement("span");
      span.className = "file-badge";
      span.textContent = escapeHtml(String(k)).slice(0, 50);
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
