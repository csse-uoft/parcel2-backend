import { RoleType } from "../models";
import { ITaxonomy } from "./index";

export const Taxonomy: ITaxonomy = {
    class: RoleType,
    data: [
        {
            name: "Investor",
            description:
                "Provides equity capital in exchange for ownership and a share of project profits.",
        },
        {
            name: "Lender",
            description:
                "Provides a loan or other debt financing for the project.",
        },
        {
            name: "Guarantor",
            description:
                "Provides a guarantee on a loan.",
        },
        {
            name: "Public Funder",
            description:
                "Government body or agency that provides grants or low-interest loans.",
        },
        {
            name: "Sponsor",
            description:
                "Organization that initiates and oversees the project.",
        },
        {
            name: "Land Owner",
            description:
                "Contributes the land to the project.",
        },
        {
            name: "Developer",
            description:
                "Manages the development process from conception to completion.",
        },
        {
            name: "General Contractor",
            description:
                "Responsible for construction, including managing subcontractors and the construction schedule.",
        },
        {
            name: "Designer",
            description:
                "Creates the project's plans, drawings, and technical specifications.",
        },
        {
            name: "Community Engagement Partner",
            description:
                "Acts as a liaison between the project and the local community.",
        },
        {
            name: "Sales Partner",
            description:
                "Manages marketing, sales, and/or leasing for the project.",
        },
        {
            name: "Property Manager",
            description:
                "Handles day-to-day operations of the completed project.",
        },
    ]
};
