import { z } from 'zod';

export const ROLES = ['DEL', 'GND', 'TWR', 'APP', 'CTR'] as const;
export type Role = (typeof ROLES)[number];

export const FREQ_RE = /^1[1-3][0-9]\.[0-9]{2,3}$/;
const Freq = z.string().regex(FREQ_RE, 'frequency must match 1[1-3]x.xx(x)');
/** VOR/ILS band, used for localizer frequencies. */
const NavFreq = z.string().regex(/^1(0[89]|1[0-7])\.[0-9]{1,3}$/, 'nav frequency must be 108.00–117.95');
const Rwy = z.string().regex(/^([0-9]|[1-3][0-9])[LCR]?$/, 'runway designator');
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Hhmm = z.string().regex(/^([01][0-9]|2[0-3])[0-5][0-9]$/);

/** `doc-id` or `doc-id#section` → { doc, sec } */
const SrcRef = z
  .string()
  .regex(/^[a-z0-9-]+(#.+)?$/, 'src must be "<doc-id>" or "<doc-id>#<section>"')
  .transform((s) => {
    const i = s.indexOf('#');
    return i < 0 ? { doc: s } : { doc: s.slice(0, i), sec: s.slice(i + 1) };
  });
export type Src = { doc: string; sec?: string };
const Srcs = z.union([SrcRef, z.array(SrcRef).min(1)]).transform((v) => (Array.isArray(v) ? v : [v]));
const FlagId = z.string().regex(/^D\d+$/);
/** flag id → field paths (empty = whole record) */
const Flags = z.record(FlagId, z.array(z.string())).optional();

const withSrc = { src: Srcs };

export const DocSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string(),
    short: z.string(),
    category: z.enum(['policy', 'sop', 'loa', 'reference', 'misc', 'vatis', 'external']),
    version: z.string().optional(),
    revised: Day.optional(),
    airac: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
    site_id: z.string().uuid().optional(),
    site_updated: Day.optional(),
    url: z.string().url().optional(),
    used_by: z.array(z.enum(ROLES)).default([]),
  })
  .strict();

const Fact = z.object({ label: z.string(), value: z.string(), src: Srcs, flag: FlagId.optional() }).strict();
const Hours = z.object({ days: z.string().regex(/^(daily|Mon|Tue|Wed|Thu|Fri|Sat|Sun)(-(Mon|Tue|Wed|Thu|Fri|Sat|Sun))?$/), open: Hhmm, close: Hhmm }).strict();

export const AirportSchema = z
  .object({
    id: z.string(),
    icao: z.string(),
    name: z.string(),
    group: z.enum(['major', 'minor', 'satellite']),
    tracon: z.string(),
    class: z.enum(['B', 'C', 'D']).optional(),
    elevation: z.number().optional(),
    dtpp: z
      .string()
      .regex(/^\d{5}$/)
      .optional(),
    runways: z.array(Rwy),
    calm_flow: z.string().optional(),
    pdc: z.boolean().default(false),
    uncontrolled: z.boolean().default(false),
    /** Tower open 24/7 — only set where a document says so. */
    h24: z.boolean().default(false),
    hours: z.array(Hours).optional(),
    initial_alt: z.object({ jet: z.number(), prop: z.number(), text: z.string(), src: Srcs, flag: FlagId.optional() }).strict().optional(),
    release: z
      .object({ type: z.enum(['per_aircraft', 'automatic']), text: z.string(), src: Srcs })
      .strict()
      .optional(),
    dep_freq_order: z
      .object({ src: Srcs, rows: z.array(z.object({ label: z.string(), freq: Freq }).strict()) })
      .strict()
      .optional(),
    facts: z.array(Fact).default([]),
    approaches: z
      .object({
        src: Srcs,
        rows: z.array(
          z
            .object({
              rwy: Rwy,
              iaf: z.string(),
              alt: z.number().optional(),
              freq: NavFreq.optional(),
              nav: z.string().optional(),
              cat23: z.boolean().optional(),
            })
            .strict(),
        ),
      })
      .strict()
      .optional(),
    procedures: z.array(z.object({ role: z.enum(ROLES), src: Srcs, items: z.array(z.string()) }).strict()).default([]),
    ...withSrc,
  })
  .strict();

export const PositionSchema = z
  .object({
    id: z.string(),
    facility: z.string(),
    role: z.enum(['DEL', 'GND', 'TWR', 'APP', 'DEP', 'CTR', 'ATIS']),
    name: z.string(),
    radio: z.string().optional(),
    callsign: z.string().optional(),
    symbol: z.string().optional(),
    freq: Freq,
    primary: z.boolean().default(false),
    side: z.enum(['east', 'west']).optional(),
    owns: z.string().optional(),
    note: z.string().optional(),
    ...withSrc,
  })
  .strict();

export const FlowSchema = z
  .object({
    airport: z.string(),
    id: z.string(),
    name: z.string(),
    depart: z.array(Rwy),
    arrive: z.array(Rwy),
    optional: z.array(Rwy).default([]),
    notes: z.array(z.string()).default([]),
    flag: FlagId.optional(),
    ...withSrc,
  })
  .strict();

const Availability = z.enum(['always', 'night', 'coord']);
export const SidSchema = z
  .object({
    name: z.string(),
    base: z.string(),
    airport: z.string(),
    rnav: z.boolean(),
    jets_only: z.boolean(),
    say: z.string().optional(),
    transition: z.string().optional(),
    fix: z.record(Rwy, z.string()),
    /** Same fixes as printed on the airport's RNAV Departure Reference (cross-check only). */
    dep_ref: z.record(Rwy, z.string()).optional(),
    fix_9_27: z.string().optional(),
    fix_9_27_text: z.string().optional(),
    waypoint: z.string().optional(),
    gate: z.string().optional(),
    direction: z.enum(['N', 'E', 'S', 'W']).optional(),
    side: z.enum(['east', 'west']).optional(),
    preferred: z.record(z.string(), Rwy).optional(),
    availability: Availability,
    notes: z.array(z.string()).default([]),
    flags: Flags,
    ...withSrc,
  })
  .strict();

export const ElvisSchema = z
  .object({
    name: z.string(),
    direction: z.enum(['N', 'E', 'S', 'W']),
    side: z.enum(['east', 'west']),
    availability: Availability,
    availability_note: z.string().optional(),
    ...withSrc,
  })
  .strict();

export const StarSchema = z
  .object({
    name: z.string(),
    alias: z.string().optional(),
    airport: z.string(),
    type: z.enum(['rnav', 'conventional', 'atc_assigned']),
    runways: z.array(Rwy),
    chart: z.string().optional(),
    flags: Flags,
    ...withSrc,
  })
  .strict();

export const HeadingRuleSchema = z
  .object({
    airport: z.string(),
    flow: z.string().optional(),
    runways: z.array(Rwy).optional(),
    aircraft: z.enum(['jet', 'prop', 'any']),
    side: z.enum(['east', 'west']).optional(),
    group: z.string(),
    heading: z.union([z.number().int().min(1).max(360), z.string(), z.record(Rwy, z.number().int())]),
    sids: z.array(z.string()).default([]),
    elvis: z.array(z.string()).default([]),
    note: z.string().optional(),
    ...withSrc,
  })
  .strict();

export const TaxiRuleSchema = z
  .object({
    airport: z.string(),
    direction: z.enum(['N', 'E', 'S', 'W']),
    printed: z.string(),
    north: z.array(Rwy),
    south: z.array(Rwy),
    flags: Flags,
    ...withSrc,
  })
  .strict();

export const ApproachDataSchema = z
  .object({
    feeder_altitudes: z
      .object({
        airport: z.string(),
        speed: z.string(),
        src: Srcs,
        rows: z.array(z.object({ traffic: z.string(), are: z.number(), arw: z.number(), note: z.string().optional() }).strict()),
      })
      .strict(),
    scratchpads: z.array(
      z.object({ facility: z.string(), kind: z.literal('primary'), runway: Rwy, visual: z.string(), instrument: z.string(), ...withSrc }).strict(),
    ),
    secondary_scratchpads: z.array(z.object({ facility: z.string(), code: z.string(), meaning: z.string(), ...withSrc }).strict()),
    satellite_scratchpads: z.array(z.object({ facility: z.string(), code: z.string(), meaning: z.string(), ...withSrc }).strict()),
  })
  .strict();

export const EnrouteSchema = z
  .object({
    sectors: z.array(
      z
        .object({
          id: z.string().regex(/^\d{2}$/),
          name: z.string(),
          callsign: z.string(),
          freq: Freq,
          stratum: z.enum(['lo', 'hi', 'uh']),
          note: z.string().optional(),
          flags: Flags,
          ...withSrc,
        })
        .strict(),
    ),
    splits: z.array(
      z
        .object({
          stratum: z.enum(['area', 'lo', 'hi', 'uh']),
          ways: z.number().int().min(1).max(4),
          label: z.string(),
          positions: z.array(
            z
              .object({ sector: z.string(), areas: z.array(z.number().int().min(1).max(6)).optional(), freq: Freq.optional(), flag: FlagId.optional() })
              .strict(),
          ),
          ...withSrc,
        })
        .strict(),
    ),
    neighbours: z.array(z.object({ id: z.string(), name: z.string(), freq: Freq, loa: z.string(), ...withSrc }).strict()),
    loa_rules: z.array(z.object({ neighbour: z.string(), destination: z.string(), restriction: z.string(), ...withSrc }).strict()),
    arrival_restrictions: z.array(z.object({ destination: z.string(), aircraft: z.string(), restriction: z.string(), ...withSrc }).strict()),
  })
  .strict();

export const AitSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    areas: z.array(z.number().int().min(1).max(6)).min(1),
    sectors: z.array(z.string()),
    steps: z.array(z.string()).min(1),
    flag: FlagId.optional(),
    ...withSrc,
  })
  .strict();

export const RuleSchema = z
  .object({
    id: z.string(),
    scope: z.enum(['ALL', ...ROLES]),
    airport: z.string().optional(),
    kind: z.enum(['rule', 'checklist', 'warning']),
    title: z.string(),
    text: z.string(),
    ...withSrc,
  })
  .strict();

export const ScriptSchema = z
  .object({
    id: z.string(),
    role: z.enum(ROLES),
    airports: z.array(z.string()).optional(),
    name: z.string(),
    template: z.string(),
    note: z.string().optional(),
    src: Srcs.optional(),
  })
  .strict();

const ValueSrc = z.object({ label: z.string(), value: z.string(), src: SrcRef }).strict();
export const DiscrepancySchema = z
  .object({
    id: FlagId,
    title: z.string(),
    status: z.enum(['open', 'resolved']),
    found: z.enum(['spec', 'build']),
    values: z.array(ValueSrc).min(2),
    note: z.string().optional(),
    resolution: z.string().optional(),
  })
  .strict();

export const QuestionSchema = z.object({ id: z.string(), text: z.string() }).strict();

const RowsWithSrc = <T extends z.ZodTypeAny>(row: T) => z.object({ src: Srcs, rows: z.array(row) }).passthrough();
export const ReferencesSchema = z
  .object({
    initial_headings_from_mem: RowsWithSrc(z.object({ dest: z.string(), heading: z.number() }).strict()).and(z.object({ header: z.string() })),
    initial_altitude_guidance: RowsWithSrc(z.object({ airport: z.string(), value: z.string(), flag: FlagId.optional() }).strict()),
    other_sids: RowsWithSrc(z.object({ airport: z.string(), sid: z.string(), text: z.string() }).strict()),
    vors: RowsWithSrc(z.object({ id: z.string(), name: z.string() }).strict()),
  })
  .strict();

const Box = z.object({ box: z.string(), faa: z.string(), fill: z.string(), field: z.string().optional() }).strict();
export const StripsSchema = z
  .object({
    layouts: z.array(z.object({ kind: z.enum(['departure', 'arrival', 'overflight']), table: z.string(), boxes: z.array(Box), ...withSrc }).strict()),
    box_10_18_defaults: z.object({ src: Srcs, rows: z.array(z.object({ box: z.string(), use: z.string(), field: z.string().optional() }).strict()) }).strict(),
    equipment_suffixes: z
      .object({
        src: Srcs,
        rows: z.array(
          z
            .object({
              rvsm: z.boolean(),
              nav: z.enum(['any', 'none', 'dme', 'tacan', 'rnav', 'gnss']),
              xpdr: z.enum(['failed', 'failed_c', 'none', 'no_c', 'mode_c']),
              suffix: z.string().length(1),
              text: z.string(),
            })
            .strict(),
        ),
      })
      .strict(),
    icao_item10: z
      .object({
        src: Srcs,
        rvsm: z.array(z.string()),
        gnss: z.array(z.string()),
        rnav: z.array(z.string()),
        tacan: z.array(z.string()),
        dme: z.array(z.string()),
        xpdr_none: z.array(z.string()),
        xpdr_no_c: z.array(z.string()),
        xpdr_mode_c: z.array(z.string()),
      })
      .strict(),
    annotations: z.array(z.object({ table: z.string(), src: Srcs, rows: z.array(z.object({ code: z.string(), meaning: z.string() }).strict()) }).strict()),
  })
  .strict();

/** Raw YAML file name → schema. */
export const FILES = {
  docs: z.array(DocSchema),
  airports: z.array(AirportSchema),
  positions: z.array(PositionSchema),
  flows: z.array(FlowSchema),
  sids: z.array(SidSchema),
  elvis: z.array(ElvisSchema),
  stars: z.array(StarSchema),
  headings: z.array(HeadingRuleSchema),
  taxi: z.array(TaxiRuleSchema),
  approach: ApproachDataSchema,
  enroute: EnrouteSchema,
  ait: z.array(AitSchema),
  rules: z.array(RuleSchema),
  scripts: z.array(ScriptSchema),
  discrepancies: z.array(DiscrepancySchema),
  questions: z.array(QuestionSchema),
  references: ReferencesSchema,
  strips: StripsSchema,
} as const;

export type FileName = keyof typeof FILES;
export type Parsed = { [K in FileName]: z.output<(typeof FILES)[K]> };

export type Doc = z.output<typeof DocSchema> & { url?: string };
export type Airport = z.output<typeof AirportSchema>;
export type Position = z.output<typeof PositionSchema>;
export type Flow = z.output<typeof FlowSchema>;
export type Sid = z.output<typeof SidSchema>;
export type Elvis = z.output<typeof ElvisSchema>;
export type Star = z.output<typeof StarSchema>;
export type HeadingRule = z.output<typeof HeadingRuleSchema>;
export type TaxiRule = z.output<typeof TaxiRuleSchema>;
export type Ait = z.output<typeof AitSchema>;
export type Rule = z.output<typeof RuleSchema>;
export type Script = z.output<typeof ScriptSchema> & { slots: string[] };
export type Discrepancy = z.output<typeof DiscrepancySchema>;
export type Enroute = z.output<typeof EnrouteSchema>;
export type ApproachData = z.output<typeof ApproachDataSchema>;
export type References = z.output<typeof ReferencesSchema>;
export type Strips = z.output<typeof StripsSchema>;

/** The validated, resolved dataset the app consumes (see schema/build.ts). */
export type Dataset = Omit<Parsed, 'docs' | 'scripts'> & {
  docs: Doc[];
  scripts: Script[];
  /** doc id → page → sections cited from that page */
  citations: Record<string, Record<string, string[]>>;
};
