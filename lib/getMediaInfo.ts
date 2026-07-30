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

  // todo: cache data for filepath?

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
  readonly creatingLibrary: CreatingLibraryRaw;
  readonly media: MediaRaw;
}

interface CreatingLibraryRaw {
  readonly name: string;
  readonly version: string;
  readonly url: string;
}

interface MediaRaw {
  readonly "@ref": string;
  readonly track: readonly TrackRaw[];
}

type TrackRaw = GeneralRaw | VideoRaw | AudioRaw | TextRaw | MenuRaw;

interface GeneralRaw {
  readonly "@type": typeof trackTypeGeneral;
  readonly UniqueID: string;
  readonly VideoCount: string;
  readonly AudioCount: string;
  readonly TextCount?: string;
  readonly MenuCount?: string;
  readonly FileExtension: string;
  readonly Format: string;
  readonly Format_Profile?: string;
  readonly Format_Version: string;
  readonly CodecID?: string;
  readonly CodecID_Compatible?: string;
  readonly FileSize: string;
  readonly Duration: string;
  readonly OverallBitRate: string;
  readonly OverallBitRate_Mode?: string;
  readonly FrameRate: string;
  readonly FrameCount: string;
  readonly StreamSize: string;
  readonly IsStreamable: string;
  readonly Title?: string;
  readonly Movie?: string;
  readonly Encoded_Date: string;
  readonly File_Created_Date: string;
  readonly File_Created_Date_Local: string;
  readonly File_Modified_Date: string;
  readonly File_Modified_Date_Local: string;
  readonly Encoded_Application: string;
  readonly Encoded_Library: string;
}

interface VideoRaw {
  readonly "@type": typeof trackTypeVideo;
  readonly StreamOrder: string;
  readonly ID: string;
  readonly UniqueID: string;
  readonly Format: string;
  readonly Format_Profile: string;
  readonly Format_Level: string;
  readonly Format_Tier?: string;
  readonly HDR_Format?: string;
  readonly HDR_Format_Version?: string;
  readonly HDR_Format_Profile?: string;
  readonly HDR_Format_Level?: string;
  readonly HDR_Format_Settings?: string;
  readonly HDR_Format_Compatibility?: string;
  readonly CodecID: string;
  readonly Duration: string;
  readonly BitRate: string;
  readonly Width: string;
  readonly Height: string;
  readonly Sampled_Width: string;
  readonly Sampled_Height: string;
  readonly PixelAspectRatio: string;
  readonly DisplayAspectRatio: string;
  readonly FrameRate_Mode: string;
  readonly FrameRate: string;
  readonly FrameRate_Num: string;
  readonly FrameRate_Den: string;
  readonly FrameCount: string;
  readonly ColorSpace: string;
  readonly ChromaSubsampling: string;
  readonly BitDepth: string;
  readonly Delay: string;
  readonly Delay_Source: string;
  readonly StreamSize: string;
  readonly Language: string;
  readonly Default: string;
  readonly Forced: string;
}

interface AudioRaw {
  readonly "@type": typeof trackTypeAudio;
  readonly StreamOrder: string;
  readonly ID: string;
  readonly UniqueID: string;
  readonly Format: string;
  readonly Format_Commercial_IfAny?: string;
  readonly Format_Settings_Mode?: string;
  readonly Format_Settings_Endianness?: string;
  readonly Format_Settings_SBR?: string;
  readonly Format_AdditionalFeatures?: string;
  readonly CodecID: string;
  readonly Duration: string;
  readonly BitRate_Mode: string;
  readonly BitRate: string;
  readonly Channels?: string;
  readonly ChannelPositions?: string;
  readonly ChannelLayout?: string;
  readonly SamplesPerFrame: string;
  readonly SamplingRate: string;
  readonly SamplingCount: string;
  readonly FrameRate: string;
  readonly FrameCount: string;
  readonly Compression_Mode: string;
  readonly Delay: string;
  readonly Delay_Source: string;
  readonly Video_Delay: string;
  readonly StreamSize: string;
  readonly Title?: string;
  readonly Language: string;
  readonly ServiceKind: string;
  readonly Default: string;
  readonly Forced: string;
  readonly extra: AudioExtraRaw;
}

interface AudioExtraRaw {
  readonly ComplexityIndex: string;
  readonly NumberOfDynamicObjects: string;
  readonly BedChannelCount: string;
  readonly BedChannelConfiguration: string;
  readonly bsid: string;
  readonly dialnorm: string;
  readonly compr: string;
  readonly acmod: string;
  readonly lfeon: string;
  readonly dialnorm_Average: string;
  readonly dialnorm_Minimum: string;
  readonly compr_Average: string;
  readonly compr_Minimum: string;
  readonly compr_Maximum: string;
  readonly compr_Count: string;
}

interface TextRaw {
  readonly "@type": typeof trackTypeText;
  readonly "@typeorder": string;
  readonly StreamOrder: string;
  readonly ID: string;
  readonly UniqueID: string;
  readonly Format: string;
  readonly MuxingMode: string;
  readonly CodecID: string;
  readonly Duration: string;
  readonly BitRate: string;
  readonly FrameRate: string;
  readonly FrameCount: string;
  readonly ElementCount: string;
  readonly StreamSize: string;
  readonly Title: string;
  readonly Language: string;
  readonly Default: string;
  readonly Forced: string;
}

interface MenuRaw {
  readonly "@type": typeof trackTypeMenu;
  readonly extra: Record<string, string>;
}
