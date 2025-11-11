import { Contact } from "./contact.model";
import { Address } from "./address.model";
import { OntologyClass, OntologyProp, XSD, OwlClass } from "../services/owl/ontology";
import { NamedNode } from "rdf-data-factory";
import { Organization } from "./organization.model";
import { Role } from "./role.model";
import { AreaUnit } from "./units.model";
import { LandUse } from "./land-use.model";


@OntologyClass('bedeo:Land', { instanceBase: 'bedeo:land' })
export class Land extends OwlClass<Land> {

    @OntologyProp('bedeo:has_notes', { exactly: 1, datatype: XSD.string })
    declare notes: string;

    @OntologyProp('bedeo:has_parcelId', { max: 1, datatype: XSD.string })
    declare parcelId?: string;

    @OntologyProp('bedeo:has_address', { min: 1, onClass: 'bedeo:Address' })
    declare addresses: Address[];

    @OntologyProp('bedeo:has_area', { max: 1, datatype: XSD.decimal })
    declare area?: number;

    @OntologyProp('bedeo:has_area_unit', { max: 1, onClass: 'bedeo:AreaUnit' })
    declare areaUnit?: AreaUnit;

    @OntologyProp('bedeo:current_land_use', { max: 1, onClass: 'bedeo:LandUse' })
    declare currentLandUse?: LandUse;

    @OntologyProp('bedeo:designated_land_use', { max: 1, onClass: 'bedeo:LandUse' })
    declare designatedLandUse?: LandUse;

    @OntologyProp('bedeo:proposed_land_use', { max: 1, onClass: 'bedeo:LandUse' })
    declare proposedLandUse?: LandUse;
}