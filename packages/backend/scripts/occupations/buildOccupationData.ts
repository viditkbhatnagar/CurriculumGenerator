/**
 * Builds the occupation-code data (data/occupations/*.json.gz) from the official downloads.
 *
 *   npx tsx scripts/occupations/buildOccupationData.ts <raw-dir>
 *
 * <raw-dir> holds the files listed in data/occupations/SOURCES.md:
 *   onet/occupation_data.csv, onet/task_statements.csv, onet/job_titles.csv
 *   uk/extended_soc2020.xlsx
 *   sg/ssoc2024_definitions.xlsx
 *   in/nco2015_Vol_I.pdf, in/nco2015_Vol_II-A.pdf, in/nco2015_Vol_II-B.pdf
 * The PDFs are read with poppler's pdftotext, which must be installed.
 *
 * Offline and deterministic: the output is committed, and the server loads it (occupationStore).
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execFileSync } from 'child_process';
import ExcelJS from 'exceljs';
import {
  OccupationRecord,
  parseNco,
  parseOnet,
  parseSsoc,
  parseUkSoc,
} from '../../src/services/occupations/occupationParsers';

const raw = process.argv[2];
if (!raw) throw new Error('Usage: buildOccupationData.ts <raw-dir>');
const OUT = path.join(__dirname, '../../data/occupations');

const cellText = (v: any): string => {
  if (v == null) return '';
  if (v.richText) return v.richText.map((t: any) => t.text).join('');
  if (v.text) return String(v.text);
  if (v.result != null) return String(v.result);
  return String(v);
};

async function sheetRows(file: string, sheet: string): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet(sheet);
  if (!ws) throw new Error(`No sheet "${sheet}" in ${file}`);
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    rows.push(((row.values as any[]) || []).slice(1).map(cellText));
  });
  return rows;
}

const pdfText = (file: string, mode: '-layout' | '-raw') =>
  execFileSync('pdftotext', [mode, file, '-'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');

function write(name: string, records: OccupationRecord[]) {
  const file = path.join(OUT, `${name}.json.gz`);
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(records)));
  return `${name}: ${records.length} occupations, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const read = (p: string) => fs.readFileSync(path.join(raw, p), 'utf8');

  const onet = parseOnet(
    read('onet/occupation_data.csv'),
    read('onet/task_statements.csv'),
    read('onet/job_titles.csv')
  );
  const uk = parseUkSoc(
    await sheetRows(path.join(raw, 'uk/extended_soc2020.xlsx'), 'Extended SOC descriptions')
  );
  const sg = parseSsoc(
    await sheetRows(path.join(raw, 'sg/ssoc2024_definitions.xlsx'), 'SSOC2024 Detailed Definitions')
  );
  const nco = parseNco(pdfText(path.join(raw, 'in/nco2015_Vol_I.pdf'), '-layout'), [
    pdfText(path.join(raw, 'in/nco2015_Vol_II-A.pdf'), '-raw'),
    pdfText(path.join(raw, 'in/nco2015_Vol_II-B.pdf'), '-raw'),
  ]);

  const summary = [
    write('us-onet', onet),
    write('uk-soc2020', uk),
    write('sg-ssoc2024', sg),
    write('in-nco2015', nco.records),
  ];
  const stats = {
    us: { occupations: onet.length, withTasks: onet.filter((o) => o.tasks.length).length },
    uk: {
      subUnitGroups: uk.length,
      unitGroups: new Set(uk.map((o) => o.group?.code)).size,
      withDescription: uk.filter((o) => o.description).length,
    },
    sg: {
      occupations: sg.length,
      withTasks: sg.filter((o) => o.tasks.length).length,
      unitGroups: new Set(sg.map((o) => o.group?.code)).size,
    },
    in: {
      occupations: nco.records.length,
      families: nco.structure.families.size,
      withDescription: nco.described,
    },
  };
  console.log(summary.join('\n'));
  console.log(JSON.stringify(stats, null, 1));
})();
