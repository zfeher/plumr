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
  getTrackExtension,
  hasItems,
  isDolbyVision,
  assertIsDefined,
} from "./common.ts";

export function getMp4boxImportAllAndRemoveCommands({
  inputFile,
  outputFolder,
  tempFolder,
  mediaInfo,
  selectedTracks,
  video,
  audio,
}: GetMp4boxImportAllAndRemoveCommandsParams): string[] {
  const commands: string[] = [];

  const convertibleAudio = audio.filter(isAudioNeedsConversionForTv);

  // todo: these feels like duplicate
  const mediaDir = path.basename(inputFile).replace(`.${mediaInfo.general.fileExtension}`, "");
  const tempMediaDir = path.join(tempFolder, mediaDir);

  const tracksMeta = convertibleAudio.reduce((acc, track) => {
    acc.set(track, {
      extractedFile: path.join(tempMediaDir, `track${track.id}.${getTrackExtension(track)}`),

      convertedFile: path.join(tempMediaDir, `track${track.id}.${EXTENSION_AC3}`),
    });
    return acc;
  }, new WeakMap<Track, TrackMeta>());

  if (hasItems(convertibleAudio)) {
    // todo: this is clearly duplicate
    const extractTracksOptions = convertibleAudio.map((track) => {
      const meta = tracksMeta.get(track);
      assertIsDefined(meta);

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
    assertIsDefined(meta);

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

  const selectedTrackIds = selectedTracks.map((track) => track.id);
  const unselectedTrackIds = mediaInfo.tracks
    .filter((track) => !selectedTrackIds.includes(track.id))
    .map((track) => track.id);

  const convertibleAudioTrackIds = convertibleAudio.map((track) => track.id);

  const trackIdsToBeRemoved = [convertibleAudioTrackIds, unselectedTrackIds].flat();

  // for dvhe
  // note: execFile doesn't like "" wrapping
  const inputFlag = ["-add", `"${inputFile}"`];
  const removeFlags = trackIdsToBeRemoved.flatMap((id) => ["-rem", id]);

  const lastTrack = mediaInfo.tracks.at(-1);
  // note: if input has menu (nero style) gpac by default will add another menu
  //  track (qt style) which shifts the ids
  const newIdOffset = lastTrack ? lastTrack.id + (mediaInfo.hasMenu ? 1 : 0) : 0;
  const addFlags = convertibleAudio.flatMap((track, index) => {
    const meta = tracksMeta.get(track);
    assertIsDefined(meta);

    const { convertedFile } = meta;
    const expectedId = newIdOffset + 1 + index;
    const targetId = selectedTrackIds.indexOf(track.id) + 1;
    const { title, language } = track;
    return [
      // note: execFile doesn't like "" wrapping
      ["-add", `"${convertedFile}"`],
      ["-set-track-id", `${expectedId}:${targetId}`],
      language ? ["-lang", `${targetId}=${language}`] : [],
      // todo: better fallback could be English etc
      // note: execFile doesn't like "" wrapping
      ["-name", `${targetId}="${title ?? language}"`],
    ].flat();
  });

  // note: execFile doesn't like "" wrapping
  const tempFlag = ["-tmp", `"${tempFolder}"`];

  const outputFileName = path
    .basename(inputFile)
    .replace(`.${mediaInfo.general.fileExtension}`, `.${EXTENSION_MP4}`);

  const outputFile = path.join(outputFolder, outputFileName);
  // note: execFile doesn't like "" wrapping
  const outputFlag = ["-new", `"${outputFile}"`];

  const mp4boxOptions = [
    inputFlag,
    removeFlags,
    addFlags,
    // note: 'udta' keeps nero styled chapters, 'tk' is quicktime styled added by
    //  mp4muxer, 'both' is the default and keeps both for utmost compatibility
    //  we skip qt menu for now because it causes track id glitches
    mediaInfo.hasMenu ? ["--chapm=udta"] : [],
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
  readonly convertedFile: string;
}

interface GetMp4boxImportAllAndRemoveCommandsParams {
  readonly inputFile: string;
  readonly outputFolder: string;
  readonly tempFolder: string;
  readonly mediaInfo: MediaInfo;
  readonly selectedTracks: readonly Track[];
  readonly video: Video;
  readonly audio: readonly Audio[];
}
