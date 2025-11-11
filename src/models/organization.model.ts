/**
 * Organization model
 * Required information
 *  - organization legal name
 *  - short description of the organization
 *  - primary contact information (first and last name, phone, email)
 *  - organization details: mailing address, (optional) business address, phone number, etc
 *
 * Optional information
 *  - secondary contact information (first and last name, phone, email)
 *  - organization mission
 *  - organization values
 */

import { Contact } from "./contact.model";
import { Address } from "./address.model";
import { OntologyClass, OntologyProp, XSD, OwlClass } from "../services/owl/ontology";
import { NamedNode } from "rdf-data-factory";
import { OrganizationLegalName, OrganizationRegistrationNumber } from "./organization-registration.model";
import { Opportunity } from "./opportunity.model";
import { Role, RoleType } from "./role.model";
import { CallForProposals } from "./call-for-proposal.model";


@OntologyClass('bedeo:Organization', { instanceBase: 'bedeo:organization' })
export class Organization extends OwlClass<Organization> {


    // ── Object-typed optionals ──────────────────────────────────────
    // @OntologyProp('bedeo:has_member', { onClass: 'bedeo:Agent' })
    // declare members?: Agent[];

    //
    // @OntologyProp('bedeo:owns', { onClass: 'bedeo:real_estate_asset' })
    // declare realEstateAssets?: RealEstateAsset[];

    // ── String-typed optionals (someValuesFrom xsd:string) ──────────
    @OntologyProp('bedeo:has_description', { min: 1, max: 1, datatype: XSD.string })
    declare description: string;



    @OntologyProp('bedeo:has_organization_credit_assessment', { max: 1, datatype: XSD.string })
    declare creditAssessment?: string;

    @OntologyProp('bedeo:has_organization_credit_assessment_score', { max: 1, datatype: XSD.string })
    declare creditAssessmentScore?: string;

    @OntologyProp('bedeo:has_organization_decision_making_style', { max: 1, datatype: XSD.string })
    declare decisionMakingStyle?: string;

    @OntologyProp('bedeo:has_organization_expertise_score', { max: 1, datatype: XSD.string })
    declare expertiseScore?: string;

    @OntologyProp('bedeo:has_organization_financial_capacity_score', { max: 1, datatype: XSD.string })
    declare financialCapacityScore?: string;

    @OntologyProp('bedeo:has_organization_financial_strength_score', { max: 1, datatype: XSD.string })
    declare financialStrengthScore?: string;

    @OntologyProp('bedeo:has_organization_funding_model', { max: 1, datatype: XSD.string })
    declare fundingModel?: string;

    @OntologyProp('bedeo:has_organization_governance_score', { max: 1, datatype: XSD.string })
    declare governanceScore?: string;

    @OntologyProp('bedeo:has_organization_governance_style', { max: 1, datatype: XSD.string })
    declare governanceStyle?: string;

    @OntologyProp('bedeo:has_organization_innovation_capacity_score', { max: 1, datatype: XSD.string })
    declare innovationCapacityScore?: string;

    @OntologyProp('bedeo:has_organization_internal_controls_score', { max: 1, datatype: XSD.string })
    declare internalControlsScore?: string;

    @OntologyProp('bedeo:has_organization_legal_status', { max: 1, datatype: XSD.string })
    declare legalStatus?: string;

    @OntologyProp('bedeo:has_organization_membership_structure', { max: 1, datatype: XSD.string })
    declare membershipStructure?: string;

    @OntologyProp('bedeo:has_organization_monitoring_capacity_score', { max: 1, datatype: XSD.string })
    declare monitoringCapacityScore?: string;

    @OntologyProp('bedeo:has_organization_operational_approach', { max: 1, datatype: XSD.string })
    declare operationalApproach?: string;

    @OntologyProp('bedeo:has_organization_operational_scope', { max: 1, datatype: XSD.string })
    declare operationalScope?: string;

    @OntologyProp('bedeo:has_organization_partnership_strategy', { max: 1, datatype: XSD.string })
    declare partnershipStrategy?: string;

    @OntologyProp('bedeo:has_organization_project_delivery_capacity_score', { max: 1, datatype: XSD.string })
    declare projectDeliveryCapacityScore?: string;

    @OntologyProp('bedeo:has_organization_reporting_capacity_score', { max: 1, datatype: XSD.string })
    declare reportingCapacityScore?: string;

    @OntologyProp('bedeo:has_organization_risk_management_approach', { max: 1, datatype: XSD.string })
    declare riskManagementApproach?: string;

    @OntologyProp('bedeo:has_organization_social_purpose_classification_status', { max: 1, datatype: XSD.string })
    declare socialPurposeClassificationStatus?: string;

    @OntologyProp('bedeo:has_organization_social_services_provision_capacity', { max: 1, datatype: XSD.string })
    declare socialServicesProvisionCapacity?: string;

    @OntologyProp('bedeo:has_organization_stakeholder_engagement_level', { max: 1, datatype: XSD.string })
    declare stakeholderEngagementLevel?: string;

    @OntologyProp('bedeo:has_organization_structure', { max: 1, datatype: XSD.string })
    declare organizationStructure?: string;

    @OntologyProp('bedeo:has_organization_sustainability_and_envirionmental_compliance_score', {
        max: 1,
        datatype: XSD.string
    })
    declare sustainabilityAndEnvironmentalComplianceScore?: string;

    @OntologyProp('bedeo:has_organization_taxation_status', { max: 1, datatype: XSD.string })
    declare taxationStatus?: string;

    @OntologyProp('bedeo:has_organization_values', { max: 1, datatype: XSD.string })
    declare organizationValues?: string;

    @OntologyProp('bedeo:has_organization_viability_score', { max: 1, datatype: XSD.string })
    declare viabilityScore?: string;

    // ── Numeric optionals ───────────────────────────────────────────
    @OntologyProp('bedeo:has_organization_debt_coverage_ratio', { max: 1, datatype: XSD.decimal })
    declare debtCoverageRatio?: number;

    @OntologyProp('bedeo:has_organization_net_worth', { max: 1, datatype: XSD.integer })
    declare netWorth?: number;

    @OntologyProp('bedeo:has_organization_years_of_experience_with_accessible_design_and_construction', {
        max: 1,
        datatype: XSD.integer
    })
    declare yearsExperienceAccessibleDesign?: number;

    @OntologyProp('bedeo:has_organization_years_of_experience_with_affordable_housing', {
        max: 1,
        datatype: XSD.integer
    })
    declare yearsExperienceAffordableHousing?: number;

    @OntologyProp('bedeo:has_email', { datatype: XSD.string })
    declare email?: string;

    // Others not covered by the ontology
    @OntologyProp('schema:telephone', { datatype: XSD.string })
    declare phone?: string;

    @OntologyProp('bedeo:primaryContact', { exactly: 1, onClass: 'bedeo:Contact' })
    declare primaryContact: Contact;


    @OntologyProp('bedeo:has_organization_type', { max: 1, onClass: 'owl:Thing' })
    declare organizationType?: NamedNode;

    // Properties we will be using in the UI
    @OntologyProp('bedeo:has_acronym', { datatype: XSD.string })
    declare acronym?: string[];

    @OntologyProp('bedeo:has_mailing_address', { max: 1, onClass: 'bedeo:Address' })
    declare mailingAddress?: Address;

    @OntologyProp('bedeo:has_delivery_address', { max: 1, onClass: 'bedeo:Address' })
    declare deliveryAddress?: Address;

    @OntologyProp('bedeo:has_primary_address', { exactly: 1, onClass: 'bedeo:Address' })
    declare primaryAddress: Address;

    @OntologyProp('bedeo:has_name', { max: 1, datatype: XSD.string })
    declare name?: string;

    @OntologyProp('bedeo:has_organization_trade_name', { max: 1, datatype: XSD.string })
    declare tradeName?: string;

    // @OntologyProp('bedeo:has_current_legal_name', { min: 1, max: 1, datatype: XSD.string })
    // declare currentLegalName: string;

    @OntologyProp('bedeo:has_legal_name', { max: 2, onClass: 'bedeo:OrganizationLegalName' })
    declare legalNames?: OrganizationLegalName[];

    @OntologyProp('bedeo:has_brief_description', { exactly: 1, datatype: XSD.string })
    declare briefDescription: string;

    @OntologyProp('bedeo:has_organization_mission_statement', { max: 1, datatype: XSD.string })
    declare missionStatement?: string;

    @OntologyProp('bedeo:has_organization_values_statement', { max: 1, datatype: XSD.string })
    declare valuesStatement?: string;

    @OntologyProp('bedeo:has_organization_registration_number', { max: 5, onClass: 'bedeo:OrganizationRegistrationNumber' })
    declare registrationNumbers?: OrganizationRegistrationNumber[];

    @OntologyProp('bedeo:has_opportunity', { onClass: 'bedeo:Opportunity' })
    declare opportunities?: (string | Opportunity)[]; // can be IRIs or populated

    @OntologyProp('bedeo:has_call_for_proposal', { onClass: 'bedeo:CallForProposals' })
    declare callForProposals?: (string | CallForProposals)[];

    @OntologyProp('bedeo:has_role_type', { onClass: 'bedeo:RoleType' })
    declare roleTypes?: RoleType[] | NamedNode[] | string[];
}
