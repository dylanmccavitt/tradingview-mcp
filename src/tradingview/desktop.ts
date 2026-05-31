import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { spawn } from "node:child_process";

import type { CdpEndpoint } from "./cdp.js";
import { formatCdpEndpoint } from "./cdp.js";

export const DEFAULT_CDP_HOST = "127.0.0.1";
export const DEFAULT_CDP_PORT = 9222;
export const DEFAULT_CDP_TIMEOUT_MS = 2_500;
export const TRADINGVIEW_APP_PATH_ENV = "TRADINGVIEW_APP_PATH";

export interface TradingViewAppResolution {
  found: boolean;
  executablePath?: string;
  checkedPaths: string[];
  source?: "option" | "env" | "default";
}

export interface LaunchCommand {
  command: string;
  args: string[];
}

export interface TradingViewLaunchResult {
  ok: boolean;
  message: string;
  endpoint: string;
  command?: LaunchCommand;
  pid?: number;
  nextSteps: string[];
}

export interface ResolveTradingViewAppOptions {
  appPath?: string;
  env?: NodeJS.ProcessEnv;
  fileExists?: (path: string) => boolean | Promise<boolean>;
}

export interface LaunchTradingViewDesktopOptions extends CdpEndpoint {
  appPath?: string;
  env?: NodeJS.ProcessEnv;
}

function defaultAppBundlePaths(): string[] {
  return [
    "/Applications/TradingView.app",
    `${homedir()}/Applications/TradingView.app`
  ];
}

function toExecutablePath(path: string): string {
  if (path.endsWith(".app")) {
    return `${path}/Contents/MacOS/TradingView`;
  }

  return path;
}

async function defaultFileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveTradingViewApp(
  options: ResolveTradingViewAppOptions = {}
): Promise<TradingViewAppResolution> {
  const env = options.env ?? process.env;
  const envPath = env[TRADINGVIEW_APP_PATH_ENV];
  const explicitPath = options.appPath ?? envPath;
  const source = options.appPath ? "option" : envPath ? "env" : "default";
  const candidatePaths = explicitPath ? [explicitPath] : defaultAppBundlePaths();
  const checkedPaths = candidatePaths.map((candidate) =>
    toExecutablePath(candidate)
  );
  const fileExists = options.fileExists ?? defaultFileExists;

  for (const executablePath of checkedPaths) {
    if (await fileExists(executablePath)) {
      return {
        found: true,
        executablePath,
        checkedPaths,
        source
      };
    }
  }

  return {
    found: false,
    checkedPaths,
    source
  };
}

export function buildTradingViewLaunchCommand(
  appExecutablePath: string,
  port = DEFAULT_CDP_PORT
): LaunchCommand {
  return {
    command: appExecutablePath,
    args: [`--remote-debugging-port=${port}`]
  };
}

export function quoteShellArgument(value: string): string {
  if (/^[A-Za-z0-9_/:=.+-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function formatShellCommand(command: LaunchCommand): string {
  return [command.command, ...command.args].map(quoteShellArgument).join(" ");
}

export async function launchTradingViewDesktop(
  options: LaunchTradingViewDesktopOptions
): Promise<TradingViewLaunchResult> {
  const appOptions: ResolveTradingViewAppOptions = {};

  if (options.appPath) {
    appOptions.appPath = options.appPath;
  }

  if (options.env) {
    appOptions.env = options.env;
  }

  const app = await resolveTradingViewApp(appOptions);
  const endpoint = formatCdpEndpoint(options);

  if (!app.found || !app.executablePath) {
    return {
      ok: false,
      message:
        "TradingView Desktop was not found. Install TradingView.app in /Applications or pass --app /path/to/TradingView.app.",
      endpoint,
      nextSteps: [
        "Install TradingView Desktop for macOS.",
        `Set ${TRADINGVIEW_APP_PATH_ENV} or pass --app when TradingView is installed outside /Applications.`
      ]
    };
  }

  const command = buildTradingViewLaunchCommand(
    app.executablePath,
    options.port
  );

  try {
    const child = spawn(command.command, command.args, {
      detached: true,
      stdio: "ignore"
    });

    return await new Promise<TradingViewLaunchResult>((resolve) => {
      child.once("error", (error: Error) => {
        resolve({
          ok: false,
          message: `TradingView Desktop launch failed: ${error.message}`,
          endpoint,
          command,
          nextSteps: [
            "Confirm the TradingView app path is executable.",
            `Run manually: ${formatShellCommand(command)}`
          ]
        });
      });

      child.once("spawn", () => {
        child.unref();

        const result: TradingViewLaunchResult = {
          ok: true,
          message: `Launched TradingView Desktop with CDP on ${endpoint}.`,
          endpoint,
          command,
          nextSteps: [
            "Open a TradingView chart tab if one is not already visible.",
            "Run npm run tv:health to verify CDP and chart target discovery."
          ]
        };

        if (typeof child.pid === "number") {
          result.pid = child.pid;
        }

        resolve(result);
      });
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);

    return {
      ok: false,
      message: `TradingView Desktop launch failed: ${detail}`,
      endpoint,
      command,
      nextSteps: [
        "Confirm the TradingView app path is executable.",
        `Run manually: ${formatShellCommand(command)}`
      ]
    };
  }
}
