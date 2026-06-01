import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { PROJECT_INFO } from "./domain.js";
import {
  MCP_SERVER_INSTRUCTIONS,
  registerTradingViewMcpTools,
  type RegisterTradingViewMcpToolsOptions
} from "./mcp/tradingview-tools.js";

export type CreateServerOptions = RegisterTradingViewMcpToolsOptions;

export function createServer(options: CreateServerOptions = {}): McpServer {
  const server = new McpServer(
    {
      name: PROJECT_INFO.name,
      version: PROJECT_INFO.version
    },
    {
      instructions: MCP_SERVER_INSTRUCTIONS
    }
  );

  registerTradingViewMcpTools(server, options);

  return server;
}
