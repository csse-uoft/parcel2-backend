import { OntologyClass, OntologyProp, XSD, OwlClass } from "../services/owl/ontology";


@OntologyClass('bedeo:OrganizationRegistrationNumber', { instanceBase: 'bedeo:organizationRegistrationNumber' })
export class OrganizationRegistrationNumber extends OwlClass<OrganizationRegistrationNumber> {

    @OntologyProp('bedeo:has_registering_authority', { max: 1, datatype: XSD.string })
    declare registeringAuthority?: string;

    @OntologyProp('bedeo:has_jurisdiction', { max: 1, datatype: XSD.string })
    declare jurisdiction?: string;

    @OntologyProp('bedeo:has_value', { exactly: 1, datatype: XSD.string })
    declare hasValue: string; // cannot use `value` as it is a reserved keyword in LiteralSpec

    @OntologyProp('bedeo:has_start_date', { max: 1, datatype: XSD.date })
    declare startDate?: Date;

    @OntologyProp('bedeo:has_end_date', { max: 1, datatype: XSD.date })
    declare endDate?: Date;
}

@OntologyClass('bedeo:OrganizationLegalName', { instanceBase: 'bedeo:organizationLegalName' })
export class OrganizationLegalName extends OwlClass<OrganizationLegalName> {

    @OntologyProp('bedeo:has_registering_authority', { max: 1, datatype: XSD.string })
    declare registeringAuthority?: string;

    @OntologyProp('bedeo:has_jurisdiction', { max: 1, datatype: XSD.string })
    declare jurisdiction?: string;

    @OntologyProp('bedeo:has_value', { exactly: 1, datatype: XSD.string })
    declare hasValue: string; // cannot use `value` as it is a reserved keyword in LiteralSpec

    @OntologyProp('bedeo:has_start_date', { max: 1, datatype: XSD.date })
    declare startDate?: Date;

    @OntologyProp('bedeo:has_end_date', { max: 1, datatype: XSD.date })
    declare endDate?: Date;
}