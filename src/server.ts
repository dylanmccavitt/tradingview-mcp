import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { PROJECT_INFO } from "./domain.js";

export function createServer(): McpServer {
  return new McpServer({
    name: PROJECT_INFO.name,
    version: PROJECT_INFO.version
  });
}
