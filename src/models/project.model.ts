import { OntologyClass, OntologyProp, XSD, OwlClass } from "../services/owl/ontology";

// Taxonomy
@OntologyClass('bedeo:ProjectType', { instanceBase: 'bedeo:projectType' })
export class ProjectType extends OwlClass<ProjectType> {
    @OntologyProp('bedeo:has_name', { exactly: 1, datatype: XSD.string })
    declare name: string;

    @OntologyProp('bedeo:has_description', { exactly: 1, datatype: XSD.string })
    declare description?: string;
}

// Taxonomy
@OntologyClass('bedeo:ProjectStage', { instanceBase: 'bedeo:projectStage' })
export class ProjectStage extends OwlClass<ProjectStage> {
    @OntologyProp('bedeo:has_name', { exactly: 1, datatype: XSD.string })
    declare name: string;

    @OntologyProp('bedeo:has_description', { exactly: 1, datatype: XSD.string })
    declare description?: string;
}
