// XSD datatype catalogue https://www.w3.org/2001/sw/DataAccess/rq23/rq25.html
export const XSD = {
    // Unbounded numeric types, literal
    integer: 'xsd:integer',
    decimal: 'xsd:decimal',
    float: 'xsd:float',
    double: 'xsd:double',
    string: 'xsd:string',
    boolean: 'xsd:boolean',
    dateTime: 'xsd:dateTime',

    nonPositiveInteger: 'xsd:nonPositiveInteger',
    negativeInteger: 'xsd:negativeInteger',
    long: 'xsd:long',
    // Bounded numeric types
    int: 'xsd:int',
    short: 'xsd:short',
    byte: 'xsd:byte',
    nonNegativeInteger: 'xsd:nonNegativeInteger',
    unsignedLong: 'xsd:unsignedLong',
    unsignedInt: 'xsd:unsignedInt',
    unsignedShort: 'xsd:unsignedShort',
    unsignedByte: 'xsd:unsignedByte',
    positiveInteger: 'xsd:positiveInteger',

    // Other types
    date: 'xsd:date',
    time: 'xsd:time',
    anyURI: 'xsd:anyURI',
    hexBinary: 'xsd:hexBinary',
    base64Binary: 'xsd:base64Binary',
} as const;
export type XsdDatatype = typeof XSD[keyof typeof XSD];

// Does a JS value satisfy an XSD datatype CURIE?
// Extend the switch as you add datatypes to XSD.
export function jsMatchesXsd(curie: string, v: unknown): boolean {
    switch (curie) {
        case XSD.string:
            return typeof v === 'string';
        case XSD.boolean:
            return typeof v === 'boolean';
        case XSD.integer:
        case XSD.byte:
        case XSD.unsignedInt:
        case XSD.unsignedLong:
        case XSD.unsignedShort:
            return typeof v === 'number' && Number.isInteger(v);
        case XSD.decimal:
        case XSD.double:
        case XSD.float:
            return typeof v === 'number';
        case XSD.dateTime:
        case XSD.date:
        case XSD.time:
            return v instanceof Date || (typeof v === 'string' && !Number.isNaN(Date.parse(v)));
        case XSD.anyURI:
        case XSD.hexBinary:
            return typeof v === 'string';
        /* unknown datatype */
        default:
            throw new Error(`Unknown datatype ${curie}`);
        // return false;
    }
}

