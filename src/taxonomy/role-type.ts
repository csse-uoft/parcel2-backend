// Predefined role types for the parcel2

import { initTests } from "../services/owl/test/init";

import "../models/address.model";
import "../models/organization.model";
import "../models/contact.model";
import "../models/role.model";

import "../services/owl/ontology";
import "../services/owl/ontology-generator";
import { Role, RoleType } from "../models/role.model";
import { OwlClass } from "../services/owl/owl-class";

export async function init() {

    // Predefined role types
    const roleTypes = [
        { name: "Builder", description: "Responsible for the construction of the project." },
        { name: "Community Liaison", description: "Acts as a bridge between the project team and the community, ensuring that community needs and concerns are addressed." },
        { name: "Developer", description: "Oversees the development process, ensuring that the project meets its goals and objectives." },
        { name: "Financier", description: "Provides financial resources for the project, ensuring that it has the necessary funding to proceed." },
        { name: "Funder", description: "Supports the project with funding, often with specific conditions or requirements." },
        { name: "Investor", description: "Invests in the project, expecting a return on investment or other benefits." },
        { name: "Post Development Beneficiary", description: "Receives benefits from the project after its completion, such as improved infrastructure or services." }
    ];

    // Get existing role types
    const existingRoleTypes = await RoleType.find<RoleType>({ name: { $in: roleTypes.map(rt => rt.name) } });
    console.log(existingRoleTypes)
    // return
    // Filter out existing role types
    const newRoleTypes = roleTypes.filter(rt => !existingRoleTypes.some((existing: RoleType) => existing?.name === rt.name && existing?.description === rt.description));
    // Create new role types
    if (newRoleTypes.length === 0) {
        console.log("No new role types to create.");
        return;
    }
    for (const roleTypeData of newRoleTypes) {
        const roleType = new RoleType(roleTypeData);
        await roleType.save();
        console.log(`Created role type: ${roleType.name}`);
    }
    console.log("All predefined role types have been created.");
}

(async function () {
    // Initialize tests
    await initTests();
    await init()
})()
