import fs from "node:fs/promises";
import fss from "node:fs";
import path from "node:path";

import type {
  AudioTrack,
  MediaInfo,
  Mp4BoxMode,
  SubtitleTrack,
  Track,
  VideoTrack,
} from "./types.ts";
import {
  EXTENSION_MKV,
  FORMAT_MATROSKA,
  MP4BOX_MODE_DEMUX_ALL,
  MP4BOX_MODE_IMPORT_ALL_THEN_REMOVE,
  MP4BOX_MODE_IMPORT_SELECTED_ONLY,
} from "./constants.ts";

import {
  isAudioTrack,
  isSubtitleTrack,
  isUnsupportedAudioAndNotConvertibleForTv,
  isUnsupportedSubtitleByTv,
  isVideoTrack,
  isDolbyVisionProfile7,
  isDolbyVision,
  isEmpty,
  hasItems,
  none,
  isAlreadySupportedByTv,
  assertIsDefined,
} from "./common.ts";

import { getMediaInfo } from "./getMediaInfo.ts";
import { getMp4boxImportSelectedOnlyCommands } from "./getMp4boxImportSelectedOnlyCommands.ts";
import { getMp4boxImportAllAndRemoveCommands } from "./getMp4boxImportAllAndRemoveCommands.ts";
import { getMp4boxDemuxAllCommands } from "./getMp4boxDemuxAllCommands.ts";
import { getMkvmergeCommands } from "./getMkvmergeCommands.ts";

export async function convertMedia(options: ConvertMediaParams): Promise<ConvertMediaResponse> {
  const { selectedTrackIds, keepHu, mp4boxMode } = options;
  // todo: for now we remove "" wrapper ahead and see if it will be a problem
  const input = options.input.replace(/^['"]/u, "").replace(/['"]$/u, "");
  let outputFolder = options.output.replace(/^['"]/u, "").replace(/['"]$/u, "");
  const tempFolder = options.tempFolder.replace(/^['"]/u, "").replace(/['"]$/u, "");

  if (!fss.existsSync(input)) {
    console.error(`[ERROR]: input file or folder does not exist: ${input}`);
    console.log();
    process.exit(1);
  }

  const inputStat = await fs.stat(input);
  const inputIsDirectory = inputStat.isDirectory();

  const commands: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (inputIsDirectory) {
    outputFolder = path.join(outputFolder, path.basename(input));

    // todo: extract this like single case (SLA :D)
    const dirEntries = await fs.readdir(input, {
      encoding: "utf8",
      withFileTypes: true,
    });

    // console.log('@@@@ dirEntries', dirEntries);

    const mkvFiles = dirEntries
      .filter(
        (entry) =>
          (entry.isFile() || entry.isSymbolicLink()) &&
          entry.name.toLowerCase().endsWith(`.${EXTENSION_MKV}`),
      )
      .map((entry) => path.join(entry.parentPath, entry.name));

    // console.log('@@@@ mkvFiles', mkvFiles);

    for (const mkvFile of mkvFiles) {
      commands.push(
        "rem # --------------------------------------------------------------------------------",
        "rem #",
        `rem # input: ${mkvFile}`,
        "rem #",
      );

      // oxlint-disable-next-line no-await-in-loop - fine for this use case
      const result = await convertSingleMedia({
        mp4boxMode,
        inputFile: mkvFile,
        outputFolder,
        tempFolder,
        keepHu,
      });

      if (result.isAlreadySupported) {
        commands.push("rem # media should be already playable and won't be converted", "rem #");
      }

      // todo: here we can improve logging via including affected file etc
      if (result.status === "ERROR") errors.push(`file: ${mkvFile}`, ...result.messages);
      if (result.status === "WARN") warnings.push(`file: ${mkvFile}`, ...result.messages);
      if (result.status !== "ERROR" && !result.isAlreadySupported) {
        commands.push(...result.commands);
      }
    }
  } else {
    // input is a single file

    const result = await convertSingleMedia({
      mp4boxMode,
      inputFile: input,
      outputFolder,
      tempFolder,
      selectedTrackIds,
      keepHu,
    });

    if (result.isAlreadySupported) {
      commands.push(
        "rem #",
        "rem # media should be already playable and won't be converted",
        "rem #",
      );
    }

    if (result.status === "ERROR") errors.push(...result.messages);
    if (result.status === "WARN") warnings.push(...result.messages);
    if (result.status !== "ERROR" && !result.isAlreadySupported) {
      commands.push(...result.commands);
    }
  }

  commands.push("pause");

  if (isEmpty(errors)) {
    commands.unshift("@echo off", "");

    const filenameNoExt = inputIsDirectory
      ? "convert"
      : path.basename(input).replace(path.extname(input), "");

    const batchOutputFile = inputIsDirectory
      ? path.join(input, `${filenameNoExt}.bat`)
      : path.join(path.dirname(input), `convert-${filenameNoExt}.bat`);

    await fs.writeFile(batchOutputFile, commands.join("\n"), "utf8");

    console.log("conversion batch file has been created");
  }

  if (hasItems(errors)) return { status: "ERROR", messages: errors };
  if (hasItems(warnings)) return { status: "WARN", messages: warnings };
  return { status: "OK" };
}

async function convertSingleMedia(
  options: ConvertSingleMediaParams,
): Promise<ConvertSingleMediaResponse> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { inputFile, keepHu, outputFolder, tempFolder, mp4boxMode } = options;
  let { selectedTrackIds } = options;

  // todo: use some cache for media info to avoid some wait twice ;)
  const mediaInfoResult = await getMediaInfo(inputFile, keepHu);

  if (!mediaInfoResult) {
    // todo: notify client side
    console.error("convertMedia: media info could not be loaded 😟");
    // todo: how to do proper error handling via server actions? :)
    //  Promise.reject, throw cause 500 server error, can't reach client this info
    errors.push("media info could not be loaded 😟");
    return { status: "ERROR", messages: errors, isAlreadySupported: false };
  }

  const {
    info: mediaInfo,
    recommendedTrackIds,
    hasSubtitleTracks,
    isTrackAndStreamOrderDifferent,
  } = mediaInfoResult;

  if (isTrackAndStreamOrderDifferent) {
    console.error("convertMedia: track and stream order are different! watch out! investigate!");
    errors.push("track and stream order are different! watch out! investigate!");
  }

  // todo: for v1 this should be sufficient 😜
  selectedTrackIds ??= recommendedTrackIds;

  const selectedTracks = selectedTrackIds.map((trackId) => {
    const infoTrack = mediaInfo.tracks.find((track) => track.id === trackId);
    assertIsDefined(infoTrack);
    return infoTrack;
  });

  const { videoTrack, audioTracks, subtitleTracks } = selectedTracks.reduce<{
    videoTrack: VideoTrack | undefined;
    audioTracks: AudioTrack[];
    subtitleTracks: SubtitleTrack[];
  }>(
    (acc, track) => {
      if (isVideoTrack(track) && acc.videoTrack !== undefined) {
        // todo: better way?
        // todo: warn user if multiple video track found vs check what can mp4 support?
        throw new Error("This should not happen usually :)");
      }

      if (isVideoTrack(track)) acc.videoTrack = track;
      else if (isAudioTrack(track)) acc.audioTracks.push(track);
      else if (isSubtitleTrack(track)) acc.subtitleTracks.push(track);
      return acc;
    },
    {
      videoTrack: undefined,
      audioTracks: [],
      subtitleTracks: [],
    },
  );

  if (!videoTrack) {
    // todo: notify client side
    console.error("convertMedia: no video file is selected 🙃");
    // todo: how to do proper error handling via server actions? :)
    //  Promise.reject, throw cause 500 server error, can't reach client this info
    errors.push("no video file is selected 🙃");
  }

  if (isEmpty(audioTracks)) {
    // todo: notify client side
    console.error("convertMedia: no audio track is selected, usually 1 should be 😉");
    // todo: how to do proper error handling via server actions? :)
    //  Promise.reject, throw cause 500 server error, can't reach client this info
    errors.push("no audio track is selected, usually 1 should be 😉");
  }

  if (videoTrack && isDolbyVisionProfile7(videoTrack)) {
    // todo: notify client side
    console.error("convertMedia: dolby vision profile 7 video won't work 😥");
    // todo: how to do proper error handling via server actions? :)
    //  Promise.reject, throw cause 500 server error, can't reach client this info
    errors.push("dolby vision profile 7 video won't work 😥");
  }

  if (audioTracks.some(isUnsupportedAudioAndNotConvertibleForTv)) {
    // todo: notify client side
    console.error("convertMedia: unsupported/unconvertible audio selected 😟");
    // todo: how to do proper error handling via server actions? :)
    //  Promise.reject, throw cause 500 server error, can't reach client this info
    errors.push("unsupported/unconvertible audio selected 😟");
  }

  if (subtitleTracks.some(isUnsupportedSubtitleByTv)) {
    // todo: notify client side
    console.error("convertMedia: unsupported subtitle selected 😟");
    // todo: how to do proper error handling via server actions? :)
    //  Promise.reject, throw cause 500 server error, can't reach client this info
    errors.push("unsupported subtitle selected 😟");
  }

  // todo: duplicate-ish
  const audioLanguages = audioTracks.reduce((acc, track) => {
    // todo: vs properly handle
    // en-US, en-AU => en
    return acc.add(track.language.replace(/-.*$/u, ""));
  }, new Set<string>());

  const hasForeignAudioSelectedOnly = none(
    (lang) => audioLanguages.has(lang),
    // todo: this is subjective for now 😉
    ["en", "eng", "hu", "hun"],
  );

  const hasSelectedSubtitles = hasItems(subtitleTracks);

  if (hasForeignAudioSelectedOnly) {
    // todo: we need to check selected subs count here :)
    if (hasSubtitleTracks && !hasSelectedSubtitles) {
      // todo: notify client side
      console.error("convertMedia: audio is foreign only and no subtitle track is selected ⚠️");
      // todo: how to do proper error handling via server actions? :)
      //  Promise.reject, throw cause 500 server error, can't reach client this info
      errors.push("audio is foreign only and no subtitle track is selected ⚠️");
    } else if (!hasSubtitleTracks) {
      // todo: notify client side
      console.error("convertMedia: audio is foreign only and there are no subtitle tracks ⚠️");
      // todo: how to do proper error handling via server actions? :)
      //  Promise.reject, throw cause 500 server error, can't reach client this info
      errors.push("audio is foreign only and there are no subtitle tracks ⚠️");
    }
  } else if (hasSubtitleTracks && !hasSelectedSubtitles) {
    // todo: notify client side
    console.warn("convertMedia: no subtitle track is selected.");
    // todo: how to do proper error handling via server actions? :)
    //  Promise.reject, throw cause 500 server error, can't reach client this info
    warnings.push("no subtitle track is selected.");
  }

  // todo: if ever will be needed :D
  if (mediaInfo.general.format !== FORMAT_MATROSKA) {
    // todo: notify client side
    console.error("convertMedia: ToDo: need to handle non mkv inputs as well (e.g.: mp4) 😉");
    // todo: how to do proper error handling via server actions? :)
    //  Promise.reject, throw cause 500 server error, can't reach client this info
    errors.push("ToDo: need to handle non mkv inputs as well (e.g.: mp4) 😉");
  }

  const isAlreadySupported = isAlreadySupportedByTv(
    mediaInfo.general.fileExtension,
    selectedTracks,
    keepHu,
  );

  if (isAlreadySupported) {
    console.warn("convertMedia: media should be already playable");
    warnings.push("media should be already playable");
  }

  let commands: string[] = [];
  if (isEmpty(errors) && videoTrack) {
    commands = isDolbyVision(videoTrack)
      ? getMp4boxCommands({
          mp4boxMode,
          inputFile,
          outputFolder,
          tempFolder,
          mediaInfo,
          selectedTracks,
          videoTrack,
          audioTracks,
        })
      : getMkvmergeCommands({
          inputFile,
          outputFolder,
          tempFolder,
          mediaInfo,
          selectedTracks,
          audioTracks,
          subtitleTracks,
        });
  }

  if (hasItems(errors)) return { status: "ERROR", messages: errors, isAlreadySupported };

  if (hasItems(warnings)) {
    return {
      status: "WARN",
      messages: warnings,
      commands,
      isAlreadySupported,
    };
  }

  return {
    status: "OK",
    commands,
    isAlreadySupported,
  };
}

function getMp4boxCommands({
  mp4boxMode,
  inputFile,
  outputFolder,
  tempFolder,
  mediaInfo,
  selectedTracks,
  videoTrack,
  audioTracks,
}: GetMp4boxCommandsParams): string[] {
  // todo: we can do better, method => func map with same params could be nicer
  if (mp4boxMode === MP4BOX_MODE_IMPORT_SELECTED_ONLY) {
    return getMp4boxImportSelectedOnlyCommands({
      inputFile,
      outputFolder,
      tempFolder,
      mediaInfo,
      selectedTracks,
      videoTrack,
      audioTracks,
    });
  }

  if (mp4boxMode === MP4BOX_MODE_IMPORT_ALL_THEN_REMOVE) {
    return getMp4boxImportAllAndRemoveCommands({
      inputFile,
      outputFolder,
      tempFolder,
      mediaInfo,
      selectedTracks,
      videoTrack,
      audioTracks,
    });
  }

  // todo: alternative solution if sth goes wrong 😉
  if (mp4boxMode === MP4BOX_MODE_DEMUX_ALL) {
    return getMp4boxDemuxAllCommands({
      inputFile,
      outputFolder,
      tempFolder,
      mediaInfo,
      selectedTracks,
      videoTrack,
      audioTracks,
    });
  }

  // todo: scream
  return [];
}

type GetMp4boxCommandsParams = Readonly<{
  mp4boxMode: Mp4BoxMode;
  inputFile: string;
  outputFolder: string;
  tempFolder: string;
  mediaInfo: MediaInfo;
  selectedTracks: readonly Track[];
  videoTrack: VideoTrack;
  audioTracks: readonly AudioTrack[];
}>;

// todo: better way, reuse ConvertMediaParams somehow?
type ConvertSingleMediaParams = Readonly<{
  inputFile: string;
  keepHu: boolean;
  outputFolder: string;
  tempFolder: string;
  selectedTrackIds?: readonly number[] | undefined;
  mp4boxMode: Mp4BoxMode;
}>;

type ConvertSingleMediaResponse =
  | ConvertSingleMediaOkResponse
  | ConvertSingleMediaWarnResponse
  | ConvertSingleMediaErrorResponse;

interface ConvertSingleMediaOkResponse extends ConvertSingleMediaResponseBase {
  readonly status: "OK";
  readonly commands: string[];
}

interface ConvertSingleMediaWarnResponse
  extends
    Omit<ConvertSingleMediaOkResponse, "status">,
    Omit<ConvertSingleMediaErrorResponse, "status"> {
  readonly status: "WARN";
}

interface ConvertSingleMediaErrorResponse extends ConvertSingleMediaResponseBase {
  readonly status: "ERROR";
  readonly messages: string[];
}

interface ConvertSingleMediaResponseBase {
  readonly isAlreadySupported: boolean;
}

type ConvertMediaParams = Readonly<{
  input: string;
  keepHu: boolean;
  output: string;
  tempFolder: string;
  selectedTrackIds?: readonly number[];
  mp4boxMode: Mp4BoxMode;
}>;

type ConvertMediaResponse =
  | ConvertMediaOkResponse
  | ConvertMediaWarnResponse
  | ConvertMediaErrorResponse;

interface ConvertMediaOkResponse {
  readonly status: "OK";
}

interface ConvertMediaWarnResponse extends Omit<ConvertMediaOkResponse, "status"> {
  readonly status: "WARN";
  readonly messages: string[];
}

interface ConvertMediaErrorResponse extends Omit<ConvertMediaWarnResponse, "status"> {
  readonly status: "ERROR";
}
