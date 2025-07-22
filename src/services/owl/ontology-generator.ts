import {
    CLASS_REGISTRY,
    getOwnClassMeta,
    getClassMeta,
    Restriction,
    XSD,
    CLASS_IRI,
    PROP_IRI,
    PROP_RESTR
} from "./ontology";
import { PM } from "../prefixes";
import { escapeLiteral } from "./sparql-utils";

// turtle writer
class Turtle {
    private lines: string[] = [];
    readonly used = new Set<string>();

    iri(value: string): string {
        const curie = PM.ensurePrefixed(value);
        this.used.add(curie.split(":", 1)[0]);
        return curie;
    }

    add(line: string): void {
        this.lines.push(line);
    }

    blank(): void {
        this.lines.push("");
    }

    build(): string {
        const header = [...this.used].sort()
            .map(p => `@prefix ${p}: <${PM.map[p]}> .`)
            .join("\n");
        return `${header}\n\n${this.lines.join("\n")}`;
    }
}

// helpers
const datatypeCurie = (r?: Restriction) =>
    r?.datatype ? PM.ensurePrefixed(String(r.datatype)) : undefined;

interface GeneratorOptions {
    includeShacl?: boolean;
}

// OWL generator
export function generateOntologyTTL(opts: GeneratorOptions = {}): string {
    const w = new Turtle();
    const declared = new Set<string>();

    // ensure base prefixes always appear
    ["rdf", "rdfs", "owl", "xsd"].forEach(p => w.iri(`${p}:placeholder`));

    for (const [classIri, ctor] of CLASS_REGISTRY.entries()) {
        const own = getOwnClassMeta(ctor);
        const classCurie = w.iri(own.classIri);

        w.add(`${classCurie} a owl:Class .`);

        // optional superclass
        let parent: any = Object.getPrototypeOf(ctor);
        while (parent && parent !== Function.prototype) {
            if (Reflect.hasMetadata(CLASS_IRI, parent)) {
                const parCurie = w.iri(Reflect.getMetadata(CLASS_IRI, parent));
                w.add(`${classCurie} rdfs:subClassOf ${parCurie} .`);
                break;
            }
            parent = Object.getPrototypeOf(parent);
        }

        const ownProps = Reflect.getMetadata(PROP_IRI, ctor) ?? {};
        const ownRestr = Reflect.getMetadata(PROP_RESTR, ctor) ?? {};

        for (const [key, propIri] of Object.entries(ownProps)) {
            const r = ownRestr[key] as Restriction | undefined;
            const propCurie = w.iri(propIri as string);
            const object = !!r?.onClass;
            const owlType = object ? "owl:ObjectProperty" : "owl:DatatypeProperty";

            // property declaration
            if (!declared.has(propCurie)) {
                w.add(`${propCurie} a ${owlType} ;`);
                w.add(`  rdfs:domain ${classCurie} .`);
                if (object) {
                    w.add(`${propCurie} rdfs:range ${w.iri(r!.onClass!)} .`);
                } else {
                    const dt = datatypeCurie(r) ?? w.iri(XSD.string);
                    w.add(`${propCurie} rdfs:range ${dt} .`);
                }
                declared.add(propCurie);
            }

            // per-class restriction
            if (r?.min !== undefined || r?.max !== undefined || r?.exactly !== undefined) {
                const block: string[] = [
                    "  [ a owl:Restriction ;",
                    `    owl:onProperty ${propCurie} ;`
                ];
                if (r.min !== undefined)
                    block.push(`    owl:minQualifiedCardinality "${r.min}"^^xsd:nonNegativeInteger ;`);
                if (r.max !== undefined)
                    block.push(`    owl:maxQualifiedCardinality "${r.max}"^^xsd:nonNegativeInteger ;`);
                if (r.exactly !== undefined)
                    block.push(`    owl:cardinality "${r.exactly}"^^xsd:nonNegativeInteger ;`);

                if (object) {
                    block.push(`    owl:onClass ${w.iri(r.onClass!)} ;`);
                } else {
                    block.push(`    owl:onDataRange ${w.iri(datatypeCurie(r) ?? XSD.string)} ;`);
                }

                // remove trailing semicolon from last line
                block[block.length - 1] = block[block.length - 1].replace(/;$/, "");
                block.push("  ] .");

                w.add(`${classCurie} rdfs:subClassOf`);
                w.add(block.join("\n"));
            } else if (r?.onClass || r?.datatype) {
                // simple property restriction
                w.add(`${classCurie} rdfs:subClassOf [ a owl:Restriction ;`);
                w.add(`  owl:onProperty ${propCurie} ;`);
                if (r.onClass) {
                    w.add(`  owl:allValuesFrom ${w.iri(r.onClass)} ;`);
                } else {
                    const dt = datatypeCurie(r) ?? XSD.string;
                    w.add(`  owl:allValuesFrom ${w.iri(dt)} ;`);
                }
                w.add("] .");
            }
        }

        w.blank();
    }

    let ttl = w.build();

    // SHACL section
    if (opts.includeShacl) {
        const shapes = generateShaclTTL();
        const mergedSet = new Set(w.used);
        const shapeBody: string[] = [];

        for (const line of shapes.split(/\r?\n/)) {
            if (line.startsWith("@prefix")) {
                const p = line.split(" ", 2)[1].replace(/:.*/, "");
                if (!mergedSet.has(p)) {
                    ttl = `${line}\n` + ttl;
                    mergedSet.add(p);
                }
            } else {
                shapeBody.push(line);
            }
        }

        ttl += "\n# SHACL shapes\n" + shapeBody.join("\n");
    }

    return ttl;
}

// SHACL generator
export function generateShaclTTL(): string {
    const tw = new Turtle();
    tw.iri("sh:placeholder");

    for (const [classIri, ctor] of CLASS_REGISTRY.entries()) {
        const meta = getClassMeta(ctor.prototype);
        const shapeCurie = tw.iri(`${classIri}Shape`);
        const classCurie = tw.iri(classIri);
        const blocks: string[] = [];

        for (const [key, propIri] of Object.entries(meta.propIris)) {
            const r = meta.propRestr[key] as Restriction | undefined;
            const pCur = tw.iri(propIri);

            const b: string[] = [`    sh:path ${pCur} ;`];
            if (r?.min !== undefined) b.push(`    sh:minCount ${r.min} ;`);
            if (r?.max !== undefined) b.push(`    sh:maxCount ${r.max} ;`);

            let dt = datatypeCurie(r);
            if (!dt && !r?.onClass) dt = XSD.string;

            if (dt) b.push(`    sh:datatype ${tw.iri(dt)} ;`);
            else if (r?.onClass) b.push(`    sh:class ${tw.iri(r.onClass)} ;`);

            if (r?.pattern) {
                const lit = escapeLiteral(r.pattern.source);
                b.push(`    sh:pattern ${lit} ;`);
            }

            if (r?.oneOf?.length) {
                const inList = r.oneOf.map(v => escapeLiteral(String(v))).join(" ");
                b.push(`    sh:in ( ${inList} ) ;`);
            }

            b[b.length - 1] = b[b.length - 1].replace(/;$/, "");
            blocks.push(`  sh:property [\n${b.join("\n")}\n  ]`);
        }

        const propSection = blocks
            .map((blk, i, arr) => blk + (i === arr.length - 1 ? " ." : " ;"))
            .join("\n");

        tw.add(`${shapeCurie}`);
        tw.add(`  a sh:NodeShape ;`);
        tw.add(`  sh:targetClass ${classCurie} ;`);
        tw.add(propSection);
        tw.blank();
    }

    return tw.build();
}
