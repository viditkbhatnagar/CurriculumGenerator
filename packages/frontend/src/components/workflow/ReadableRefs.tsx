'use client';

import { useEffect, useState } from 'react';
import { getConceptReferences } from '@/lib/libraryApi';
import { findConceptCodes, replaceConceptCodes } from '@/lib/conceptReferences';

/** References already fetched, by programme and code, so a list of items asks once. */
const known = new Map<string, string>();

/**
 * Text with any library concept codes shown as readable book references. Text without codes
 * renders as it is and makes no request; if the lookup fails the codes stay as stored.
 */
export default function ReadableRefs({
  text,
  workflowId,
}: {
  text: string | undefined;
  workflowId?: string;
}) {
  const [, setVersion] = useState(0);
  const scope = workflowId || '';
  const codes = findConceptCodes(text);
  const wanted = codes.filter((c) => !known.has(`${scope}|${c}`)).join(',');

  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    getConceptReferences(wanted.split(','), workflowId)
      .then((refs) => {
        for (const r of refs) known.set(`${scope}|${r.code}`, r.reference);
        if (!cancelled) setVersion((v) => v + 1);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [wanted, workflowId, scope]);

  if (!text) return null;
  if (!codes.length) return <>{text}</>;
  const refs = new Map<string, string>();
  for (const c of codes) {
    const r = known.get(`${scope}|${c}`);
    if (r) refs.set(c, r);
  }
  return <>{replaceConceptCodes(text, refs)}</>;
}
