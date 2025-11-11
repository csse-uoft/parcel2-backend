import { OntologyClass, OntologyProp, OwlClass, XSD } from "../services/owl/ontology";
import { Opportunity } from "./opportunity.model";
import { CallForProposalStatus, ApplicationDecisionStatus, ApplicationSubmissionStatus, ProposalStatus } from "../constants/call-for-proposals";
import { Organization } from "./organization.model";

// A call for proposal is a formal solicitation of proposals for a specific project or opportunity
@OntologyClass('bedeo:CallForProposals', { instanceBase: 'bedeo:callForProposals' })
export class CallForProposals extends OwlClass<CallForProposals> {

    @OntologyProp('bedeo:for_partnership_opportunity', { exactly: 1, onClass: 'bedeo:Opportunity' })
    declare forPartnershipOpportunity: Opportunity;

    @OntologyProp('bedeo:has_application', { onClass: 'bedeo:Application' })
    declare applications: Application[];

    // @OntologyProp('bedeo:has_constraint', { min: 0, onClass: 'bedeo:ConstraintClause' })
    // declare constraints: string[];

    @OntologyProp('bedeo:has_end_date', { exactly: 1, datatype: XSD.date })
    declare endDate: Date;

    @OntologyProp('bedeo:has_start_date', { exactly: 1, datatype: XSD.date })
    declare startDate: Date;

    @OntologyProp('bedeo:has_call_for_proposal_status', { exactly: 1, datatype: XSD.string })
    declare status: CallForProposalStatus;
}


@OntologyClass('bedeo:Application', { instanceBase: 'bedeo:application' })
export class Application extends OwlClass<Application> {
    @OntologyProp('bedeo:has_acceptance_status', { exactly: 1, datatype: XSD.string })
    declare acceptanceStatus: ApplicationDecisionStatus;

    @OntologyProp('bedeo:has_application_status', { exactly: 1, datatype: XSD.string })
    declare applicationStatus: ApplicationSubmissionStatus;

    @OntologyProp('bedeo:has_co-applicant', { onClass: 'bedeo:Organization' }) //*
    declare coApplicants?: (string | Organization)[];

    @OntologyProp('bedeo:has_principal_applicant', { exactly: 1, onClass: 'bedeo:Organization' }) //*
    declare principalApplicant: string | Organization;

    @OntologyProp('bedeo:has_proposal', { exactly: 1, onClass: 'bedeo:Proposal' })
    declare proposal: Proposal;
}


@OntologyClass('bedeo:Proposal', { instanceBase: 'bedeo:proposal' })
export class Proposal extends OwlClass<Proposal> {
    @OntologyProp('bedeo:has_title', { exactly: 1, datatype: XSD.string })
    declare title: string;

    @OntologyProp('bedeo:has_description', { exactly: 1, datatype: XSD.string })
    declare description: string;

    @OntologyProp('bedeo:has_organization', { exactly: 1, onClass: 'bedeo:Organization' })
    declare organization: string | Organization;

    // in opportunity class
    // @OntologyProp('bedeo:has_project', { exactly: 1, onClass: 'bedeo:Project' })
    // declare project: string;

    @OntologyProp('bedeo:has_proposal_status', { exactly: 1, datatype: XSD.string })
    declare proposalStatus: ProposalStatus;

    @OntologyProp('bedeo:has_files', { datatype: XSD.string })
    declare files: string[];
}