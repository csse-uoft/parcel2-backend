import { OntologyClass, OntologyProp, OwlClass, XSD } from "../services/owl/ontology";

@OntologyClass('bedeo:Person', { instanceBase: 'bedeo:person' })
export class Person extends OwlClass<Person> {
    @OntologyProp('bedeo:has_primary_address', { min: 0, max: 1, onClass: 'bedeo:Address' })
    declare primaryAddress: string;

    // Current
    @OntologyProp('bedeo:has_full_name', { exactly: 1, datatype: XSD.string })
    declare fullName: string;

    @OntologyProp('bedeo:has_first_name', { exactly: 1, datatype: XSD.string })
    declare firstName: string;

    @OntologyProp('bedeo:has_last_name', { exactly: 1, datatype: XSD.string })
    declare lastName: string;

    @OntologyProp('bedeo:has_middle_name', { min: 0, max: 1, datatype: XSD.string })
    declare middleName: string;

    // Formal
    @OntologyProp('bedeo:has_formal_full_name', { datatype: XSD.string })
    declare formalFullName: string[];

    @OntologyProp('bedeo:has_formal_first_name', { datatype: XSD.string })
    declare formalFirstName: string[];

    @OntologyProp('bedeo:has_formal_last_name', { datatype: XSD.string })
    declare formalLastName: string[];

    @OntologyProp('bedeo:has_formal_middle_name', { datatype: XSD.string })
    declare formalMiddleName: string[];
}
