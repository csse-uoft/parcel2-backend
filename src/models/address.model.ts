import { OntologyClass, OntologyProp, OwlClass } from "../services/owl/ontology";


@OntologyClass('bedeo:Address', { instanceBase: 'bedeo:address' })
export class Address extends OwlClass<Address> {

    @OntologyProp('bedeo:has_concession_information', { max: 1 })
    declare concessionInformation?: string;

    @OntologyProp('bedeo:has_country_code', { max: 1 })
    declare countryCode?: string;

    @OntologyProp('bedeo:has_country_name', { max: 1 })
    declare countryName?: string;

    @OntologyProp('bedeo:has_locality_name', { max: 1 })
    declare localityName?: string;

    @OntologyProp('bedeo:has_location_description', { max: 1 })
    declare locationDescription?: string;

    @OntologyProp('bedeo:has_lot_information', { max: 1 })
    declare lotInformation?: string;

    @OntologyProp('bedeo:has_part_lot_information', { max: 1 })
    declare partLotInformation?: string;

    @OntologyProp('bedeo:has_postal_box_identifier', { max: 1 })
    declare postalBoxIdentifier?: string;

    @OntologyProp('bedeo:has_postal_code', { max: 1 })
    declare postalCode?: string;

    @OntologyProp('bedeo:has_postal_station_information', { max: 1 })
    declare postalStationInformation?: string;

    @OntologyProp('bedeo:has_property_identification_number', { max: 1 })
    declare propertyIdentificationNumber?: string;

    @OntologyProp('bedeo:has_province_code', { max: 1 })
    declare provinceCode?: string;

    @OntologyProp('bedeo:has_province_name', { max: 1 })
    declare provinceName?: string;

    @OntologyProp('bedeo:has_rural_route_identifier', { max: 1 })
    declare ruralRouteIdentifier?: string;

    @OntologyProp('bedeo:has_site_name', { max: 1 })
    declare siteName?: string;

    @OntologyProp('bedeo:has_street_direction', { max: 1 })
    declare streetDirection?: string;

    @OntologyProp('bedeo:has_street_name', { max: 1 })
    declare streetName?: string;

    @OntologyProp('bedeo:has_street_number', { max: 1 })
    declare streetNumber?: string;

    @OntologyProp('bedeo:has_street_type', { max: 1 })
    declare streetType?: string;

    @OntologyProp('bedeo:has_string_representation', { max: 1 })
    declare stringRepresentation?: string;

    @OntologyProp('bedeo:has_unit_designator', { max: 1 })
    declare unitDesignator?: string;

    @OntologyProp('bedeo:has_unit_identifier', { max: 1 })
    declare unitIdentifier?: string;

}