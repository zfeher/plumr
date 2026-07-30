import path from "node:path";

import type { Audio, MediaInfo, Track, Video } from "./types.ts";
import {
  EXTENSION_AC3,
  EXTENSION_MP4,
  mp4BoxBrandCompatFlags,
  mp4BoxDvheFlags,
} from "./constants.ts";
import {
  isAudioNeedsConversionForTv,
  isAudioTrack,
  getTrackExtension,
  hasItems,
  isDolbyVision,
} from "./common.ts";

export function getMp4boxDemuxAllCommands({
  inputFile,
  outputDirectory,
  tempDirectory,
  mediaInfo,
  selectedTracks,
  video,
  audio,
}: GetMp4boxDemuxAllCommandsParams): string[] {
  const commands: string[] = [];

  // todo: these feels duplicate
  const mediaDir = path.basename(inputFile).replace(`.${mediaInfo.general.fileExtension}`, "");

  const tempMediaDir = path.join(tempDirectory, mediaDir);

  const tracksMeta = selectedTracks.reduce((acc, track) => {
    const isConvertibleAudioTr = isAudioTrack(track) && isAudioNeedsConversionForTv(track);
    acc.set(track, {
      extractedFile: path.join(tempMediaDir, `track${track.id}.${getTrackExtension(track)}`),

      ...(isConvertibleAudioTr && {
        convertedFile: path.join(tempMediaDir, `track${track.id}.${EXTENSION_AC3}`),
      }),
    });
    return acc;
  }, new WeakMap<Track, TrackMeta>());

  // todo: this is clean duplicate
  const extractTracksOptions = selectedTracks.map((track) => {
    const meta = tracksMeta.get(track);
    // todo: better way? asssertIsNotNil?
    if (!meta) throw new Error("This should not happen :)");

    // note: TIDs of mkvextract starts from 0 whereas mediainfo id starts from 1
    //  streamOrder starts from 0 probably can be used but needs some checking, experience
    // note: execFile doesn't like extra "" wrapping
    // return `${track.id - 1}:${extractedFile}`;
    return `${track.id - 1}:"${meta.extractedFile}"`;
  });

  commands.push(
    "rem #",
    "rem # extract all tracks",
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

  const convertibleAudio = audio.filter(isAudioNeedsConversionForTv);

  // if (hasItems(convertibleAudio)) {
  //   console.log('converting audio track(s)...');
  // }

  // todo: these feels like duplicates
  if (hasItems(convertibleAudio)) {
    commands.push("rem #", "rem # convert audio files", "rem #");
  }

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

  // for dvhe
  const addFlags = selectedTracks.flatMap((track, index) => {
    const meta = tracksMeta.get(track);
    // todo: better way? assertIsNotNil?
    if (!meta) throw new Error("This should not happen :)");

    const file = meta.convertedFile ?? meta.extractedFile;
    const { language } = track;
    // todo: we might wanna improve on fallback title, thats what we might see in player, tv
    //  we use it for video as well but we could use general.title/movie instead
    const title = "title" in track ? (track.title ?? language) : language;
    const trackId = index + 1;
    return [
      // note: execFile doesn't like "" wrapping
      ["-add", `"${file}"`],
      language ? ["-lang", `${trackId}=${language}`] : [],
      title ? ["-name", `${trackId}="${title}"`] : [],
    ].flat();
  });

  // note: execFile doesn't like "" wrapping
  const tempFlag = ["-tmp", `"${tempDirectory}"`];

  const outputFileName = path
    .basename(inputFile)
    .replace(`.${mediaInfo.general.fileExtension}`, `.${EXTENSION_MP4}`);

  const outputFile = path.join(outputDirectory, outputFileName);
  // note: execFile doesn't like "" wrapping
  const outputFlag = ["-new", `"${outputFile}"`];

  const mp4boxOptions = [
    addFlags,
    // todo: temp to check non DV stuff for muxing tests
    isDolbyVision(video) ? mp4BoxDvheFlags : [],
    mp4BoxBrandCompatFlags,
    tempFlag,
    outputFlag,
  ]
    .flat()
    .filter(Boolean);

  commands.push(
    "rem #",
    "rem # mux tracks",
    "rem #",
    `mp4box ${mp4boxOptions.join(" ")}`,
    "",
    `rmdir /s /q "${tempMediaDir}"`,
  );

  // console.log('@@@:');
  // console.log(commands.join('\n'));
  // commands.forEach((command) => console.log(command));

  // console.log('@@@@ mp4boxOptions', mp4boxOptions);

  // console.log('muxing...');

  // const muxResult = await execFile('mp4box', mp4boxOptions).catch((error) =>
  //   console.error(error),
  // );

  // console.log('muxing is done');

  // console.log(muxResult);

  return commands;
}

interface TrackMeta {
  readonly extractedFile: string;
  readonly convertedFile?: string;
}

interface GetMp4boxDemuxAllCommandsParams {
  readonly inputFile: string;
  readonly outputDirectory: string;
  readonly tempDirectory: string;
  readonly mediaInfo: MediaInfo;
  readonly selectedTracks: readonly Track[];
  readonly video: Video;
  readonly audio: readonly Audio[];
}
