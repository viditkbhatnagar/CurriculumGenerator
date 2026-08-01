/**
 * Module blueprint — the programme structure a faculty member defines before
 * Step 4 runs.
 *
 * Without one, Step 4 invents its own module list and is capped at 6-8 modules,
 * which collapses a 180-ECTS degree into eight oversized modules. With one, the
 * module list, titles and credit/hour split are fixed by the author and the
 * generator only writes the teaching content for each.
 *
 * Faculty send these as spreadsheets laid out for reading, not for parsing:
 * several tables on one sheet, years side by side in different column ranges,
 * section headings, repeated "No. | Module | ECTS" header rows and "Total"
 * rows. The parser below reads that shape rather than demanding a fixed one.
 */
import ExcelJS from 'exceljs';
import { loggingService } from './loggingService';

export interface BlueprintModule {
  /** Position in the programme, 1-based. */
  sequenceOrder: number;
  /** Short code, e.g. "BBA101". Generated when the sheet omits one. */
  code: string;
  title: string;
  credits: number | null;
  contactHours: number | null;
  independentHours: number | null;
  totalHours: number | null;
  /** The section the module came from, e.g. "Year 1 – Level 4". */
  group: string;
  /** True for modules in an optional track the student chooses between. */
  isElective: boolean;
}

export interface ParsedBlueprint {
  modules: BlueprintModule[];
  groups: Array<{ name: string; moduleCount: number; credits: number; isElective: boolean }>;
  totalModules: number;
  /** Credits a single student takes: all core groups plus one elective track. */
  totalCredits: number;
  /** Credits across every module listed, including all elective tracks. */
  totalCreditsAllTracks: number;
  warnings: string[];
}

const HEADER_WORDS =
  /^(no\.?|#|s\.?\s*no\.?|sr\.?\s*no\.?|module|modules|subject|course|title|ects|credits?|hours?|contact|independent)$/i;
const TOTAL_ROW = /^\s*total\b/i;
const ELECTIVE_HINT = /(special|elective|option|track|choose|pathway|concentration)/i;

/** Largest credit value a single module can plausibly carry. */
const MAX_MODULE_CREDITS = 60;

/**
 * Section headings ("Year 1 – Level 4", "Specialization : Finance and FinTech",
 * "Common Modules (All Students)"). These are usually merged across the table's
 * columns, so the same text is returned for every cell in the range and would
 * otherwise be read as a module title sitting in the module column.
 */
const HEADING_TEXT =
  /^(year\s*\d|level\s*\d|semester\s*\d|term\s*\d|stage\s*\d|specialis|specializ|common\s+modules|core\s+modules|elective|students\s+choose|choose\s+one|optional)/i;

const isHeadingText = (value: string): boolean =>
  HEADING_TEXT.test(value) || /\b(ects|eqf)\b.*\b(year|level)\b/i.test(value);

const text = (value: ExcelJS.CellValue): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const rich = value as { richText?: Array<{ text: string }>; text?: string; result?: unknown };
    if (Array.isArray(rich.richText)) return rich.richText.map((r) => r.text).join('');
    if (typeof rich.text === 'string') return rich.text;
    if (rich.result !== undefined) return String(rich.result);
    return '';
  }
  return String(value);
};

const clean = (value: ExcelJS.CellValue): string => text(value).replace(/\s+/g, ' ').trim();

const num = (value: ExcelJS.CellValue): number | null => {
  const raw = clean(value)
    .replace(/[^\d.,-]/g, '')
    .replace(',', '.');
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/** A row is a module row when it names something and that name is not furniture. */
const looksLikeModuleTitle = (value: string): boolean =>
  value.length >= 4 && !HEADER_WORDS.test(value) && !TOTAL_ROW.test(value) && /[a-z]/i.test(value);

/**
 * Locate the column bands that hold module tables.
 *
 * A sheet may place Year 1 in columns A-C and Year 2 in E-G. Each band is found
 * by its "Module"/"ECTS" header pair, so the two are read as separate tables
 * rather than one table with stray columns.
 */
interface Band {
  titleCol: number;
  creditsCol: number | null;
  contactCol: number | null;
  independentCol: number | null;
  labelCol: number;
}

function findBands(sheet: ExcelJS.Worksheet): Band[] {
  const bands: Band[] = [];
  const seen = new Set<number>();

  sheet.eachRow((row) => {
    const cells: Array<{ col: number; value: string }> = [];
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      cells.push({ col, value: clean(cell.value) });
    });

    for (const cell of cells) {
      if (!/^(module|modules|subject|course|course title|module title)$/i.test(cell.value))
        continue;
      if (seen.has(cell.col)) continue;
      seen.add(cell.col);

      const near = (re: RegExp): number | null => {
        const hit = cells.find(
          (c) => c.col > cell.col && c.col <= cell.col + 4 && re.test(c.value)
        );
        return hit ? hit.col : null;
      };
      bands.push({
        titleCol: cell.col,
        creditsCol: near(/^(ects|credits?|cp)$/i),
        contactCol: near(/contact/i),
        independentCol: near(/(independent|self[- ]?study)/i),
        labelCol: cell.col - 1,
      });
    }
  });

  // No header row anywhere — fall back to the first column that carries text.
  if (bands.length === 0)
    bands.push({ titleCol: 1, creditsCol: 2, contactCol: null, independentCol: null, labelCol: 0 });
  return bands.sort((a, b) => a.titleCol - b.titleCol);
}

/**
 * The section heading a row sits under, scoped to this table's own columns.
 *
 * The scope matters: with two years printed side by side, a range wide enough to
 * reach the next table files Year 1's modules under Year 2's heading. It runs
 * from the row-number column to the credits column and no further.
 *
 * Where a year heading and a narrower one both apply ("Year 3 – Level 6", then
 * "Common Modules"), both are kept — the year drives progressive complexity
 * later, and the narrower name distinguishes core from elective.
 */
function headingFor(
  headings: Array<{ row: number; col: number; value: string }>,
  band: Band,
  rowNumber: number
): string {
  const from = Math.max(1, band.labelCol);
  const to = band.creditsCol ?? band.titleCol + 1;
  const above = headings.filter((h) => h.row <= rowNumber && h.col >= from && h.col <= to);

  // The year banner is searched across the whole sheet rather than this table's
  // columns, because it is often printed once above everything that follows.
  // Take the closest one above by row; where two years share a row — one per
  // table in a side-by-side layout — take the one nearest this table's columns.
  const isYear = (v: string) => /^(year|level|semester|term|stage)\s*\d/i.test(v);
  const yearsAbove = headings.filter((h) => h.row <= rowNumber && isYear(h.value));
  const nearestRow = yearsAbove.length ? Math.max(...yearsAbove.map((h) => h.row)) : null;
  const year =
    nearestRow === null
      ? undefined
      : yearsAbove
          .filter((h) => h.row === nearestRow)
          .sort((a, b) => Math.abs(a.col - band.titleCol) - Math.abs(b.col - band.titleCol))[0];

  if (above.length === 0) return year ? year.value : '';
  const specific = above[above.length - 1].value;
  if (!year || year.value === specific || isYear(specific)) return specific;
  return `${year.value} › ${specific}`;
}

export async function parseBlueprintWorkbook(buffer: Buffer): Promise<ParsedBlueprint> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);

  const warnings: string[] = [];
  const modules: BlueprintModule[] = [];

  for (const sheet of workbook.worksheets) {
    const bands = findBands(sheet);

    // Section headings. Recorded with the column they start in, because a sheet
    // can run two years side by side and each table needs its own heading.
    // Merged headings repeat across their range, so only the leftmost is kept.
    const headings: Array<{ row: number; col: number; value: string }> = [];
    sheet.eachRow((row, rowNumber) => {
      let previous = '';
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        const value = clean(cell.value);
        if (!value || value === previous) {
          if (value) previous = value;
          return;
        }
        previous = value;
        if (isHeadingText(value) && !TOTAL_ROW.test(value)) {
          headings.push({ row: rowNumber, col, value });
        }
      });
    });

    for (const band of bands) {
      sheet.eachRow((row, rowNumber) => {
        const title = clean(row.getCell(band.titleCol).value);
        if (!looksLikeModuleTitle(title) || isHeadingText(title)) return;

        // A heading merged across the table repeats its text in every column of
        // the range, so the "credits" cell reads back as the heading itself.
        const creditsText = band.creditsCol ? clean(row.getCell(band.creditsCol).value) : '';
        if (creditsText && creditsText === title) return;

        const rawCredits = band.creditsCol ? num(row.getCell(band.creditsCol).value) : null;
        const credits = rawCredits !== null && rawCredits <= MAX_MODULE_CREDITS ? rawCredits : null;
        const contactHours = band.contactCol ? num(row.getCell(band.contactCol).value) : null;
        const independentHours = band.independentCol
          ? num(row.getCell(band.independentCol).value)
          : null;

        // Require either a credit figure or a row number beside the title, so
        // prose paragraphs on the sheet are not mistaken for modules.
        const label = band.labelCol > 0 ? clean(row.getCell(band.labelCol).value) : '';
        if (credits === null && !/^\d+$/.test(label)) return;

        const group = headingFor(headings, band, rowNumber);
        modules.push({
          sequenceOrder: 0, // assigned once every sheet has been read
          code: '',
          title,
          credits,
          contactHours,
          independentHours,
          totalHours:
            contactHours !== null || independentHours !== null
              ? (contactHours || 0) + (independentHours || 0)
              : null,
          group: group || sheet.name,
          isElective: ELECTIVE_HINT.test(group),
        });
      });
    }
  }

  if (modules.length === 0) {
    return {
      modules: [],
      groups: [],
      totalModules: 0,
      totalCredits: 0,
      totalCreditsAllTracks: 0,
      warnings: [
        'No modules found. The sheet needs a header row naming a "Module" column, and ideally an "ECTS" or "Credits" column beside it.',
      ],
    };
  }

  // Drop rows repeated across bands (merged cells can surface the same title twice).
  const deduped: BlueprintModule[] = [];
  const seen = new Set<string>();
  for (const module of modules) {
    const key = `${module.group}::${module.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(module);
  }

  // Put the modules in the order a student meets them. Reading order follows
  // the sheet's layout — with years side by side, that interleaves Year 3's core
  // modules ahead of Year 2 — so sort by year, then core before elective.
  const yearOf = (group: string): number => {
    const match = /(?:year|level|semester|term|stage)\s*(\d)/i.exec(group);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  };
  deduped.forEach((module, index) => {
    module.sequenceOrder = index; // preserve read order as the final tiebreak
  });
  deduped.sort(
    (a, b) =>
      yearOf(a.group) - yearOf(b.group) ||
      Number(a.isElective) - Number(b.isElective) ||
      a.sequenceOrder - b.sequenceOrder
  );

  deduped.forEach((module, index) => {
    module.sequenceOrder = index + 1;
    module.code = `M${String(index + 1).padStart(2, '0')}`;
  });

  const groupMap = new Map<string, { moduleCount: number; credits: number; isElective: boolean }>();
  for (const module of deduped) {
    const entry = groupMap.get(module.group) || {
      moduleCount: 0,
      credits: 0,
      isElective: module.isElective,
    };
    entry.moduleCount += 1;
    entry.credits += module.credits || 0;
    groupMap.set(module.group, entry);
  }
  const groups = [...groupMap.entries()].map(([name, v]) => ({ name, ...v }));

  const coreCredits = groups.filter((g) => !g.isElective).reduce((sum, g) => sum + g.credits, 0);
  const electiveGroups = groups.filter((g) => g.isElective);
  // A student takes one elective track, so count the largest once rather than all.
  const oneElective = electiveGroups.length ? Math.max(...electiveGroups.map((g) => g.credits)) : 0;

  const missingCredits = deduped.filter((m) => m.credits === null).length;
  if (missingCredits) {
    warnings.push(
      `${missingCredits} module(s) have no credit value — their hours will be split evenly from the programme total.`
    );
  }
  if (electiveGroups.length > 1) {
    warnings.push(
      `${electiveGroups.length} optional tracks found (${electiveGroups.map((g) => g.name).join('; ')}). A student takes one, so the programme total counts a single track.`
    );
  }

  loggingService.info('Parsed module blueprint', {
    sheets: workbook.worksheets.length,
    modules: deduped.length,
    groups: groups.length,
  });

  return {
    modules: deduped,
    groups,
    totalModules: deduped.length,
    totalCredits: coreCredits + oneElective,
    totalCreditsAllTracks: deduped.reduce((sum, m) => sum + (m.credits || 0), 0),
    warnings,
  };
}

/**
 * Fill in hours for modules that only carry credits, using the programme's own
 * hours-per-credit so the blueprint reconciles with Step 1 rather than assuming
 * a fixed ECTS conversion.
 */
export function applyProgrammeHours(
  modules: BlueprintModule[],
  programme: { totalHours?: number; credits?: number; contactHoursPercent?: number }
): BlueprintModule[] {
  const totalCredits = modules.reduce((sum, m) => sum + (m.credits || 0), 0);
  const hoursPerCredit =
    programme.totalHours && totalCredits ? programme.totalHours / totalCredits : null;
  const contactShare = (programme.contactHoursPercent ?? 30) / 100;

  return modules.map((module) => {
    if (module.contactHours !== null && module.independentHours !== null) return module;

    const totalHours =
      module.totalHours ??
      (hoursPerCredit && module.credits ? Math.round(module.credits * hoursPerCredit) : null);
    if (totalHours === null) return module;

    const contactHours = module.contactHours ?? Math.round(totalHours * contactShare);
    return {
      ...module,
      totalHours,
      contactHours,
      independentHours: module.independentHours ?? totalHours - contactHours,
    };
  });
}
