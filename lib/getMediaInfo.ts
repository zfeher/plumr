import fs from "node:fs/promises";
import { promisify } from "node:util";
import child_process from "node:child_process";
// oxlint-disable-next-line id-length
import * as v from "valibot";

import type { AudioTrack, MediaInfo, SubtitleTrack, VideoTrack } from "./types.ts";
import {
  trackTypeAudio,
  trackTypeGeneral,
  trackTypeMenu,
  trackTypeSubtitle,
  trackTypeText,
  trackTypeVideo,
} from "./constants.ts";
import { getRecommendedTracks, isAlreadySupportedByTv } from "./common.ts";
import { MediaInfoRaw } from "./schemas.ts";

// oxlint-disable-next-line typescript/strict-void-return
const execFile = promisify(child_process.execFile);

export async function getMediaInfo(
  file: string,
  keepHu: boolean,
): Promise<void | GetMediaInfoResult> {
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

  const mediaInfoCliResult = await execFile("mediainfo", ["--output=JSON", normalizedFile]);
  const parseResult = v.safeParse(MediaInfoRaw, JSON.parse(mediaInfoCliResult.stdout));

  if (!parseResult.success) {
    console.log(parseResult.issues);
    console.log(JSON.stringify(parseResult.issues, null, 2));
    return;
  }

  const rawMediaInfo = parseResult.output;
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
      fileExtension: rawGeneral.FileExtension,
      format: rawGeneral.Format,
      formatVersion: rawGeneral.Format_Version,
      fileSize: rawGeneral.FileSize,
      duration: rawGeneral.Duration,
      overallBitrate: rawGeneral.OverallBitRate,
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
            streamOrder: rawTrack.StreamOrder,
            id: rawTrack.ID,
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
            duration: rawTrack.Duration,
            bitRate: rawTrack.BitRate,
            width: rawTrack.Width,
            height: rawTrack.Height,
            sampledWidth: rawTrack.Sampled_Width,
            sampledHeight: rawTrack.Sampled_Height,
            pixelAspectRatio: rawTrack.PixelAspectRatio,
            displayAspectRatio: rawTrack.DisplayAspectRatio,
            frameRateMode: rawTrack.FrameRate_Mode,
            frameRate: rawTrack.FrameRate,
            colorSpace: rawTrack.ColorSpace,
            chromaSubsampling: rawTrack.ChromaSubsampling,
            bitDepth: rawTrack.BitDepth,
            streamSize: rawTrack.StreamSize,
            title: rawTrack.Title,
            language: rawTrack.Language,
            default: rawTrack.Default,
            forced: rawTrack.Forced,
          } satisfies VideoTrack;
        }

        if (rawTrack["@type"] === trackTypeAudio) {
          return {
            type: trackTypeAudio,
            streamOrder: rawTrack.StreamOrder,
            id: rawTrack.ID,
            uniqueId: rawTrack.UniqueID,
            format: rawTrack.Format,
            formatCommercialIfAny: rawTrack.Format_Commercial_IfAny,
            formatSettings: rawTrack.Format_Settings_Mode,
            formatAdditionalFeatures: rawTrack.Format_AdditionalFeatures,
            codecId: rawTrack.CodecID,
            duration: rawTrack.Duration,
            bitRateMode: rawTrack.BitRate_Mode,
            bitRate: rawTrack.BitRate,
            channels: rawTrack.Channels,
            channelLayout: rawTrack.ChannelLayout,
            samplingRate: rawTrack.SamplingRate,
            frameRate: rawTrack.FrameRate,
            compressionMode: rawTrack.Compression_Mode,
            delay: rawTrack.Delay,
            videoDelay: rawTrack.Video_Delay,
            streamSize: rawTrack.StreamSize,
            title: rawTrack.Title,
            language: rawTrack.Language,
            default: rawTrack.Default,
            forced: rawTrack.Forced,
          } satisfies AudioTrack;
        }

        if (rawTrack["@type"] === trackTypeText) {
          return {
            type: trackTypeSubtitle,
            typeorder: rawTrack["@typeorder"],
            streamOrder: rawTrack.StreamOrder,
            id: rawTrack.ID,
            uniqueId: rawTrack.UniqueID,
            format: rawTrack.Format,
            codecId: rawTrack.CodecID,
            duration: rawTrack.Duration,
            bitRate: rawTrack.BitRate,
            frameRate: rawTrack.FrameRate,
            frameCount: rawTrack.FrameCount,
            elementCount: rawTrack.ElementCount,
            streamSize: rawTrack.StreamSize,
            title: rawTrack.Title,
            language: rawTrack.Language,
            default: rawTrack.Default,
            forced: rawTrack.Forced,
          } satisfies SubtitleTrack;
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

  const recommended = getRecommendedTracks(info.tracks, keepHu);
  const recommendedTrackIds = recommended.tracks.map((track) => track.id);

  const isAlreadySupported = isAlreadySupportedByTv(
    info.general.fileExtension,
    info.tracks,
    keepHu,
  );

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
