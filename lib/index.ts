import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import path from "node:path";
import pkgJson from "../package.json" with { type: "json" };
import { convertMedia } from "./convertMedia.ts";

await main();

async function main(): Promise<void> {
  console.log();
  console.log(`LG Media v${pkgJson.version}`);

  const { values } = parseArgs({ options: getParseArgsOptions() });
  const hasInputOption = "input" in values;

  // oxlint-disable-next-line typescript/strict-boolean-expressions - todo: resolve
  if (values["help"] || !hasInputOption) {
    printHelp();
    return;
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion - todo: resolve schema validation
  const input = values["input"] as string;

  if (!input) {
    printHelp();
    console.error("[ERROR]: input file or folder is required");
    console.log();
    return;
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion - todo: resolve schema validation
  const output = values["output"] as string;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion - todo: resolve schema validation
  const tempFolder = values["temp-folder"] as string;
  const outputIsFolder = path.extname(output) === "";

  console.log();
  console.log("temp folder:", tempFolder);
  console.log("input:", input);
  if (outputIsFolder) {
    console.log("output folder:", output);
  } else {
    console.log("output file:", output);
  }

  console.log();

  const result = await convertMedia({ input, output, tempFolder });
  console.log(JSON.stringify(result, null, 2));
  console.log();
}

function printHelp(): void {
  console.log();
  console.log("Usage: lgmedia [options]");
  console.log();
  console.log("Options:");

  const options = [
    ["-h, --help", "Show this help message"],
    ["-i, --input", "Input video file or folder containing video files (required)"],
    ["-o, --output", "Output video file or folder (default: T:/__watch_list__/__lgmedia__)"],
    ["-t, --temp-folder", "Temp folder (default: T:/temp/lgmedia)"],
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
      default: "T:/__watch_list__/__lgmedia__",
    },

    "temp-folder": {
      type: "string",
      short: "t",
      default: "T:/temp/lgmedia",
    },
  };
}
