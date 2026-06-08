import {
  DEFAULT_RAW_CHART_CONTROL_MAX_RESULT_BYTES,
  DEFAULT_RAW_PINE_COMPILE_SETTLE_MS,
  DEFAULT_RAW_PINE_GET_SOURCE_MAX_CHARS,
  DEFAULT_RAW_PINE_SAVE_SETTLE_MS,
  RAW_PINE_ACTION_SETTLE_MS_LIMIT,
  RAW_PINE_GET_SOURCE_MAX_CHARS_LIMIT,
  RAW_PINE_SOURCE_MAX_CHARS,
  runRawPineEditorControl,
  type RawAutomationResult,
  type RawPineCompileOptions,
  type RawPineGetConsoleOptions,
  type RawPineGetErrorsOptions,
  type RawPineGetSourceOptions,
  type RawPineOpenEditorOptions,
  type RawPineSaveOptions,
  type RawPineSetSourceOptions
} from "./session.js";

function invalidPineSourceMessage(source: string): string | null {
  if (source.length === 0) {
    return "Raw Pine source is required.";
  }

  if (source.length > RAW_PINE_SOURCE_MAX_CHARS) {
    return `Raw Pine source must be ${RAW_PINE_SOURCE_MAX_CHARS} characters or fewer.`;
  }

  return null;
}

function invalidPineGetSourceLimitMessage(maxSourceChars: number): string | null {
  if (
    !Number.isInteger(maxSourceChars) ||
    maxSourceChars <= 0 ||
    maxSourceChars > RAW_PINE_GET_SOURCE_MAX_CHARS_LIMIT
  ) {
    return `Raw Pine source retrieval maxSourceChars must be an integer from 1 to ${RAW_PINE_GET_SOURCE_MAX_CHARS_LIMIT}.`;
  }

  return null;
}

function invalidPineSettleMsMessage(settleMs: number): string | null {
  if (
    !Number.isInteger(settleMs) ||
    settleMs < 0 ||
    settleMs > RAW_PINE_ACTION_SETTLE_MS_LIMIT
  ) {
    return `Raw Pine settleMs must be an integer from 0 to ${RAW_PINE_ACTION_SETTLE_MS_LIMIT}.`;
  }

  return null;
}

export function runRawPineOpenEditor(
  options: RawPineOpenEditorOptions
): Promise<RawAutomationResult> {
  return runRawPineEditorControl(
    "pine-open-editor",
    "openEditor",
    {},
    options
  );
}

export function runRawPineSetSource(
  options: RawPineSetSourceOptions
): Promise<RawAutomationResult> {
  return runRawPineEditorControl(
    "pine-set-source",
    "setSource",
    {
      source: options.source
    },
    options,
    invalidPineSourceMessage(options.source)
  );
}

export function runRawPineGetSource(
  options: RawPineGetSourceOptions
): Promise<RawAutomationResult> {
  const maxSourceChars =
    options.maxSourceChars ?? DEFAULT_RAW_PINE_GET_SOURCE_MAX_CHARS;

  return runRawPineEditorControl(
    "pine-get-source",
    "getSource",
    {
      maxSourceChars
    },
    options,
    invalidPineGetSourceLimitMessage(maxSourceChars),
    Math.max(
      DEFAULT_RAW_CHART_CONTROL_MAX_RESULT_BYTES,
      maxSourceChars + 2_048
    )
  );
}

export function runRawPineGetErrors(
  options: RawPineGetErrorsOptions
): Promise<RawAutomationResult> {
  return runRawPineEditorControl(
    "pine-get-errors",
    "getErrors",
    {},
    options
  );
}

export function runRawPineGetConsole(
  options: RawPineGetConsoleOptions
): Promise<RawAutomationResult> {
  return runRawPineEditorControl(
    "pine-get-console",
    "getConsole",
    {},
    options
  );
}

export function runRawPineCompile(
  options: RawPineCompileOptions
): Promise<RawAutomationResult> {
  const settleMs = options.settleMs ?? DEFAULT_RAW_PINE_COMPILE_SETTLE_MS;

  return runRawPineEditorControl(
    "pine-compile",
    "compile",
    {
      settleMs
    },
    options,
    invalidPineSettleMsMessage(settleMs)
  );
}

export function runRawPineSave(
  options: RawPineSaveOptions
): Promise<RawAutomationResult> {
  const settleMs = options.settleMs ?? DEFAULT_RAW_PINE_SAVE_SETTLE_MS;

  return runRawPineEditorControl(
    "pine-save",
    "save",
    {
      settleMs
    },
    options,
    invalidPineSettleMsMessage(settleMs)
  );
}
