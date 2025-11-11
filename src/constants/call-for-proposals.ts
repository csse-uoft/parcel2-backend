export enum CallForProposalStatus {
    DRAFT = "draft",
    PUBLISHED = "published",
    CLOSED = "closed",
}

export enum ApplicationSubmissionStatus {
    DRAFT = "draft",
    SUBMITTED = "submitted",
    UNDER_REVIEW = "under_review",
    WITHDRAWN = "withdrawn",
}

export enum ApplicationDecisionStatus {
    PENDING = "pending",
    ACCEPTED = "accepted",
    REJECTED = "rejected",
}

export enum ProposalStatus {
    DRAFT = "draft",
    READY_FOR_REVIEW = "ready_for_review",
}

export const CALL_FOR_PROPOSAL_FILTERABLE_STATUSES: CallForProposalStatus[] = [
    CallForProposalStatus.DRAFT,
    CallForProposalStatus.PUBLISHED,
    CallForProposalStatus.CLOSED,
];

export const APPLICATION_SUBMISSION_STATUSES: ApplicationSubmissionStatus[] = [
    ApplicationSubmissionStatus.DRAFT,
    ApplicationSubmissionStatus.SUBMITTED,
    ApplicationSubmissionStatus.UNDER_REVIEW,
    ApplicationSubmissionStatus.WITHDRAWN,
];

export const APPLICATION_DECISION_STATUSES: ApplicationDecisionStatus[] = [
    ApplicationDecisionStatus.PENDING,
    ApplicationDecisionStatus.ACCEPTED,
    ApplicationDecisionStatus.REJECTED,
];

export const PROPOSAL_STATUSES: ProposalStatus[] = [
    ProposalStatus.DRAFT,
    ProposalStatus.READY_FOR_REVIEW,
];
