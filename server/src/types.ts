import type {
  CallToolRequest,
  CallToolResult,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";

type Tool = ListToolsResult["tools"][0];

export type ToolInputSchema = Tool["inputSchema"];

export interface McpAction {
  tool: Tool;
  handler: (request: CallToolRequest) => Promise<CallToolResult>;
}

export function textResult(data: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

// --- Data types ---

export interface TrackFiles {
  master?: string;
  mp3?: string;
  m4a?: string;
  wav?: string;
}

export interface TrackStems {
  model: string;
  dir: string;
  tracks: string[];
}

export interface ReleaseStatus {
  status: "pending" | "uploaded" | "failed";
  url: string | null;
  id: string | null;
  uploaded_at: string | null;
  error?: string;
}

export interface TrackMeta {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  isrc: string;
  bpm: number | null;
  key: string;
  description: string;
  tags: string[];
  artwork: string | null;
  duration_seconds: number | null;
  sample_rate: number | null;
  files: TrackFiles;
  stems: TrackStems | null;
  releases: {
    soundcloud: ReleaseStatus;
    youtube: ReleaseStatus;
  };
  created_at: string;
  updated_at: string;
}

export interface CatalogData {
  tracks: TrackMeta[];
  settings: {
    default_artist: string;
    default_genre: string;
    isrc_prefix: string;
  };
}
