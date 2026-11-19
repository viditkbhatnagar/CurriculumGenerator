/**
 * Reads a course document's blocks into a programme and its modules, without a model.
 *
 * Athira Hari at India Learns asked on 19 November 2026 to carry courses already drafted in
 * ChatGPT into the curriculum developer. Those drafts are usually well structured: a title,
 * labelled fields, and modules as a table, as "Module 1: ..." headings or as a numbered list.
 * Each of those shapes is read here by rule. Whatever is not in the document stays empty and
 * is listed in `flags`; nothing is guessed. The model is only asked (courseDocumentModel)
 * when no modules could be found at all.
 */
import type { CourseBlock } from './courseDocumentBlocks';

export interface ExtractedModule {
  sequenceOrder: number;
  code: string;
  title: string;
  credits: number | null;
  contactHours: number | null;
  independentHours: number | null;
  totalHours: number | null;
  topics: string[];
  outcomes: string[];
  group: string;
  isElective: boolean;
}

export interface ExtractedProgramme {
  title: string;
  description: string;
  purpose: string;
  /** The level or credential wording as the document gave it. */
  levelText: string;
  credentialText: string;
  credits: number | null;
  totalHours: number | null;
  targetLearners: string;
  jobRoles: Array<{ title: string; description: string }>;
}

export interface ExtractedCourse {
  programme: ExtractedProgramme;
  modules: ExtractedModule[];
  flags: string[];
  method: 'deterministic' | 'model';
}

type SectionKey = 'description' | 'purpose' | 'learners' | 'roles' | 'modules';

const LABELS: Array<[RegExp, keyof ExtractedProgramme | 'modules']> = [
  [
    /^((programme|program|course|qualification)\s+)?(title|name)$|^(programme|program|course)$/i,
    'title',
  ],
  [
    /^((course|programme|program)\s+)?(description|overview|summary|about( the (course|programme|program))?)$/i,
    'description',
  ],
  [/^(purpose|aims?|rationale|goals?|course (aim|purpose)|programme (aim|purpose))$/i, 'purpose'],
  [/^(level|academic level|qualification level|rqf level|eqf level)$/i, 'levelText'],
  [
    /^(credential|credential type|qualification type|award|course type|programme type|type)$/i,
    'credentialText',
  ],
  [/^(total )?(credits?|ects( credits)?)$/i, 'credits'],
  [
    /^(total |programme |course )?(hours|learning hours|total learning hours|notional hours|duration)$/i,
    'totalHours',
  ],
  [
    /^(target (learners?|audience)|audience|who (is it|this is) for|intended learners?|learners?)$/i,
    'targetLearners',
  ],
  [
    /^(job roles?|careers?|career outcomes?|career paths?|target roles?|roles|job opportunities)$/i,
    'jobRoles',
  ],
];

const MODULE_SECTION =
  /^(\d+[.)]\s*)?((course|programme|program)\s+)?(structure|modules?|curriculum|syllabus|course outline|module (list|breakdown|overview)|course content)$/i;
const MODULE_HEADING = /^(module|unit|week|session|part)\s*(\d+|[ivx]+)\b\s*[:.\-–—]?\s*(.*)$/i;
const TOTAL_ROW = /^\s*(grand|sub)?[\s-]*totals?\b/i;

const labelOf = (text: string): { label: string; value: string } | null => {
  const m = /^([A-Za-z][A-Za-z /&-]{1,40}?)\s*[:：]\s*(.*)$/.exec(text);
  return m ? { label: m[1].trim(), value: m[2].trim() } : null;
};

const fieldFor = (label: string): keyof ExtractedProgramme | null => {
  const hit = LABELS.find(([re]) => re.test(label.replace(/^\d+[.)]\s*/, '')));
  return hit && hit[1] !== 'modules' ? hit[1] : null;
};

const sectionFor = (heading: string): SectionKey | null => {
  const text = heading
    .replace(/[:：]\s*$/, '')
    .replace(/^\d+[.)]\s*/, '')
    .trim();
  if (MODULE_SECTION.test(text)) return 'modules';
  const field = fieldFor(text);
  if (field === 'description') return 'description';
  if (field === 'purpose') return 'purpose';
  if (field === 'targetLearners') return 'learners';
  if (field === 'jobRoles') return 'roles';
  return null;
};

const toNumber = (text: string): number | null => {
  const m = /(\d+(?:[.,]\d+)?)/.exec(text);
  if (!m) return null;
  const n = Number.parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Hours only when the text says hours; "6 weeks" is not a total of hours. */
const toHours = (text: string): number | null => {
  const m = /(\d+(?:[.,]\d+)?)\s*(?:contact\s+|learning\s+|notional\s+)?(?:hours?|hrs?|h)\b/i.exec(
    text
  );
  if (m) return Number.parseFloat(m[1].replace(',', '.'));
  return /^\s*\d+(?:[.,]\d+)?\s*$/.test(text) ? toNumber(text) : null;
};

const splitList = (text: string): string[] =>
  text
    .split(/\s*[;•\n]\s*|\s*,\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);

/** "Module 3: Pricing (15 credits, 40 hours)" to its title and any figures in it. */
export function parseTitleLine(text: string): {
  title: string;
  credits: number | null;
  hours: number | null;
} {
  const credits = /(\d+(?:\.\d+)?)\s*(?:ects\s*)?credits?\b/i.exec(text);
  const hours = /(\d+(?:\.\d+)?)\s*(?:contact\s+|learning\s+)?(?:hours?|hrs?)\b/i.exec(text);
  let title = text
    .replace(/\(?\s*\d+(?:\.\d+)?\s*(?:ects\s*)?credits?\s*\)?/gi, '')
    .replace(/\(?\s*\d+(?:\.\d+)?\s*(?:contact\s+|learning\s+)?(?:hours?|hrs?)\s*\)?/gi, '')
    .replace(/^(module|unit)\s*(\d+|[ivx]+)\s*[:.\-–—]?\s*/i, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/\(\s*[,;\s]*\)/g, '')
    .replace(/\s*[-–—,:;|]+\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!title) title = text.trim();
  return {
    title,
    credits: credits ? Number.parseFloat(credits[1]) : null,
    hours: hours ? Number.parseFloat(hours[1]) : null,
  };
}

const blankModule = (title: string): ExtractedModule => ({
  sequenceOrder: 0,
  code: '',
  title,
  credits: null,
  contactHours: null,
  independentHours: null,
  totalHours: null,
  topics: [],
  outcomes: [],
  group: '',
  isElective: /\b(elective|optional)\b/i.test(title),
});

// --- Modules as a table -------------------------------------------------------------------

type ColumnKey =
  | 'title'
  | 'code'
  | 'credits'
  | 'contact'
  | 'independent'
  | 'total'
  | 'topics'
  | 'outcomes';

function columnKey(header: string): ColumnKey | null {
  const h = header.toLowerCase();
  if (/contact|face|taught|lecture/.test(h) && /hour|hrs|h$/.test(h)) return 'contact';
  if (/independent|self|private/.test(h)) return 'independent';
  if (/credit|ects/.test(h)) return 'credits';
  if (/outcome|objective|\blos?\b/.test(h)) return 'outcomes';
  if (/topic|content|syllabus|key (areas|concepts)/.test(h)) return 'topics';
  if (/total|learning hours|notional|^hours?$|duration/.test(h)) return 'total';
  if (
    /^(module|unit|subject|course|title|module title|module name|unit title|course title|name)$/.test(
      h
    )
  )
    return 'title';
  if (/code|^(no\.?|#|id|sr\.?\s*no\.?)$/.test(h)) return 'code';
  return null;
}

function modulesFromTables(blocks: CourseBlock[]): ExtractedModule[] {
  const modules: ExtractedModule[] = [];
  let columns: Map<number, ColumnKey> | null = null;
  let group = '';
  let lastHeading = '';

  for (const block of blocks) {
    if (block.kind === 'heading') {
      lastHeading = block.text;
      columns = null;
      continue;
    }
    if (block.kind !== 'row') {
      if (columns) columns = null;
      continue;
    }
    const mapped = new Map<number, ColumnKey>();
    block.cells.forEach((cell, i) => {
      const key = columnKey(cell);
      if (key && ![...mapped.values()].includes(key)) mapped.set(i, key);
    });
    const looksLikeHeader = block.isHeader || (!columns && [...mapped.values()].includes('title'));
    if (looksLikeHeader && [...mapped.values()].includes('title')) {
      columns = mapped;
      group = /^(modules?|course structure|structure|curriculum)$/i.test(lastHeading)
        ? ''
        : lastHeading;
      continue;
    }
    if (!columns) continue;

    const cell = (key: ColumnKey): string => {
      for (const [i, k] of columns!) if (k === key) return block.cells[i] ?? '';
      return '';
    };
    const titleRaw = cell('title');
    if (!titleRaw || TOTAL_ROW.test(titleRaw) || /^\d+$/.test(titleRaw) || titleRaw.length < 3)
      continue;

    const parsed = parseTitleLine(titleRaw);
    const m = blankModule(parsed.title);
    const codeCell = cell('code');
    if (/^[A-Za-z]{2,}[-\s]?\d+/.test(codeCell)) m.code = codeCell.replace(/\s+/g, '');
    m.credits = toNumber(cell('credits')) ?? parsed.credits;
    m.contactHours = toHours(cell('contact'));
    m.independentHours = toHours(cell('independent'));
    m.totalHours = toHours(cell('total')) ?? parsed.hours;
    m.topics = splitList(cell('topics'));
    m.outcomes = splitList(cell('outcomes'));
    m.group = group;
    modules.push(m);
  }
  return modules;
}

// --- Modules as "Module 1: ..." headings -------------------------------------------------

function applyModuleLine(
  m: ExtractedModule,
  text: string,
  bucket: { current: 'topics' | 'outcomes' }
): boolean {
  const lab = labelOf(text);
  if (!lab) return false;
  const key = lab.label.toLowerCase();
  if (/^(credits?|ects)$/.test(key)) m.credits = toNumber(lab.value);
  else if (/^(contact hours?|contact)$/.test(key)) m.contactHours = toHours(lab.value);
  else if (/^(independent|self[- ]study|independent hours?)/.test(key))
    m.independentHours = toHours(lab.value);
  else if (/^(total |learning )?hours?$|^duration$/.test(key)) m.totalHours = toHours(lab.value);
  else if (/^(module )?code$/.test(key)) m.code = lab.value.replace(/\s+/g, '');
  else if (/outcomes?|objectives?/.test(key)) {
    bucket.current = 'outcomes';
    m.outcomes.push(...splitList(lab.value));
  } else if (/topics?|content|key (areas|concepts)/.test(key)) {
    bucket.current = 'topics';
    m.topics.push(...splitList(lab.value));
  } else return false;
  return true;
}

function modulesFromHeadings(blocks: CourseBlock[]): ExtractedModule[] {
  const modules: ExtractedModule[] = [];
  let current: ExtractedModule | null = null;
  let moduleLevel = 0;
  const bucket: { current: 'topics' | 'outcomes' } = { current: 'topics' };

  for (const block of blocks) {
    if (block.kind === 'heading') {
      const hit = MODULE_HEADING.exec(block.text);
      if (hit && (!current || block.level <= moduleLevel)) {
        const parsed = parseTitleLine(block.text);
        current = blankModule(parsed.title);
        current.credits = parsed.credits;
        current.totalHours = parsed.hours;
        moduleLevel = block.level;
        bucket.current = 'topics';
        modules.push(current);
        continue;
      }
      if (current && block.level <= moduleLevel) current = null;
      else if (current) {
        if (/outcomes?|objectives?/i.test(block.text)) bucket.current = 'outcomes';
        else if (/topics?|content|key (areas|concepts)/i.test(block.text))
          bucket.current = 'topics';
      }
      continue;
    }
    if (!current) continue;
    if (block.kind === 'para' || block.kind === 'item') {
      if (applyModuleLine(current, block.text, bucket)) continue;
      if (block.kind === 'para') {
        if (
          /^(topics?|learning outcomes?|outcomes?|objectives?|key topics)\s*:?$/i.test(block.text)
        ) {
          bucket.current = /topic/i.test(block.text) ? 'topics' : 'outcomes';
        }
        continue;
      }
      current[bucket.current].push(block.text);
    }
  }
  return modules;
}

// --- Modules as a list --------------------------------------------------------------------

function modulesFromList(blocks: CourseBlock[]): ExtractedModule[] {
  const modules: ExtractedModule[] = [];
  let inSection = false;
  let sectionLevel = 0;
  let current: ExtractedModule | null = null;
  const bucket: { current: 'topics' | 'outcomes' } = { current: 'topics' };

  for (const block of blocks) {
    if (block.kind === 'heading') {
      if (sectionFor(block.text) === 'modules') {
        inSection = true;
        sectionLevel = block.level;
      } else if (inSection && block.level <= sectionLevel) inSection = false;
      continue;
    }
    if (!inSection || block.kind !== 'item') continue;
    if (block.depth === 0) {
      const parsed = parseTitleLine(block.text);
      current = blankModule(parsed.title);
      current.credits = parsed.credits;
      current.totalHours = parsed.hours;
      bucket.current = 'topics';
      modules.push(current);
    } else if (current) {
      if (applyModuleLine(current, block.text, bucket)) continue;
      current[bucket.current].push(block.text);
    }
  }
  return modules;
}

// --- Programme fields -----------------------------------------------------------------------

const emptyProgramme = (): ExtractedProgramme => ({
  title: '',
  description: '',
  purpose: '',
  levelText: '',
  credentialText: '',
  credits: null,
  totalHours: null,
  targetLearners: '',
  jobRoles: [],
});

const roleFrom = (text: string): { title: string; description: string } => {
  const split = /^(.{3,70}?)\s+[–—-]\s+(.+)$|^(.{3,70}?):\s+(.+)$/.exec(text);
  if (split)
    return { title: (split[1] || split[3]).trim(), description: (split[2] || split[4]).trim() };
  return { title: text.trim(), description: '' };
};

function programmeFrom(blocks: CourseBlock[]): ExtractedProgramme {
  const p = emptyProgramme();
  let section: SectionKey | null = null;
  let sectionLevel = 0;
  const buckets: Record<'description' | 'purpose' | 'learners', string[]> = {
    description: [],
    purpose: [],
    learners: [],
  };

  for (const block of blocks) {
    if (block.kind === 'row') break;
    if (block.kind === 'heading') {
      if (MODULE_HEADING.test(block.text)) break;
      const key = sectionFor(block.text);
      if (key === 'modules') break;
      if (key) {
        section = key;
        sectionLevel = block.level;
      } else if (!p.title && block.level === 1) {
        p.title = block.text
          .replace(/^(course|programme|program)\s*(outline|plan|title|design)?\s*[:\-–—]\s*/i, '')
          .trim();
        section = null;
      } else if (section && block.level <= sectionLevel) section = null;
      continue;
    }

    const lab = labelOf(block.text);
    const field = lab ? fieldFor(lab.label) : null;
    if (lab && field && lab.value) {
      if (field === 'title') p.title = p.title || lab.value;
      else if (field === 'credits') p.credits = toNumber(lab.value);
      else if (field === 'totalHours') p.totalHours = toHours(lab.value);
      else if (field === 'jobRoles') {
        p.jobRoles.push(...splitList(lab.value).map((t) => roleFrom(t)));
      } else if (field === 'levelText' || field === 'credentialText') p[field] = lab.value;
      else if (field === 'description' || field === 'purpose') buckets[field].push(lab.value);
      else if (field === 'targetLearners') buckets.learners.push(lab.value);
      continue;
    }
    if (!section || section === 'modules') continue;
    if (section === 'roles') {
      if (block.kind === 'item') p.jobRoles.push(roleFrom(block.text));
      else p.jobRoles.push(...splitList(block.text).map((t) => roleFrom(t)));
    } else buckets[section].push(block.text);
  }

  p.description = buckets.description.join('\n\n');
  p.purpose = buckets.purpose.join('\n\n');
  p.targetLearners = buckets.learners.join('; ');
  return p;
}

/** A level as a UK-scale number, only when the document states one. */
export const statedLevel = (text: string): number | null => {
  const m = /\blevel\s*(\d)\b|\brqf\s*(\d)\b|^\s*(\d)\s*$/i.exec(text);
  const n = m ? Number(m[1] || m[2] || m[3]) : NaN;
  return n >= 3 && n <= 8 ? n : null;
};

export function parseCourseBlocks(blocks: CourseBlock[]): ExtractedCourse {
  const programme = programmeFrom(blocks);

  let modules = modulesFromTables(blocks);
  if (!modules.length) modules = modulesFromHeadings(blocks);
  if (!modules.length) modules = modulesFromList(blocks);
  modules = modules.map((m, i) => ({
    ...m,
    sequenceOrder: i + 1,
    code: m.code || `M${String(i + 1).padStart(2, '0')}`,
  }));

  return { programme, modules, flags: flagsFor(programme, modules), method: 'deterministic' };
}

/** What the document did not say, as sentences for the author. */
export function flagsFor(programme: ExtractedProgramme, modules: ExtractedModule[]): string[] {
  const flags: string[] = [];
  const missing = (value: unknown, text: string) => {
    if (!value || (Array.isArray(value) && !value.length)) flags.push(text);
  };
  missing(programme.title, 'The document does not give a programme title.');
  missing(programme.description, 'No programme description was found; write one in Step 1.');
  missing(programme.purpose, 'No programme purpose or aims were found.');
  missing(
    programme.levelText || programme.credentialText,
    'No level or credential type was stated.'
  );
  missing(
    programme.credits || programme.totalHours,
    'No credits or total hours were stated for the programme.'
  );
  missing(programme.targetLearners, 'No target learners were described.');
  if (programme.jobRoles.length < 2) {
    flags.push(
      'Step 1 needs at least two job roles; the document gave ' + programme.jobRoles.length + '.'
    );
  }
  if (programme.jobRoles.some((r) => !r.description)) {
    flags.push('Job roles have no descriptions in the document; Step 1 needs them.');
  }
  if (!modules.length) {
    flags.push('No modules were found in the document.');
    return flags;
  }
  const noCredits = modules.filter((m) => m.credits === null).length;
  if (noCredits) flags.push(`${noCredits} of ${modules.length} modules have no credit value.`);
  const noHours = modules.filter((m) => m.totalHours === null && m.contactHours === null).length;
  if (noHours) flags.push(`${noHours} of ${modules.length} modules have no hours.`);
  const noOutcomes = modules.filter((m) => !m.outcomes.length).length;
  if (noOutcomes) flags.push(`${noOutcomes} of ${modules.length} modules list no outcomes.`);
  const sum = modules.reduce((s, m) => s + (m.credits || 0), 0);
  if (programme.credits && sum && !modules.some((m) => m.isElective) && sum !== programme.credits) {
    flags.push(`Module credits add to ${sum}, but the programme states ${programme.credits}.`);
  }
  return flags;
}
