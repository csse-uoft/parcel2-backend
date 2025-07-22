import { PrefixManager } from "./owl/prefix-manager";

/**
 * Central registry of namespace prefixes used across the Parcel2 backend.
 */
export const PREFIXES: Record<string, string> = {
    parcel2: "https://ontology.connectbuildnow.org/parcel2#",
    bedeo: "https://csse.utoronto.ca/",
    brick: "https://brickschema.org/schema/Brick#",
    csvw: "http://www.w3.org/ns/csvw#",
    dc: "http://purl.org/dc/elements/1.1/",
    dcam: "http://purl.org/dc/dcam/",
    dcat: "http://www.w3.org/ns/dcat#",
    dcmitype: "http://purl.org/dc/dcmitype/",
    dcterms: "http://purl.org/dc/terms/",
    doap: "http://usefulinc.com/ns/doap#",
    foaf: "http://xmlns.com/foaf/0.1/",
    geo: "http://www.opengis.net/ont/geosparql#",
    odrl: "http://www.w3.org/ns/odrl/2/",
    org: "http://www.w3.org/ns/org#",
    owl: "http://www.w3.org/2002/07/owl#",
    prof: "http://www.w3.org/ns/dx/prof/",
    prov: "http://www.w3.org/ns/prov#",
    qb: "http://purl.org/linked-data/cube#",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    schema: "https://schema.org/",
    sh: "http://www.w3.org/ns/shacl#",
    skos: "http://www.w3.org/2004/02/skos/core#",
    sosa: "http://www.w3.org/ns/sosa/",
    ssn: "http://www.w3.org/ns/ssn/",
    time: "http://www.w3.org/2006/time#",
    vann: "http://purl.org/vocab/vann/",
    void: "http://rdfs.org/ns/void#",
    wgs: "https://www.w3.org/2003/01/geo/wgs84_pos#",
    xml: "http://www.w3.org/XML/1998/namespace",
    xsd: "http://www.w3.org/2001/XMLSchema#",

    ex: "http://example.com/", // Example namespace for testing

    // Address ID prefixes
    addrid: "urn:addr:",
}

/**
 * Returns the PREFIX block for SPARQL queries.
 * Custom prefixes can be appended by the caller if needed.
 */
export function prefixLines(): string {
    return Object.entries(PREFIXES)
        .map(([p, iri]) => `PREFIX ${p}: <${iri}>`)
        .join("\n");
}

export const PREFIX_BLOCK = prefixLines();


// Given a list of prefixes, return a string of prefixes
export function prefixesToString(prefixes: string[] | Set<string>): string {
    const output = [];
    for (const prefix of prefixes) {
        if (PREFIXES.hasOwnProperty(prefix)) {
            output.push(`PREFIX ${prefix}: <${PREFIXES[prefix]!}>`);
        } else {
            throw new Error(`Prefix ${prefix} not found in PREFIXES`);
        }
    }
    return output.join("\n");
}


export const PM = new PrefixManager(PREFIXES);