import fs from "node:fs/promises";
import { promisify } from "node:util";
import child_process from "node:child_process";

import type { Audio, MediaInfo, Subtitle, Video } from "./types.ts";
import {
  trackTypeAudio,
  trackTypeGeneral,
  trackTypeMenu,
  trackTypeSubtitle,
  trackTypeText,
  trackTypeVideo,
} from "./constants.ts";
import { getRecommendedTracks, isAlreadySupportedByTv } from "./common.ts";

// oxlint-disable-next-line typescript/strict-void-return
const execFile = promisify(child_process.execFile);

export async function getMediaInfo(file: string): Promise<void | GetMediaInfoResult> {
  // note: mediainfo call like this doesn't like `"` wrapper nor `'`!
  // todo: better way? sooner?
  const normalizedFile = file.replace(/^['"]/u, "").replace(/['"]$/u, "");

  const fileStat = await fs.stat(normalizedFile);

  if (fileStat.isDirectory()) {
    // todo: in v2 we could return an array of MediaInfo objects
    console.log("[getMediaInfo]: specified path is a directory");
    return;
  }

  // todo: cache data for filepath

  const result = await execFile("mediainfo", ["--output=JSON", normalizedFile]);

  // todo: Zod or lighter alternative usage (valibot)
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion - todo: resolve properly
  const rawMediaInfo = JSON.parse(result.stdout) as MediaInfoRaw;

  console.log("@@@@ getMediaInfo: raw", JSON.stringify(rawMediaInfo, null, 2));

  const rawGeneral = rawMediaInfo.media.track.find((track) => track["@type"] === trackTypeGeneral);

  if (!rawGeneral) return;

  const hasMenu = rawMediaInfo.media.track.some((track) => track["@type"] === trackTypeMenu);

  const rawTracks = rawMediaInfo.media.track.filter(
    (track) => ![trackTypeGeneral, trackTypeMenu].includes(track["@type"]),
  );

  const info: MediaInfo = {
    hasMenu,

    general: {
      ref: rawMediaInfo.media["@ref"],
      uniqueId: rawGeneral.UniqueID,
      fileExtension: rawGeneral.FileExtension.toLowerCase(),
      format: rawGeneral.Format,
      formatVersion: rawGeneral.Format_Version,
      fileSize: Number(rawGeneral.FileSize),
      duration: Number(rawGeneral.Duration),
      overallBitrate: Number(rawGeneral.OverallBitRate),
      frameRate: rawGeneral.FrameRate,
      title: rawGeneral.Title,
      movie: rawGeneral.Movie,
      encodedDate: rawGeneral.Encoded_Date,
      encodedApplication: rawGeneral.Encoded_Application,
      encodedLibrary: rawGeneral.Encoded_Library,
    },

    tracks: rawTracks
      .map((rawTrack) => {
        if (rawTrack["@type"] === trackTypeVideo) {
          return {
            type: trackTypeVideo,
            streamOrder: Number(rawTrack.StreamOrder),
            id: Number(rawTrack.ID),
            uniqueId: rawTrack.UniqueID,
            format: rawTrack.Format,
            formatProfile: rawTrack.Format_Profile,
            formatLevel: rawTrack.Format_Level,
            formatTier: rawTrack.Format_Tier,
            hdrFormat: rawTrack.HDR_Format,
            hdrFormatVersion: rawTrack.HDR_Format_Version,
            hdrFormatProfile: rawTrack.HDR_Format_Profile,
            hdrFormatLevel: rawTrack.HDR_Format_Level,
            hdrFormatSettings: rawTrack.HDR_Format_Settings,
            hdrFormatCompatibility: rawTrack.HDR_Format_Compatibility,
            codecId: rawTrack.CodecID,
            duration: Number(rawTrack.Duration),
            bitRate: Number(rawTrack.BitRate),
            width: Number(rawTrack.Width),
            height: Number(rawTrack.Height),
            sampledWidth: Number(rawTrack.Sampled_Width),
            sampledHeight: Number(rawTrack.Sampled_Height),
            pixelAspectRatio: rawTrack.PixelAspectRatio,
            displayAspectRatio: rawTrack.DisplayAspectRatio,
            frameRateMode: rawTrack.FrameRate_Mode,
            frameRate: rawTrack.FrameRate,
            colorSpace: rawTrack.ColorSpace,
            chromaSubsampling: rawTrack.ChromaSubsampling,
            bitDepth: Number(rawTrack.BitDepth),
            streamSize: Number(rawTrack.StreamSize),
            language: rawTrack.Language,
            default: /yes/iu.test(rawTrack.Default),
            forced: /yes/iu.test(rawTrack.Forced),
          } satisfies Video;
        }

        if (rawTrack["@type"] === trackTypeAudio) {
          return {
            type: trackTypeAudio,
            streamOrder: Number(rawTrack.StreamOrder),
            id: Number(rawTrack.ID),
            uniqueId: rawTrack.UniqueID,
            format: rawTrack.Format,
            formatCommercialIfAny: rawTrack.Format_Commercial_IfAny,
            formatSettings: rawTrack.Format_Settings_Mode,
            formatAdditionalFeatures: rawTrack.Format_AdditionalFeatures,
            codecId: rawTrack.CodecID,
            duration: Number(rawTrack.Duration),
            bitRateMode: rawTrack.BitRate_Mode,
            bitRate: Number(rawTrack.BitRate),
            channels: rawTrack.Channels ? Number(rawTrack.Channels) : undefined,
            channelLayout: rawTrack.ChannelLayout,
            samplingRate: Number(rawTrack.SamplingRate),
            frameRate: rawTrack.FrameRate,
            compressionMode: rawTrack.Compression_Mode,
            delay: Number(rawTrack.Delay),
            videoDelay: Number(rawTrack.Video_Delay),
            streamSize: Number(rawTrack.StreamSize),
            title: rawTrack.Title,
            language: rawTrack.Language,
            default: /yes/iu.test(rawTrack.Default),
            forced: /yes/iu.test(rawTrack.Forced),
          } satisfies Audio;
        }

        if (rawTrack["@type"] === trackTypeText) {
          return {
            type: trackTypeSubtitle,
            typeorder: Number(rawTrack["@typeorder"]),
            streamOrder: Number(rawTrack.StreamOrder),
            id: Number(rawTrack.ID),
            uniqueId: rawTrack.UniqueID,
            format: rawTrack.Format,
            muxingMode: rawTrack.MuxingMode,
            codecId: rawTrack.CodecID,
            duration: rawTrack.Duration,
            bitRate: Number(rawTrack.BitRate),
            frameRate: Number(rawTrack.FrameRate),
            frameCount: Number(rawTrack.FrameCount),
            elementCount: Number(rawTrack.ElementCount),
            streamSize: Number(rawTrack.StreamSize),
            title: rawTrack.Title,
            language: rawTrack.Language,
            default: /yes/iu.test(rawTrack.Default),
            forced: /yes/iu.test(rawTrack.Forced),
          } satisfies Subtitle;
        }

        throw new Error(`Unsupported track type (${rawTrack["@type"]}).`);
      })
      // note: just in case :)
      //  we sort by stream order to have the same order like medi info orders tracks
      .toSorted((trackA, trackB) => {
        if (trackA.streamOrder === trackB.streamOrder) return 0;
        return trackA.streamOrder < trackB.streamOrder ? -1 : 1;
      }),
  };

  const recommended = getRecommendedTracks(info.tracks);
  const recommendedTrackIds = recommended.tracks.map((track) => track.id);

  const isAlreadySupported = isAlreadySupportedByTv(info.general.fileExtension, info.tracks);

  const isTrackAndStreamOrderDifferent = info.tracks.some(
    (track) => track.id - 1 !== track.streamOrder,
  );

  // console.log('@@@@ getMediaInfo: info', JSON.stringify(info, null, 2));
  // console.log('@@@@ getMediaInfo: recommendedTrackIds', JSON.stringify(recommendedTrackIds, null, 2));
  return {
    info,
    recommendedTrackIds,
    hasRecommendedVideo: recommended.hasRecommendedVideo,
    hasRecommendedAudio: recommended.hasRecommendedAudio,
    hasRecommendedSubtitle: recommended.hasRecommendedSubtitle,
    hasSubtitleTracks: recommended.hasSubtitleTracks,
    hasForeignAudioOnly: recommended.hasForeignAudioOnly,
    isAlreadySupported,
    isTrackAndStreamOrderDifferent,
  };
}

interface GetMediaInfoResult {
  readonly info: MediaInfo;
  readonly recommendedTrackIds: readonly number[];
  readonly hasRecommendedVideo: boolean;
  readonly hasRecommendedAudio: boolean;
  readonly hasRecommendedSubtitle: boolean;
  readonly hasSubtitleTracks: boolean;
  readonly hasForeignAudioOnly: boolean;
  readonly isAlreadySupported: boolean;
  readonly isTrackAndStreamOrderDifferent: boolean;
}

interface MediaInfoRaw {
  creatingLibrary: CreatingLibraryRaw;
  media: MediaRaw;
}

interface CreatingLibraryRaw {
  name: string;
  version: string;
  url: string;
}

interface MediaRaw {
  "@ref": string;
  track: TrackRaw[];
}

type TrackRaw = GeneralRaw | VideoRaw | AudioRaw | TextRaw | MenuRaw;

interface GeneralRaw {
  "@type": typeof trackTypeGeneral;
  UniqueID: string;
  VideoCount: string;
  AudioCount: string;
  TextCount?: string;
  MenuCount?: string;
  FileExtension: string;
  Format: string;
  Format_Profile?: string;
  Format_Version: string;
  CodecID?: string;
  CodecID_Compatible?: string;
  FileSize: string;
  Duration: string;
  OverallBitRate: string;
  OverallBitRate_Mode?: string;
  FrameRate: string;
  FrameCount: string;
  StreamSize: string;
  IsStreamable: string;
  Title?: string;
  Movie?: string;
  Encoded_Date: string;
  File_Created_Date: string;
  File_Created_Date_Local: string;
  File_Modified_Date: string;
  File_Modified_Date_Local: string;
  Encoded_Application: string;
  Encoded_Library: string;
}

interface VideoRaw {
  "@type": typeof trackTypeVideo;
  StreamOrder: string;
  ID: string;
  UniqueID: string;
  Format: string;
  Format_Profile: string;
  Format_Level: string;
  Format_Tier?: string;
  HDR_Format?: string;
  HDR_Format_Version?: string;
  HDR_Format_Profile?: string;
  HDR_Format_Level?: string;
  HDR_Format_Settings?: string;
  HDR_Format_Compatibility?: string;
  CodecID: string;
  Duration: string;
  BitRate: string;
  Width: string;
  Height: string;
  Sampled_Width: string;
  Sampled_Height: string;
  PixelAspectRatio: string;
  DisplayAspectRatio: string;
  FrameRate_Mode: string;
  FrameRate: string;
  FrameRate_Num: string;
  FrameRate_Den: string;
  FrameCount: string;
  ColorSpace: string;
  ChromaSubsampling: string;
  BitDepth: string;
  Delay: string;
  Delay_Source: string;
  StreamSize: string;
  Language: string;
  Default: string;
  Forced: string;
}

interface AudioRaw {
  "@type": typeof trackTypeAudio;
  StreamOrder: string;
  ID: string;
  UniqueID: string;
  Format: string;
  Format_Commercial_IfAny?: string;
  Format_Settings_Mode?: string;
  Format_Settings_Endianness?: string;
  Format_Settings_SBR?: string;
  Format_AdditionalFeatures?: string;
  CodecID: string;
  Duration: string;
  BitRate_Mode: string;
  BitRate: string;
  Channels?: string;
  ChannelPositions?: string;
  ChannelLayout?: string;
  SamplesPerFrame: string;
  SamplingRate: string;
  SamplingCount: string;
  FrameRate: string;
  FrameCount: string;
  Compression_Mode: string;
  Delay: string;
  Delay_Source: string;
  Video_Delay: string;
  StreamSize: string;
  Title?: string;
  Language: string;
  ServiceKind: string;
  Default: string;
  Forced: string;
  extra: AudioExtraRaw;
}

interface AudioExtraRaw {
  ComplexityIndex: string;
  NumberOfDynamicObjects: string;
  BedChannelCount: string;
  BedChannelConfiguration: string;
  bsid: string;
  dialnorm: string;
  compr: string;
  acmod: string;
  lfeon: string;
  dialnorm_Average: string;
  dialnorm_Minimum: string;
  compr_Average: string;
  compr_Minimum: string;
  compr_Maximum: string;
  compr_Count: string;
}

interface TextRaw {
  "@type": typeof trackTypeText;
  "@typeorder": string;
  StreamOrder: string;
  ID: string;
  UniqueID: string;
  Format: string;
  MuxingMode: string;
  CodecID: string;
  Duration: string;
  BitRate: string;
  FrameRate: string;
  FrameCount: string;
  ElementCount: string;
  StreamSize: string;
  Title: string;
  Language: string;
  Default: string;
  Forced: string;
}

interface MenuRaw {
  "@type": typeof trackTypeMenu;
  extra: Record<string, string>;
}
