# music-distro

MCP server for personal music distribution — manage your catalog, upload to SoundCloud and YouTube, track release status across platforms. Built for use with Claude Code or any MCP client.

## Tools (12)

### Catalog Management

| Tool | Description |
|---|---|
| `distro_list_tracks` | List all tracks with metadata and release status |
| `distro_add_track` | Add an audio file to the catalog with metadata |
| `distro_update_track` | Update track metadata + write ID3 tags to MP3 files |
| `distro_scan_new` | Auto-discover new audio files in ~/Desktop/AI-Music/ |

### Upload & Distribution

| Tool | Description |
|---|---|
| `distro_upload_soundcloud` | Upload a catalog track to SoundCloud (public/private) |
| `distro_upload_youtube` | Generate waveform video and upload to YouTube |
| `distro_upload_all` | Upload to all connected platforms in one call |

### Release Management

| Tool | Description |
|---|---|
| `distro_release_status` | Summary of all tracks and platform status |
| `distro_open_dashboard` | Open the web dashboard for visual catalog management |

### Authentication

| Tool | Description |
|---|---|
| `distro_auth_soundcloud` | Initiate SoundCloud OAuth flow |
| `distro_auth_youtube` | Initiate YouTube OAuth flow (Google) |
| `distro_auth_status` | Check which platforms are connected |

## Quick Start

### Prerequisites

- Node.js 18+
- ffmpeg (`brew install ffmpeg`)
- SoundCloud client credentials (optional)
- YouTube/Google OAuth credentials (optional)

### Install

```bash
npm install -g music-distro
```

### Configure in Claude Code

Add to `~/.mcp.json`:

```json
{
  "mcpServers": {
    "music-distro": {
      "command": "music-distro",
      "env": {
        "MUSIC_OUTPUT_DIR": "~/Desktop/AI-Music",
        "MUSIC_DISTRO_PORT": "3847",
        "CREDS_DIR": "/path/to/credentials/music-distro"
      }
    }
  }
}
```

### Or run from source

```bash
git clone https://github.com/ExpertVagabond/music-distro.git
cd music-distro/server
npm install && npm run build
node build/index.js
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MUSIC_OUTPUT_DIR` | `~/Desktop/AI-Music` | Where audio files and catalog.json live |
| `MUSIC_DISTRO_PORT` | `3847` | Port for OAuth callbacks and dashboard |
| `CREDS_DIR` | — | Directory for platform credentials |
| `DASHBOARD_DIR` | — | Path to dashboard static files |

## Workflow

### 1. Scan for new tracks

```
distro_scan_new
→ Discovers new audio files, reads metadata via ffprobe, adds to catalog
```

### 2. Update metadata

```
distro_update_track
  id: "track-uuid"
  title: "Building in the Dark"
  artist: "Matthew Karsten"
  genre: "Electronic"
  bpm: 128
  tags: ["trap", "dark", "808"]
→ Updates catalog + writes ID3 tags to MP3
```

### 3. Upload to platforms

```
distro_upload_soundcloud --track_id "uuid" --sharing public
distro_upload_youtube --track_id "uuid" --privacy unlisted
# or upload to all at once:
distro_upload_all --track_id "uuid"
```

### 4. Check release status

```
distro_release_status
→ Shows all tracks with SoundCloud/YouTube URLs and upload status
```

## Platform Authentication

### SoundCloud

1. Create a SoundCloud app at [soundcloud.com/you/apps](https://soundcloud.com/you/apps)
2. Save credentials:
   ```json
   // $CREDS_DIR/soundcloud-client.json
   { "client_id": "...", "client_secret": "..." }
   ```
3. Run `distro_auth_soundcloud` → opens browser for OAuth

### YouTube

1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/)
2. Save as `$CREDS_DIR/youtube/client_secret.json`
3. Run `distro_auth_youtube` → opens browser for Google OAuth

## Dashboard

Web UI for visual catalog management at `http://localhost:3847/dashboard`:

- Track catalog table with metadata
- Release status badges with platform links
- Statistics bar (total/uploaded/pending)
- Auth status indicators
- Scan for new files

Start the dashboard server: `npm run dev`

## Catalog Storage

All data stored in `$MUSIC_OUTPUT_DIR/catalog.json`:

```json
{
  "tracks": [
    {
      "id": "uuid",
      "title": "Track Name",
      "artist": "Artist",
      "genre": "Electronic",
      "duration_seconds": 30,
      "files": { "wav": "path.wav", "mp3": "path.mp3" },
      "releases": {
        "soundcloud": { "status": "uploaded", "url": "https://..." },
        "youtube": { "status": "pending" }
      }
    }
  ]
}
```

## Related Projects

- [ai-music-mcp](https://github.com/ExpertVagabond/ai-music-mcp) — MCP server for MusicGen + Demucs + RVC pipeline
- [rvc-mcp](https://github.com/ExpertVagabond/rvc-mcp) — MCP server for RVC training and model management
- [ai-music-studio](https://github.com/ExpertVagabond/ai-music-studio) — CLI for local music production

## License

MIT — Purple Squirrel Media
