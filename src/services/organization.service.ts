import { Organization } from "../models/organization.model";
import { Contact } from "../models/contact.model";
import { Address } from "../models/address.model";

export type OrganizationUpdatePayload = Record<string, unknown>;

export function applyOrganizationUpdates(organization: Organization, payload: OrganizationUpdatePayload): void {
    if (!payload || typeof payload !== "object") {
        return;
    }

    const updates: Record<string, unknown> = { ...payload };
    delete updates.iri;

    if (updates.primaryContact && typeof updates.primaryContact === "object") {
        if (organization.primaryContact) {
            Object.assign(organization.primaryContact, updates.primaryContact);
        } else {
            organization.primaryContact = Contact.create(updates.primaryContact as Record<string, unknown>);
        }
        delete updates.primaryContact;
    }

    const primaryAddress = updates.primaryAddress;
    if (primaryAddress && typeof primaryAddress === "object") {
        if (organization.primaryAddress) {
            Object.assign(organization.primaryAddress, primaryAddress);
        } else {
            organization.primaryAddress = Address.create(primaryAddress as Record<string, unknown>);
        }
        delete updates.primaryAddress;
    }

    const mailingAddress = updates.mailingAddress;
    if (mailingAddress && typeof mailingAddress === "object") {
        if (organization.mailingAddress) {
            Object.assign(organization.mailingAddress, mailingAddress);
        } else {
            organization.mailingAddress = Address.create(mailingAddress as Record<string, unknown>);
        }
        delete updates.mailingAddress;
    }

    const deliveryAddress = updates.deliveryAddress;
    if (deliveryAddress && typeof deliveryAddress === "object") {
        if (organization.deliveryAddress) {
            Object.assign(organization.deliveryAddress, deliveryAddress);
        } else {
            organization.deliveryAddress = Address.create(deliveryAddress as Record<string, unknown>);
        }
        delete updates.deliveryAddress;
    }

    const acronyms = updates["acronyms"];
    if (Array.isArray(acronyms)) {
        organization.acronym = acronyms as string[];
        delete updates["acronyms"];
    }

    const roleTypes = updates["roleTypes"];
    if (Array.isArray(roleTypes)) {
        organization.roleTypes = roleTypes as any;
        delete updates["roleTypes"];
    }

    Object.assign(organization, updates);
}
