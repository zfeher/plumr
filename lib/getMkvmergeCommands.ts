import path from "node:path";

import type { Audio, MediaInfo, Subtitle, Track } from "./types.ts";
import { EXTENSION_AC3, EXTENSION_MKV } from "./constants.ts";

import {
  getTrackExtension,
  hasItems,
  isAudioNeedsConversionForTv,
  isSupportedAudioByTv,
} from "./common.ts";

export function getMkvmergeCommands({
  inputFile,
  outputDirectory,
  tempDirectory,
  mediaInfo,
  selectedTracks,
  audio,
  subtitle,
}: GetMkvmergeCommandsParams): string[] {
  const commands: string[] = [];

  // todo: extract?
  interface TrackMeta {
    fid: number;
    extractedFile: string;
    convertedFile: string;
  }

  // todo: these feels duplicate
  const mediaDir = path.basename(inputFile).replace(`.${mediaInfo.general.fileExtension}`, "");

  const tempMediaDir = path.join(tempDirectory, mediaDir);

  const convertibleAudio = audio.filter(isAudioNeedsConversionForTv);
  const tracksMeta = convertibleAudio.reduce((acc, track, index) => {
    acc.set(track, {
      // note: we assume at least a video is imported from input so external FIDs
      //  will start from 1. feel free to rethink 😉
      fid: index + 1,

      extractedFile: path.join(tempMediaDir, `track${track.id}.${getTrackExtension(track)}`),

      convertedFile: path.join(tempMediaDir, `track${track.id}.${EXTENSION_AC3}`),
    });
    return acc;
  }, new WeakMap<Track, TrackMeta>());

  if (hasItems(convertibleAudio)) {
    // todo: this is clearly duplicate
    const extractTracksOptions = convertibleAudio.map((track) => {
      const meta = tracksMeta.get(track);
      // todo: better way?
      if (!meta) throw new Error("This should not happen :)");

      // note: TIDs of mkvextract starts from 0 whereas mediainfo id starts from 1
      //  streamOrder starts from 0 probably can be used but needs some checking, experience
      // note: execFile doesn't like extra "" wrapping
      return `${track.id - 1}:"${meta.extractedFile}"`;
    });

    commands.push(
      "rem #",
      "rem # extract convertible audio tracks",
      "rem #",
      `mkvextract "${inputFile}" tracks ${extractTracksOptions.join(" ")}`,
      "",
    );

    // console.log('extracting track(s)...');

    // const extractResult = await execFile('mkvextract', [
    //   inputFile,
    //   'tracks',
    //   ...extractTracksOptions,
    //   // todo: proper error handling, notif user etc
    // ]).catch((error) => console.error(error));

    // console.log('extracting tracks is done');
    // console.log(extractResult);
  }

  // if (hasItems(convertibleAudio)) {
  //   console.log('converting audio track(s)...');
  // }

  // todo: these feels like duplicates
  if (hasItems(convertibleAudio)) {
    commands.push("rem #", "rem # convert audio files", "rem #");
  }

  // todo: alternative could be traversing tracksMeta
  for (const track of convertibleAudio) {
    const meta = tracksMeta.get(track);
    // todo: better way?
    if (!meta) throw new Error("This should not happen :)");

    commands.push(`eac3to "${meta.extractedFile}" "${meta.convertedFile}" -down6 -640`);

    // const convertResult = await execFile('eac3to', [
    //   extractedFile,
    //   convertedFile,
    //   '-down6',
    //   '-640',
    //   // todo: proper error handling, notif user etc
    // ]).catch((error) => console.error(error));
    // console.log(convertResult);
  }

  if (hasItems(convertibleAudio)) {
    commands.push("");
  }

  // if (hasItems(convertibleAudio)) {
  //   console.log('converting audio track(s) is done');
  // }

  // todo: notif user about progress
  // todo: notif user about errors, warnings etc

  const supportedAudio = audio.filter(isSupportedAudioByTv);
  // note: mkvmerge works with 0 based TIDs
  const inputAudioTrackIds = supportedAudio.map((track) => track.id - 1);
  // note: mkvmerge works with 0 based TIDs
  const inputSubtitleTrackIds = subtitle.map((track) => track.id - 1);

  const inputFlags = [
    hasItems(supportedAudio) ? ["--audio-tracks", inputAudioTrackIds.join(",")] : ["--no-audio"],
    hasItems(subtitle)
      ? ["--subtitle-tracks", inputSubtitleTrackIds.join(",")]
      : ["--no-subtitles"],
    `"${inputFile}"`,
  ].flat();

  // note: here we rely on that only convertible audio is extracted and converted
  const externalFlags = convertibleAudio.flatMap((track) => {
    const meta = tracksMeta.get(track);
    // todo: better way?
    if (!meta) throw new Error("This should not happen :)");

    // note: this one is tricky because the options are input specific and TID
    //  means a track id in that input (here an audio where that is 0)
    const trackId = 0;
    const { language, title } = track;

    return [
      language ? ["--language", `${trackId}:${track.language}`] : [],
      title ? ["--track-name", `${trackId}:"${track.title}"`] : [],
      // todo: we might not really need these, check if works ok 😉
      // track.default ? ['--default-track-flag', trackId] : [],
      // track.forced ? ['--forced-display-flag', trackId] : [],
      `"${meta.convertedFile}"`,
    ].flat();
  });

  const trackOrder = selectedTracks.map((track) => {
    const meta = tracksMeta.get(track);
    const isExternalTrack = meta !== undefined;
    // note: here we assume that at least a video is imported from input
    const fid = isExternalTrack ? meta.fid : 0;
    // note: external TID is always 0 in our cases (audio, subtitle)
    const trackId = isExternalTrack ? 0 : track.id - 1;
    return `${fid}:${trackId}`;
  });

  const trackOrderFlag = ["--track-order", trackOrder.join(",")];

  const outputFileName = path
    .basename(inputFile)
    .replace(`.${mediaInfo.general.fileExtension}`, `.${EXTENSION_MKV}`);

  const outputFile = path.join(outputDirectory, outputFileName);
  const outputFlag = ["--output", `"${outputFile}"`];

  commands.push(
    ["mkvmerge", inputFlags, externalFlags, trackOrderFlag, outputFlag].flat().join(" "),
  );

  return commands;
}

interface GetMkvmergeCommandsParams {
  readonly inputFile: string;
  readonly outputDirectory: string;
  readonly tempDirectory: string;
  readonly mediaInfo: MediaInfo;
  readonly selectedTracks: readonly Track[];
  readonly audio: readonly Audio[];
  readonly subtitle: readonly Subtitle[];
}
