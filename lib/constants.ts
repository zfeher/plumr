export const DEFAULT_OUTPUT_FOLDER = "T:/__watch_list__/__plumr__";
export const DEFAULT_TEMP_FOLDER = "T:/temp/plumr";

export const MP4BOX_MODE_IMPORT_SELECTED_ONLY = "importSelectedOnly";
export const MP4BOX_MODE_IMPORT_ALL_THEN_REMOVE = "importAllThenRemove";
export const MP4BOX_MODE_DEMUX_ALL = "demuxAll";
export const DEFAULT_MP4BOX_MODE = MP4BOX_MODE_IMPORT_SELECTED_ONLY;

export const trackTypeGeneral = "General";
export const trackTypeMenu = "Menu";
export const trackTypeVideo = "Video";
export const trackTypeAudio = "Audio";
export const trackTypeSubtitle = "Subtitle";
export const trackTypeText = "Text";
export const trackTypeImage = "Image";

export const FORMAT_MATROSKA = "Matroska";
export const FORMAT_MPEG_4 = "MPEG-4";
export const FORMAT_MPEG_TS = "MPEG-TS";
export const FORMAT_HEVC = "HEVC";
export const FORMAT_AVC = "AVC";
export const FORMAT_AAC = "AAC";
export const FORMAT_AC3 = "AC-3";
export const FORMAT_EAC3 = "E-AC-3";
export const FORMAT_DTS = "DTS";
export const FORMAT_OPUS = "Opus";
export const FORMAT_TRUE_HD = "MLP FBA";
export const FORMAT_ASS = "ASS";
export const FORMAT_PGS = "PGS";
// oxlint-disable-next-line unicorn/text-encoding-identifier-case - should be UTF-8 that is what we get
export const FORMAT_UTF8 = "UTF-8";
export const FORMAT_MP4_TIMED_TEXT = "Timed Text";

export const videoFormats = [
  FORMAT_MATROSKA,
  FORMAT_MPEG_4,
  FORMAT_MPEG_TS,
  FORMAT_HEVC,
  FORMAT_AVC,
] as const;

export type VideoFormat = (typeof videoFormats)[number];

export const audioFormats = [
  FORMAT_AAC,
  FORMAT_AC3,
  FORMAT_EAC3,
  FORMAT_DTS,
  FORMAT_OPUS,
  FORMAT_TRUE_HD,
] as const;

export type AudioFormat = (typeof audioFormats)[number];

export const subtitleFormats = [
  FORMAT_ASS,
  FORMAT_PGS,
  FORMAT_UTF8,
  FORMAT_MP4_TIMED_TEXT,
] as const;
export type SubtitleFormat = (typeof subtitleFormats)[number];

export const mediaFormats = [...videoFormats, ...audioFormats, ...subtitleFormats] as const;
export type MediaFormat = (typeof mediaFormats)[number];

export const audioFormatsNeedsConversionForTv: readonly AudioFormat[] = [
  FORMAT_TRUE_HD,
  FORMAT_DTS,
];

export const supportedAudioFormatsByTv: readonly AudioFormat[] = [
  FORMAT_EAC3,
  FORMAT_AC3,
  FORMAT_AAC,
  FORMAT_OPUS,
];

export const EXTENSION_H265 = "h265";
export const EXTENSION_H264 = "h264";
export const EXTENSION_EAC3 = "eac3";
export const EXTENSION_AC3 = "ac3";
export const EXTENSION_AAC = "aac";
export const EXTENSION_DTS = "dts";
export const EXTENSION_M2TS = "m2ts";
export const EXTENSION_META = "meta";
export const EXTENSION_MKV = "mkv";
export const EXTENSION_MP4 = "mp4";
export const EXTENSION_TS = "ts";
export const EXTENSION_OPUS = "opus";
export const EXTENSION_TRUE_HD = "thd";
export const EXTENSION_ASS = "ass";
export const EXTENSION_SRT = "srt";
export const EXTENSION_SUP = "sup";

export const mediaExtensions = [
  EXTENSION_H265,
  EXTENSION_H264,
  EXTENSION_EAC3,
  EXTENSION_AC3,
  EXTENSION_AAC,
  EXTENSION_DTS,
  EXTENSION_M2TS,
  EXTENSION_META,
  EXTENSION_MKV,
  EXTENSION_MP4,
  EXTENSION_TS,
  EXTENSION_OPUS,
  EXTENSION_TRUE_HD,
  EXTENSION_ASS,
  EXTENSION_SRT,
  EXTENSION_SUP,
] as const;

export type MediaExtension = (typeof mediaExtensions)[number];

export const supportedDolbyVisionContainersByTv: readonly MediaExtension[] = [
  EXTENSION_MP4,
  EXTENSION_TS,
  EXTENSION_M2TS,
];

export const HDR_FORMAT_DOLBY_VISION = "Dolby Vision";
export const HDR_FORMAT_DOLBY_VISION_HDR10 = "Dolby Vision / SMPTE ST 2086";
export const HDR_FORMAT_DOLBY_VISION_HDR10_PLUS = "Dolby Vision / SMPTE ST 2094 App 4";
export const HDR_FORMAT_HDR10_PLUS = "SMPTE ST 2094 App 4";
export const HDR_FORMAT_HDR10 = "SMPTE ST 2086";

export const mp4BoxBrandCompatFlags: readonly string[] = [
  ["-brand", "mp42"],
  ["-ab", "isom"],
  ["-ab", "dby1"],
].flat();

export const mp4BoxDvheFlags: readonly string[] = [
  "--force_dv",
  "--xps_inband=all",
  ["-hdr", "none"],
].flat();

// todo: readonly map
export const formatToExtensionMap = new Map<MediaFormat, MediaExtension>([
  [FORMAT_HEVC, EXTENSION_H265],
  [FORMAT_AVC, EXTENSION_H264],
  [FORMAT_AC3, EXTENSION_AC3],
  [FORMAT_AAC, EXTENSION_AAC],
  [FORMAT_DTS, EXTENSION_DTS],
  [FORMAT_EAC3, EXTENSION_EAC3],
  [FORMAT_TRUE_HD, EXTENSION_TRUE_HD],
  [FORMAT_ASS, EXTENSION_ASS],
  [FORMAT_PGS, EXTENSION_SUP],
  [FORMAT_UTF8, EXTENSION_SRT],
]);

// todo: don't forget to add TrueHD if it gets introduced as a known format
const preferredConvertibleAudioOrder: readonly string[] = [
  `${FORMAT_TRUE_HD} 16-ch, Dolby TrueHD with Dolby Atmos`,
  `${FORMAT_DTS} XLL X, DTS-HD MA + DTS:X`,
  `${FORMAT_DTS} XLL, DTS-HD Master Audio`,
  FORMAT_DTS,
];

export const reversedPreferredConvertibleAudioOrder: readonly string[] =
  preferredConvertibleAudioOrder.toReversed();
