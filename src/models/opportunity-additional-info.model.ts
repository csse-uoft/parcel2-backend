import { Contact } from "./contact.model";
import { Address } from "./address.model";
import { OntologyClass, OntologyProp, XSD, OwlClass } from "../services/owl/ontology";
import { NamedNode } from "rdf-data-factory";


@OntologyClass('bedeo:OpportunityAdditionalInfo', { instanceBase: 'bedeo:opportunityAdditionalInfo' })
export class OpportunityAdditionalInfo extends OwlClass<OpportunityAdditionalInfo> {
    @OntologyProp('bedeo:has_images', { datatype: XSD.string })
    declare images: string[];

    @OntologyProp('bedeo:has_primary_image', { max: 1, datatype: XSD.string })
    declare primaryImage: string;

    @OntologyProp('bedeo:has_files', { datatype: XSD.string })
    declare files: string[];

    @OntologyProp('bedeo:is_posted', { max: 1, datatype: XSD.boolean })
    declare isPosted?: boolean;

    @OntologyProp('bedeo:is_searchable', { max: 1, datatype: XSD.boolean })
    declare isSearchable?: boolean;

    @OntologyProp('bedeo:has_date_posted', { max: 1, datatype: XSD.dateTime })
    declare datePosted?: Date;

    @OntologyProp('bedeo:has_date_modified', { max: 1, datatype: XSD.dateTime })
    declare dateModified?: Date;
}
