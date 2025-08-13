import { OntologyClass, OntologyProp, XSD, OwlClass } from "../services/owl/ontology";


@OntologyClass('bedeo:Role', { instanceBase: 'bedeo:role' })
export class Role extends OwlClass<Role> {

    @OntologyProp('bedeo:has_start_date', { max: 1, datatype: XSD.dateTime })
    declare startDate?: Date;

    @OntologyProp('bedeo:has_end_date', { max: 1, datatype: XSD.dateTime })
    declare endDate?: Date;

    @OntologyProp('bedeo:has_description', { max: 1, datatype: XSD.string })
    declare description?: string;

    @OntologyProp('bedeo:has_role_type', { min: 1, onClass: 'bedeo:RoleType' })
    declare roleTypes?: RoleType[];
}


// Taxonomy of roles
@OntologyClass('bedeo:RoleType', { instanceBase: 'bedeo:roleType' })
export class RoleType extends OwlClass<RoleType> {
    @OntologyProp('bedeo:has_name', { max: 1, datatype: XSD.string })
    declare name: string;

    @OntologyProp('bedeo:has_description', { min: 1, datatype: XSD.string })
    declare description?: string;
}