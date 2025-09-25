import { Contact } from "./contact.model";
import { Address } from "./address.model";
import { OntologyClass, OntologyProp, XSD, OwlClass } from "../services/owl/ontology";
import { NamedNode } from "rdf-data-factory";
import { Partner } from "./partner.model";
import { OpportunityAdditionalInfo } from "./opportunity-additional-info.model";
import { ProjectStage, ProjectType } from "./project.model";
import { Role, RoleType } from "./role.model";
import { Land } from "./land.model";


@OntologyClass('bedeo:Opportunity', { instanceBase: 'bedeo:opportunity' })
export class Opportunity extends OwlClass<Opportunity> {

    @OntologyProp('bedeo:has_name', { exactly: 1, datatype: XSD.string })
    declare name: string;

    @OntologyProp('bedeo:has_description', { exactly: 1, datatype: XSD.string })
    declare description?: string;

    @OntologyProp('bedeo:requires_partnership_role', { onClass: 'bedeo:RoleType' })
    declare partnershipRoles?: RoleType[] | NamedNode[] | string[];

    @OntologyProp('bedeo:has_primary_contact', { exactly: 1, onClass: 'bedeo:Contact' })
    declare primaryContact?: Contact;

    @OntologyProp('bedeo:has_project_type', { exactly: 1, onClass: 'bedeo:ProjectType' })
    declare projectType?: ProjectType | NamedNode | string;

    @OntologyProp('bedeo:has_project_stage', { exactly: 1, onClass: 'bedeo:ProjectStage' })
    declare projectStage?: ProjectType | NamedNode | string;

    @OntologyProp('bedeo:has_partner', { onClass: 'bedeo:Partner' })
    declare partners?: Partner[];

    @OntologyProp('bedeo:has_land', { exactly: 1, onClass: 'bedeo:Land' }) // need a land model
    declare land?: Land;

    @OntologyProp('bedeo:has_additional_info', { exactly: 1, onClass: 'bedeo:OpportunityAdditionalInfo' })
    declare additionalInfo?: OpportunityAdditionalInfo;
}