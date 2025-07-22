import { XSD } from "./ontology";

/** Wrapper for language-tagged or explicitly typed literals */
export interface LiteralSpec {
    value: string | number | bigint | boolean | Date;
    /** e.g. "en", "zh-Hans" (mutually exclusive with datatype) */
    lang?:  string;
    /** full IRI or CURIE, e.g. xsd:hexBinary  */
    datatype?: string;
}

/** True if `s` already looks like an RDF literal. Very permissive by design. */
const SPARQL_LITERAL_RE =
    /^"[^"\\]*(?:\\.[^"\\]*)*"(?:@[a-zA-Z\-]+|\^\^(?:<[^>]*>|\w+:\w+))?$/;

/**
 * Convert a JS value (or a LiteralSpec object) into a valid SPARQL literal
 * string.  NEVER returns null or undefined.
 */
export function escapeLiteral(
    input: unknown,
    /** default numeric datatype when value is `number` & not integer */
    floatDatatype: 'xsd:decimal' | 'xsd:double' = 'xsd:decimal'
): string {
    // -------------------------------------------------------------
    // 1. Explicit spec object  { value, lang?, datatype? }
    // ----------------------------------------------------------------
    if (isLiteralSpec(input)) {
        const { value, lang, datatype } = input;
        if (lang && datatype)
            throw new Error('Literal cannot have both lang and datatype');

        const lit = escapePrimitive(value);
        if (lang)      return `${lit}@${lang}`;
        if (datatype)  return `${lit}^^${datatype}`;
        return lit;
    }

    // ────────────────────────────────────────────────────────────────
    // 2. null / undefined  → empty literal
    // ----------------------------------------------------------------
    if (input === null || input === undefined) return '""';

    // ────────────────────────────────────────────────────────────────
    // 3. Already an escaped literal  → return untouched
    // ----------------------------------------------------------------
    if (typeof input === 'string' && SPARQL_LITERAL_RE.test(input)) {
        return input;
    }

    // ────────────────────────────────────────────────────────────────
    // 4. Primitive shortcut cases (number / boolean / bigint / date)
    // ----------------------------------------------------------------
    if (typeof input === 'number') {
        const dt = Number.isInteger(input) ? 'xsd:integer' : floatDatatype;
        return `"${input}"^^${dt}`;
    }

    if (typeof input === 'bigint') {
        return `"${input.toString()}"^^xsd:integer`;
    }

    if (typeof input === 'boolean') {
        return `"${input}"^^xsd:boolean`;
    }

    if (input instanceof Date) {
        return `"${input.toISOString()}"^^xsd:dateTime`;
    }

    // ────────────────────────────────────────────────────────────────
    // 5. Fallback: stringify *anything* else
    //    (Buffer, URL, Symbol, RegExp, typed arrays, objects…)
    // ----------------------------------------------------------------
    return escapePrimitive(input);
}

// Helpers
// =======

export function isLiteralSpec(v: unknown): v is LiteralSpec {
    return (
        // @ts-ignore
        v?.termType !== 'NamedNode' &&
        typeof v === 'object' &&
        v !== null &&
        'value' in (v as Record<string, unknown>)
    );
}

/** Escape → "\"quotable\" and control chars\nlike this" */
function escapePrimitive(v: unknown): string {
    const str = String(v);
    const escaped = str.replace(/[\\"\n\r\t\b\f\v\u0000-\u001F]/g, ch => {
        switch (ch) {
            case '\\': return '\\\\';
            case '"':  return '\\"';
            case '\n': return '\\n';
            case '\r': return '\\r';
            case '\t': return '\\t';
            case '\b': return '\\b';
            case '\f': return '\\f';
            case '\v': return '\\v';
            default:   // control char
                return `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`;
        }
    });
    return `"${escaped}"`;
}
