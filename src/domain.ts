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

export const RAW_AUTOMATION_BOUNDARY = {
  status: "opt_in_experimental",
  gateEnv: "TRADINGVIEW_MCP_ENABLE_RAW_AUTOMATION",
  toolPrefixes: ["tradingview_raw_", "tradingview_draw_", "tradingview_pine_"],
  allowed: [
    "local_chart_target_evaluate",
    "local_chart_target_input",
    "native_tradingview_drawings",
    "direct_chart_manipulation",
    "compact_chart_data_extraction",
    "explicit_pine_editor_actions",
    "workspace_tab_pane_layout_controls",
    "bounded_explicit_batch_chart_actions"
  ],
  constraints: [
    "disabled_by_default",
    "active_tradingview_chart_target_only",
    "compact_outputs_by_default",
    "no_broker_order_or_account_automation",
    "no_scanner_ranking_or_unattended_alerts"
  ]
} as const;

export const CHART_ANALYSIS_PROFILE_NAMES = [
  "focus",
  "breakout",
  "squeeze",
  "momentum"
] as const;

export type ChartAnalysisProfileName =
  (typeof CHART_ANALYSIS_PROFILE_NAMES)[number];

export const CHART_ANALYSIS_PROFILES = {
  focus: {
    description:
      "Single-chart review mode for objective context, important levels, and concise follow-up prompts."
  },
  breakout: {
    description:
      "Chart review mode for objective breakout context, nearby levels, volume context, and checklist fields."
  },
  squeeze: {
    description:
      "Chart review mode for objective compression context, range levels, volatility context, and checklist fields."
  },
  momentum: {
    description:
      "Chart review mode for objective trend context, relative strength context, continuation levels, and checklist fields."
  }
} as const satisfies Record<ChartAnalysisProfileName, { description: string }>;

export const CHART_ANALYSIS_PROFILE_OUTPUT = {
  allowed: [
    "objective_chart_facts",
    "extracted_levels",
    "setup_checklist_fields",
    "chartbook_notes",
    "user_review_prompts"
  ],
  forbidden: [
    "rankings",
    "watchlist_scoring",
    "financial_advice",
    "order_actions",
    "broker_calls",
    "unattended_alerts",
    "generated_candidates"
  ]
} as const;

export function getProjectInfo() {
  return {
    ...PROJECT_INFO,
    guardrails: PROJECT_GUARDRAILS,
    rawAutomation: RAW_AUTOMATION_BOUNDARY,
    chartAnalysisProfiles: {
      names: CHART_ANALYSIS_PROFILE_NAMES,
      profiles: CHART_ANALYSIS_PROFILES,
      output: CHART_ANALYSIS_PROFILE_OUTPUT
    }
  };
}
