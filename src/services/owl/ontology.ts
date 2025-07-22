import "reflect-metadata";
import { OwlClass } from "./owl-class";
import { PM } from "../prefixes";
import { XsdDatatype, XSD } from "./xsd-utils";

export { XsdDatatype, XSD, OwlClass, PM }

// Symbols used to store metadata keys
export const CLASS_IRI = Symbol("CLASS_IRI");
export const PROP_IRI = Symbol("PROP_IRI");
export const PROP_RESTR = Symbol("PROP_RESTR");

// Describes additional OWL / data-validation constraints on a property
export interface Restriction {
    // minimum allowed cardinality (0 → optional)
    min?: number;
    // maximum allowed cardinality (∞ if omitted)
    max?: number;
    // exactly this many values are required (mutually exclusive with min/max)
    exactly?: number;
    // value must be *exactly* one of these IRIs or literals, this is not in OWL2 but used in SHACL
    oneOf?: unknown[];
    // XSD datatype or CURIE for literals, mutually exclusive with onClass
    datatype?: XsdDatatype | string;
    // RegExp for string literals (requires datatype === xsd:string)
    pattern?: RegExp;
    // If object, required rdf:type for the value (owl:onClass / owl:allValuesFrom)
    onClass?: string;
}

// Extra options accepted by `@OntologyClass`
export interface ClassOptions {
    // Default namespace for new instances, e.g. `ex:organization`
    instanceBase?: string;
}

// Global registry of every mapped constructor keyed by its owl:Class IRI
export const CLASS_REGISTRY = new Map<string, typeof OwlClass>();

/**
 * Decorator for ontology classes.
 *
 * @param iri   Full IRI or CURIE identifying the OWL class.
 * @param opts  Per-class options (instance prefix, …)
 */
export function OntologyClass(
    iri: string,
    opts: ClassOptions = {}
) {
    return (target: Function) => {
        Reflect.defineMetadata(CLASS_IRI, iri, target);
        Reflect.defineMetadata("instanceBase", opts.instanceBase, target);

        // Auto-register constructor so we can look it up later
        CLASS_REGISTRY.set(PM.ensureExpanded(iri), target as typeof OwlClass);
    };
}

/**
 * Decorator for class properties.
 *
 * @param iri    IRI / CURIE of the predicate
 * @param restr  Optional set of restrictions (cardinality, datatype, …)
 */
export function OntologyProp(
    iri: string,
    restr: Restriction = {}
) {
    // Normalise datatype at decoration time
    if (restr.datatype) restr.datatype = PM.ensurePrefixed(restr.datatype);

    // — quick validation of mutually-exclusive flags —
    if (restr.exactly != null && (restr.min != null || restr.max != null))
        throw new Error(
            `Restriction for ${iri} cannot define both 'exactly' and 'min/max'.`
        );
    if (restr.min != null && restr.min < 0)
        throw new Error(`Restriction for ${iri} has min < 0.`);
    if (restr.max != null && restr.max < 0)
        throw new Error(`Restriction for ${iri} has max < 0.`);
    if (restr.oneOf && restr.datatype)
        throw new Error(`Restriction for ${iri} cannot have both 'oneOf' and 'datatype'.`);
    if (restr.pattern && restr.datatype !== XSD.string)
        throw new Error(`Pattern for ${iri} requires datatype xsd:string.`);
    if (restr.onClass && restr.datatype)
        throw new Error(`Restriction for ${iri} cannot have both 'onClass' and 'datatype'.`);

    return (target: Object, propKey: string | symbol) => {
        const ctor = target.constructor;
        const props = Reflect.getMetadata(PROP_IRI, ctor) ?? {};
        const restrs = Reflect.getMetadata(PROP_RESTR, ctor) ?? {};

        props[propKey as string] = iri;
        restrs[propKey as string] = restr;

        Reflect.defineMetadata(PROP_IRI, props, ctor);
        Reflect.defineMetadata(PROP_RESTR, restrs, ctor);
    };
}

/**
 * Return **only** metadata defined directly on the given constructor.
 * Does **not** follow the prototype chain.
 */
export function getOwnClassMeta(ctor: Function) {
    if (!Reflect.hasMetadata(CLASS_IRI, ctor))
        throw new Error(`Constructor ${ctor.name} lacks @OntologyClass`);

    return {
        classIri: Reflect.getMetadata(CLASS_IRI, ctor) as string,
        propIris: Reflect.getMetadata(PROP_IRI, ctor) ?? {},
        propRestr: Reflect.getMetadata(PROP_RESTR, ctor) ?? {},
        instanceBase: Reflect.getMetadata("instanceBase", ctor) as string | undefined,
    };
}

/**
 * Collect merged metadata for a class *or* instance,
 * including decorators set on ancestor classes.
 */
export function getClassMeta(target: object | Function) {
    const ctor = typeof target === "function" ? target : target.constructor;

    const propIris: Record<string, string> = {};
    const propRestr: Record<string, Restriction> = {};

    let classIri: string | undefined;
    let instanceBase: string | undefined;

    let cur: any = ctor;
    while (cur && cur !== Function.prototype) {
        // stop if the superclass is not ontology-annotated
        if (!Reflect.hasMetadata(CLASS_IRI, cur)) break;

        // first (most-derived) hit wins
        classIri ??= Reflect.getMetadata(CLASS_IRI, cur);
        instanceBase ??= Reflect.getMetadata("instanceBase", cur);

        // merge properties; subclass overrides parent on collision
        Object.assign(propIris, Reflect.getMetadata(PROP_IRI, cur) ?? {});
        Object.assign(propRestr, Reflect.getMetadata(PROP_RESTR, cur) ?? {});

        cur = Object.getPrototypeOf(cur);
    }

    if (!classIri)
        throw new Error(`No @OntologyClass metadata found on ${ctor.name}`);

    return { classIri, propIris, propRestr, instanceBase };
}
