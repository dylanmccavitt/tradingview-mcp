import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  DEFAULT_CDP_HOST,
  DEFAULT_CDP_PORT,
  DEFAULT_CDP_TIMEOUT_MS
} from "../tradingview/desktop.js";
import { RAW_AUTOMATION_ENV } from "../tradingview/raw-automation.js";

export type ToolResultData = Record<string, unknown>;

export const positiveInteger = z.number().int().positive();
export const nonNegativeNumber = z.number().finite().min(0);
export const nonEmptyString = z.string().trim().min(1);

export const endpointShape = {
  host: nonEmptyString.optional(),
  port: positiveInteger.optional(),
  timeoutMs: positiveInteger.optional(),
  appPath: nonEmptyString.optional()
};

export const exchangeQualifiedSymbol = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+$/,
    "Symbol must be exchange-qualified, for example NASDAQ:NVDA."
  );

export function endpointOptions(args: {
  host?: string | undefined;
  port?: number | undefined;
  timeoutMs?: number | undefined;
  appPath?: string | undefined;
}): {
  host: string;
  port: number;
  timeoutMs: number;
  appPath?: string;
} {
  const options: {
    host: string;
    port: number;
    timeoutMs: number;
    appPath?: string;
  } = {
    host: args.host ?? DEFAULT_CDP_HOST,
    port: args.port ?? DEFAULT_CDP_PORT,
    timeoutMs: args.timeoutMs ?? DEFAULT_CDP_TIMEOUT_MS
  };

  if (args.appPath) {
    options.appPath = args.appPath;
  }

  return options;
}

export function textToolResult(
  summary: string,
  data: ToolResultData
): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: summary
      }
    ],
    structuredContent: data
  };
}

export function asToolData(value: unknown): ToolResultData {
  return value && typeof value === "object"
    ? (value as ToolResultData)
    : {
        value
      };
}

export function rawGuardrailedDescription(action: string): string {
  return `${action} Experimental local TradingView raw control for the active chart target only. Requires ${RAW_AUTOMATION_ENV}=1. Charting-only: no scanner/ranking behavior, no financial advice, no broker/order actions, no unattended candidates, and no TradingView account/security automation.`;
}
