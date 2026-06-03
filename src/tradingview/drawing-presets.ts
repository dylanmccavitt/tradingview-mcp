import type {
  DrawingMacroDrawingRequest,
  DrawingMacroOverrideValue,
  DrawingMacroPlan
} from "./drawing-macros.js";

export const DRAWING_PRESET_NAMES = [
  "clean-thesis",
  "minimal-levels",
  "risk-map"
] as const;

export type DrawingPresetName = (typeof DRAWING_PRESET_NAMES)[number];

export const DEFAULT_DRAWING_PRESET: DrawingPresetName = "clean-thesis";

export type DrawingPresetShapeType =
  | "horizontal-line"
  | "trend-line"
  | "rectangle"
  | "text"
  | "fib-retracement";

type OverrideValue = DrawingMacroOverrideValue;
type OverrideRecord = Record<string, OverrideValue>;

function normalizeDrawingPreset(
  preset: DrawingPresetName | undefined
): DrawingPresetName {
  return preset ?? DEFAULT_DRAWING_PRESET;
}

function roleText(role: string | undefined): string {
  return role?.toLowerCase() ?? "";
}

function roleColor(role: string | undefined, preset: DrawingPresetName): string {
  const text = roleText(role);
  if (preset === "minimal-levels") {
    return "#9aa0a6";
  }
  if (
    text.includes("projection") ||
    text.includes("extension") ||
    text.includes("target")
  ) {
    return "#8e7cc3";
  }
  if (
    text.includes("range") ||
    text.includes("support") ||
    text.includes("retracement")
  ) {
    return "#64b5f6";
  }
  return preset === "risk-map" ? "#26a69a" : "#8ab4f8";
}

function lineBase(color: string): OverrideRecord {
  return {
    color,
    linecolor: color,
    linestyle: 2,
    linewidth: 1
  };
}

function presetOverrides(
  shapeType: DrawingPresetShapeType,
  preset: DrawingPresetName,
  role: string | undefined
): OverrideRecord {
  const color = roleColor(role, preset);

  if (shapeType === "horizontal-line") {
    return {
      ...lineBase(color),
      "linetoolhorzline.linecolor": color,
      "linetoolhorzline.linestyle": 2,
      "linetoolhorzline.linewidth": 1
    };
  }

  if (shapeType === "trend-line") {
    return {
      ...lineBase(color),
      "linetooltrendline.linecolor": color,
      "linetooltrendline.linestyle": 2,
      "linetooltrendline.linewidth": 1
    };
  }

  if (shapeType === "rectangle") {
    const fillColor =
      preset === "minimal-levels"
        ? "rgba(154, 160, 166, 0.06)"
        : "rgba(100, 181, 246, 0.08)";
    return {
      ...lineBase(color),
      backgroundColor: fillColor,
      transparency: 90,
      "linetoolrectangle.color": color,
      "linetoolrectangle.backgroundColor": fillColor,
      "linetoolrectangle.linestyle": 2,
      "linetoolrectangle.linewidth": 1,
      "linetoolrectangle.transparency": 90
    };
  }

  if (shapeType === "text") {
    return {
      color,
      fontsize: 12,
      "linetooltext.color": color,
      "linetooltext.fontsize": 12
    };
  }

  return {
    fillBackground: true,
    transparency: 92,
    extendLines: false,
    extendLinesLeft: false,
    "linetoolfibretracement.fillBackground": true,
    "linetoolfibretracement.transparency": 92,
    "linetoolfibretracement.extendLines": false,
    "linetoolfibretracement.extendLinesLeft": false,
    "linetoolfibretracement.horzLabelsAlign": "right",
    "linetoolfibretracement.horzTextAlign": "right",
    "linetoolfibretracement.labelFontSize": 11,
    "linetoolfibretracement.trendline.color": color,
    "linetoolfibretracement.trendline.linewidth": 1,
    "linetoolfibretracement.levelsStyle.linewidth": 1
  };
}

function enforcedLineWidth(shapeType: DrawingPresetShapeType): OverrideRecord {
  if (shapeType === "horizontal-line") {
    return {
      linewidth: 1,
      "linetoolhorzline.linewidth": 1
    };
  }
  if (shapeType === "trend-line") {
    return {
      linewidth: 1,
      "linetooltrendline.linewidth": 1
    };
  }
  if (shapeType === "rectangle") {
    return {
      linewidth: 1,
      "linetoolrectangle.linewidth": 1
    };
  }
  if (shapeType === "fib-retracement") {
    return {
      linewidth: 1,
      "linetoolfibretracement.trendline.linewidth": 1,
      "linetoolfibretracement.levelsStyle.linewidth": 1
    };
  }
  return {};
}

export function applyDrawingPresetOverrides(
  shapeType: DrawingPresetShapeType,
  options: {
    preset?: DrawingPresetName | undefined;
    role?: string | undefined;
    overrides?: OverrideRecord | undefined;
  } = {}
): OverrideRecord {
  const preset = normalizeDrawingPreset(options.preset);
  return {
    ...presetOverrides(shapeType, preset, options.role),
    ...(options.overrides ?? {}),
    ...enforcedLineWidth(shapeType)
  };
}

export function applyDrawingPresetToRequest(
  drawing: DrawingMacroDrawingRequest,
  preset?: DrawingPresetName
): DrawingMacroDrawingRequest {
  return {
    ...drawing,
    overrides: applyDrawingPresetOverrides(drawing.shapeType, {
      preset,
      role: drawing.role,
      overrides: drawing.overrides
    })
  };
}

export function applyDrawingPresetToMacroPlan(
  plan: DrawingMacroPlan,
  preset?: DrawingPresetName
): DrawingMacroPlan {
  return {
    ...plan,
    drawings: plan.drawings.map((drawing) =>
      applyDrawingPresetToRequest(drawing, preset)
    )
  };
}
