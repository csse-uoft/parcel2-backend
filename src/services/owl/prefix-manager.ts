export interface PrefixMap {
    [prefix: string]: string;
}

export class UnknownPrefixError extends Error {
    constructor(message: string) {
        super(message);
    }
}

const ABS_RE = /^[a-zA-Z][\w+.-]*:\/\//;           // http:, https:, urn:, …
const CURIE_RE = /^([A-Za-z_][\w-]*):(?!\/)(.+)$/;   // prefix:local (no slash)

export class PrefixManager {
    private readonly prefixes: PrefixMap;

    constructor(initial: PrefixMap) {
        this.prefixes = { ...initial };
    }

    /**
     * Expand a CURIE to an absolute IRI.
     * "schema:Person" → "http://schema.org/Person"
     * @param curie
     */
    expand(curie: string): string {
        const m = CURIE_RE.exec(curie);
        if (!m) return curie;                                 // already absolute
        const [, pref, local] = m;
        const base = this.prefixes[pref];
        if (!base) throw new UnknownPrefixError(
            `Prefix "${pref}" is not registered. Known: ${Object.keys(this.prefixes).join(', ')}`
        );
        return base + local;
    }

    /**
     * Shrink an absolute IRI to a CURIE.
     * "http://schema.org/Person" → "schema:Person"
     * @param iri
     */
    shrink(iri: string): string {
        for (const [p, base] of Object.entries(this.prefixes)) {
            if (iri.startsWith(base)) return `${p}:${iri.slice(base.length)}`;
        }
        throw new UnknownPrefixError(
            `No registered namespace matches IRI "${iri}". Known bases: ${Object.values(this.prefixes).join(', ')}`
        );
    }

    /**
     * Ensure a string is a CURIE or absolute IRI.
     * @param iriOrCurie
     */
    ensurePrefixed(iriOrCurie: string): string {
        if (iriOrCurie === 'a') return 'rdf:type'; // special case for RDF type
        return CURIE_RE.test(iriOrCurie) ? iriOrCurie : this.shrink(iriOrCurie);
    }

    /**
     * Return an absolute IRI.  Accepts CURIE or absolute IRI;
     * throws if unknown prefix.
     * @param val
     */
    ensureExpanded(val: string): string {
        if (ABS_RE.test(val)) return val;        // already absolute
        if (CURIE_RE.test(val)) return this.expand(val);   // CURIE → expand
        throw new UnknownPrefixError(
            `Value "${val}" is neither an absolute IRI nor a registered CURIE.`
        );
    }

    register(prefix: string, namespace: string) {
        this.prefixes[prefix] = namespace;
    }

    get map(): Readonly<PrefixMap> {
        return this.prefixes;
    }

    getNamespace(iri: string): { prefix: string, base: string } {
        iri = this.ensureExpanded(iri); // ensure it's absolute
        for (const [prefix, base] of Object.entries(this.prefixes)) {
            if (iri.startsWith(base)) return { prefix, base };
        }
        // no matching prefix found
        throw new UnknownPrefixError(`No registered namespace matches IRI "${iri}". Known bases: ${Object.values(this.prefixes).join(', ')}`);
    }
}