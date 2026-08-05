// oxlint-disable-next-line id-length
import * as v from "valibot";
import {
  trackTypeGeneral,
  trackTypeVideo,
  trackTypeAudio,
  trackTypeText,
  trackTypeMenu,
  MP4BOX_MODE_IMPORT_SELECTED_ONLY,
  MP4BOX_MODE_IMPORT_ALL_THEN_REMOVE,
  MP4BOX_MODE_DEMUX_ALL,
  DEFAULT_OUTPUT_FOLDER,
  DEFAULT_TEMP_FOLDER,
  DEFAULT_MP4BOX_MODE,
  mediaExtensions,
  mediaFormats,
  videoFormats,
  audioFormats,
  subtitleFormats,
} from "./constants.ts";

const OpStringSchema = v.exactOptional(v.string());
const NumberSchema = v.pipe(v.string(), v.toNumber());
const OpNumberSchema = v.exactOptional(NumberSchema);
const IntegerSchema = v.pipe(NumberSchema, v.integer());
const OpIntegerSchema = v.exactOptional(IntegerSchema);
const Str2BooleanSchema = v.pipe(v.string(), v.parseBoolean());
const OpStr2BooleanSchema = v.exactOptional(Str2BooleanSchema);
const NonEmptyStringSchema = v.pipe(v.string(), v.nonEmpty());
const OpNonEmptyStringSchema = v.exactOptional(NonEmptyStringSchema);

const ArgsValues = v.pipe(
  v.strictObject({
    help: v.fallback(v.boolean(), false),
    input: OpNonEmptyStringSchema,
    "keep-hu": v.fallback(v.boolean(), false),
    output: v.fallback(NonEmptyStringSchema, DEFAULT_OUTPUT_FOLDER),
    "temp-folder": v.fallback(NonEmptyStringSchema, DEFAULT_TEMP_FOLDER),

    "mp4box-mode": v.fallback(
      v.picklist([
        MP4BOX_MODE_IMPORT_SELECTED_ONLY,
        MP4BOX_MODE_IMPORT_ALL_THEN_REMOVE,
        MP4BOX_MODE_DEMUX_ALL,
      ]),
      DEFAULT_MP4BOX_MODE,
    ),
  }),
  v.readonly(),
);

export const Args = v.pipe(
  v.strictObject({
    values: ArgsValues,
    positionals: v.pipe(v.array(v.string()), v.empty(), v.readonly()),
  }),
  v.readonly(),
);

type Args = v.InferOutput<typeof Args>;

const GeneralTrackExtraRaw = v.pipe(
  v.strictObject({
    ErrorDetectionType: OpStringSchema,
    Attachments: OpStringSchema,
    IMDB: OpStringSchema,
    TMDB: OpStringSchema,
  }),
  v.readonly(),
);

type GeneralTrackExtraRaw = v.InferOutput<typeof GeneralTrackExtraRaw>;

const GeneralTrackRaw = v.pipe(
  v.strictObject({
    "@type": v.literal(trackTypeGeneral),
    UniqueID: v.string(),
    VideoCount: IntegerSchema,
    AudioCount: IntegerSchema,
    TextCount: IntegerSchema,
    MenuCount: OpIntegerSchema,
    FileExtension: v.pipe(v.string(), v.toLowerCase(), v.picklist(mediaExtensions)),
    Format: v.pipe(v.string(), v.picklist(mediaFormats)),
    Format_Version: IntegerSchema,
    FileSize: IntegerSchema,
    Duration: NumberSchema,
    OverallBitRate: IntegerSchema,
    FrameRate: NumberSchema,
    FrameCount: IntegerSchema,
    StreamSize: OpIntegerSchema,
    IsStreamable: Str2BooleanSchema,
    Title: OpStringSchema,
    Movie: OpStringSchema,
    Encoded_Date: OpStringSchema,
    File_Created_Date: v.string(),
    File_Created_Date_Local: v.string(),
    File_Modified_Date: v.string(),
    File_Modified_Date_Local: v.string(),
    Encoded_Application: v.string(),
    Encoded_Application_Name: OpStringSchema,
    Encoded_Application_Version: OpStringSchema,
    Encoded_Library: v.string(),
    extra: v.exactOptional(GeneralTrackExtraRaw),
  }),
  v.readonly(),
);

type GeneralTrackRaw = v.InferOutput<typeof GeneralTrackRaw>;

const VideoTrackRaw = v.pipe(
  v.strictObject({
    "@type": v.literal(trackTypeVideo),
    StreamOrder: IntegerSchema,
    ID: IntegerSchema,
    UniqueID: v.string(),
    Format: v.pipe(v.string(), v.picklist(videoFormats)),
    Format_Profile: v.string(),
    Format_Level: NumberSchema,
    Format_Settings_CABAC: OpStr2BooleanSchema,
    Format_Settings_RefFrames: OpIntegerSchema,
    Format_Settings_SliceCount: OpIntegerSchema,
    Format_Tier: OpStringSchema,
    HDR_Format: OpStringSchema,
    HDR_Format_Version: OpStringSchema,
    HDR_Format_Profile: OpStringSchema,
    HDR_Format_Level: OpStringSchema,
    HDR_Format_Settings: OpStringSchema,
    HDR_Format_Compression: OpStringSchema,
    HDR_Format_Compatibility: OpStringSchema,
    CodecID: v.string(),
    Duration: NumberSchema,
    BitRate_Mode: OpStringSchema,
    BitRate: IntegerSchema,
    BitRate_Nominal: OpIntegerSchema,
    Width: IntegerSchema,
    Height: IntegerSchema,
    Stored_Width: OpIntegerSchema,
    Stored_Height: OpIntegerSchema,
    Sampled_Width: IntegerSchema,
    Sampled_Height: IntegerSchema,
    PixelAspectRatio: NumberSchema,
    DisplayAspectRatio: NumberSchema,
    FrameRate_Mode: v.string(),
    FrameRate_Mode_Original: OpStringSchema,
    FrameRate: NumberSchema,
    FrameRate_Num: OpIntegerSchema,
    FrameRate_Den: OpIntegerSchema,
    FrameCount: IntegerSchema,
    ColorSpace: v.string(),
    ChromaSubsampling: v.string(),
    ChromaSubsampling_Position: OpStringSchema,
    BitDepth: IntegerSchema,
    ScanType: OpStringSchema,
    Delay: NumberSchema,
    Delay_Source: v.string(),
    StreamSize: IntegerSchema,
    Title: OpStringSchema,
    Encoded_Library: OpStringSchema,
    Encoded_Library_Name: OpStringSchema,
    Encoded_Library_Version: OpStringSchema,
    Encoded_Library_Settings: OpStringSchema,
    Language: OpStringSchema,
    Default: Str2BooleanSchema,
    Forced: Str2BooleanSchema,
    BufferSize: OpIntegerSchema,
    colour_description_present: OpStr2BooleanSchema,
    colour_description_present_Source: OpStringSchema,
    colour_range: OpStringSchema,
    colour_range_Source: OpStringSchema,
    colour_primaries: OpStringSchema,
    colour_primaries_Source: OpStringSchema,
    transfer_characteristics: OpStringSchema,
    transfer_characteristics_Source: OpStringSchema,
    matrix_coefficients: OpStringSchema,
    matrix_coefficients_Source: OpStringSchema,
    MasteringDisplay_ColorPrimaries: OpStringSchema,
    MasteringDisplay_ColorPrimaries_Source: OpStringSchema,
    MasteringDisplay_Luminance: OpStringSchema,
    MasteringDisplay_Luminance_Source: OpStringSchema,
    MasteringDisplay_Luminance_Min: OpNumberSchema,
    MasteringDisplay_Luminance_Max: OpIntegerSchema,
    MaxCLL: OpIntegerSchema,
    MaxCLL_Source: OpStringSchema,
    MaxFALL: OpIntegerSchema,
    MaxFALL_Source: OpStringSchema,
  }),
  v.readonly(),
);

type VideoTrackRaw = v.InferOutput<typeof VideoTrackRaw>;

const AudioTrackExtraRaw = v.pipe(
  v.strictObject({
    ComplexityIndex: OpIntegerSchema,
    NumberOfDynamicObjects: OpIntegerSchema,
    BedChannelCount: OpIntegerSchema,
    BedChannelConfiguration: OpStringSchema,
    Source: OpStringSchema,
    bsid: IntegerSchema,
    dialnorm: IntegerSchema,
    compr: OpNumberSchema,
    dsurmod: OpIntegerSchema,
    acmod: v.string(),
    lfeon: OpStringSchema,
    mixlevel: OpIntegerSchema,
    roomtyp: OpStringSchema,
    cmixlev: OpNumberSchema,
    surmixlev: OpStringSchema,
    dmixmod: OpStringSchema,
    ltrtcmixlev: OpNumberSchema,
    ltrtsurmixlev: OpNumberSchema,
    lorocmixlev: OpNumberSchema,
    lorosurmixlev: OpNumberSchema,
    dialnorm_Average: IntegerSchema,
    dialnorm_Minimum: IntegerSchema,
    compr_Average: OpNumberSchema,
    compr_Minimum: OpNumberSchema,
    compr_Maximum: OpNumberSchema,
    compr_Count: OpIntegerSchema,
    dynrng_Average: OpNumberSchema,
    dynrng_Minimum: OpNumberSchema,
    dynrng_Maximum: OpNumberSchema,
    dynrng_Count: OpNumberSchema,
  }),
  v.readonly(),
);

type AudioTrackExtraRaw = v.InferOutput<typeof AudioTrackExtraRaw>;

const AudioTrackRaw = v.pipe(
  v.strictObject({
    "@type": v.literal(trackTypeAudio),
    "@typeorder": OpIntegerSchema,
    StreamOrder: IntegerSchema,
    ID: IntegerSchema,
    UniqueID: v.string(),
    Format: v.pipe(v.string(), v.picklist(audioFormats)),
    Format_Commercial_IfAny: OpStringSchema,
    Format_Settings_Mode: OpStringSchema,
    Format_Settings_Endianness: OpStringSchema,
    Format_AdditionalFeatures: OpStringSchema,
    CodecID: v.string(),
    Duration: NumberSchema,
    BitRate_Mode: OpStringSchema,
    BitRate: IntegerSchema,
    Channels: IntegerSchema,
    ChannelPositions: v.string(),
    ChannelLayout: v.string(),
    SamplesPerFrame: IntegerSchema,
    SamplingRate: IntegerSchema,
    SamplingCount: IntegerSchema,
    FrameRate: NumberSchema,
    FrameCount: IntegerSchema,
    Compression_Mode: v.string(),
    Delay: NumberSchema,
    Delay_Source: v.string(),
    Video_Delay: NumberSchema,
    StreamSize: IntegerSchema,
    Title: OpStringSchema,
    Language: v.string(), // en, eng, en-US, en-AU, hu, hun, hu-HU ...
    ServiceKind: OpStringSchema,
    Default: Str2BooleanSchema,
    Forced: Str2BooleanSchema,
    extra: v.exactOptional(AudioTrackExtraRaw),
  }),
  v.readonly(),
);

type AudioTrackRaw = v.InferOutput<typeof AudioTrackRaw>;

const TextTrackExtraRaw = v.pipe(
  v.strictObject({
    Source: OpStringSchema,
  }),
  v.readonly(),
);

type TextTrackExtraRaw = v.InferOutput<typeof TextTrackExtraRaw>;

const TextTrackRaw = v.pipe(
  v.strictObject({
    "@type": v.literal(trackTypeText),
    "@typeorder": OpIntegerSchema,
    StreamOrder: IntegerSchema,
    ID: IntegerSchema,
    UniqueID: v.string(),
    Format: v.pipe(v.string(), v.picklist(subtitleFormats)),
    MuxingMode: OpStringSchema,
    CodecID: v.string(),
    Duration: NumberSchema,
    BitRate: IntegerSchema,
    FrameRate: OpNumberSchema,
    FrameCount: IntegerSchema,
    ElementCount: IntegerSchema,
    Compression_Mode: OpStringSchema,
    StreamSize: IntegerSchema,
    Title: OpStringSchema,
    Language: v.string(), // hu, hun, hu-HU, ...
    ServiceKind: OpStringSchema,
    Default: Str2BooleanSchema,
    Forced: Str2BooleanSchema,
    extra: v.exactOptional(TextTrackExtraRaw),
  }),
  v.readonly(),
);

type TextTrackRaw = v.InferOutput<typeof TextTrackRaw>;

const MenuTrackRaw = v.pipe(
  v.strictObject({
    "@type": v.literal(trackTypeMenu),
    "@typeorder": OpIntegerSchema,
    extra: v.pipe(v.record(v.string(), v.string()), v.readonly()),
  }),
  v.readonly(),
);

type MenuTrackRaw = v.InferOutput<typeof MenuTrackRaw>;

const TrackRaw = v.variant("@type", [
  GeneralTrackRaw,
  VideoTrackRaw,
  AudioTrackRaw,
  TextTrackRaw,
  MenuTrackRaw,
]);

type TrackRaw = v.InferOutput<typeof TrackRaw>;

const MediaRaw = v.pipe(
  v.strictObject({
    "@ref": v.string(),
    track: v.pipe(v.array(TrackRaw), v.readonly()),
  }),
  v.readonly(),
);

type MediaRaw = v.InferOutput<typeof MediaRaw>;

const CreatingLibraryRaw = v.pipe(
  v.strictObject({
    name: v.string(),
    version: v.string(),
    url: v.string(),
  }),
  v.readonly(),
);

type CreatingLibraryRaw = v.InferOutput<typeof CreatingLibraryRaw>;

export const MediaInfoRaw = v.pipe(
  v.strictObject({
    creatingLibrary: CreatingLibraryRaw,
    media: MediaRaw,
  }),
  v.readonly(),
);

export type MediaInfoRaw = v.InferOutput<typeof MediaInfoRaw>;
