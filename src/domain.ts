export const PROJECT_INFO = {
  name: "tradingview-mcp",
  version: "0.1.0",
  purpose:
    "Local MCP server for manual TradingView Desktop charting workflows over software, semiconductor, AI, infrastructure, and cybersecurity stock universes."
} as const;

export const PROJECT_GUARDRAILS = {
  trading:
    "No broker connections, order placement, portfolio actions, or trade execution.",
  scanner:
    "No unattended scanners, candidate ranking, alerts, or automated buy/sell recommendations.",
  locality:
    "Operate locally against user-controlled TradingView Desktop sessions; do not exfiltrate chart data."
} as const;

export function getProjectInfo() {
  return {
    ...PROJECT_INFO,
    guardrails: PROJECT_GUARDRAILS
  };
}
