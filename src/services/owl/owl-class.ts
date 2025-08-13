import { escapeLiteral, isLiteralSpec, LiteralSpec } from "./sparql-utils";
import {
    executeSparqlQuery,
    executeSparqlUpdate,
    StardogQueryParams
} from "../stardog";
import { getClassMeta, CLASS_REGISTRY } from "./ontology";
import * as RDF from "@rdfjs/types";
import { PM } from "../prefixes";
import { defaultIriFactory, SparqlBuilder } from "./sparql-builder";
import { OntologyValidator } from "./validator";
import { NamedNode } from "rdf-data-factory";

// Helper types
type AllowSpec<V> =
    V extends Array<infer U> ? Array<AllowSpec<U>> :
        V extends object ? InitWithSpec<V> | NamedNode : // allow nested classes or an IRI
            V | LiteralSpec; // allow primitive values or LiteralSpec

export type InitWithSpec<T> = Partial<{
    [K in keyof T]: AllowSpec<T[K]>;
}>;

export interface SaveOptions {
    // passed to Stardog
    reasoning?: boolean;
}

export interface DeleteOptions {
    // also delete nested resources
    cascade?: boolean;
    // passed to Stardog
    reasoning?: boolean;
}

// Allowed scalar literal types
type Scalar = string | number | boolean | Date | bigint;

// IRI-ish inputs for object properties
type IriLike = string | NamedNode;

// Operators per field
type FieldFilter =
    | Scalar
    | LiteralSpec
    | IriLike
    | { $eq: Scalar | LiteralSpec | IriLike }
    | { $in: Array<Scalar | LiteralSpec | IriLike> };

// Nested where: keys are TS property names; values can be FieldFilter
// or another nested Where for object properties (onClass).
export type Where<T> = Partial<Record<keyof T, FieldFilter | Record<string, any>>>;

const IRI = Symbol("owlInstanceIri"); // private slot name

/**
 * Base class for all OWL classes in the application.
 */
export class OwlClass<TSelf extends object = any> {
    private [IRI]?: string;

    constructor(init?: InitWithSpec<TSelf>) {
        if (init) {
            const { iri, ...rest } = init as any;
            Object.assign(this, rest as TSelf);
            if (iri) this.__setIri(iri);
        }
    }

    /** Factory that preserves strong typing across subclasses. */
    static create<T extends OwlClass>(
        this: new (i?: InitWithSpec<T>) => T,
        init: InitWithSpec<T>
    ): T {
        return new this(init) as T;
    }

    /** CURIE identifying this resource, or `undefined` if not persisted. */
    get iri(): string | undefined {
        return this[IRI];
    }

    /** Internal helper used by loader / save. */
    protected __setIri(curie: string) {
        this[IRI] = PM.ensurePrefixed(curie);
    }

    /**
     * Load and fully hydrate an instance by IRI (CURIE or full).
     * Recursively hydrates nested resources where the property
     * restriction declares `onClass`.
     */
    static async findByIri<T extends OwlClass>(
        iri: string,
        opts: Omit<StardogQueryParams, "queryString"> = {}
    ): Promise<T | null> {

        const abs = PM.ensureExpanded(iri);
        const rows = await executeSparqlQuery({
            ...opts,
            queryString: `SELECT ?p ?o WHERE { <${abs}> ?p ?o }`
        });
        if (!rows?.length) return null;

        const meta = getClassMeta(this.prototype);
        const instance = new this() as any;
        const pred2prop: Record<string, string> = {};

        for (const [prop, curie] of Object.entries(meta.propIris)) {
            pred2prop[PM.ensureExpanded(curie)] = prop;
        }

        const bucket: Record<string, any[]> = {};
        for (const row of rows) {
            const pIri = (row.p as RDF.NamedNode).value;
            const termType = (row.o as RDF.Term).termType;
            const tsProp = pred2prop[pIri];
            if (!tsProp) continue;
            const restr = meta.propRestr[tsProp];

            let val;
            if (termType === "NamedNode") {
                if (meta.propRestr[tsProp]?.onClass === 'owl:Thing') {
                    val = new NamedNode((row.o as RDF.NamedNode).value);
                } else {
                    val = await termToJs(row.o as RDF.Term, restr);
                }
            } else if (termType === "Literal") {
                val = await termToJs(row.o as RDF.Term, restr);
            } else {
                // ignore other term types (e.g. BlankNode)
                console.warn(`Ignoring unsupported term type ${termType} for property ${pIri}`);
            }
            bucket[tsProp] = (bucket[tsProp] ?? []).concat(val);

        }

        for (const [prop, vals] of Object.entries(bucket)) {
            // Check if the property is restricted to a single value
            const single = meta.propRestr[prop]?.max === 1 || meta.propRestr[prop]?.exactly === 1;
            instance[prop] = single ? vals[0] : vals;
        }
        instance.__setIri(PM.ensurePrefixed(iri));
        return instance;
    }

    static async findAll<T extends OwlClass>(limit: number = 20, offset: number = 0): Promise<T[]> {
        const meta = getClassMeta(this.prototype);
        const classIri = PM.ensureExpanded(meta.classIri);
        const rows = await executeSparqlQuery({
            queryString: `SELECT ?iri WHERE { ?iri a <${classIri}> } LIMIT ${limit} OFFSET ${offset}`,
        });

        if (!rows?.length) return [];

        const instances: T[] = [];
        for (const row of rows) {
            const iri = (row.iri as RDF.NamedNode).value;
            const instance = await this.findByIri<T>(iri);
            if (instance) instances.push(instance);
        }
        return instances;
    }

    static async find<T extends OwlClass>(
        where: Where<T> = {},
        opts: Omit<StardogQueryParams, "queryString"> = {}
    ): Promise<T[]> {
        // quick out on empty $in arrays
        for (const v of Object.values(where ?? {})) {
            if (v && typeof v === "object" && "$in" in v && Array.isArray((v as any).$in) && (v as any).$in.length === 0) {
                return [];
            }
        }

        const meta = getClassMeta(this.prototype);
        const classAbs = PM.ensureExpanded(meta.classIri);

        // Map TS prop -> absolute predicate IRI
        const prop2predAbs: Record<string, string> = {};
        for (const [prop, curie] of Object.entries(meta.propIris)) {
            prop2predAbs[prop] = PM.ensureExpanded(curie);
        }

        // variable generator
        let varIdx = 0;
        const vNew = (hint?: string) => `?v${++varIdx}${hint ? "_" + hint : ""}`;

        // SPARQL buffers
        const triples: string[] = [`?s a <${classAbs}> .`];
        const filters: string[] = [];

        // value emitters
        const emitIri = (x: any): string => {
            if (x && x.termType === "NamedNode") return `<${x.value}>`;
            const abs = PM.ensureExpanded(String(x));
            return `<${abs}>`;
        };
        const emitLiteral = (x: any): string => {
            if (x && x.termType === "NamedNode") return escapeLiteral(x.value); // treat as string literal if misused
            if (typeof x === "string" || typeof x === "number" || typeof x === "boolean" || typeof x === "bigint" || x instanceof Date || isLiteralSpec(x)) {
                return escapeLiteral(x);
            }
            return escapeLiteral(JSON.stringify(x));
        };

        // Resolve a CLASS_REGISTRY constructor from onClass
        const ctorForOnClass = (onClass?: string) => {
            if (!onClass) return undefined;
            const abs = PM.ensureExpanded(onClass);
            return CLASS_REGISTRY.get(abs);
        };

        // Recursive walker: add join patterns for nested object filters
        const walkWhere = (
            subjectVar: string,
            curMeta: ReturnType<typeof getClassMeta>,
            w: Record<string, any>
        ) => {
            for (const [tsProp, rawFilter] of Object.entries(w ?? {})) {
                const predAbs = prop2predAbs[tsProp] ?? PM.ensureExpanded(curMeta.propIris[tsProp] ?? "");
                if (!predAbs) continue;

                const restr = curMeta.propRestr[tsProp];
                const expectsLiteral = !!restr?.datatype && !restr?.onClass;
                const expectsIri      = !!restr?.onClass && !restr?.datatype;

                // operator normalization
                let op: "$eq" | "$in" | "nested" = "$eq";
                let payload: any = rawFilter;

                const maybeOperatorObject =
                    rawFilter && typeof rawFilter === "object" && !Array.isArray(rawFilter) && !(rawFilter as any).termType;

                const isOpIn  = !!(maybeOperatorObject && "$in" in (rawFilter as any));
                const isOpEq  = !!(maybeOperatorObject && "$eq" in (rawFilter as any));

                // If this is an object property and the filter looks like a nested map (e.g. { name: "Doctor" }),
                // treat as NESTED when it doesn't specify $eq/$in OR when it's clearly a plain object of subfields.
                const looksNested =
                    expectsIri &&
                    maybeOperatorObject &&
                    !isOpEq &&
                    !isOpIn &&
                    // Heuristic: keys correspond to properties of the nested class
                    Object.keys(rawFilter as any).length > 0;

                if (looksNested) {
                    op = "nested";
                } else if (isOpIn) {
                    op = "$in";
                    payload = (rawFilter as any).$in;
                } else if (isOpEq) {
                    op = "$eq";
                    payload = (rawFilter as any).$eq;
                }

                // ---------- NESTED (join on object property and recurse) ----------
                if (op === "nested") {
                    // Bind child node
                    const childVar = vNew(tsProp);
                    triples.push(`${subjectVar} <${predAbs}> ${childVar} .`);

                    // Find nested constructor & metadata
                    const childCtor = ctorForOnClass(restr?.onClass);
                    if (!childCtor) {
                        // No mapped class — allow raw IRI filters only
                        // But user provided nested map → cannot proceed meaningfully
                        throw new Error(`Property "${String(tsProp)}" is not mapped to a class; cannot descend into nested where.`);
                    }
                    const childMeta = getClassMeta(childCtor.prototype);

                    // Build a temporary property map for child to use inside recursion
                    const childProp2predAbs: Record<string, string> = {};
                    for (const [p, c] of Object.entries(childMeta.propIris)) {
                        childProp2predAbs[p] = PM.ensureExpanded(c);
                    }

                    // Recurse with child's metadata
                    // NOTE: inside recursion we must use child's prop map, so temporarily swap
                    const prevProp2predAbs = { ...prop2predAbs };
                    Object.assign(prop2predAbs, childProp2predAbs);
                    walkWhere(childVar, childMeta, rawFilter as Record<string, any>);
                    Object.assign(prop2predAbs, prevProp2predAbs);
                    continue;
                }

                // ---------- TERMINAL $eq / $in ----------
                // Bind var when we need a FILTER, otherwise place the value inline
                const bindVar = op === "$in";
                const v = bindVar ? vNew(tsProp) : undefined;

                const rhsFor = (val: any): string => {
                    if (expectsIri) return emitIri(val);
                    return emitLiteral(val);
                };

                if (op === "$eq") {
                    const rhs = rhsFor(payload);
                    triples.push(`${subjectVar} <${predAbs}> ${rhs} .`);
                    continue;
                }

                if (op === "$in") {
                    const list = (Array.isArray(payload) ? payload : [payload]).map(rhsFor).join(", ");
                    triples.push(`${subjectVar} <${predAbs}> ${v} .`);
                    filters.push(`FILTER(${v} IN (${list}))`);
                    continue;
                }
            }
        };

        // Build where
        walkWhere("?s", meta, where as Record<string, any>);

        const query = `
SELECT DISTINCT ?s WHERE {
  ${triples.join("\n  ")}
  ${filters.join("\n  ")}
}`;
        console.log(query);
        const rows = await executeSparqlQuery({ ...opts, queryString: query });
        if (!rows?.length) return [];

        const out: T[] = [];
        for (const r of rows) {
            const iriAbs = r.s.value;
            const inst = await this.findByIri<T>(iriAbs, opts);
            if (inst) out.push(inst);
        }
        return out;
    }


    /** Insert or update the current resource in Stardog. */
    async save(opts: SaveOptions = {}): Promise<void> {
        if (!this.iri) {
            this.__setIri(PM.ensurePrefixed(defaultIriFactory(this)));
        }

        OntologyValidator.validate(this);

        const { triples, prefixes, deletes } =
            SparqlBuilder.serialize(this, this.iri!);

        // const predicates = new Set(
        //     triples.map(t => PM.ensurePrefixed(t.split(" ", 3)[1]))
        // );

        const deleteWhere = deletes
            .map(p => `DELETE WHERE { ${p} }`)
            .join(" ;\n");

        const insertData =
            `INSERT DATA {\n  ${triples.join("\n  ")}\n}`;

        const prefixBlock = [...prefixes]
            .map(p => `PREFIX ${p}: <${PM.map[p]}>`).join("\n");

        const update =
            `${prefixBlock}\n\n${deleteWhere} ;\n${insertData}`;

        await executeSparqlUpdate(update, { reasoning: opts.reasoning });
    }

    /** Delete this resource; optionally cascade to nested ones. */
    async delete(opts: DeleteOptions = {}): Promise<void> {
        if (!this.iri)
            throw new Error("Cannot delete: instance has no IRI.");

        const targets = [PM.ensureExpanded(this.iri)];
        if (opts.cascade) {
            this.collectNested()
                .filter(n => n.iri)
                .forEach(n => targets.push(PM.ensureExpanded(n.iri!)));
        }

        const deleteClauses = targets
            .map(s => `DELETE WHERE { <${s}> ?p ?o }`)
            .join(" ;\n");

        const { prefixes } = SparqlBuilder.serialize(this, this.iri!);
        const prefixBlock = [...prefixes]
            .map(p => `PREFIX ${p}: <${PM.map[p]}>`).join("\n");

        await executeSparqlUpdate(
            `${prefixBlock}\n\n${deleteClauses}`,
            { reasoning: opts.reasoning }
        );

        this.markDeleted();
        if (opts.cascade) {
            this.collectNested().forEach(n => n.markDeleted());
        }
    }

    private collectNested(): OwlClass[] {
        const out: OwlClass[] = [];
        const meta = getClassMeta(this);
        for (const prop of Object.keys(meta.propIris)) {
            const v = (this as any)[prop];
            if (v instanceof OwlClass) {
                out.push(v, ...v.collectNested());
            } else if (Array.isArray(v)) {
                v.filter((x): x is OwlClass => x instanceof OwlClass)
                    .forEach(x => out.push(x, ...x.collectNested()));
            }
        }
        return out;
    }

    private markDeleted(): void {
        this[IRI] = undefined;
    }

    toJSON(): Record<string, any> {
        const result: Record<string, any> = {};
        if (this.iri) {
            result.iri = this.iri;
        }

        for (const [key, value] of Object.entries(this)) {
            result[key] = serializeValue(value);
        }

        return result;
    }

    // experimental: convert to JSON-LD format
    toJSONLD(context?: Record<string, any>): Record<string, any> {
        const meta = getClassMeta(this);
        const jsonld: Record<string, any> = {
            "@context": context ?? {},
            "@id": this.iri,
            "@type": meta.classIri,
        };
        // In the nesting case, we don't want to include the context
        if (context) delete jsonld["@context"];
        else context = jsonld["@context"];

        for (const [prop, curie] of Object.entries(meta.propIris)) {
            const { prefix, base } = PM.getNamespace(curie);
            context![prefix] = base;

            const value = (this as any)[prop];
            if (value === undefined) continue;
            if (value.termType === "NamedNode") {
                // If it's a NamedNode, we can just use its value directly
                jsonld[PM.ensurePrefixed(curie)] = { "@id": value.value };
                continue;
            }

            if (Array.isArray(value)) {
                jsonld[curie] = value.map(v => v.toJSONLD ? v.toJSONLD(context) : v);
            } else {
                jsonld[curie] = value.toJSONLD ? value.toJSONLD(context) : value;
            }
        }

        return jsonld;
    }
}

/**
 * Convert an RDF term to a JavaScript value.
 * @param term
 * @param restriction
 */
async function termToJs(
    term: RDF.Term,
    restriction?: { onClass?: string }
): Promise<any> {

    // literals
    if (term.termType === "Literal") {
        const lit = term as RDF.Literal;
        if (lit.language) return { value: lit.value, lang: lit.language };

        const dt = lit.datatype.value;
        if (dt.endsWith("#integer")) return Number.parseInt(lit.value, 10);
        if (dt.match(/#(decimal|double)$/)) return Number.parseFloat(lit.value);
        if (dt.endsWith("#boolean")) return lit.value === "true";

        if (dt.endsWith("#dateTime")) {
            // parse date or dateTime
            const date = new Date(lit.value);
            if (isNaN(date.getTime())) {
                throw new Error(`Invalid date value: ${lit.value}`);
            }
            return date;
        }
        if (dt.endsWith("#date")) {
            // parse date only
            const date = new Date(lit.value);
            if (isNaN(date.getTime())) {
                throw new Error(`Invalid date value: ${lit.value}`);
            }
            return date.toISOString().split("T")[0]; // return as YYYY-MM-DD
        }

        if (!dt.endsWith("#string"))
            return { value: lit.value, datatype: dt };

        return lit.value; // plain string
    }

    // NamedNode: maybe hydrate nested resource
    if (term.termType === "NamedNode") {
        const absIri = term.value;

        // prefer restriction.onClass if available
        const wanted = restriction?.onClass
            ? PM.ensureExpanded(restriction.onClass)
            : undefined;
        let ctor: any = wanted ? CLASS_REGISTRY.get(wanted) : undefined;

        if (!ctor) {
            const tRows = await executeSparqlQuery({
                queryString: `SELECT ?t WHERE { <${absIri}> a ?t } LIMIT 1`
            });
            const tIri = tRows?.[0]?.t?.value;
            ctor = tIri ? CLASS_REGISTRY.get(tIri) : undefined;
        }

        if (ctor && ctor.prototype instanceof OwlClass)
            return (ctor as typeof OwlClass).findByIri(absIri);

        return absIri; // unknown type → raw IRI
    }

    // blank nodes or other terms
    return term.value;
}

function serializeValue(val: any): any {
    if (val instanceof OwlClass) {
        return val.toJSON();
    } else if (Array.isArray(val)) {
        return val.map(serializeValue);
    } else if (val?.termType === "NamedNode") {
        return val.value;
    } else {
        return val;
    }
}
