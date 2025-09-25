import { ProjectStage } from "../models";
import { ITaxonomy } from "./index";

export const Taxonomy: ITaxonomy = {
    class: ProjectStage,
    data: [
        {
            name: "Initiation",
            description:
                "The initial stage where the project is conceived and authorized, and high-level goals and objectives are defined.",
        },
        {
            name: "Feasibility",
            description:
                "The stage assessing technical, financial, and legal viability, clarifying the project's core purpose and feasibility.",
        },
        {
            name: "Planning",
            description:
                "Creating a detailed plan to guide all project work.",
        },
        {
            name: "Execution",
            description:
                "Implementing the plan and performing the work to create the deliverables.",
        },
        {
            name: "Finalization",
            description:
                "Formally completing the project, handing over deliverables, and closing administrative and financial tasks.",
        },
    ]
}