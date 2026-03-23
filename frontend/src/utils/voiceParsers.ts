// Voice transcript parsers for ingredient and dish forms

export interface ParsedIngredient {
  name?: string;
  category?: string;
  quantity?: string;
  unit?: string;
  minQuantity?: string;
  supplier?: string;
  targetPrice?: string;
}

export interface ParsedDish {
  dishName?: string;
  dishType?: string;
  price?: string;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const UNIT_SYNONYMS: Record<string, string> = {
  'kg': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
  'g': 'g', 'gram': 'g', 'grams': 'g',
  'l': 'L', 'liter': 'L', 'liters': 'L', 'litre': 'L', 'litres': 'L',
  'ml': 'ml', 'milliliter': 'ml', 'milliliters': 'ml', 'millilitre': 'ml', 'millilitres': 'ml',
  'pcs': 'pcs', 'piece': 'pcs', 'pieces': 'pcs', 'pc': 'pcs',
};

function normalizeUnit(unit: string): string | null {
  return UNIT_SYNONYMS[unit.toLowerCase()] ?? null;
}

// Maps spoken number words to their numeric values.
// Handles: "five", "twenty", "five fifty" (→ 5.50), "three dollars fifty cents", etc.
const WORD_ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19,
};
const WORD_TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};

/**
 * Tries to parse a price from a text segment that may contain:
 *  - digit literals: "5.50", "$3.00"
 *  - spoken dollars/cents: "5 dollars 50 cents"
 *  - shorthand spoken: "five fifty" → 5.50, "three dollars fifty" → 3.50
 *  - single word: "five" → 5.00
 */
function extractPrice(text: string): string | null {
  const t = text.trim().toLowerCase();

  // "5 dollars 50 cents" / "3 dollars"
  const dcMatch = t.match(/(\d+(?:\.\d+)?)\s+dollars?(?:\s+(\d+(?:\.\d+)?)\s+cents?)?/i);
  if (dcMatch) {
    const dollars = parseFloat(dcMatch[1]);
    const cents = dcMatch[2] ? parseFloat(dcMatch[2]) / 100 : 0;
    return (dollars + cents).toFixed(2);
  }

  // "five dollars fifty cents" / "five dollars fifty"
  const wordsPattern = Object.keys({ ...WORD_ONES, ...WORD_TENS }).join('|');
  const wdcRe = new RegExp(
    `(${wordsPattern})\\s+dollars?(?:\\s+(${wordsPattern})(?:\\s+cents?)?)?`,
    'i'
  );
  const wdcMatch = t.match(wdcRe);
  if (wdcMatch) {
    const d = WORD_ONES[wdcMatch[1].toLowerCase()] ?? WORD_TENS[wdcMatch[1].toLowerCase()] ?? 0;
    const c = wdcMatch[2]
      ? (WORD_ONES[wdcMatch[2].toLowerCase()] ?? WORD_TENS[wdcMatch[2].toLowerCase()] ?? 0) / 100
      : 0;
    return (d + c).toFixed(2);
  }

  // "five fifty" → 5.50  (one word = dollars, second word = cents as whole number)
  const twoWordRe = new RegExp(`(?:^|\\s)(${wordsPattern})\\s+(${wordsPattern})(?:\\s|$)`, 'i');
  const twoWordMatch = t.match(twoWordRe);
  if (twoWordMatch) {
    const dollars = WORD_ONES[twoWordMatch[1].toLowerCase()] ?? WORD_TENS[twoWordMatch[1].toLowerCase()];
    const cents = WORD_ONES[twoWordMatch[2].toLowerCase()] ?? WORD_TENS[twoWordMatch[2].toLowerCase()];
    if (dollars !== undefined && cents !== undefined) {
      return (dollars + cents / 100).toFixed(2);
    }
  }

  // Single word number: "five" → 5.00
  const oneWordRe = new RegExp(`^(?:price\\s+|cost\\s+|\\$)?\\s*(${wordsPattern})$`, 'i');
  const oneWordMatch = t.match(oneWordRe);
  if (oneWordMatch) {
    const v = WORD_ONES[oneWordMatch[1].toLowerCase()] ?? WORD_TENS[oneWordMatch[1].toLowerCase()];
    if (v !== undefined) return v.toFixed(2);
  }

  // "$5.50" or numeric
  const numMatch = t.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  if (numMatch) return parseFloat(numMatch[1]).toFixed(2);

  return null;
}

function extractQuantityUnit(segment: string): { quantity: string; unit: string } | null {
  const match = segment.match(/^(\d+(?:\.\d+)?)\s+([a-zA-Z]+)/);
  if (match) {
    const unit = normalizeUnit(match[2]);
    if (unit) return { quantity: match[1], unit };
  }
  const numMatch = segment.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) return { quantity: numMatch[1], unit: 'kg' };
  return null;
}

/** Converts a single spoken word (e.g. "three", "twenty") to a number, or null if not recognised. */
function spokenToNumber(word: string): number | null {
  const w = word.trim().toLowerCase();
  if (w in WORD_ONES) return WORD_ONES[w];
  if (w in WORD_TENS) return WORD_TENS[w];
  const n = parseFloat(w);
  return isNaN(n) ? null : n;
}

// ─── Edit-command detection ───────────────────────────────────────────────────
// Detects patterns like:
//   "change the dish name to chicken rice"
//   "set the name to nasi lemak"
//   "update the price to five fifty"
//   "change the category to noodle dish"

type FieldKey = 'dishName' | 'dishType' | 'price' | 'name' | 'category' | 'quantity' | 'minQuantity' | 'supplier' | 'targetPrice';

const DISH_FIELD_ALIASES: Record<string, FieldKey> = {
  'dish name': 'dishName', 'name': 'dishName', 'title': 'dishName',
  'category': 'dishType', 'dish type': 'dishType', 'type': 'dishType',
  'price': 'price', 'selling price': 'price', 'cost': 'price',
};

const INGREDIENT_FIELD_ALIASES: Record<string, FieldKey> = {
  'ingredient name': 'name', 'item name': 'name', 'name': 'name',
  'category': 'category',
  'quantity': 'quantity', 'amount': 'quantity',
  'unit': 'unit',
  'minimum quantity': 'minQuantity', 'minimum': 'minQuantity', 'min quantity': 'minQuantity',
  'supplier': 'supplier',
  'target price': 'targetPrice', 'price': 'targetPrice', 'cost': 'targetPrice',
};

function detectEditCommand(
  transcript: string,
  fieldAliases: Record<string, FieldKey>
): { field: FieldKey; value: string } | null {
  // Pattern: "change/set/update [the] <field> to <value>"
  const lower = transcript.toLowerCase().trim();
  const actionRe = /^(?:change|set|update|make)\s+(?:the\s+)?/i;
  if (!actionRe.test(lower)) return null;

  const withoutAction = transcript.replace(actionRe, '').trim();
  const lower2 = withoutAction.toLowerCase();

  // Sort aliases longest-first so "dish name" matches before "name"
  const sortedAliases = Object.keys(fieldAliases).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    if (lower2.startsWith(alias.toLowerCase())) {
      // Everything after "<alias> to"
      const rest = withoutAction.slice(alias.length).trim();
      const toMatch = rest.match(/^to\s+(.+)$/i);
      if (toMatch) {
        return { field: fieldAliases[alias], value: toMatch[1].trim().replace(/[.,!?]+$/, '') };
      }
    }
  }
  return null;
}

// ─── Dish parser ─────────────────────────────────────────────────────────────

/**
 * Parses a voice transcript into dish form fields.
 *
 * Handles:
 *  - Comma-separated: "Chicken Rice, rice dish, price 5.50"
 *  - Edit commands: "change the dish name to nasi lemak"
 *  - Free-form: "nasi lemak rice dish five fifty"
 */
export function parseDishTranscript(transcript: string): ParsedDish {
  const result: ParsedDish = {};
  const trimmed = transcript.trim();
  if (!trimmed) return result;

  // 1. Edit-command handling
  const editCmd = detectEditCommand(trimmed, DISH_FIELD_ALIASES);
  if (editCmd) {
    const { field, value } = editCmd;
    if (field === 'dishName') {
      result.dishName = toTitleCase(value);
    } else if (field === 'dishType') {
      result.dishType = normalizeDishType(value);
    } else if (field === 'price') {
      const p = extractPrice(value);
      if (p) result.price = p;
    }
    return result;
  }

  const segments = trimmed.split(/,\s*/);

  if (segments.length >= 2) {
    // 2. Comma-separated path
    result.dishName = toTitleCase(segments[0].trim());

    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i].trim();
      if (!seg) continue;

      // Dish type
      const dt = normalizeDishType(seg);
      if (dt && !result.dishType) { result.dishType = dt; continue; }

      // Price
      const p = extractPrice(seg);
      if (p && !result.price) { result.price = p; continue; }
    }
  } else {
    // 3. No commas — greedy left-to-right
    // Strip trailing period added by STT
    const clean = trimmed.replace(/\.\s*$/, '');
    const lower = clean.toLowerCase();

    // Detect dish type phrase in the text
    const dishTypeInfo = detectDishTypeInText(lower);
    if (dishTypeInfo) {
      result.dishType = dishTypeInfo.type;
      // Name = everything before the dish type phrase
      const beforeType = clean.slice(0, dishTypeInfo.index).trim();
      if (beforeType) result.dishName = toTitleCase(beforeType);
      // Price = everything after
      const afterType = clean.slice(dishTypeInfo.index + dishTypeInfo.length).trim();
      if (afterType) {
        const p = extractPrice(afterType);
        if (p) result.price = p;
      }
    } else {
      // No category keyword — try to split on a price keyword or number
      const priceIdx = findPriceStart(lower);
      if (priceIdx > 0) {
        result.dishName = toTitleCase(clean.slice(0, priceIdx).trim());
        const p = extractPrice(clean.slice(priceIdx).trim());
        if (p) result.price = p;
      } else {
        // Entire phrase is probably just the dish name
        result.dishName = toTitleCase(clean);
      }
    }
  }

  return result;
}

function normalizeDishType(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes('noodle')) return 'Noodle Dishes';
  if (t.includes('rice')) return 'Rice Dishes';
  if (t === 'other') return 'Other';
  return null;
}

function detectDishTypeInText(lower: string): { type: string; index: number; length: number } | null {
  const patterns: [RegExp, string][] = [
    [/noodle\s*dish(?:es)?/i, 'Noodle Dishes'],
    [/rice\s*dish(?:es)?/i, 'Rice Dishes'],
    [/noodle/i, 'Noodle Dishes'],
    [/\bother\b/i, 'Other'],
    // "rice" only matches if not part of the dish name — checked last so
    // patterns above take precedence
    [/\brice\b/i, 'Rice Dishes'],
  ];
  for (const [re, type] of patterns) {
    const m = lower.match(re);
    if (m && m.index !== undefined) {
      return { type, index: m.index, length: m[0].length };
    }
  }
  return null;
}

/** Find the index where a price expression starts in the text. */
function findPriceStart(lower: string): number {
  const priceKeywords = /(?:price|selling|at|for|costs?|\$)/;
  const m = lower.match(priceKeywords);
  if (m && m.index !== undefined) return m.index;
  // Fallback: first digit
  const dm = lower.match(/\d/);
  if (dm && dm.index !== undefined) return dm.index;
  return -1;
}

function toTitleCase(str: string): string {
  return str
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ─── Ingredient parser ────────────────────────────────────────────────────────

/**
 * Parses a voice transcript into ingredient form fields.
 *
 * Handles:
 *  - Comma-separated: "Yellow Noodles, Noodles, 10 kg, minimum 2, supplier Fresh Market, price 3.50"
 *  - Edit commands: "change the name to bean sprouts"
 *  - Free-form: "yellow noodles noodles 10 kg minimum 2"
 */
export function parseIngredientTranscript(
  transcript: string,
  supplierNames: string[],
  availableCategories: string[]
): ParsedIngredient {
  const result: ParsedIngredient = {};
  const trimmed = transcript.trim();
  if (!trimmed) return result;

  // 1. Edit-command handling
  const editCmd = detectEditCommand(trimmed, INGREDIENT_FIELD_ALIASES);
  if (editCmd) {
    const { field, value } = editCmd;
    if (field === 'name') {
      result.name = toTitleCase(value);
    } else if (field === 'category') {
      const matchedCat = availableCategories.find(
        (c) => c.toLowerCase() === value.toLowerCase() || value.toLowerCase().includes(c.toLowerCase())
      );
      if (matchedCat) result.category = matchedCat;
    } else if (field === 'quantity') {
      const qtyUnit = extractQuantityUnit(value);
      if (qtyUnit) { result.quantity = qtyUnit.quantity; result.unit = qtyUnit.unit; }
      else {
        const clean = value.replace(/[^0-9.]/g, '');
        if (clean) result.quantity = clean;
        else { const n = spokenToNumber(value); if (n !== null) result.quantity = String(n); }
      }
    } else if (field === 'minQuantity') {
      const clean = value.replace(/[^0-9.]/g, '');
      if (clean) result.minQuantity = clean;
      else { const n = spokenToNumber(value); if (n !== null) result.minQuantity = String(n); }
    } else if (field === 'supplier') {
      const found = supplierNames.find(
        (s) => s.toLowerCase().includes(value.toLowerCase()) || value.toLowerCase().includes(s.toLowerCase())
      );
      if (found) result.supplier = found;
    } else if (field === 'targetPrice') {
      const p = extractPrice(value);
      if (p) result.targetPrice = p;
    }
    return result;
  }

  // Normalize common STT unit spellings
  const normalized = trimmed
    .replace(/\bkilograms?\b/gi, 'kg')
    .replace(/\bgrams?\b/gi, 'g')
    .replace(/\bliters?|litres?\b/gi, 'L')
    .replace(/\bmilliliters?|millilitres?\b/gi, 'ml')
    .replace(/\bpieces?\b/gi, 'pcs')
    .replace(/\.\s*$/, ''); // strip trailing period

  const segments = normalized.split(/,\s*/);

  if (segments.length >= 2) {
    // 2. Comma-separated path
    result.name = toTitleCase(segments[0].trim());

    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i].trim();
      const segLower = seg.toLowerCase();
      if (!seg) continue;

      // Category check
      const matchedCat = availableCategories.find(
        (c) => segLower === c.toLowerCase() || segLower.includes(c.toLowerCase())
      );
      if (matchedCat && !result.category) { result.category = matchedCat; continue; }

      // Minimum quantity: "minimum 2", "minimum quantity 2", "minimum five"
      const minMatch = seg.match(/min(?:imum)?(?:\s+quantity)?\s+(\d+(?:\.\d+)?|[a-zA-Z]+)\s*([a-zA-Z]*)/i);
      if (minMatch) {
        const rawMin = minMatch[1];
        const minNum = /^\d/.test(rawMin) ? rawMin : (spokenToNumber(rawMin) !== null ? String(spokenToNumber(rawMin)) : null);
        if (minNum) {
          result.minQuantity = minNum;
          if (minMatch[2] && !result.unit) {
            const u = normalizeUnit(minMatch[2]);
            if (u) result.unit = u;
          }
          continue;
        }
      }

      // Supplier: "supplier Fresh Market"
      const supplierMatch = seg.match(/supplier\s+(.+)/i);
      if (supplierMatch) {
        const spokenName = supplierMatch[1].trim();
        const found = supplierNames.find(
          (s) =>
            s.toLowerCase().includes(spokenName.toLowerCase()) ||
            spokenName.toLowerCase().includes(s.toLowerCase())
        );
        if (found) result.supplier = found;
        continue;
      }

      // Price: "price 3.50" or "$3.50"
      if (segLower.includes('price') || segLower.includes('$') || segLower.includes('cost')) {
        const p = extractPrice(seg);
        if (p) { result.targetPrice = p; continue; }
      }

      // Quantity + optional unit: "10 kg" or just "10"
      const qtyUnit = extractQuantityUnit(seg);
      if (qtyUnit) {
        if (!result.quantity) {
          result.quantity = qtyUnit.quantity;
          result.unit = qtyUnit.unit;
        } else if (!result.minQuantity) {
          result.minQuantity = qtyUnit.quantity;
        } else if (!result.targetPrice) {
          result.targetPrice = qtyUnit.quantity;
        }
        continue;
      }
    }
  } else {
    // 3. No commas — keyword-based fallback
    const lower = normalized.toLowerCase();

    // Category check first so we know where the name ends
    let categoryIndex = -1;
    let matchedCategory: string | undefined;
    for (const cat of availableCategories) {
      const idx = lower.indexOf(cat.toLowerCase());
      if (idx !== -1 && (categoryIndex === -1 || idx < categoryIndex)) {
        categoryIndex = idx;
        matchedCategory = cat;
      }
    }
    if (matchedCategory) result.category = matchedCategory;

    // Minimum keyword index
    const minKwIdx = lower.search(/\bmin(?:imum)?\b/);
    // Supplier keyword index
    const supplierKwIdx = lower.search(/\bsupplier\b/);
    // Price keyword index
    const priceKwIdx = lower.search(/\bprice\b|\bcost\b|\$/);

    // Name ends at the first of: category, minimum, supplier, price, or first digit
    const endCandidates = [
      categoryIndex,
      minKwIdx,
      supplierKwIdx,
      priceKwIdx,
    ].filter((i) => i > 0);
    // Also consider first standalone digit
    const firstDigitMatch = normalized.match(/\b\d/);
    if (firstDigitMatch?.index) endCandidates.push(firstDigitMatch.index);

    const nameEnd = endCandidates.length > 0 ? Math.min(...endCandidates) : normalized.length;
    if (nameEnd > 0) result.name = toTitleCase(normalized.slice(0, nameEnd).trim());

    // All quantity+unit pairs
    const allQtyUnit = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s+(kg|g|L|ml|pcs)/g)];
    if (allQtyUnit.length >= 1) {
      result.quantity = allQtyUnit[0][1];
      result.unit = allQtyUnit[0][2];
    }
    if (allQtyUnit.length >= 2) {
      result.minQuantity = allQtyUnit[1][1];
    }

    // Minimum keyword: "minimum 2", "minimum quantity 2", "minimum five"
    if (!result.minQuantity) {
      const minMatch = normalized.match(/\bmin(?:imum)?(?:\s+quantity)?\s+(\d+(?:\.\d+)?|[a-zA-Z]+)/i);
      if (minMatch) {
        const rawMin = minMatch[1];
        if (/^\d/.test(rawMin)) result.minQuantity = rawMin;
        else { const n = spokenToNumber(rawMin); if (n !== null) result.minQuantity = String(n); }
      }
    }

    // Price keyword
    const priceMatch = normalized.match(/(?:price|cost)\s+(.+?)(?:,|$)/i);
    if (priceMatch) {
      const p = extractPrice(priceMatch[1]);
      if (p) result.targetPrice = p;
    }

    // Supplier keyword
    const supplierMatch = normalized.match(/\bsupplier\s+([A-Za-z\s]+?)(?=\s+\d|\s+price|\s+cost|$)/i);
    if (supplierMatch) {
      const spokenName = supplierMatch[1].trim();
      const found = supplierNames.find(
        (s) =>
          s.toLowerCase().includes(spokenName.toLowerCase()) ||
          spokenName.toLowerCase().includes(s.toLowerCase())
      );
      if (found) result.supplier = found;
    }
  }

  return result;
}

