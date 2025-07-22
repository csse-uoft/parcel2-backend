import { Contact } from "./contact.model";
import { Address } from "./address.model";
import { OntologyClass, OntologyProp, XSD, OwlClass } from "../services/owl/ontology";
import { NamedNode } from "rdf-data-factory";
import { Organization } from "./organization.model";


@OntologyClass('bedeo:Partner', { instanceBase: 'bedeo:partner' })
export class Partner extends OwlClass<Partner> {

    @OntologyProp('bedeo:has_organization', { exactly: 1, onClass: 'bedeo:Organization' })
    declare organization: Organization;

    @OntologyProp('bedeo:has_role', { min: 1, onClass: 'bedeo:Role' })
    declare roles?: NamedNode[];

}