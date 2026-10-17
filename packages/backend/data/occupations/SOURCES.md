# Occupation codes: sources and licences

National occupation classifications for the four countries Rejin chose on 16 October 2026 (India,
the US, the UK and Singapore). The `.json.gz` files are built from the official downloads below by
`scripts/occupations/buildOccupationData.ts`; each holds one record per occupation
(`OccupationRecord` in `src/services/occupations/occupationParsers.ts`).

| File                  | Classification                                 | Occupations                       | Publisher                                                          | Downloaded  |
| --------------------- | ---------------------------------------------- | --------------------------------- | ------------------------------------------------------------------ | ----------- |
| `us-onet.json.gz`     | O\*NET-SOC 2019 taxonomy, O\*NET 31.0 database | 1,016 (923 with task statements)  | US Department of Labor, Employment and Training Administration     | 17 Oct 2026 |
| `uk-soc2020.json.gz`  | Extended SOC 2020, version 7 (sub-unit groups) | 1,384 in 412 unit groups          | Office for National Statistics                                     | 17 Oct 2026 |
| `sg-ssoc2024.json.gz` | SSOC 2024 detailed definitions                 | 1,001 (972 with unit-group tasks) | Department of Statistics, Singapore                                | 17 Oct 2026 |
| `in-nco2015.json.gz`  | National Classification of Occupations 2015    | 3,452 (3,404 with descriptions)   | Directorate General of Employment, Ministry of Labour & Employment | 17 Oct 2026 |

## Downloads

- **O\*NET 31.0** (CSV): `https://www.onetcenter.org/dl_files/database/db_31_0_csv/` files
  `occupation_data.csv`, `task_statements.csv`, `job_titles.csv`.
- **Extended SOC 2020** (XLSX): ONS, "Extended SOC2020 structure and descriptions", 27 August 2026,
  sheet "Extended SOC descriptions":
  `https://www.ons.gov.uk/file?uri=/methodology/classificationsandstandards/standardoccupationalclassificationsoc/standardoccupationalclassificationsocextensionproject/extendedsoc2020structureanddescriptionsexcel20260827.xlsx`
- **SSOC 2024** (XLSX): SingStat, "SSOC 2024 Detailed Definitions":
  `https://www.singstat.gov.sg/files/456a230e-fa6a-41f6-9e7f-6d3f0ffcf521.xlsx`
- **NCO 2015** (PDF): DGE, Volumes I, II-A and II-B:
  `https://dge.gov.in/sites/default/files/2024-05/National_Classification_of_Occupations_Vol_I-2015.pdf`
  (and `…Vol_II-A-2015.pdf`, `…Vol_II-B-2015.pdf`). Read with poppler's `pdftotext`: Volume I's
  concordance for the structure (`-layout`), Volumes II-A and II-B for descriptions (`-raw`).

## Licences and attribution

- **O\*NET**: CC BY 4.0. "This product includes information from the O\*NET 31.0 Database by the
  U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the
  CC BY 4.0 license. O\*NET® is a trademark of USDOL/ETA."
- **UK SOC 2020**: Open Government Licence v3.0. "Contains public sector information licensed
  under the Open Government Licence v3.0" (source: Office for National Statistics).
- **SSOC 2024**: SingStat's SSOC 2024 report permits reproduction with the Department of
  Statistics, Singapore, credited as the source.
- **NCO 2015**: a Government of India publication; its download page states no reuse terms. Used
  here as reference data with the Directorate General of Employment credited; confirm terms before
  republishing the data itself.

## Known gaps

- UK records are prose descriptions; ONS's extended file has no separate task lists.
- Singapore states tasks per four-digit unit group, so each occupation carries its unit group's
  tasks.
- India: 48 occupations listed in Volume I have no description in Volume II. Seven occupations
  described in Volume II are missing from Volume I's table and are titled from Volume II; one
  of those titles (3127.9900) is cut short where Volume II wraps it.
