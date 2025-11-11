import { Request, Response } from "express";
import { Application, CallForProposals, Opportunity, Organization, Proposal } from "../models";
import {
    ApplicationDecisionStatus,
    ApplicationSubmissionStatus,
    CallForProposalStatus,
    ProposalStatus,
} from "../constants/call-for-proposals";
import { RequestUser } from "../middleware/auth.middleware";
import { hasRole, UserRole } from "../constants/roles";
import { getUserOrganization } from "../services/user.service";
import { ServiceError } from "../utils/errors";
import { PM } from "../services/prefixes";

const DEFAULT_NO_POPULATES = [
    "applications.proposal.organization.callForProposals",
    "applications.proposal.organization.opportunities",
    "applications.coApplicants.callForProposals",
    "applications.coApplicants.opportunities",
];

function serializeCallForProposal(cfp: CallForProposals): any {
    const candidate = (cfp as any)?.toJSON?.() ?? null;
    if (candidate && typeof candidate === "object") {
        return candidate;
    }
    return JSON.parse(JSON.stringify(cfp));
}

function ensureDate(value: unknown, field: string): Date {
    if (!value) {
        throw new ServiceError(`Missing required field: ${field}`, 400);
    }
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) {
        throw new ServiceError(`Invalid date for ${field}`, 400);
    }
    return parsed;
}

async function resolveOpportunityOwner(opportunityIri: string): Promise<Organization | null> {
    const normalized = PM.ensurePrefixed(opportunityIri);
    const opportunity = await Opportunity.findByIri<Opportunity>(normalized, {
        noPopulates: ["partners.organization.opportunities"],
    });
    if (!opportunity) return null;

    const owner = await Organization.findOne<Organization>({ opportunities: { $in: [normalized] } });
    return owner ?? null;
}

async function requireCallForProposal(iri: string) {
    const prefixed = PM.ensurePrefixed(iri);
    const cfp = await CallForProposals.findByIri<CallForProposals>(prefixed, { noPopulates: DEFAULT_NO_POPULATES });
    if (!cfp) {
        throw new ServiceError("Call for proposals not found", 404);
    }
    return cfp;
}

async function summarizeOwner(cfp: CallForProposals) {
    const opportunityIri = typeof cfp.forPartnershipOpportunity === "string"
        ? cfp.forPartnershipOpportunity
        : cfp.forPartnershipOpportunity?.iri;
    if (!opportunityIri) return null;
    const owner = await resolveOpportunityOwner(opportunityIri);
    if (!owner?.iri) return null;
    return {
        iri: owner.iri,
        name: owner.name ?? owner.tradeName ?? owner.briefDescription,
    };
}

async function requireOrganizationForUser(user: RequestUser): Promise<Organization> {
    try {
        return await getUserOrganization(user.id);
    } catch (err) {
        if (err instanceof ServiceError) {
            throw err;
        }
        throw new ServiceError("Failed to resolve organization", 400);
    }
}

function ensureOrganizationOwnsCall(org: Organization, cfp: CallForProposals) {
    const iri = PM.ensurePrefixed(cfp.iri ?? "");
    const owns = (org.callForProposals ?? []).some((entry) => {
        if (!entry) return false;
        if (typeof entry === "string") return PM.ensurePrefixed(entry) === iri;
        return PM.ensurePrefixed(entry.iri ?? "") === iri;
    });
    if (!owns) {
        throw new ServiceError("Forbidden: call for proposals not owned by organization", 403);
    }
}

function ensureOrganizationOwnsOpportunity(org: Organization, opportunityIri: string) {
    const normalized = PM.ensurePrefixed(opportunityIri);
    const owns = (org.opportunities ?? []).some((entry) => {
        if (!entry) return false;
        if (typeof entry === "string") return PM.ensurePrefixed(entry) === normalized;
        return PM.ensurePrefixed(entry.iri ?? "") === normalized;
    });
    if (!owns) {
        throw new ServiceError("Forbidden: opportunity is outside the organization", 403);
    }
}

function normalizeIri(input: string | { iri?: string; id?: string }): string {
    if (typeof input === "string") return PM.ensurePrefixed(input);
    const iri = input.iri ?? input.id;
    if (!iri) {
        throw new ServiceError("Invalid IRI input", 400);
    }
    return PM.ensurePrefixed(iri);
}

function cleanOrganizationList(values: unknown[]): string[] {
    return (values ?? [])
        .map((value) => {
            if (!value) return null;
            if (typeof value === "string") return PM.ensurePrefixed(value);
            if (typeof value === "object" && typeof (value as any).iri === "string") {
                return PM.ensurePrefixed((value as any).iri);
            }
            return null;
        })
        .filter((value): value is string => Boolean(value));
}

function upsertCallForProposalFromPayload(
    cfp: CallForProposals,
    payload: any,
    opportunityIri: string,
) {
    cfp.forPartnershipOpportunity = opportunityIri as any;
    cfp.startDate = ensureDate(payload.startDate, "startDate");
    cfp.endDate = ensureDate(payload.endDate, "endDate");
    const status = payload.status ?? CallForProposalStatus.DRAFT;
    if (!Object.values(CallForProposalStatus).includes(status)) {
        throw new ServiceError("Invalid call for proposal status", 400);
    }
    cfp.status = status;
    cfp.applications = cfp.applications ?? [];
}

function buildProposalFromPayload(payload: any, applicantIri: string): Proposal {
    if (!payload?.title) {
        throw new ServiceError("Proposal title is required", 400);
    }
    if (!payload?.description) {
        throw new ServiceError("Proposal description is required", 400);
    }
    const proposalStatus = payload.proposalStatus ?? ProposalStatus.DRAFT;
    if (!Object.values(ProposalStatus).includes(proposalStatus)) {
        throw new ServiceError("Invalid proposal status", 400);
    }

    const proposal = Proposal.create({
        title: payload.title,
        description: payload.description,
        organization: applicantIri,
        proposalStatus,
        files: Array.isArray(payload.files) ? payload.files : [],
    });
    proposal.assignIRI();
    return proposal;
}

function buildApplicationFromPayload(
    payload: any,
    applicantIri: string,
    proposal: Proposal,
    overrides?: {
        applicationStatus?: ApplicationSubmissionStatus;
        acceptanceStatus?: ApplicationDecisionStatus;
    },
): Application {
    const applicationStatusInput = overrides?.applicationStatus ?? payload.applicationStatus;
    const applicationStatus = applicationStatusInput ?? ApplicationSubmissionStatus.DRAFT;
    if (!Object.values(ApplicationSubmissionStatus).includes(applicationStatus)) {
        throw new ServiceError("Invalid application status", 400);
    }
    const acceptanceStatusInput = overrides?.acceptanceStatus ?? payload.acceptanceStatus;
    const acceptanceStatus = acceptanceStatusInput ?? ApplicationDecisionStatus.PENDING;
    if (!Object.values(ApplicationDecisionStatus).includes(acceptanceStatus)) {
        throw new ServiceError("Invalid acceptance status", 400);
    }

    const application = Application.create({
        applicationStatus,
        acceptanceStatus,
        principalApplicant: applicantIri,
        proposal,
        coApplicants: cleanOrganizationList(payload.coApplicants ?? []),
    });
    application.assignIRI();
    return application;
}

export async function listCallForProposals(req: Request, res: Response) {
    try {
        const user = (req as any).user as RequestUser;
        const isAdmin = hasRole(user.roles, UserRole.ADMIN);

        if (isAdmin) {
            const where: any = {};
            if (req.query.opportunity) {
                where.forPartnershipOpportunity = normalizeIri(String(req.query.opportunity));
            }
            const data = await CallForProposals.find(where, { noPopulates: DEFAULT_NO_POPULATES });
            const withOwners = await Promise.all(data.map(async (item) => {
                const cfpItem = item as CallForProposals;
                const summary = await summarizeOwner(cfpItem);
                if (summary) {
                    (cfpItem as any).organization = summary;
                }
                return cfpItem;
            }));
            res.json(withOwners);
            return;
        }

        const organization = await requireOrganizationForUser(user);
        if (!organization.callForProposals?.length) {
            res.json([]);
            return;
        }
        const payload = organization.callForProposals
            .map((entry) => (typeof entry === "string" ? entry : entry?.iri))
            .filter((iri): iri is string => Boolean(iri));
        if (!payload.length) {
            res.json([]);
            return;
        }
        const cfps = await CallForProposals.find({ iri: { $in: payload } }, { noPopulates: DEFAULT_NO_POPULATES });
        const withOwners = await Promise.all(cfps.map(async (item) => {
            const cfpItem = item as CallForProposals;
            const summary = await summarizeOwner(cfpItem);
            if (summary) {
                (cfpItem as any).organization = summary;
            }
            return cfpItem;
        }));
        res.json(withOwners);
    } catch (error) {
        console.error(error);
        const status = error instanceof ServiceError ? error.status : 400;
        res.status(status).json({ message: (error as Error).message });
    }
}

export async function getCallForProposalByIri(req: Request, res: Response) {
    try {
        const iri = req.params.iri;
        const user = (req as any).user as RequestUser;
        const cfp = await requireCallForProposal(iri);

        const isAdmin = hasRole(user.roles, UserRole.ADMIN);
        const userOrg = await requireOrganizationForUser(user);
        const userOrgIri = PM.ensurePrefixed(userOrg.iri ?? "");

        const ownerOrg = await resolveOpportunityOwner(
            typeof cfp.forPartnershipOpportunity === "string"
                ? cfp.forPartnershipOpportunity
                : cfp.forPartnershipOpportunity?.iri ?? "",
        );
        const ownerIri = ownerOrg?.iri ? PM.ensurePrefixed(ownerOrg.iri) : null;
        const isOwner = ownerIri && ownerIri === userOrgIri;

        if (!isAdmin && !isOwner && cfp.status === CallForProposalStatus.DRAFT) {
            throw new ServiceError("Forbidden", 403);
        }

        const payload = serializeCallForProposal(cfp);
        if (!isAdmin && !isOwner) {
            const userApplications = (payload.applications ?? []).filter((app: Application | null) => {
                if (!app) return false;
                const principal = typeof app.principalApplicant === "string"
                    ? PM.ensurePrefixed(app.principalApplicant)
                    : PM.ensurePrefixed(app.principalApplicant?.iri ?? "");
                return principal === userOrgIri;
            });
            payload.applications = userApplications;
        }

        const summary = await summarizeOwner(cfp);
        if (summary) {
            payload.organization = summary;
        }

        res.json(payload);
    } catch (error) {
        console.error(error);
        const status = error instanceof ServiceError ? error.status : 400;
        res.status(status).json({ message: (error as Error).message });
    }
}

export async function createCallForProposal(req: Request, res: Response) {
    try {
        const user = (req as any).user as RequestUser;
        const isAdmin = hasRole(user.roles, UserRole.ADMIN);
        const payload = req.body ?? {};

        if (!payload.forPartnershipOpportunity) {
            throw new ServiceError("forPartnershipOpportunity is required", 400);
        }
        const opportunityIri = normalizeIri(payload.forPartnershipOpportunity);

        let owner = await resolveOpportunityOwner(opportunityIri);
        if (!owner) {
            throw new ServiceError("Opportunity not found or unlinked", 404);
        }

        if (!isAdmin) {
            const userOrg = await requireOrganizationForUser(user);
            ensureOrganizationOwnsOpportunity(userOrg, opportunityIri);
            owner = userOrg;
        }

        const cfp = CallForProposals.create({});
        cfp.assignIRI();
        upsertCallForProposalFromPayload(cfp, payload, opportunityIri);
        await cfp.save();

        const existing = owner.callForProposals ?? [];
        const seen = new Set<string>();
        const combined = [...existing, cfp].filter((entry) => {
            if (!entry) return false;
            const iri = typeof entry === "string" ? PM.ensurePrefixed(entry) : PM.ensurePrefixed(entry.iri ?? "");
            if (!iri || seen.has(iri)) return false;
            seen.add(iri);
            return true;
        });
        owner.callForProposals = combined;
        await owner.save();

        const hydrated = await CallForProposals.findByIri<CallForProposals>(cfp.iri!, { noPopulates: DEFAULT_NO_POPULATES }) ?? cfp;
        const summary = await summarizeOwner(hydrated);
        if (summary) {
            (hydrated as any).organization = summary;
        }
        res.status(201).json(hydrated);
    } catch (error) {
        console.error(error);
        const status = error instanceof ServiceError ? error.status : 400;
        res.status(status).json({ message: (error as Error).message });
    }
}

export async function updateCallForProposal(req: Request, res: Response) {
    try {
        const iri = req.params.iri;
        const payload = req.body ?? {};
        const user = (req as any).user as RequestUser;
        const isAdmin = hasRole(user.roles, UserRole.ADMIN);

        const cfp = await requireCallForProposal(iri);

        let owner = await resolveOpportunityOwner(
            typeof cfp.forPartnershipOpportunity === "string"
                ? cfp.forPartnershipOpportunity
                : cfp.forPartnershipOpportunity.iri!,
        );
        if (!owner) {
            throw new ServiceError("Owner organization could not be determined", 404);
        }

        if (!isAdmin) {
            const userOrg = await requireOrganizationForUser(user);
            if (PM.ensurePrefixed(owner.iri ?? "") !== PM.ensurePrefixed(userOrg.iri ?? "")) {
                throw new ServiceError("Forbidden", 403);
            }
            owner = userOrg;
        }

        const opportunityIri = normalizeIri(payload.forPartnershipOpportunity ?? cfp.forPartnershipOpportunity);
        ensureOrganizationOwnsOpportunity(owner, opportunityIri);

        upsertCallForProposalFromPayload(cfp, payload, opportunityIri);
        await cfp.save();

        const refreshed = await CallForProposals.findByIri<CallForProposals>(cfp.iri!, { noPopulates: DEFAULT_NO_POPULATES });
        if (refreshed) {
            const summary = await summarizeOwner(refreshed);
            if (summary) {
                (refreshed as any).organization = summary;
            }
        }

        res.json(refreshed ?? cfp);
    } catch (error) {
        console.error(error);
        const status = error instanceof ServiceError ? error.status : 400;
        res.status(status).json({ message: (error as Error).message });
    }
}

export async function deleteCallForProposal(req: Request, res: Response) {
    try {
        const iri = req.params.iri;
        const user = (req as any).user as RequestUser;
        const isAdmin = hasRole(user.roles, UserRole.ADMIN);

        const cfp = await requireCallForProposal(iri);

        let owner = await resolveOpportunityOwner(
            typeof cfp.forPartnershipOpportunity === "string"
                ? cfp.forPartnershipOpportunity
                : cfp.forPartnershipOpportunity.iri!,
        );

        if (!isAdmin) {
            const userOrg = await requireOrganizationForUser(user);
            if (!owner || PM.ensurePrefixed(owner.iri ?? "") !== PM.ensurePrefixed(userOrg.iri ?? "")) {
                throw new ServiceError("Forbidden", 403);
            }
            owner = userOrg;
        }

        await cfp.delete({ cascade: true });
        if (owner) {
            owner.callForProposals = (owner.callForProposals ?? []).filter((entry) => {
                if (!entry) return false;
                const entryIri = typeof entry === "string" ? PM.ensurePrefixed(entry) : PM.ensurePrefixed(entry.iri ?? "");
                return entryIri !== PM.ensurePrefixed(cfp.iri!);
            });
            await owner.save();
        }
        res.json({ message: "Call for proposals deleted" });
    } catch (error) {
        console.error(error);
        const status = error instanceof ServiceError ? error.status : 400;
        res.status(status).json({ message: (error as Error).message });
    }
}

export async function listApplicationsForCall(req: Request, res: Response) {
    try {
        const iri = req.params.iri;
        const user = (req as any).user as RequestUser;
        const cfp = await requireCallForProposal(iri);
        const isAdmin = hasRole(user.roles, UserRole.ADMIN);

        if (!isAdmin) {
            const userOrg = await requireOrganizationForUser(user);
            try {
                ensureOrganizationOwnsCall(userOrg, cfp);
            } catch {
                const principalMatch = (cfp.applications ?? []).filter((app) => {
                    if (!app) return false;
                    const principal = typeof app.principalApplicant === "string"
                        ? PM.ensurePrefixed(app.principalApplicant)
                        : PM.ensurePrefixed(app.principalApplicant?.iri ?? "");
                    return principal === PM.ensurePrefixed(userOrg.iri ?? "");
                });
                const data = principalMatch ?? [];
                res.json(data);
                return;
            }
        }

        res.json(cfp.applications ?? []);
    } catch (error) {
        console.error(error);
        const status = error instanceof ServiceError ? error.status : 400;
        res.status(status).json({ message: (error as Error).message });
    }
}

export async function listCallForProposalsForOpportunity(req: Request, res: Response) {
    try {
        const user = (req as any).user as RequestUser;
        const opportunityIri = normalizeIri(req.params.iri);
        const isAdmin = hasRole(user.roles, UserRole.ADMIN);
        const userOrg = await requireOrganizationForUser(user);
        const userOrgIri = PM.ensurePrefixed(userOrg.iri ?? "");

        const calls = await CallForProposals.find<CallForProposals>({}, { noPopulates: DEFAULT_NO_POPULATES });
        const payload = await Promise.all(calls.map(async (call) => {
            const callOpportunityIri = PM.ensurePrefixed(
                typeof call.forPartnershipOpportunity === "string"
                    ? call.forPartnershipOpportunity
                    : call.forPartnershipOpportunity?.iri ?? "",
            );
            if (callOpportunityIri !== opportunityIri) {
                return null;
            }
            const ownerOrg = await resolveOpportunityOwner(
                typeof call.forPartnershipOpportunity === "string"
                    ? call.forPartnershipOpportunity
                    : call.forPartnershipOpportunity?.iri ?? "",
            );
            const ownerIri = ownerOrg?.iri ? PM.ensurePrefixed(ownerOrg.iri) : null;
            const isOwner = ownerIri === userOrgIri;

            if (!isAdmin && !isOwner && call.status === CallForProposalStatus.DRAFT) {
                return null;
            }

            const serialized = serializeCallForProposal(call);
            const applications = Array.isArray(serialized.applications) ? serialized.applications : [];
            const yourApplication = applications.find((app: any) => {
                if (!app) return false;
                const principal = typeof app.principalApplicant === "string"
                    ? PM.ensurePrefixed(app.principalApplicant)
                    : PM.ensurePrefixed(app.principalApplicant?.iri ?? "");
                return principal === userOrgIri;
            }) ?? null;

            if (!isAdmin && !isOwner) {
                serialized.applications = yourApplication ? [yourApplication] : [];
            }

            const summary = await summarizeOwner(call);
            if (summary) {
                serialized.organization = summary;
            }

            serialized.yourApplication = yourApplication;
            serialized.isOwner = isOwner;

            return serialized;
        }));

        const filtered = payload.filter((item): item is Record<string, any> => Boolean(item));
        res.json(filtered);
    } catch (error) {
        console.error(error);
        const status = error instanceof ServiceError ? error.status : 400;
        res.status(status).json({ message: (error as Error).message });
    }
}

export async function listMyApplications(req: Request, res: Response) {
    try {
        const user = (req as any).user as RequestUser;
        const userOrg = await requireOrganizationForUser(user);
        const userOrgIri = PM.ensurePrefixed(userOrg.iri ?? "");

        const calls = await CallForProposals.find<CallForProposals>({}, { noPopulates: DEFAULT_NO_POPULATES });
        const result: Array<{ callForProposal: any; application: any }> = [];

        for (const call of calls) {
            const serialized = serializeCallForProposal(call);
            const summary = await summarizeOwner(call);

            const applications = Array.isArray(serialized.applications) ? serialized.applications : [];
            applications
                .filter((app: any) => {
                    if (!app) return false;
                    const principal = typeof app.principalApplicant === "string"
                        ? PM.ensurePrefixed(app.principalApplicant)
                        : PM.ensurePrefixed(app.principalApplicant?.iri ?? "");
                    return principal === userOrgIri;
                })
                .forEach((app: any) => {
                    result.push({
                        callForProposal: {
                            iri: serialized.iri,
                            status: serialized.status,
                            startDate: serialized.startDate,
                            endDate: serialized.endDate,
                            forPartnershipOpportunity: serialized.forPartnershipOpportunity,
                            organization: summary ?? null,
                        },
                        application: app,
                    });
                });
        }

        res.json(result);
    } catch (error) {
        console.error(error);
        const status = error instanceof ServiceError ? error.status : 400;
        res.status(status).json({ message: (error as Error).message });
    }
}

export async function getMyApplication(req: Request, res: Response) {
    try {
        const user = (req as any).user as RequestUser;
        const applicationIri = PM.ensurePrefixed(req.params.applicationIri);
        const isAdmin = hasRole(user.roles, UserRole.ADMIN);
        const userOrg = await requireOrganizationForUser(user);
        const userOrgIri = PM.ensurePrefixed(userOrg.iri ?? "");

    const calls = await CallForProposals.find<CallForProposals>({}, { noPopulates: DEFAULT_NO_POPULATES });

        let matchedCall: CallForProposals | null = null;
        let matchedApplication: any = null;

        for (const call of calls) {
            const serialized = serializeCallForProposal(call);
            const applications = Array.isArray(serialized.applications) ? serialized.applications : [];
            const found = applications.find((app: any) => PM.ensurePrefixed(app?.iri ?? "") === applicationIri);
            if (found) {
                matchedCall = call;
                matchedApplication = found;
                break;
            }
        }

        if (!matchedCall || !matchedApplication) {
            throw new ServiceError("Application not found", 404);
        }

        const serializedCall = serializeCallForProposal(matchedCall);
        const ownerOrg = await resolveOpportunityOwner(
            typeof matchedCall.forPartnershipOpportunity === "string"
                ? matchedCall.forPartnershipOpportunity
                : matchedCall.forPartnershipOpportunity?.iri ?? "",
        );
        const ownerIri = ownerOrg?.iri ? PM.ensurePrefixed(ownerOrg.iri) : null;
        const isOwner = ownerIri === userOrgIri;

        const principal = typeof matchedApplication.principalApplicant === "string"
            ? PM.ensurePrefixed(matchedApplication.principalApplicant)
            : PM.ensurePrefixed(matchedApplication.principalApplicant?.iri ?? "");
        const isApplicant = principal === userOrgIri;

        if (!isAdmin && !isOwner && !isApplicant) {
            throw new ServiceError("Forbidden", 403);
        }

        const summary = await summarizeOwner(matchedCall);
        const response = {
            callForProposal: {
                iri: serializedCall.iri,
                status: serializedCall.status,
                startDate: serializedCall.startDate,
                endDate: serializedCall.endDate,
                forPartnershipOpportunity: serializedCall.forPartnershipOpportunity,
                organization: summary ?? null,
            },
            application: matchedApplication,
            isOwner,
            isApplicant,
        };

        res.json(response);
    } catch (error) {
        console.error(error);
        const status = error instanceof ServiceError ? error.status : 400;
        res.status(status).json({ message: (error as Error).message });
    }
}

export async function createApplicationForCall(req: Request, res: Response) {
    try {
        const user = (req as any).user as RequestUser;
        const payload = req.body ?? {};
        const cfp = await requireCallForProposal(req.params.iri);
        const applicantOrg = await requireOrganizationForUser(user);
        const ownerOrg = await resolveOpportunityOwner(
            typeof cfp.forPartnershipOpportunity === "string"
                ? cfp.forPartnershipOpportunity
                : cfp.forPartnershipOpportunity.iri!,
        );

        const applicantIri = PM.ensurePrefixed(applicantOrg.iri ?? "");
        const isAdmin = hasRole(user.roles, UserRole.ADMIN);
        const applicantIsOwner = ownerOrg && PM.ensurePrefixed(ownerOrg.iri ?? "") === applicantIri;

        const proposal = buildProposalFromPayload(payload.proposal, applicantIri);
        const sanitizedStatuses = {
            applicationStatus: (isAdmin || applicantIsOwner) && payload.applicationStatus
                ? payload.applicationStatus
                : ApplicationSubmissionStatus.DRAFT,
            acceptanceStatus: (isAdmin || applicantIsOwner) && payload.acceptanceStatus
                ? payload.acceptanceStatus
                : ApplicationDecisionStatus.PENDING,
        } as const;
        const application = buildApplicationFromPayload(payload, applicantIri, proposal, sanitizedStatuses);

        cfp.applications = [...(cfp.applications ?? []), application];
        await cfp.save();

        const fresh = await CallForProposals.findByIri<CallForProposals>(cfp.iri!, { noPopulates: DEFAULT_NO_POPULATES });
        const created = (fresh?.applications ?? []).find((entry) => PM.ensurePrefixed(entry?.iri ?? "") === PM.ensurePrefixed(application.iri!));
        res.status(201).json(created ?? application);
    } catch (error) {
        console.error(error);
        const status = error instanceof ServiceError ? error.status : 400;
        res.status(status).json({ message: (error as Error).message });
    }
}

export async function updateApplicationForCall(req: Request, res: Response) {
    try {
        const user = (req as any).user as RequestUser;
        const payload = req.body ?? {};
        const cfp = await requireCallForProposal(req.params.iri);
        const applicationIri = PM.ensurePrefixed(req.params.applicationIri);
        const isAdmin = hasRole(user.roles, UserRole.ADMIN);
        const userOrg = await requireOrganizationForUser(user);
        const userOrgIri = PM.ensurePrefixed(userOrg.iri ?? "");

        const application = (cfp.applications ?? []).find((entry) => PM.ensurePrefixed(entry?.iri ?? "") === applicationIri);
        if (!application) {
            throw new ServiceError("Application not found", 404);
        }

        const ownerOrg = await resolveOpportunityOwner(
            typeof cfp.forPartnershipOpportunity === "string"
                ? cfp.forPartnershipOpportunity
                : cfp.forPartnershipOpportunity.iri!,
        );

        const applicantIri = typeof application.principalApplicant === "string"
            ? PM.ensurePrefixed(application.principalApplicant)
            : PM.ensurePrefixed(application.principalApplicant?.iri ?? "");

        const canManageStatuses = isAdmin || (ownerOrg && PM.ensurePrefixed(ownerOrg.iri ?? "") === userOrgIri);
        const isApplicant = applicantIri === userOrgIri;

        if (!canManageStatuses && !isApplicant) {
            throw new ServiceError("Forbidden", 403);
        }

        if (payload.proposal) {
            application.proposal.title = payload.proposal.title ?? application.proposal.title;
            application.proposal.description = payload.proposal.description ?? application.proposal.description;
            if (payload.proposal.files) {
                application.proposal.files = Array.isArray(payload.proposal.files) ? payload.proposal.files : application.proposal.files;
            }
            if (payload.proposal.proposalStatus) {
                if (!Object.values(ProposalStatus).includes(payload.proposal.proposalStatus)) {
                    throw new ServiceError("Invalid proposal status", 400);
                }
                application.proposal.proposalStatus = payload.proposal.proposalStatus;
            }
        }

        if (payload.coApplicants) {
            application.coApplicants = cleanOrganizationList(payload.coApplicants);
        }

        if (payload.applicationStatus !== undefined) {
            if (!Object.values(ApplicationSubmissionStatus).includes(payload.applicationStatus)) {
                throw new ServiceError("Invalid application status", 400);
            }
            if (!canManageStatuses) {
                throw new ServiceError("Only the opportunity owner can update application status", 403);
            }
            application.applicationStatus = payload.applicationStatus;
        }

        if (payload.acceptanceStatus !== undefined) {
            if (!canManageStatuses) {
                throw new ServiceError("Only reviewers can update acceptance status", 403);
            }
            if (!Object.values(ApplicationDecisionStatus).includes(payload.acceptanceStatus)) {
                throw new ServiceError("Invalid acceptance status", 400);
            }
            application.acceptanceStatus = payload.acceptanceStatus;
        }

        await cfp.save();

        const fresh = await CallForProposals.findByIri<CallForProposals>(cfp.iri!, { noPopulates: DEFAULT_NO_POPULATES });
        const updated = (fresh?.applications ?? []).find((entry) => PM.ensurePrefixed(entry?.iri ?? "") === applicationIri);
        res.json(updated ?? application);
    } catch (error) {
        console.error(error);
        const status = error instanceof ServiceError ? error.status : 400;
        res.status(status).json({ message: (error as Error).message });
    }
}

export async function deleteApplicationForCall(req: Request, res: Response) {
    try {
        const user = (req as any).user as RequestUser;
        const cfp = await requireCallForProposal(req.params.iri);
        const applicationIri = PM.ensurePrefixed(req.params.applicationIri);
        const userOrg = await requireOrganizationForUser(user);
        const userOrgIri = PM.ensurePrefixed(userOrg.iri ?? "");
        const isAdmin = hasRole(user.roles, UserRole.ADMIN);

        const applicationIndex = (cfp.applications ?? []).findIndex((entry) => PM.ensurePrefixed(entry?.iri ?? "") === applicationIri);
        if (applicationIndex === -1) {
            throw new ServiceError("Application not found", 404);
        }
        const application = cfp.applications![applicationIndex];

        const ownerOrg = await resolveOpportunityOwner(
            typeof cfp.forPartnershipOpportunity === "string"
                ? cfp.forPartnershipOpportunity
                : cfp.forPartnershipOpportunity.iri!,
        );
        const applicantIri = typeof application.principalApplicant === "string"
            ? PM.ensurePrefixed(application.principalApplicant)
            : PM.ensurePrefixed(application.principalApplicant?.iri ?? "");

        const canDelete = isAdmin
            || (ownerOrg && PM.ensurePrefixed(ownerOrg.iri ?? "") === userOrgIri)
            || applicantIri === userOrgIri;

        if (!canDelete) {
            throw new ServiceError("Forbidden", 403);
        }

        cfp.applications!.splice(applicationIndex, 1);
        await cfp.save();
        res.json({ message: "Application removed" });
    } catch (error) {
        console.error(error);
        const status = error instanceof ServiceError ? error.status : 400;
        res.status(status).json({ message: (error as Error).message });
    }
}
