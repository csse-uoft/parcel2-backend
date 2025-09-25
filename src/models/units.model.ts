import { OntologyClass, OntologyProp, OwlClass, XSD } from "../services/owl/ontology";

@OntologyClass('bedeo:AreaUnit', { instanceBase: 'bedeo:areaUnit' })
export class AreaUnit extends OwlClass<AreaUnit> {
    // name
    @OntologyProp('bedeo:has_name', { exactly: 1, datatype: XSD.string })
    declare name: string;

    // symbol
    @OntologyProp('bedeo:has_description', { exactly: 1, datatype: XSD.string })
    declare description?: string;
}