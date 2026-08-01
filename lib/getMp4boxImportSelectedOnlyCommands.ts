import path from "node:path";

import type { AudioTrack, MediaInfo, Track, VideoTrack } from "./types.ts";
import {
  EXTENSION_AC3,
  EXTENSION_MP4,
  mp4BoxBrandCompatFlags,
  mp4BoxDvheFlags,
} from "./constants.ts";
import {
  assertIsDefined,
  getTrackExtension,
  hasItems,
  isAudioNeedsConversionForTv,
  isAudioTrack,
  isDolbyVision,
  isSubtitleTrack,
} from "./common.ts";

export function getMp4boxImportSelectedOnlyCommands({
  inputFile,
  outputFolder,
  tempFolder,
  mediaInfo,
  selectedTracks,
  videoTrack,
  audioTracks,
}: GetMp4boxImportSelectedOnlyCommandsParams): string[] {
  const commands: string[] = [];

  // todo: these feels duplicate
  const mediaDir = path.basename(inputFile).replace(`.${mediaInfo.general.fileExtension}`, "");

  const tempMediaDir = path.join(tempFolder, mediaDir);

  // todo: using WeakMap again?
  const tracksMeta = selectedTracks.reduce((acc, track) => {
    const isConvertibleAudioTr = isAudioTrack(track) && isAudioNeedsConversionForTv(track);

    if (!isConvertibleAudioTr && !isSubtitleTrack(track)) return acc;

    const trackId = track.id;
    acc.set(track, {
      extractedFile: path.join(tempMediaDir, `track${trackId}.${getTrackExtension(track)}`),

      convertedFile: isConvertibleAudioTr
        ? path.join(tempMediaDir, `track${trackId}.${EXTENSION_AC3}`)
        : undefined,
    });
    return acc;
  }, new Map<Track, TrackMeta>());

  if (tracksMeta.size > 0) {
    // todo: this is clearly duplicate kinda-ish :)
    const extractTracksOptions = [...tracksMeta.entries()].map(([track, meta]) => {
      // note: TIDs of mkvextract starts from 0 whereas mediainfo id starts from 1
      //  streamOrder starts from 0 probably can be used but needs some checking, experience
      // note: execFile doesn't like extra "" wrapping
      // return `${track.id - 1}:${extractedFile}`;
      return `${track.id - 1}:"${meta.extractedFile}"`;
    });

    commands.push(
      "rem #",
      "rem # extract convertible audio and subtitle tracks",
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

  const convertibleAudioTracks = audioTracks.filter(isAudioNeedsConversionForTv);

  // if (hasItems(convertibleAudio)) {
  //   console.log('converting audio track(s)...');
  // }

  // todo: these feels like duplicates
  if (hasItems(convertibleAudioTracks)) {
    commands.push("rem #", "rem # convert audio files", "rem #");
  }

  // todo: alternative could be traversing tracksMeta
  for (const track of convertibleAudioTracks) {
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

  if (hasItems(convertibleAudioTracks)) {
    commands.push("");
  }

  // if (hasItems(convertibleAudio)) {
  //   console.log('converting audio track(s) is done');
  // }

  // todo: notif user about progress
  // todo: notif user about errors, warnings etc

  // todo: adding qt style menu causes track id glitches, menu id is 65534 and other
  //  track ids may start from 65535 (maybe -1 etc if more external). it can also
  //  happen that input track id changes and not kept. seems like an mp4box bug

  let previousExpectedTrackId = 0;
  const inputFlags = selectedTracks.flatMap((track, index) => {
    const meta = tracksMeta.get(track);
    const isExternalTrack = meta !== undefined;

    // note: execFile doesn't like "" wrapping
    const input = isExternalTrack
      ? `"${meta.convertedFile ?? meta.extractedFile}"`
      : `"${inputFile}#trackID=${track.id}"`;

    // note: track ids are kept or given. importing tracks from input keeps their track
    //  ids. extracted tracks will get new ids starting from previous track id + 1.
    //  the track/stream order is based on the order of `-add` flags.
    const expectedTrackId = isExternalTrack ? previousExpectedTrackId + 1 : track.id;
    const trackId = index + 1;
    const isTrackIdChanged = trackId !== expectedTrackId;
    previousExpectedTrackId = expectedTrackId;
    const { language } = track;

    // todo: we might wanna improve on fallback title, thats what we might see in player, tv
    //  we use it for video as well but we could use general.title/movie instead
    // todo: better fallback could be English etc
    const title = track.title ?? language;

    return [
      // note: execFile doesn't like "" wrapping
      ["-add", input],
      isTrackIdChanged ? ["-set-track-id", `${expectedTrackId}:${trackId}`] : [],
      isExternalTrack && language ? ["-lang", `${trackId}=${language}`] : [],
      isExternalTrack && title ? ["-name", `${trackId}="${title}"`] : [],
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
    inputFlags,
    // note: 'udta' keeps nero styled chapters, 'tk' is quicktime styled added by
    //  mp4muxer, 'both' is the default and keeps both for utmost compatibility
    //  we skip qt menu for now because it causes track id glitches
    mediaInfo.hasMenu ? ["--chapm=udta"] : [],
    // todo: temp to check non DV stuff for muxing tests
    isDolbyVision(videoTrack) ? mp4BoxDvheFlags : [],
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
  readonly convertedFile: string | undefined;
}

interface GetMp4boxImportSelectedOnlyCommandsParams {
  readonly inputFile: string;
  readonly outputFolder: string;
  readonly tempFolder: string;
  readonly mediaInfo: MediaInfo;
  readonly selectedTracks: readonly Track[];
  readonly videoTrack: VideoTrack;
  readonly audioTracks: readonly AudioTrack[];
}
