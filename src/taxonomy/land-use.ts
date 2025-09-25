import { ITaxonomy } from "./index";
import { LandUse } from "../models/land-use.model";

export const Taxonomy: ITaxonomy = {
    class: LandUse,
    data: [
        {
            name: "Residential",
            description: "Properties primarily used for housing, including single-family homes, apartments, and condominiums.",
        },
        {
            name: "Commercial",
            description: "Properties used for business activities, such as retail stores, offices, and restaurants.",
        },
        {
            name: "Industrial",
            description: "Properties used for manufacturing, warehousing, and distribution of goods.",
        },
        {
            name: "Agricultural",
            description: "Land used for farming, livestock grazing, and other agricultural activities.",
        },
        {
            name: "Mixed-Use",
            description: "Properties that combine residential, commercial, and/or industrial uses within a single development or area.",
        },
        {
            name: "Recreational",
            description: "Land designated for recreational activities, such as parks, sports fields, and golf courses.",
        },
        {
            name: "Institutional",
            description: "Properties used for public or community services, including schools, hospitals, and government buildings.",
        },
        {
            name: "Transportation",
            description: "Land used for transportation infrastructure, such as roads, highways, railways, and airports.",
        },
        {
            name: "Conservation",
            description: "Land set aside for environmental protection and conservation purposes.",
        },
        {
            name: "Vacant Land",
            description: "Undeveloped land that is not currently being used for any specific purpose.",
        },
    ]
};
