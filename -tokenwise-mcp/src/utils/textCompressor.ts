const FILLER_OPENERS = [
  /^(Sure!?\s*|Of course!?\s*|Absolutely!?\s*|Certainly!?\s*|Great question!?\s*)/i,
  /^I'?d be happy to\s+/i,
  /^I'?d love to help\s*/i,
];

const PHRASE_MAP: Array<[RegExp, string]> = [
  [/\bin order to\b/gi, "to"],
  [/\bat this point in time\b/gi, "now"],
  [/\bdue to the fact that\b/gi, "because"],
  [/\bin the event that\b/gi, "if"],
  [/\bfor the purpose of\b/gi, "for"],
  [/\bit is important to note that\b/gi, "note:"],
  [/\bplease be advised that\b/gi, ""],
  [/\bas previously mentioned\b/gi, ""],
];

export type Aggressiveness = "low" | "medium" | "high";

export function compress(
  text: string,
  level: Aggressiveness
): string {

  let out = text;

  // --------------------------------------------------
  // STEP 1: Normalize whitespace
  // --------------------------------------------------

  out = out
    .replace(/\t/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/ {2,}/g, " ");

  out = out
    .split("\n")
    .map(line => line.trimEnd())
    .join("\n");

  out = out.replace(/\n{3,}/g, "\n\n");

  if (level === "low") {
    return out.trim();
  }

  // --------------------------------------------------
  // STEP 2: Replace unnecessary phrases
  // --------------------------------------------------

  for (const [pattern, replacement] of PHRASE_MAP) {
    out = out.replace(pattern, replacement);
  }

  // --------------------------------------------------
  // STEP 3: Clean whitespace after replacements
  // --------------------------------------------------

  out = out
    .replace(/ {2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n");

  // Clean punctuation created by removed phrases
  out = out.replace(/,\s*,/g, ",");
  out = out.replace(/([.!?:])\s*,\s+/g, "$1 ");
  out = out.replace(/^\s*,\s*/, "");

  if (level === "medium") {
    return out.trim();
  }

  // --------------------------------------------------
  // STEP 4: Remove filler openers
  // --------------------------------------------------

  out = out
    .split("\n")
    .map(line => {
      let l = line;

      for (const re of FILLER_OPENERS) {
        l = l.replace(re, "");
      }

      return l;
    })
    .join("\n");

  // --------------------------------------------------
  // STEP 5: Final whitespace normalization
  // --------------------------------------------------

  out = out
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return out;
}