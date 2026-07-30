export const trackTypeGeneral = "General";
export const trackTypeMenu = "Menu";
export const trackTypeVideo = "Video";
export const trackTypeAudio = "Audio";
export const trackTypeSubtitle = "Subtitle";
export const trackTypeText = "Text";

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
export const FORMAT_UTF8 = "utf8";
export const FORMAT_MP4_TIMED_TEXT = "Timed Text";

export const audioFormatsNeedsConversionForTv = [FORMAT_TRUE_HD, FORMAT_DTS] as const;

export const supportedAudioFormatsByTv = [
  FORMAT_EAC3,
  FORMAT_AC3,
  FORMAT_AAC,
  FORMAT_OPUS,
] as const;

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

export const supportedDolbyVisionContainersByTv = [
  EXTENSION_MP4,
  EXTENSION_TS,
  EXTENSION_M2TS,
] as const;

export const HDR_FORMAT_DOLBY_VISION = "Dolby Vision";
export const HDR_FORMAT_DOLBY_VISION_HDR10 = "Dolby Vision / SMPTE ST 2086";
export const HDR_FORMAT_DOLBY_VISION_HDR10_PLUS = "Dolby Vision / SMPTE ST 2094 App 4";
export const HDR_FORMAT_HDR10_PLUS = "SMPTE ST 2094 App 4";
export const HDR_FORMAT_HDR10 = "SMPTE ST 2086";

export const tsCodecMapping = new Map<string, string>()
  .set("A_AAC-2", "A_AAC")
  .set("A_EAC3", "A_AC3")
  .set("A_TRUEHD", "A_AC3");

export const threeLetterLanguageCodes = new Map<string, string>()
  .set("en", "eng")
  .set("ar", "ara")
  .set("ca", "cat")
  .set("cs", "cze")
  .set("da", "dan")
  .set("de", "ger")
  .set("el", "gre")
  .set("es", "spa")
  .set("eu", "baq")
  .set("fi", "fin")
  .set("fil", "fil")
  .set("fr", "fre")
  .set("gl", "glg")
  .set("he", "heb")
  .set("hr", "hrv")
  .set("hu", "hun")
  .set("id", "ind")
  .set("it", "ita")
  .set("ja", "jpn")
  .set("ko", "kor")
  .set("ms", "may")
  .set("nb", "nob")
  .set("nl", "dut")
  .set("pl", "pol")
  .set("pt", "por")
  .set("ro", "rum")
  .set("ru", "rus")
  .set("sv", "swe")
  .set("th", "tha")
  .set("tr", "tur")
  .set("uk", "ukr")
  .set("vi", "vie")
  .set("zh", "chi");

export const mp4BoxBrandCompatFlags = [
  ["-brand", "mp42"],
  ["-ab", "isom"],
  ["-ab", "dby1"],
].flat();

export const mp4BoxDvheFlags = ["--force_dv", "--xps_inband=all", ["-hdr", "none"]].flat();

export const formatToExtensionMap = new Map<string, string>()
  .set(FORMAT_HEVC, EXTENSION_H265)
  .set(FORMAT_AVC, EXTENSION_H264)
  .set(FORMAT_AC3, EXTENSION_AC3)
  .set(FORMAT_AAC, EXTENSION_AAC)
  .set(FORMAT_DTS, EXTENSION_DTS)
  .set(FORMAT_EAC3, EXTENSION_EAC3)
  .set(FORMAT_TRUE_HD, EXTENSION_TRUE_HD)
  .set(FORMAT_ASS, EXTENSION_ASS)
  .set(FORMAT_PGS, EXTENSION_SUP)
  .set(FORMAT_UTF8, EXTENSION_SRT);

// todo: don't forget to add TrueHD if it gets introduced as a known format
const preferredConvertibleAudioOrder = [
  `${FORMAT_TRUE_HD} 16-ch, Dolby TrueHD with Dolby Atmos`,
  `${FORMAT_DTS} XLL X, DTS-HD MA + DTS:X`,
  `${FORMAT_DTS} XLL, DTS-HD Master Audio`,
  FORMAT_DTS,
];

export const reversedPreferredConvertibleAudioOrder = preferredConvertibleAudioOrder.toReversed();
