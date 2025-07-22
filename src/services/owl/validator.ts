import { CLASS_IRI, getClassMeta, Restriction, XSD } from './ontology';
import { PM } from '../prefixes';
import { jsMatchesXsd } from './xsd-utils';
import { isLiteralSpec } from "./sparql-utils";
import { OwlClass } from "./owl-class";

/**
 * OntologyValidator checks if an object adheres to the restrictions defined in its class metadata.
 * It validates cardinality, datatype, enumeration, pattern, and nested class constraints.
 */
export class OntologyValidator {
    static validate(root: unknown, path?: string): void {
        const { propRestr, classIri } = getClassMeta(root as object);
        if (path == null) path = (root as OwlClass).iri ? PM.ensurePrefixed((root as OwlClass).iri!) : PM.ensurePrefixed(classIri);

        for (const [field, rule] of Object.entries(propRestr)) {
            const value = (root as any)[field];
            const curPath = `${path}.${field}`;

            // CARDINALITY
            const count = Array.isArray(value) ? value.length : (value !== undefined ? 1 : 0);
            if (rule.max === 0 && count > 0)
                throw new Error(`Property ${curPath} is forbidden`);
            if (rule.min !== undefined && count < rule.min)
                throw new Error(`Property ${curPath} needs ≥${rule.min} value(s)`);
            if (rule.max !== undefined && count > rule.max)
                throw new Error(`Property ${curPath} allows ≤${rule.max} value(s)`);
            if (rule.exactly !== undefined && count !== rule.exactly)
                throw new Error(`Property ${curPath} needs exactly ${rule.exactly} value(s)`);

            if (count === 0) continue;                       // optional & absent

            for (const v of (Array.isArray(value) ? value : [value])) {
                // DATATYPE
                if (rule.datatype) {
                    const curie = PM.ensurePrefixed(rule.datatype);  // decorator already normalised
                    const isLiteralObject = isLiteralSpec(v);
                    if (!jsMatchesXsd(curie, isLiteralObject ?v.value : v)) {
                        throw new Error(`Property ${curPath} expects datatype ${curie} but got ${isLiteralObject ? v.datatype : typeof v}`);
                    }
                }

                // ENUMERATION
                if (rule.oneOf && !rule.oneOf.includes(v))
                    throw new Error(`Property ${curPath} expects one of ${JSON.stringify(rule.oneOf)} but got ${v}`);

                // PATTERN
                if (rule.pattern && typeof v === 'string' && !rule.pattern.test(v))
                    throw new Error(`Value '${v}' of ${curPath} violates pattern ${rule.pattern}`);

                // NESTED CLASS, no validation for NamedNode
                if (rule.onClass && v.termType !== 'NamedNode') {
                    if (Reflect.hasMetadata(CLASS_IRI, v)) {
                        const expected = PM.ensurePrefixed(rule.onClass);
                        const meta = getClassMeta(v as object);
                        const actual = PM.ensurePrefixed(meta.classIri);

                        if (actual !== expected)
                            throw new Error(`Nested object at ${curPath} must be of class ${expected}`);
                        this.validate(v, curPath);                  // recurse
                    } else {

                    }
                }
            }
        }
    }
}
