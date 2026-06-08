import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  asToolData,
  endpointOptions,
  endpointShape,
  positiveInteger,
  rawGuardrailedDescription,
  textToolResult
} from "./raw-common.js";
import {
  RAW_REPLAY_MAX_SPEED,
  RAW_REPLAY_MAX_STEPS,
  RAW_REPLAY_MIN_SPEED,
  type RawAutomationResult,
  type RawReplayExitOptions,
  type RawReplayOpenOptions,
  type RawReplayPlayPauseOptions,
  type RawReplaySetSpeedOptions,
  type RawReplayStepOptions
} from "../tradingview/raw-automation.js";

export interface RawReplayMcpToolHandlers {
  runRawReplayOpen: (
    options: RawReplayOpenOptions
  ) => Promise<RawAutomationResult>;
  runRawReplayPlayPause: (
    options: RawReplayPlayPauseOptions
  ) => Promise<RawAutomationResult>;
  runRawReplayStep: (
    options: RawReplayStepOptions
  ) => Promise<RawAutomationResult>;
  runRawReplaySetSpeed: (
    options: RawReplaySetSpeedOptions
  ) => Promise<RawAutomationResult>;
  runRawReplayExit: (
    options: RawReplayExitOptions
  ) => Promise<RawAutomationResult>;
}

const rawReplayOpenSchema = z.object(endpointShape);

const rawReplayPlayPauseSchema = z.object({
  ...endpointShape,
  mode: z
    .enum(["play", "pause", "toggle"])
    .optional()
    .describe("Explicit replay playback action. Defaults to play.")
});

const rawReplayStepSchema = z.object({
  ...endpointShape,
  direction: z
    .enum(["forward", "back"])
    .describe("Replay bar step direction."),
  steps: positiveInteger
    .max(RAW_REPLAY_MAX_STEPS)
    .optional()
    .describe(`Number of replay bars to step. Defaults to 1; maximum is ${RAW_REPLAY_MAX_STEPS}.`)
});

const rawReplaySetSpeedSchema = z.object({
  ...endpointShape,
  speed: z
    .number()
    .finite()
    .min(RAW_REPLAY_MIN_SPEED)
    .max(RAW_REPLAY_MAX_SPEED)
    .describe(
      `Replay playback speed for chart-practice only. Range: ${RAW_REPLAY_MIN_SPEED} to ${RAW_REPLAY_MAX_SPEED}.`
    )
});

const rawReplayExitSchema = z.object(endpointShape);

export function registerRawReplayMcpTools(
  server: McpServer,
  handlers: RawReplayMcpToolHandlers
): void {
  server.registerTool(
    "tradingview_raw_replay_open",
    {
      title: "Raw Open TradingView Replay",
      description: rawGuardrailedDescription(
        "Open TradingView chart replay mode for explicit chart-practice/review only when a reliable local replay API is exposed; no performance scoring, alerts, rankings, generated candidates, recommendations, or unattended replay sessions."
      ),
      inputSchema: rawReplayOpenSchema,
      annotations: {
        title: "Raw Open TradingView Replay",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawReplayOpenOptions = endpointOptions(args);
      const result = await handlers.runRawReplayOpen(rawOptions);

      return textToolResult(
        `Raw replay open: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_replay_play_pause",
    {
      title: "Raw Play Or Pause TradingView Replay",
      description: rawGuardrailedDescription(
        "Play, pause, or toggle TradingView chart replay as an explicit caller-directed chart-practice/review action only; never starts unattended sessions, scores performance, alerts, ranks, recommends, or trades."
      ),
      inputSchema: rawReplayPlayPauseSchema,
      annotations: {
        title: "Raw Play Or Pause TradingView Replay",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawReplayPlayPauseOptions = {
        mode: args.mode ?? "play",
        ...endpointOptions(args)
      };
      const result = await handlers.runRawReplayPlayPause(rawOptions);

      return textToolResult(
        `Raw replay play/pause: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_replay_step",
    {
      title: "Raw Step TradingView Replay",
      description: rawGuardrailedDescription(
        "Step TradingView chart replay forward or back by an explicit bounded bar count for chart-practice/review only; no scanning, ranking, alerts, recommendations, generated candidates, or advice."
      ),
      inputSchema: rawReplayStepSchema,
      annotations: {
        title: "Raw Step TradingView Replay",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawReplayStepOptions = {
        direction: args.direction,
        steps: args.steps ?? 1,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawReplayStep(rawOptions);

      return textToolResult(
        `Raw replay step: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_replay_set_speed",
    {
      title: "Raw Set TradingView Replay Speed",
      description: rawGuardrailedDescription(
        "Set TradingView chart replay speed for chart-practice/review only when a reliable local replay API is exposed; not performance scoring, financial advice, alerts, recommendations, rankings, generated candidates, or trading automation."
      ),
      inputSchema: rawReplaySetSpeedSchema,
      annotations: {
        title: "Raw Set TradingView Replay Speed",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawReplaySetSpeedOptions = {
        speed: args.speed,
        ...endpointOptions(args)
      };
      const result = await handlers.runRawReplaySetSpeed(rawOptions);

      return textToolResult(
        `Raw replay set speed: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );

  server.registerTool(
    "tradingview_raw_replay_exit",
    {
      title: "Raw Exit TradingView Replay",
      description: rawGuardrailedDescription(
        "Exit TradingView chart replay mode for explicit chart-practice/review only when a reliable local replay API is exposed; no broker/order actions, alerts, rankings, recommendations, generated candidates, or unattended workflows."
      ),
      inputSchema: rawReplayExitSchema,
      annotations: {
        title: "Raw Exit TradingView Replay",
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (args) => {
      const rawOptions: RawReplayExitOptions = endpointOptions(args);
      const result = await handlers.runRawReplayExit(rawOptions);

      return textToolResult(
        `Raw replay exit: ${result.ok ? "success" : "failed"}.`,
        asToolData(result)
      );
    }
  );
}
