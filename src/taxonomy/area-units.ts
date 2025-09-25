import { ITaxonomy } from "./index";
import { AreaUnit } from "../models/units.model";

export const Taxonomy: ITaxonomy = {
    class: AreaUnit,
    data: [
        {
            description: "m²",
            name: "Square metre",
        },
        {
            description: "ft²",
            name: "Square foot",
        },
        {
            description: "acre",
            name: "Acre",
        },
        {
            description: "hectare",
            name: "Hectare",
        },
    ]
};
