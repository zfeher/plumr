import fs from "node:fs/promises";
import path from "node:path";

import type { Audio, MediaInfo, Subtitle, Track, Video } from "./types.ts";
import { EXTENSION_MKV, FORMAT_MATROSKA } from "./constants.ts";

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
  isThreeLetterLanguageCode,
  assertIsDefined,
} from "./common.ts";

import { getMediaInfo } from "./getMediaInfo.ts";
import { getMp4boxImportSelectedOnlyCommands } from "./getMp4boxImportSelectedOnlyCommands.ts";
import { getMp4boxImportAllAndRemoveCommands } from "./getMp4boxImportAllAndRemoveCommands.ts";
import { getMp4boxDemuxAllCommands } from "./getMp4boxDemuxAllCommands.ts";
import { getMkvmergeCommands } from "./getMkvmergeCommands.ts";

// todo: vs dreaded enum? why? all enum types?
const MP4BOX_METHOD_IMPORT_SELECTED_ONLY = "mp4boxImportSelectedOnly";
const MP4BOX_METHOD_IMPORT_ALL_THEN_REMOVE = "mp4boxImportAllThenRemove";
const MP4BOX_METHOD_DEMUX_ALL = "mp4boxDemuxAll";

type Mp4BoxMethod =
  | typeof MP4BOX_METHOD_IMPORT_SELECTED_ONLY
  | typeof MP4BOX_METHOD_IMPORT_ALL_THEN_REMOVE
  | typeof MP4BOX_METHOD_DEMUX_ALL;

const mp4boxMethod: Mp4BoxMethod = MP4BOX_METHOD_IMPORT_SELECTED_ONLY;

export async function convertMedia(options: ConvertMediaParams): Promise<ConvertMediaResponse> {
  const { selectedTrackIds } = options;
  // todo: for now we remove "" wrapper ahead and see if it will be a problem
  const inputFile = options.inputFile.replace(/^['"]/u, "").replace(/['"]$/u, "");
  let outputDirectory = options.outputDirectory.replace(/^['"]/u, "").replace(/['"]$/u, "");
  const tempDirectory = options.tempDirectory.replace(/^['"]/u, "").replace(/['"]$/u, "");

  const inputFileStat = await fs.stat(inputFile);
  const inputIsDirectory = inputFileStat.isDirectory();

  const commands: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (inputIsDirectory) {
    outputDirectory = path.join(outputDirectory, path.basename(inputFile));

    // todo: extract this like single case (SLA :D)
    const dirEntries = await fs.readdir(inputFile, {
      encoding: "utf8",
      withFileTypes: true,
    });

    // console.log('@@@@ dirEntries', dirEntries);

    const mkvFiles = dirEntries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(`.${EXTENSION_MKV}`))
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
        inputFile: mkvFile,
        outputDirectory,
        tempDirectory,
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
      inputFile,
      outputDirectory,
      tempDirectory,
      selectedTrackIds,
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
      : path.basename(inputFile).replace(path.extname(inputFile), "");

    const batchOutputFile = inputIsDirectory
      ? path.join(inputFile, `${filenameNoExt}.bat`)
      : path.join(path.dirname(inputFile), `convert-${filenameNoExt}.bat`);

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
  const { inputFile, outputDirectory, tempDirectory } = options;
  let { selectedTrackIds } = options;

  // todo: use some cache for media info to avoid some wait twice ;)
  const mediaInfoResult = await getMediaInfo(inputFile);

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

  const { video, audio, subtitle } = selectedTracks.reduce<{
    video: Video | undefined;
    audio: Audio[];
    subtitle: Subtitle[];
  }>(
    (acc, track) => {
      if (isVideoTrack(track) && acc.video !== undefined) {
        // todo: better way?
        // todo: warn user if multiple video track found vs check what can mp4 support?
        throw new Error("This should not happen usually :)");
      }

      if (isVideoTrack(track)) acc.video = track;
      else if (isAudioTrack(track)) acc.audio.push(track);
      else if (isSubtitleTrack(track)) acc.subtitle.push(track);
      return acc;
    },
    {
      video: undefined,
      audio: [],
      subtitle: [],
    },
  );

  if (!video) {
    // todo: notify client side
    console.error("convertMedia: no video file is selected 🙃");
    // todo: how to do proper error handling via server actions? :)
    //  Promise.reject, throw cause 500 server error, can't reach client this info
    errors.push("no video file is selected 🙃");
  }

  if (isEmpty(audio)) {
    // todo: notify client side
    console.error("convertMedia: no audio track is selected, usually 1 should be 😉");
    // todo: how to do proper error handling via server actions? :)
    //  Promise.reject, throw cause 500 server error, can't reach client this info
    errors.push("no audio track is selected, usually 1 should be 😉");
  }

  if (video && isDolbyVisionProfile7(video)) {
    // todo: notify client side
    console.error("convertMedia: dolby vision profile 7 video won't work 😥");
    // todo: how to do proper error handling via server actions? :)
    //  Promise.reject, throw cause 500 server error, can't reach client this info
    errors.push("dolby vision profile 7 video won't work 😥");
  }

  if (audio.some(isUnsupportedAudioAndNotConvertibleForTv)) {
    // todo: notify client side
    console.error("convertMedia: unsupported/unconvertible audio selected 😟");
    // todo: how to do proper error handling via server actions? :)
    //  Promise.reject, throw cause 500 server error, can't reach client this info
    errors.push("unsupported/unconvertible audio selected 😟");
  }

  if (subtitle.some(isUnsupportedSubtitleByTv)) {
    // todo: notify client side
    console.error("convertMedia: unsupported subtitle selected 😟");
    // todo: how to do proper error handling via server actions? :)
    //  Promise.reject, throw cause 500 server error, can't reach client this info
    errors.push("unsupported subtitle selected 😟");
  }

  // todo: duplicate-ish
  const languages = audio.reduce((acc, track) => {
    return acc.add(track.language);
  }, new Set<string>());

  const hasForeignAudioSelectedOnly = none(
    (lang) => languages.has(lang),
    // todo: this is subjective for now 😉
    ["en", "eng", "hu", "hun"],
  );

  const hasSelectedSubtitles = hasItems(subtitle);

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
  );

  if (isAlreadySupported) {
    console.warn("convertMedia: media should be already playable");
    warnings.push("media should be already playable");
  }

  const languagesWithoutThreeLetterCode = selectedTracks
    .filter((track) => track.language !== "" && !isThreeLetterLanguageCode(track.language))
    .map((track) => track.language);

  if (hasItems(languagesWithoutThreeLetterCode)) {
    const langs = languagesWithoutThreeLetterCode.join(", ");

    console.warn(`convertMedia: some languages has no three letter language codes: [${langs}]`);
    warnings.push(`some languages has no three letter language codes: [${langs}]`);
  }

  let commands: string[] = [];
  if (isEmpty(errors) && video) {
    commands = isDolbyVision(video)
      ? getMp4boxCommands({
          inputFile,
          outputDirectory,
          tempDirectory,
          mediaInfo,
          selectedTracks,
          video,
          audio,
        })
      : getMkvmergeCommands({
          inputFile,
          outputDirectory,
          tempDirectory,
          mediaInfo,
          selectedTracks,
          audio,
          subtitle,
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
  inputFile,
  outputDirectory,
  tempDirectory,
  mediaInfo,
  selectedTracks,
  video,
  audio,
}: GetMp4boxCommandsParams): string[] {
  // todo: we can do better, method => func map with same params could be nicer
  if (mp4boxMethod === MP4BOX_METHOD_IMPORT_SELECTED_ONLY) {
    return getMp4boxImportSelectedOnlyCommands({
      inputFile,
      outputDirectory,
      tempDirectory,
      mediaInfo,
      selectedTracks,
      video,
      audio,
    });
  }

  if (mp4boxMethod === MP4BOX_METHOD_IMPORT_ALL_THEN_REMOVE) {
    return getMp4boxImportAllAndRemoveCommands({
      inputFile,
      outputDirectory,
      tempDirectory,
      mediaInfo,
      selectedTracks,
      video,
      audio,
    });
  }

  // todo: alternative solution if sth goes wrong 😉
  if (mp4boxMethod === MP4BOX_METHOD_DEMUX_ALL) {
    return getMp4boxDemuxAllCommands({
      inputFile,
      outputDirectory,
      tempDirectory,
      mediaInfo,
      selectedTracks,
      video,
      audio,
    });
  }

  return [];
}

interface GetMp4boxCommandsParams {
  readonly inputFile: string;
  readonly outputDirectory: string;
  readonly tempDirectory: string;
  readonly mediaInfo: MediaInfo;
  readonly selectedTracks: readonly Track[];
  readonly video: Video;
  readonly audio: readonly Audio[];
}

// todo: better way, reuse ConvertMediaParams somehow?
interface ConvertSingleMediaParams {
  readonly inputFile: string;
  readonly outputDirectory: string;
  readonly tempDirectory: string;
  readonly selectedTrackIds?: readonly number[];
}

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

interface ConvertMediaParams {
  readonly inputFile: string;
  readonly outputDirectory: string;
  readonly tempDirectory: string;
  readonly selectedTrackIds: readonly number[];
}

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
