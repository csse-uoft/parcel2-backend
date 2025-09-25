import { XSD } from "./ontology";

/** Wrapper for language-tagged or explicitly typed literals */
export interface LiteralSpec {
    value: string | number | bigint | boolean | Date;
    /** e.g. "en", "zh-Hans" (mutually exclusive with datatype) */
    lang?: string;
    /** full IRI or CURIE, e.g. xsd:hexBinary  */
    datatype?: string;
}

/** True if `s` already looks like an RDF literal. Very permissive by design. */
const SPARQL_LITERAL_RE =
    /^"[^"\\]*(?:\\.[^"\\]*)*"(?:@[a-zA-Z\-]+|\^\^(?:<[^>]*>|\w+:\w+))?$/;

/**
 * Convert a JS value (or a LiteralSpec object) into a valid SPARQL literal
 * string.  NEVER returns null or undefined.
 * Type checks are strict and will throw errors if something is off.
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
        // Type checkings
        if (value instanceof Date) {
            if (datatype == XSD.dateTime || datatype == XSD.time || datatype == null) {
                // OK
                return `"${value.toISOString()}"^^${datatype || XSD.dateTime}`;
            } else if (datatype === XSD.date) {
                return `"${value.toISOString().slice(0, 10)}"^^${datatype}`;
            } else if (datatype === XSD.time) {
                return `"${value.toISOString().slice(11, 23)}"^^${datatype}`;
            } else {
                throw new Error('Date value must have xsd:date, xsd:dateTime or xsd:time datatype');
            }
        } else if (datatype === XSD.date || datatype === XSD.dateTime || datatype === XSD.time) {
            // try to convert string/number to date
            let date;
            if (typeof value === "string") {
                if (isNaN(Date.parse(value))) {
                    throw new Error(`Value "${value}" is not a valid date string`);
                } else {
                    date = new Date(value);
                }
            } else if (typeof value === "number") {
                if (!Number.isFinite(value)) {
                    throw new Error(`Value "${value}" is not a valid timestamp`);
                } else {
                    date = new Date(value);
                }
            } else {
                throw new Error(`Value of type ${typeof value} is not valid for datatype ${datatype}`);
            }
            return escapeLiteral({ value: date, datatype });
        } else if (typeof value === 'number') {
            if (datatype == null) {
                const dt = Number.isInteger(value) ? XSD.integer : floatDatatype;
                return `"${value}"^^${dt}`;
            } else if (datatype === XSD.integer || datatype === XSD.nonNegativeInteger
                || datatype === XSD.nonPositiveInteger || datatype === XSD.positiveInteger
                || datatype === XSD.negativeInteger || datatype === XSD.long
                || datatype === XSD.int || datatype === XSD.short) {
                if (!Number.isInteger(value)) {
                    throw new Error(`Value ${value} is not an integer as required by datatype xsd:integer`);
                }
            } else if (datatype === XSD.decimal || datatype === XSD.double || datatype === XSD.float) {
                // OK
            } else {
                throw new Error(`Unsupported numeric datatype ${datatype}`);
            }
            return `"${value}"^^${datatype}`;
        } else if (typeof value === 'bigint') {
            if (datatype == null || datatype === XSD.integer) {
                return escapeLiteral(value);
            } else {
                throw new Error(`BigInt value must have xsd:integer datatype`);
            }
        } else if (typeof value === 'boolean') {
            if (datatype == null || datatype === XSD.boolean) {
                return escapeLiteral(value);
            } else {
                throw new Error(`Boolean value must have xsd:boolean datatype`);
            }
        }

        // Fallback for string and any other types
        const lit = escapePrimitive(value);
        if (lang) return `${lit}@${lang}`;
        if (datatype) return `${lit}^^${datatype}`;
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
            case '\\':
                return '\\\\';
            case '"':
                return '\\"';
            case '\n':
                return '\\n';
            case '\r':
                return '\\r';
            case '\t':
                return '\\t';
            case '\b':
                return '\\b';
            case '\f':
                return '\\f';
            case '\v':
                return '\\v';
            default:   // control char
                return `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`;
        }
    });
    return `"${escaped}"`;
}
