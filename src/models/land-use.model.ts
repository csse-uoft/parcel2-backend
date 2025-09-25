import { OntologyClass, OntologyProp, OwlClass, XSD } from "../services/owl/ontology";

@OntologyClass('bedeo:LandUse', { instanceBase: 'bedeo:landUse' })
export class LandUse extends OwlClass<LandUse> {

    @OntologyProp('bedeo:has_name', { exactly: 1, datatype: XSD.string })
    declare name: string;

    @OntologyProp('bedeo:has_description', { exactly: 1, datatype: XSD.string })
    declare description?: string;
}