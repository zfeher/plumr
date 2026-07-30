import type {
  MP4BOX_MODE_DEMUX_ALL,
  MP4BOX_MODE_IMPORT_ALL_THEN_REMOVE,
  MP4BOX_MODE_IMPORT_SELECTED_ONLY,
  trackTypeAudio,
  trackTypeSubtitle,
  trackTypeVideo,
} from "./constants.ts";

export type Mp4BoxMode =
  | typeof MP4BOX_MODE_IMPORT_SELECTED_ONLY
  | typeof MP4BOX_MODE_IMPORT_ALL_THEN_REMOVE
  | typeof MP4BOX_MODE_DEMUX_ALL;

export interface MediaInfo {
  readonly hasMenu: boolean;

  readonly general: {
    readonly ref: string;
    readonly uniqueId: string;
    readonly fileExtension: string;
    readonly format: string;
    readonly formatVersion: string;
    readonly fileSize: number;
    readonly duration: number;
    readonly overallBitrate: number;
    readonly frameRate: string;
    readonly title: string | undefined;
    readonly movie: string | undefined;
    readonly encodedDate: string;
    readonly encodedApplication: string;
    readonly encodedLibrary: string;
  };

  readonly tracks: readonly Track[];
}

export type Track = Video | Audio | Subtitle;

export interface Video {
  readonly type: typeof trackTypeVideo;
  readonly streamOrder: number;
  readonly id: number;
  readonly uniqueId: string;
  readonly format: string;
  readonly formatProfile: string;
  readonly formatLevel: string;
  readonly formatTier: string | undefined;
  readonly hdrFormat: string | undefined;
  readonly hdrFormatVersion: string | undefined;
  readonly hdrFormatProfile: string | undefined;
  readonly hdrFormatLevel: string | undefined;
  readonly hdrFormatSettings: string | undefined;
  readonly hdrFormatCompatibility: string | undefined;
  readonly codecId: string;
  readonly duration: number;
  readonly bitRate: number;
  readonly width: number;
  readonly height: number;
  readonly sampledWidth: number;
  readonly sampledHeight: number;
  readonly pixelAspectRatio: string;
  readonly displayAspectRatio: string;
  readonly frameRateMode: string;
  readonly frameRate: string;
  readonly colorSpace: string;
  readonly chromaSubsampling: string;
  readonly bitDepth: number;
  readonly streamSize: number;
  readonly language: string;
  readonly default: boolean;
  readonly forced: boolean;
}

export interface Audio {
  readonly type: typeof trackTypeAudio;
  readonly streamOrder: number;
  readonly id: number;
  readonly uniqueId: string;
  readonly format: string;
  readonly formatCommercialIfAny: string | undefined;
  readonly formatSettings: string | undefined;
  readonly formatAdditionalFeatures: string | undefined;
  readonly codecId: string;
  readonly duration: number;
  readonly bitRateMode: string;
  readonly bitRate: number;
  readonly channels: number | undefined;
  readonly channelLayout: string | undefined;
  readonly samplingRate: number;
  readonly frameRate: string;
  readonly compressionMode: string;
  readonly delay: number;
  readonly videoDelay: number;
  readonly streamSize: number;
  readonly title: string | undefined;
  readonly language: string;
  readonly default: boolean;
  readonly forced: boolean;
}

export interface Subtitle {
  readonly type: typeof trackTypeSubtitle;
  readonly typeorder: number;
  readonly streamOrder: number;
  readonly id: number;
  readonly uniqueId: string;
  readonly format: string;
  readonly muxingMode: string;
  readonly codecId: string;
  readonly duration: string;
  readonly bitRate: number;
  readonly frameRate: number;
  readonly frameCount: number;
  readonly elementCount: number;
  readonly streamSize: number;
  readonly title: string;
  readonly language: string;
  readonly default: boolean;
  readonly forced: boolean;
}
