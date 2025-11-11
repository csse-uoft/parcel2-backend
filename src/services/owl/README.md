# Ontology ORM

A minimal Object–RDF mapper that:

* maps TypeScript classes to **OWL classes** with decorators
* validates instances against **cardinality, datatype and pattern** rules
* generates **SPARQL INSERT / DELETE / UPDATE** statements
* hydrates nested objects by following `owl:onClass` restrictions
* emits ready-to-load **OWL 2 TTL** and **SHACL** shapes graphs
* keeps prefixes consistent via a central `PrefixManager`

## Defining ontology classes

```ts
import {
  OntologyClass,
  OntologyProp,
  OwlClass,
  XSD
} from "./ontology";

// Required and optional fields with precise cardinalities
@OntologyClass("schema:Person", { instanceBase: "ex:person" })
export class Person extends OwlClass<Person> {
  @OntologyProp("schema:givenName",  { exactly: 1, datatype: XSD.string })
  declare firstName: string;

  @OntologyProp("schema:familyName", { exactly: 1, datatype: XSD.string })
  declare lastName:  string;

  @OntologyProp("schema:email",      { max: 1, datatype: XSD.string,
                                       pattern: /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/ })
  declare email?: string;
}
```

* `min`, `max`, `exactly` set cardinality.
* `datatype`, `pattern`, `oneOf`, `onClass` refine values.
* The constructor is automatically generated; use `Person.create({ … })`
  for strong typing.

---

## Ontology ORM Details
> [REC-owl2-quick-reference](https://www.w3.org/TR/2012/REC-owl2-quick-reference-20121211/).

### exact cardinality
```ts
@OntologyProp("schema:givenName",  { exactly: 1 })
```
Represents a property in the ontology, with:
```ttl
ex:somePerson a schema:Person ;
  rdfs:subClassOf 
    [ a owl:Restriction ;
      owl:onProperty schema:givenName ;
      owl:cardinality 1 ;
    ] .
```

### min/max cardinality
```ts
@OntologyProp("schema:name",  { min: 1, max: 2 })
```
Represents a property with a range of cardinalities:
```ttl
ex:somePerson a schema:Person ;
  rdfs:subClassOf 
    [ a owl:Restriction ;
      owl:onProperty schema:name ;
      owl:minCardinality 1 ;
    ] ,
    [ a owl:Restriction ;
      owl:onProperty schema:name ;
      owl:maxCardinality 2 ;
    ] .
```

### Data Property Datatype
```ts
@OntologyProp("schema:email", { datatype: XSD.string })
```
Represents a property with a datatype:
```ttl
ex:somePerson a schema:Person ;
  rdfs:subClassOf
    [ a owl:Restriction ;
      owl:onProperty schema:email ;
      owl:allValuesFrom "xsd:string" ;
    ] .
```

### Object Property Datatype
```ts
@OntologyProp("schema:address", { onClass: "schema:Address" })
```
Represents a property that must be an instance of another class:
```ttl
ex:somePerson a schema:Person ;
  rdfs:subClassOf
    [ a owl:Restriction ;
      owl:onProperty schema:address ;
      owl:allValuesFrom schema:Address ;
    ] .
```

## CRUD workflow

```ts
// create → INSERT
const p = Person.create({
  firstName: "Ada",
  lastName:  "Lovelace",
  email:     "ada@example.com"
});
await p.save();

// read → SELECT + hydrate
const ada = await Person.findByIri("ex:person_7d1c");

// update → DELETE/INSERT on touched predicates
ada.email = "ada@babbage.io";
await ada.save();

// delete (cascade removes nested objects)
await ada.delete({ cascade: true });
```

Validation runs on every `save()`; violations raise an error before any
queries are sent.



## Prefix management

```ts
PM.register("bedeo", "https://example.com/bedeo#");
PM.ensurePrefixed("https://example.com/bedeo#Address"); // → bedeo:Address
```

All builders use `PM` so generated queries always include the prefixes
actually used.

---

## Generating ontology & SHACL (Experimental)

```ts
import { generateOntologyTTL } from "./ontology-generator";

// OWL only
writeFileSync("ontology.ttl", generateOntologyTTL());

// OWL + SHACL
writeFileSync(
  "ontology-with-shapes.ttl",
  generateOntologyTTL({ includeShacl: true })
);
```


## ORM Class Query

`OwlClass.find(where?, options?)` returns fully hydrated instances that match RDF triples emitted for the mapped class. Filters use the TypeScript property names from your `@OntologyProp` declarations.

```ts
// Basic field filters (scalar + $in)
const openCalls = await Opportunity.find({
  status: "Open",
  iri: { $in: ["ex:opp_1", "ex:opp_3"] },
});

// Nested filters traverse object properties declared with onClass
const cityLeads = await Opportunity.find({
  location: {
    addressLocality: "Toronto",
  },
});

// Combine with query options (limit/offset/reasoning) and populate controls
const minimal = await Opportunity.find(
  { iri: { $in: ["ex:opp_2"] } },
  {
    limit: 1,
    reasoning: true,
    noPopulates: ["partners.organization.opportunities"],
  }
);
```

### Options reference
- `limit`, `offset`, `reasoning`, `onData`, `onVariables` mirror the underlying Stardog query parameters.
- `noPopulates` (string[]): skip hydrating the matching property paths; use `*` as a wildcard segment and omit numeric indexes. Example: `partners.organization.*` avoids loading any nested organization fields.
- Options are depth-aware: recursive lookups reuse the same `noPopulates` rules, preventing cycles like `Opportunity.partners[].organization.opportunities` when they are not needed by the caller.

