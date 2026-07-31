import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import path from "node:path";
// oxlint-disable-next-line id-length
import * as v from "valibot";

import pkgJson from "../package.json" with { type: "json" };

import { Args } from "./schemas.ts";
import {
  MP4BOX_MODE_IMPORT_SELECTED_ONLY,
  MP4BOX_MODE_IMPORT_ALL_THEN_REMOVE,
  MP4BOX_MODE_DEMUX_ALL,
  DEFAULT_MP4BOX_MODE,
  DEFAULT_OUTPUT_FOLDER,
  DEFAULT_TEMP_FOLDER,
} from "./constants.ts";
import { convertMedia } from "./convertMedia.ts";

await main();

async function main(): Promise<void> {
  console.log();
  console.log(`Plumr v${pkgJson.version}`);

  const parseArgsResult = parseArgs({ options: getParseArgsOptions(), strict: false });
  const schemaParseResult = v.safeParse(Args, parseArgsResult);

  if (!schemaParseResult.success) {
    printHelp();
    console.error("[ERROR]: check your args");
    console.log();
    return;
  }

  const { values: argValues } = schemaParseResult.output;
  const { input } = argValues;

  if (argValues.help || !input) {
    printHelp();
    return;
  }

  const { output, "temp-folder": tempFolder, "mp4box-mode": mp4boxMode } = argValues;
  const outputIsFolder = path.extname(output) === "";

  console.log();
  console.log("temp folder:", tempFolder);
  console.log("input:", input);
  if (outputIsFolder) {
    console.log("output folder:", output);
  } else {
    console.log("output file:", output);
  }
  console.log("mp4box mode:", mp4boxMode);

  console.log();

  const result = await convertMedia({ input, output, tempFolder, mp4boxMode });
  console.log(JSON.stringify(result, null, 2));
  console.log();
}

function printHelp(): void {
  console.log();
  console.log("Usage: plumr [options]");
  console.log();
  console.log("Options:");

  const options = [
    ["-h, --help", "Show this help message"],
    ["-i, --input", "Input video file or folder containing video files (required)"],
    ["-o, --output", "Output video file or folder (default: T:/__watch_list__/__plumr__)"],
    ["-t, --temp-folder", "Temp folder (default: T:/temp/plumr)"],
    [
      "--mp4box-mode",
      `mp4box mode (default: ${DEFAULT_MP4BOX_MODE}, all: ${MP4BOX_MODE_IMPORT_SELECTED_ONLY}, ${MP4BOX_MODE_IMPORT_ALL_THEN_REMOVE}, ${MP4BOX_MODE_DEMUX_ALL})`,
    ],
  ] as const;

  const optionColumnWidth = options.reduce((max, [option]) => Math.max(max, option.length), 0) + 2;

  for (const [option, description] of options) {
    console.log(`  ${option.padEnd(optionColumnWidth)}${description}`);
  }
  console.log();
}

function getParseArgsOptions(): ParseArgsOptionsConfig {
  return {
    help: {
      type: "boolean",
      short: "h",
    },

    input: {
      type: "string",
      short: "i",
    },

    output: {
      type: "string",
      short: "o",
      default: DEFAULT_OUTPUT_FOLDER,
    },

    "temp-folder": {
      type: "string",
      short: "t",
      default: DEFAULT_TEMP_FOLDER,
    },

    "mp4box-mode": {
      type: "string",
      default: DEFAULT_MP4BOX_MODE,
    },
  };
}
