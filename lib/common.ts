import type { AudioTrack, SubtitleTrack, Track, VideoTrack } from "./types.ts";
import {
  FORMAT_MP4_TIMED_TEXT,
  HDR_FORMAT_DOLBY_VISION,
  audioFormatsNeedsConversionForTv,
  formatToExtensionMap,
  reversedPreferredConvertibleAudioOrder,
  supportedAudioFormatsByTv,
  supportedDolbyVisionContainersByTv,
  trackTypeAudio,
  trackTypeSubtitle,
  trackTypeVideo,
} from "./constants.ts";

export function isAlreadySupportedByTv(fileExtension: string, tracks: readonly Track[]): boolean {
  return (
    hasSupportedVideoByTvAndContainer(fileExtension, tracks) &&
    hasSufficientSupportedAudioByTv(tracks)
  );
}

function hasSupportedVideoByTvAndContainer(
  containerExtension: string,
  tracks: readonly Track[],
): boolean {
  const video = getSupportedVideoTracksByTv(tracks);

  if (
    !video ||
    (isDolbyVision(video) && !isSupportedDolbyVisionContainerByTv(containerExtension))
  ) {
    return false;
  }

  return true;
}

function isSupportedDolbyVisionContainerByTv(extension: string): boolean {
  // todo: resolve: schema validation could help
  // oxlint-disable-next-line typescript/no-explicit-any typescript/no-unsafe-argument typescript/no-unsafe-type-assertion
  return supportedDolbyVisionContainersByTv.includes(extension as any);
}

function hasSufficientSupportedAudioByTv(tracks: readonly Track[]): boolean {
  const { tracks: recommended } = getRecommendedAudioTracks(tracks);
  return hasItems(recommended) && none(isAudioNeedsConversionForTv, recommended);
}

export function getRecommendedTracks(tracks: readonly Track[]): GetRecommendedTracksResult {
  const recommendedVideo = getSupportedVideoTracksByTv(tracks);
  const recommendedAudio = getRecommendedAudioTracks(tracks);
  const recommendedSubtitle = getRecommendedSubtitleTracks(tracks);
  return {
    hasRecommendedVideo: recommendedVideo !== undefined,
    hasRecommendedAudio: hasItems(recommendedAudio.tracks),
    hasRecommendedSubtitle: hasItems(recommendedSubtitle.tracks),
    hasSubtitleTracks: recommendedSubtitle.hasCandidates,
    hasForeignAudioOnly: recommendedAudio.hasForeignAudioOnly,
    tracks: [recommendedVideo ?? [], recommendedAudio.tracks, recommendedSubtitle.tracks].flat(),
  };
}

interface GetRecommendedTracksResult {
  readonly hasRecommendedVideo: boolean;
  readonly hasRecommendedAudio: boolean;
  readonly hasRecommendedSubtitle: boolean;
  readonly hasSubtitleTracks: boolean;
  readonly hasForeignAudioOnly: boolean;
  readonly tracks: readonly Track[];
}

function getRecommendedSubtitleTracks(tracks: readonly Track[]): GetRecommendedSubtitleTracks {
  const candidates = tracks.filter(isSubtitleTrack);
  const recommended = candidates.filter(isRecommendedSubtitle).toSorted((subtitleA, subtitleB) => {
    const aSize = subtitleA.streamSize;
    const bSize = subtitleB.streamSize;
    if (aSize === bSize) return 0;
    return bSize < aSize ? 1 : -1;
  });

  // note: if first sub is forced (at least 2x smaller than the second sub) we drop it
  if (
    recommended.length > 1 &&
    recommended[0] &&
    recommended[1] &&
    recommended[0].streamSize / recommended[1].streamSize <= 0.5
  ) {
    recommended.slice(1);
  }

  return { tracks: recommended, hasCandidates: hasItems(candidates) };
}

interface GetRecommendedSubtitleTracks {
  readonly tracks: readonly Track[];
  readonly hasCandidates: boolean;
}

function isRecommendedSubtitle(track: SubtitleTrack): boolean {
  return (
    track.streamSize > 0 &&
    isSupportedSubtitleByTv(track) &&
    !track.forced &&
    !isCommentaryTrack(track) &&
    ["en", "eng", "en-US"].includes(track.language)
  );
}

function getRecommendedAudioTracks(tracks: readonly Track[]): GetRecommendedAudioTracksResult {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion - todo: resolve
  const candidates = tracks.filter(
    (track) =>
      isAudioTrack(track) &&
      !isCommentaryTrack(track) &&
      isSupportedAudioOrNeedsConversionForTv(track),
  ) as AudioTrack[]; // todo: better way?

  const languages = candidates.reduce((acc, track) => {
    return acc.add(track.language);
  }, new Set<string>());

  const hasForeignAudioOnly = none(
    (lang) => languages.has(lang),
    // todo: this is subjective for now 😉
    ["en", "eng", "en-US", "hu", "hun", "hu-HU"],
  );

  // single audio easy 🙂
  if (candidates.length === 1) {
    return { tracks: candidates, hasForeignAudioOnly };
  }

  const supported = candidates.filter((track) => isSupportedAudioByTv(track));
  const convertible = candidates.filter((track) => isAudioNeedsConversionForTv(track));

  // simple keep all supported
  if (isEmpty(convertible)) {
    return { tracks: supported, hasForeignAudioOnly };
  }

  // multi lang we cannot automatically decide what to convert (origin lang not known)
  if (languages.size > 1) {
    return { tracks: [], hasForeignAudioOnly };
  }

  // single lang + multi audio cases

  // note: MP4 DTS, Opus channels info are missing so we cannot recommend correctly
  if (candidates.some(hasNoChannelsInfo)) {
    return { tracks: [], hasForeignAudioOnly };
  }

  if (
    supported.some(hasMultiChannels) ||
    (hasItems(supported) && none(hasMultiChannels, convertible))
  ) {
    return { tracks: supported, hasForeignAudioOnly };
  }

  const preferredConvertible = getPreferredConvertibleAudioTrack(convertible);
  const recommended = preferredConvertible ? [preferredConvertible, ...supported] : supported;

  return { tracks: recommended, hasForeignAudioOnly };
}

interface GetRecommendedAudioTracksResult {
  readonly tracks: readonly AudioTrack[];
  readonly hasForeignAudioOnly: boolean;
}

function isCommentaryTrack(track: AudioTrack | SubtitleTrack): boolean {
  return /commentary/iu.test(track.title ?? "");
}

function getPreferredConvertibleAudioTrack(tracks: readonly AudioTrack[]): AudioTrack | undefined {
  if (tracks.length === 0) {
    return undefined;
  }
  if (tracks.length === 1) {
    return tracks[0];
  }

  // TrueHD > DTS-HD MA > DTS, ...

  const sorted = tracks.toSorted((trackA, trackB) => {
    const aIndex = reversedPreferredConvertibleAudioOrder.indexOf(getAudioFormatString(trackA));
    const bIndex = reversedPreferredConvertibleAudioOrder.indexOf(getAudioFormatString(trackB));
    // note: yes we reverse once again so we can take arr[0] as most preferred ;)
    if (aIndex === bIndex) return 0;
    return aIndex > bIndex ? -1 : 1;
  });

  return sorted[0];
}

function getAudioFormatString(track: AudioTrack): string {
  return `${track.format} ${track.formatAdditionalFeatures}, ${track.formatCommercialIfAny}`.replaceAll(
    /,? undefined/gu,
    "",
  );
}

function hasNoChannelsInfo(track: AudioTrack): boolean {
  return !hasChannelsInfo(track);
}

function hasChannelsInfo(track: AudioTrack): boolean {
  return track.channels !== undefined;
}

function hasMultiChannels(track: AudioTrack): boolean {
  return (track.channels ?? 0) > 4;
}

function getSupportedVideoTracksByTv(tracks: readonly Track[]): VideoTrack | undefined {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion - todo: resolve
  const video = tracks.filter(
    (track) => isVideoTrack(track) && isSupportedVideoByTv(track),
  ) as VideoTrack[]; // todo: better way?

  if (video.length > 1) {
    // todo: better way? assertLengthEq1?
    // todo: warn user if multiple video track found vs check what can mp4 support?
    throw new Error("This should not happen usually :)");
  }

  return video[0];
}

function isSupportedVideoByTv(track: VideoTrack): boolean {
  return !isDolbyVisionProfile7(track);
}

export function isDolbyVisionProfile7(track: VideoTrack): boolean {
  // DV profile 7: dv**.07
  return /dv[a-z]{2}\.07/u.test(track.hdrFormatProfile ?? "");
}

export function isDolbyVision(track: VideoTrack): boolean {
  return track.hdrFormat?.includes(HDR_FORMAT_DOLBY_VISION) ?? false;
}

export function isUnsupportedAudioAndNotConvertibleForTv(track: AudioTrack): boolean {
  return !isSupportedAudioOrNeedsConversionForTv(track);
}

function isSupportedAudioOrNeedsConversionForTv(track: AudioTrack): boolean {
  return isSupportedAudioByTv(track) || isAudioNeedsConversionForTv(track);
}

export function isSupportedAudioByTv(track: AudioTrack): boolean {
  // todo: resolve: schema validation could help
  // oxlint-disable-next-line typescript/no-explicit-any typescript/no-unsafe-argument typescript/no-unsafe-type-assertion
  return supportedAudioFormatsByTv.includes(track.format as any);
}

export function isAudioNeedsConversionForTv(track: AudioTrack): boolean {
  // todo: resolve: schema validation could help
  // oxlint-disable-next-line typescript/no-unsafe-argument typescript/no-unsafe-type-assertion typescript/no-explicit-any
  return audioFormatsNeedsConversionForTv.includes(track.format as any);
}

export function isUnsupportedSubtitleByTv(track: SubtitleTrack): boolean {
  return !isSupportedSubtitleByTv(track);
}

function isSupportedSubtitleByTv(track: SubtitleTrack): boolean {
  // return ['UTF-8', 'ASS'].includes(track.format);
  return /S_TEXT\//iu.test(track.codecId) || track.format === FORMAT_MP4_TIMED_TEXT;
}

export function isVideoTrack(track: Track): track is VideoTrack {
  return track.type === trackTypeVideo;
}

export function isAudioTrack(track: Track): track is AudioTrack {
  return track.type === trackTypeAudio;
}

export function isSubtitleTrack(track: Track): track is SubtitleTrack {
  return track.type === trackTypeSubtitle;
}

export function getTrackExtension(track: Track): string {
  const extension = formatToExtensionMap.get(track.format);
  assertIsDefined(
    extension,
    `Unsupported track format (${track.format}) so cannot figure out the extension 😔`,
  );
  return extension;
}

export function assertIsDefined<T>(
  value: T,
  message?: string,
): asserts value is Exclude<T, null | undefined> {
  if (value === null || value === undefined) {
    throw new Error(
      message ??
        `Expected 'value' to be not Nil (null | undefined), but received ${JSON.stringify(value)}`,
    );
  }
}

export function isDefined<T>(value: T): value is Exclude<T, null | undefined> {
  return value !== null && value !== undefined;
}

export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function isEmpty(arr: readonly unknown[]): boolean {
  return arr.length === 0;
}

export function hasItems(arr: readonly unknown[]): boolean {
  return arr.length > 0;
}

export function none<T>(fn: (item: T) => boolean, arr: readonly T[]): boolean {
  return arr.every((item) => !fn(item));
}
