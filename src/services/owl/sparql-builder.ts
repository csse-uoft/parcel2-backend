import { CLASS_IRI, CLASS_REGISTRY, getClassMeta, Restriction } from "./ontology";
import { randomUUID } from "crypto";
import {
    escapeLiteral,
    isLiteralSpec,
    LiteralSpec
} from "./sparql-utils";
import { PM } from "../prefixes";
import { jsMatchesXsd } from "./xsd-utils";
import { OwlClass } from "./owl-class";
import { NamedNode } from "rdf-data-factory";


/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------ */

/** True if the value is an object decorated with @OntologyClass */
const isMappedResource = (v: unknown): boolean =>
    typeof v === "object" &&
    v !== null &&
    Reflect.hasMetadata(CLASS_IRI, (v as object).constructor);

/** Collect CURIE prefix (part before ':') into a set */
const addPrefix = (curie: string, bucket: Set<string>) =>
    bucket.add(curie.split(":", 1)[0]);

/** Regex used to discover prefixes inside generated triples */
const CURIE_RE = /\b([A-Za-z_][\w-]*):(?!\/)/g;

export interface InsertOpts {
    /** Custom IRI factory for brand-new instances */
    iriFactory?: (o: OwlClass) => string;
}

/** Default UUID-based IRI factory; respects @OntologyClass.instanceBase */
export const defaultIriFactory = (obj: OwlClass): string => {
    const { instanceBase, classIri } = getClassMeta(obj);
    if (obj.iri) return PM.ensurePrefixed(obj.iri);
    const base = PM.ensurePrefixed(instanceBase ?? classIri);
    return `${base}_${randomUUID()}`;
};

/* ------------------------------------------------------------------
   Main builder
------------------------------------------------------------------ */
export class SparqlBuilder {
    /**
     * Build an `INSERT DATA` statement for `instance`.
     * Will recursively serialize nested mapped objects.
     */
    static insert(instance: OwlClass, opts: InsertOpts = {}): string {
        const iriFactory = opts.iriFactory ?? defaultIriFactory;

        const rootCurie = PM.ensurePrefixed(instance.iri ?? iriFactory(instance));
        (instance as any).__setIri?.(rootCurie);

        const { triples, prefixes } =
            SparqlBuilder.serialize(instance, rootCurie);

        prefixes.add(rootCurie.split(":", 1)[0]);

        const prefixTxt = [...prefixes]
            .map(p => `PREFIX ${p}: <${PM.map[p]}>`).join("\n");

        return `${prefixTxt}

INSERT DATA {
${triples.map(t => "  " + t).join("\n")}
}`;
    }

    /** Recursively flatten object → array of triples (CURIE form) */
    private static walk(
        obj: any,
        subj: string,
        out: string[],
        deletes: string[],
        iriFactory: (o: OwlClass) => string,
        used: Set<string>
    ): void {

        const meta = getClassMeta(obj);
        const classCurie = PM.ensurePrefixed(meta.classIri);

        out.push(`${subj} a ${classCurie} .`);
        deletes.push(`${subj} a ?class .`);
        addPrefix(subj, used);
        addPrefix(classCurie, used);

        for (const [prop, predIri] of Object.entries(meta.propIris)) {
            const raw = obj[prop];
            if (raw === undefined || raw === null) continue;

            const restr = meta.propRestr[prop] as Restriction | undefined;

            const predCurie = PM.ensurePrefixed(predIri);
            addPrefix(predCurie, used);

            for (const vRaw of (Array.isArray(raw) ? raw : [raw])) {

                // ----- literals
                if (
                    isLiteralSpec(vRaw) ||
                    typeof vRaw !== "object" ||
                    vRaw instanceof Date
                ) {
                    const restr = meta.propRestr[prop] as Restriction | undefined;

                    // STEP 1: normalise to LiteralSpec
                    let spec: LiteralSpec;
                    if (isLiteralSpec(vRaw)) {
                        spec = vRaw;
                        if (
                            restr?.datatype &&
                            PM.ensurePrefixed(restr.datatype) !==
                            PM.ensurePrefixed(spec.datatype ?? "")
                        ) {
                            throw new Error(
                                `Datatype mismatch at ${subj}.${prop}: expected ` +
                                `${restr.datatype} but got ${spec.datatype ?? "string"}`
                            );
                        }
                    } else {
                        spec = restr?.datatype
                            ? { value: vRaw as any, datatype: PM.ensurePrefixed(restr.datatype) }
                            : (vRaw as any);
                    }

                    // STEP 1b: JS ↔ XSD sanity check
                    if (
                        isLiteralSpec(spec) &&
                        spec.datatype &&
                        !jsMatchesXsd(spec.datatype, spec.value)
                    ) {
                        throw new Error(
                            `Value "${spec.value}" at ${subj}.${prop} ` +
                            `does not match datatype ${restr?.datatype ?? "string"}`
                        );
                    }

                    // STEP 2: emit triple + collect datatype prefix
                    const lit = escapeLiteral(spec);
                    out.push(`${subj} ${predCurie} ${lit} .`);
                    deletes.push(`${subj} ${predCurie} ?o .`);

                    if (isLiteralSpec(spec) && spec.datatype) {
                        addPrefix(PM.ensurePrefixed(spec.datatype), used);
                    }
                    continue;
                }

                // ----- nested mapped resource
                if (isMappedResource(vRaw)) {
                    const childCurie = PM.ensurePrefixed(iriFactory(vRaw));
                    out.push(`${subj} ${predCurie} ${childCurie} .`);
                    deletes.push(`${subj} ${predCurie} ?o .`);
                    addPrefix(childCurie, used);

                    (vRaw as any).__setIri?.(childCurie);
                    this.walk(vRaw, childCurie, out, deletes, iriFactory, used);
                    continue;
                }

                // providing an IRI, ideally the restriction's onClass should be provided
                if (vRaw.termType === "NamedNode" && restr?.datatype == null && restr?.onClass) {
                    const childCurie = PM.ensureExpanded((vRaw as NamedNode).value);
                    out.push(`${subj} ${predCurie} <${childCurie}> .`);
                    deletes.push(`${subj} ${predCurie} ?o .`);
                    addPrefix(childCurie, used);
                    continue;
                }

                // js object that holds the resource data
                if (typeof vRaw === "object") {
                    // Try to instantiate a mapped resource
                    const constr = CLASS_REGISTRY.get(PM.ensureExpanded(restr?.onClass ?? ""));
                    if (!constr) {
                        throw new Error(
                            `Property ${subj}.${prop} is an object but no mapped class found for ` +
                            `${PM.ensureExpanded(restr?.onClass ?? "")}. This could be a bug in the ontology` +
                            `or not imported ontology class.`
                        );
                    }
                    // Create a new instance of the mapped class
                    const child = constr.create(vRaw);
                    const childCurie = PM.ensurePrefixed(iriFactory(child));
                    out.push(`${subj} ${predCurie} ${childCurie} .`);
                    deletes.push(`${subj} ${predCurie} ?o .`);
                    addPrefix(childCurie, used);

                    (child as any).__setIri?.(childCurie);
                    this.walk(child, childCurie, out, deletes, iriFactory, used);
                    continue;
                }

                // ----- fallback: stringify unknown object
                const lit = escapeLiteral(JSON.stringify(vRaw));
                out.push(`${subj} ${predCurie} ${lit} .`);
                console.warn(`Warning: ${subj}.${prop} is not a mapped resource or literal, ` +
                    `serializing as JSON string: ${lit}`);
            }
        }
    }

    /** Flatten instance → triples + used prefixes */
    static serialize(
        instance: OwlClass,
        rootCurie: string
    ): { triples: string[]; prefixes: Set<string>, deletes: string[] } {

        const triples: string[] = [];
        const deletes: string[] = [];
        const prefixes = new Set<string>();

        this.walk(
            instance,
            PM.ensurePrefixed(rootCurie),
            triples,
            deletes,
            defaultIriFactory,
            prefixes
        );
        return { triples, prefixes, deletes };
    }
}
