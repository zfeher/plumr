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
    readonly formatVersion: number;
    readonly fileSize: number;
    readonly duration: number;
    readonly overallBitrate: number;
    readonly frameRate: number;
    readonly title: string | undefined;
    readonly movie: string | undefined;
    readonly encodedDate: string | undefined;
    readonly encodedApplication: string;
    readonly encodedLibrary: string;
  };

  readonly tracks: readonly Track[];
}

export type Track = VideoTrack | AudioTrack | SubtitleTrack;

export interface VideoTrack {
  readonly type: typeof trackTypeVideo;
  readonly streamOrder: number;
  readonly id: number;
  readonly uniqueId: string;
  readonly format: string;
  readonly formatProfile: string;
  readonly formatLevel: number;
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
  readonly pixelAspectRatio: number;
  readonly displayAspectRatio: number;
  readonly frameRateMode: string;
  readonly frameRate: number;
  readonly colorSpace: string;
  readonly chromaSubsampling: string;
  readonly bitDepth: number;
  readonly streamSize: number;
  readonly title: string | undefined;
  readonly language: string | undefined;
  readonly default: boolean;
  readonly forced: boolean;
}

export interface AudioTrack {
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
  readonly bitRateMode: string | undefined;
  readonly bitRate: number;
  readonly channels: number;
  readonly channelLayout: string;
  readonly samplingRate: number;
  readonly frameRate: number;
  readonly compressionMode: string;
  readonly delay: number;
  readonly videoDelay: number;
  readonly streamSize: number;
  readonly title: string | undefined;
  readonly language: string;
  readonly default: boolean;
  readonly forced: boolean;
}

export interface SubtitleTrack {
  readonly type: typeof trackTypeSubtitle;
  readonly typeorder: number | undefined;
  readonly streamOrder: number;
  readonly id: number;
  readonly uniqueId: string;
  readonly format: string;
  readonly codecId: string;
  readonly duration: number;
  readonly bitRate: number;
  readonly frameRate: number | undefined;
  readonly frameCount: number;
  readonly elementCount: number;
  readonly streamSize: number;
  readonly title: string | undefined;
  readonly language: string;
  readonly default: boolean;
  readonly forced: boolean;
}
