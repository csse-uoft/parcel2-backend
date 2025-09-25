import { ProjectType } from "../models";
import { ITaxonomy } from "./index";

export const Taxonomy: ITaxonomy = {
    class: ProjectType,
    data: [
        {
            name: "Market-rate housing",
            description:
                "A housing development whose units are sold or rented at market prices, without government subsidies or rent restrictions.",
        },
        {
            name: "Affordable housing",
            description:
                "A housing development whose units are priced to be affordable for low- to moderate-income households.",
        },
        {
            name: "Supportive housing",
            description:
                "A housing development that combines affordable housing with on-site social services for people facing challenges such as homelessness, chronic health conditions, or mental health issues.",
        },
        {
            name: "Mixed-use",
            description:
                "An urban development that combines residential, commercial, cultural, institutional, and/or industrial uses in a single project or building.",
        },
    ]
}