/**
 * Parsers for the four national occupation classifications held in the knowledge base.
 *
 * Rejin asked (16 October 2026) for occupation codes by country, and chose India, the US, the UK
 * and Singapore "for a decent spread". Each is published by its government in its own format:
 * - US: O*NET 31.0 (US Department of Labor), CSV, with task statements and alternate titles;
 * - UK: Extended SOC 2020 (Office for National Statistics), XLSX, with sub-unit group
 *   descriptions and each unit group's entry routes;
 * - Singapore: SSOC 2024 (Department of Statistics), XLSX, with definitions, tasks and example
 *   job titles;
 * - India: NCO 2015 (Directorate General of Employment), PDF only: the structure from Volume I's
 *   concordance, the descriptions from Volumes II-A and II-B.
 *
 * Each parser turns its source into the same record (OccupationRecord). Pure, so it can be tested;
 * the downloads and file reading are in scripts/occupations/buildOccupationData.ts.
 */

export type OccupationSystem = 'O*NET-SOC 2019' | 'UK SOC 2020' | 'SSOC 2024' | 'NCO 2015';
export type OccupationCountry = 'US' | 'UK' | 'SG' | 'IN';

export interface OccupationRecord {
  system: OccupationSystem;
  country: OccupationCountry;
  /** The occupation's code in its own system, e.g. "15-1252.00", "2134/01", "25121", "2512.0100". */
  code: string;
  title: string;
  description: string;
  tasks: string[];
  alternateTitles: string[];
  /** The unit group (US/UK/SG) or family (India) the occupation sits in. */
  group?: { code: string; title: string };
  /** UK only: how people usually enter the unit group. */
  entryRoutes?: string;
}

// Control characters as well as runs of space: SSOC's example titles carry U+009F.
const clean = (s: unknown) =>
  String(s ?? '')
    // eslint-disable-next-line no-control-regex -- removing control characters is the point
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// ---------------------------------------------------------------------------------------------
// US: O*NET

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

const byHeader = (rows: string[][]) => {
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
};

/** Alternate titles kept per O*NET occupation, so a record stays a readable size. */
export const MAX_ALTERNATE_TITLES = 25;

export function parseOnet(occupationsCsv: string, tasksCsv: string, titlesCsv: string) {
  const tasks = new Map<string, { text: string; core: boolean }[]>();
  for (const t of byHeader(parseCsv(tasksCsv))) {
    const code = t['O*NET-SOC Code'];
    if (!tasks.has(code)) tasks.set(code, []);
    tasks.get(code)!.push({ text: clean(t.Task), core: t['Task Type'] === 'Core' });
  }
  const titles = new Map<string, string[]>();
  for (const t of byHeader(parseCsv(titlesCsv))) {
    const code = t['O*NET-SOC Code'];
    if (!titles.has(code)) titles.set(code, []);
    const title = clean(t['Job Title']);
    if (title && !titles.get(code)!.includes(title)) titles.get(code)!.push(title);
  }
  return byHeader(parseCsv(occupationsCsv)).map(
    (o): OccupationRecord => ({
      system: 'O*NET-SOC 2019',
      country: 'US',
      code: o['O*NET-SOC Code'],
      title: clean(o.Title),
      description: clean(o.Description),
      // Core tasks first: they are the ones most incumbents perform.
      tasks: (tasks.get(o['O*NET-SOC Code']) || [])
        .sort((a, b) => Number(b.core) - Number(a.core))
        .map((t) => t.text),
      alternateTitles: (titles.get(o['O*NET-SOC Code']) || []).slice(0, MAX_ALTERNATE_TITLES),
      group: {
        code: o['O*NET-SOC Code'].slice(0, 7),
        title: '',
      },
    })
  );
}

// ---------------------------------------------------------------------------------------------
// UK: Extended SOC 2020, "Extended SOC descriptions" sheet

/**
 * Rows as cell text, columns in sheet order: unique id, major, sub-major, minor, unit group,
 * sub-unit group (or a heading such as "TYPICAL ENTRY ROUTES…"), title, description.
 */
export function parseUkSoc(rows: string[][]): OccupationRecord[] {
  const out: OccupationRecord[] = [];
  let unit: { code: string; title: string; entryRoutes?: string } | null = null;
  for (const raw of rows) {
    const r = raw.map(clean);
    const [, , , , unitCode, sub, title, description] = r;
    if (/^\d{4}$/.test(unitCode)) {
      unit = { code: unitCode, title };
      continue;
    }
    if (unit && /^TYPICAL ENTRY ROUTES/i.test(sub)) {
      unit.entryRoutes = description;
      continue;
    }
    if (unit && /^\d{4}\/\d{2}$/.test(sub)) {
      out.push({
        system: 'UK SOC 2020',
        country: 'UK',
        code: sub,
        title,
        description,
        tasks: [],
        alternateTitles: [],
        group: { code: unit.code, title: unit.title },
        entryRoutes: unit.entryRoutes,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Singapore: SSOC 2024 detailed definitions

/** "• one • two", "- one\n- two" or newline-separated items, as a list without their markers. */
const bullets = (s: unknown) =>
  String(s ?? '')
    .split(/•|\n|\s-\s(?=[a-z])/)
    .map((x) => clean(x).replace(/^[-–]\s*/, ''))
    .filter((x) => x && !/^(n\.?a\.?|nil|-)$/i.test(x));

/**
 * Rows as cell text: code, title, groups classified under it, definition, tasks, notes,
 * examples of jobs classified under it, examples classified elsewhere. Occupations are the
 * five-digit codes. SSOC states tasks for the four-digit unit group, not for each occupation, so
 * an occupation takes its unit group's tasks.
 */
export function parseSsoc(rows: string[][]): OccupationRecord[] {
  const units = new Map<string, { title: string; tasks: string[] }>();
  const out: OccupationRecord[] = [];
  for (const raw of rows) {
    const code = clean(raw[0]);
    const title = clean(raw[1]);
    if (/^\d{4}$/.test(code)) units.set(code, { title, tasks: bullets(raw[4]) });
    if (!/^\d{5}$/.test(code)) continue;
    const unit = units.get(code.slice(0, 4));
    out.push({
      system: 'SSOC 2024',
      country: 'SG',
      code,
      title,
      description: clean(raw[3]),
      tasks: bullets(raw[4]).length ? bullets(raw[4]) : unit?.tasks || [],
      alternateTitles: bullets(raw[6]),
      group: { code: code.slice(0, 4), title: unit?.title || '' },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// India: NCO 2015

export interface NcoStructure {
  families: Map<string, string>;
  occupations: Map<string, string>;
}

// One space or more between code and title: some lines have one ("4110.0100 Clerk, General").
const NCO_CODE = /^(\d{4}\.\d{4})\s+(.+?)(?:\s{2,}\d{4}\.\d{2})?\s*$/;

/**
 * Volume I's concordance (pdftotext -layout): "Family 1111 Legislators", then occupation lines
 * "1111.0100   Elected Official, Union Government   1111.10" whose titles may continue on the
 * next, indented line.
 */
export function parseNcoStructure(layoutText: string): NcoStructure {
  const families = new Map<string, string>();
  const occupations = new Map<string, string>();
  const lines = layoutText.split('\n');
  const start = lines.findIndex((l) => /^\s*Division\s+1\s{2,}Managers/.test(l));
  let last: string | null = null;
  for (const line of lines.slice(Math.max(0, start))) {
    const family = line.match(/^\s*Family\s+(\d{4})\s{2,}(.+?)\s*$/);
    if (family) {
      families.set(family[1], clean(family[2]));
      last = null;
      continue;
    }
    // A layout glitch puts some occupations on the "Family" label's line.
    const occ = line
      .trim()
      .replace(/^Family\s+(?=\d{4}\.\d{4})/, '')
      .match(NCO_CODE);
    if (occ) {
      occupations.set(occ[1], clean(occ[2]));
      last = occ[1];
      continue;
    }
    // A wrapped title: an indented line of words only, straight after an occupation line.
    if (last && /^\s{20,}[A-Za-z(&]/.test(line) && !/\d{4}\.\d/.test(line)) {
      occupations.set(last, clean(`${occupations.get(last)} ${line}`));
      continue;
    }
    if (line.trim()) last = null;
  }
  return { families, occupations };
}

const NCO_NOISE = [
  /^VOLUME II\s*[AB]?$/i,
  /^National Classification of Occupations\s*[–-]\s*2015.*$/i,
  /^\d{1,3}$/,
];

/**
 * Volumes II-A and II-B (pdftotext -raw): each occupation starts with its code alone on a line,
 * then its title (possibly wrapped), then its description, which ends at "ISCO 08 Unit Group
 * Details:" or the next heading. The title is known from Volume I, so it is removed from the
 * start of the segment by matching words rather than lines.
 */
export function parseNcoDescriptions(
  rawText: string,
  titles: Map<string, string>,
  /** Filled with the first line of each occupation Volume I does not list, as its title. */
  unlisted: Map<string, string> = new Map()
): Map<string, string> {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !NCO_NOISE.some((re) => re.test(l)));
  const out = new Map<string, string>();
  for (let i = 0; i < lines.length; i++) {
    if (!/^\d{4}\.\d{4}$/.test(lines[i])) continue;
    const code = lines[i];
    const body: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (/^\d{4}\.\d{4}$/.test(l) || /^ISCO 08 Unit Group Details:/i.test(l)) break;
      if (/^(Family|Group|Sub-Division|Division)\s+\d/.test(l)) break;
      body.push(l);
    }
    let text = clean(body.join(' '));
    if (!titles.has(code) && body[0]) unlisted.set(code, clean(body[0]));
    const title = titles.get(code) || unlisted.get(code);
    if (title) {
      const words = clean(title).split(' ');
      const head = text.split(' ').slice(0, words.length).join(' ');
      if (head.toLowerCase() === words.join(' ').toLowerCase()) {
        text = text.split(' ').slice(words.length).join(' ');
      }
    }
    if (text) out.set(code, text);
  }
  return out;
}

export function parseNco(
  volume1Layout: string,
  volume2Raw: string[]
): { records: OccupationRecord[]; structure: NcoStructure; described: number } {
  const structure = parseNcoStructure(volume1Layout);
  const descriptions = new Map<string, string>();
  const unlisted = new Map<string, string>();
  for (const text of volume2Raw) {
    for (const [code, d] of parseNcoDescriptions(text, structure.occupations, unlisted)) {
      descriptions.set(code, d);
    }
  }
  // Described in Volume II but missing from Volume I's table: kept, titled from Volume II.
  for (const [code, title] of unlisted) {
    if (!structure.occupations.has(code)) structure.occupations.set(code, title);
  }
  const records = [...structure.occupations.entries()].map(
    ([code, title]): OccupationRecord => ({
      system: 'NCO 2015',
      country: 'IN',
      code,
      title,
      description: descriptions.get(code) || '',
      tasks: [],
      alternateTitles: [],
      group: { code: code.slice(0, 4), title: structure.families.get(code.slice(0, 4)) || '' },
    })
  );
  return { records, structure, described: records.filter((r) => r.description).length };
}
