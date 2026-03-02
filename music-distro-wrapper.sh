#!/bin/bash
# Music Distribution MCP Server wrapper
export MUSIC_OUTPUT_DIR="$HOME/Desktop/AI-Music"
export MUSIC_DISTRO_PORT=3847
export CREDS_DIR="/Volumes/Virtual Server/configs/credentials/music-distro"
export DASHBOARD_DIR="/Volumes/Virtual Server/projects/music-distro/dashboard"
exec node "/Volumes/Virtual Server/projects/music-distro/server/build/index.js"
