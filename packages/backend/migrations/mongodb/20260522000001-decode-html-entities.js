/**
 * Decode HTML entities in stored curriculum workflow text.
 *
 * A former input sanitizer HTML-escaped every string on the way into the
 * database (`&` -> `&amp;`, `/` -> `&#x2F;`, `'` -> `&#x27;`, etc.). That
 * corrupted titles, descriptions and all generated content — the entities
 * show up literally in the app and in Word/PDF exports. The sanitizer no
 * longer escapes; this migration cleans the data already stored.
 *
 * It walks every `curriculumworkflows` document, decodes HTML entities in
 * every string field (repeatedly, to undo double-encoding), and writes
 * the document back. BSON types (ObjectId, Date, Binary, ...) are left
 * untouched. Run with: npm run migrate:up
 */

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeOnce(str) {
  return str.replace(/&(#?[a-zA-Z0-9]+);/g, (match, entity) => {
    if (NAMED[entity] !== undefined) return NAMED[entity];
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return match;
  });
}

/** Decode repeatedly so double-encoded values (`&amp;#x2F;`) resolve fully. */
function decode(str) {
  let current = str;
  for (let pass = 0; pass < 4; pass++) {
    const next = decodeOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

/** Recursively decode strings; leave BSON types and non-strings untouched. */
function walk(value) {
  if (typeof value === 'string') return decode(value);
  if (Array.isArray(value)) return value.map(walk);
  if (value && typeof value === 'object') {
    // ObjectId / Date / Binary / Decimal128 etc. — never recurse into these.
    if (value._bsontype || value instanceof Date) return value;
    const out = {};
    for (const key of Object.keys(value)) out[key] = walk(value[key]);
    return out;
  }
  return value;
}

module.exports = {
  async up(db) {
    const collection = db.collection('curriculumworkflows');
    const cursor = collection.find({});
    let scanned = 0;
    let updated = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      scanned++;
      const decoded = walk(doc);
      if (JSON.stringify(decoded) === JSON.stringify(doc)) continue;
      const { _id, ...rest } = decoded;
      await collection.replaceOne({ _id }, rest);
      updated++;
    }

    console.log(`Decoded HTML entities: ${updated} of ${scanned} workflow(s) updated`);
  },

  async down() {
    // Not reversible — re-encoding would also escape legitimate &, <, >
    // characters that users may have entered after the fix.
    console.log('decode-html-entities: down() is a no-op (not reversible)');
  },
};
