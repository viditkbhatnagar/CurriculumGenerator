/**
 * The name a programme is listed and headed by.
 *
 * The header, the programme list and download names show `projectName`; the documents show
 * Step 1's programme title. processStep1 kept the two equal, but a title changed by any other
 * route (the AI assistant, an edit) left the old name in place: "Certificate Programme in
 * Applied Fashion Design" headed a programme titled "Diploma in Applied Fashion Design"
 * (Dr Sherin, 7 October 2026). The workflow's save hook now applies this on every save.
 */
export function programmeNameFor(projectName: unknown, programTitle: unknown): string | undefined {
  const title = typeof programTitle === 'string' ? programTitle.trim() : '';
  if (!title) return undefined;
  return title === projectName ? undefined : title;
}
