import fs from 'fs';
import path from 'path';
import { ProjectType } from "../models";
import { getClassMeta, PM } from "../services/owl/ontology";

export interface ITaxonomy {
    class: typeof ProjectType;
    data: { name: string, description: string, iri?: string }[];
}

const taxonomyCache: { [key: string]: ProjectType[] } = {};

// Initialize all taxonomies
export async function initTaxonomy() {

    // Get all files in the current directory
    const directoryPath = path.join(__dirname);
    const files = fs.readdirSync(directoryPath);

    // Iterate all taxonomies and ensure they are initialized
    const taxonomies = await Promise.all(files.filter(file => file.endsWith('.ts') && file !== 'index.ts')
        .map(file => import("./" + file.replace('.ts', ''))));
    for (const taxonomy of taxonomies) {
        const taxonomyData: ITaxonomy = taxonomy.Taxonomy;

        if (!taxonomyData || !taxonomyData.class || !taxonomyData.data) {
            console.warn(`Taxonomy data is missing in ${taxonomyData.class.name}`);
            continue;
        }

        // Check if the taxonomy class exists
        if (typeof taxonomyData.class !== 'function') {
            console.warn(`Taxonomy class is not a function in ${taxonomyData.class}`);
            continue;
        }

        // Check if the taxonomy data is an array
        if (!Array.isArray(taxonomyData.data)) {
            console.warn(`Taxonomy data is not an array in ${taxonomyData.class.name}`);
            continue;
        }

        const {classIri, instanceBase} = getClassMeta(taxonomyData.class); // Ensure metadata is loaded

        if (!classIri || !instanceBase) {
            console.warn(`Taxonomy class metadata is missing in ${taxonomyData.class.name}`);
            continue;
        }

        // add iri
        taxonomyData.data = taxonomyData.data.map(item => ({...item, iri: nameToIri(instanceBase, item.name)}));

        console.log(`Processing taxonomy: ${taxonomyData.class.name}`);
        // If the taxonomy class exists, check if it needs to be initialized (delete and recreate)

        const needsInitialization = await isTaxonomyModified(taxonomyData);
        if (needsInitialization) {
            console.log(`Initializing taxonomy: ${taxonomyData.class.name}`);
            await deleteTaxonomy(taxonomyData.class);
            await createTaxonomy(taxonomyData);
        } else {
            // console.log(`Taxonomy already initialized: ${taxonomyData.class.name}`);
        }

        // Load all taxonomy entries into cache
        const allTaxonomies = await getAllTaxonomies(taxonomyData.class);

        taxonomyCache[classIri] = allTaxonomies;
    }

    console.log("Taxonomy initialization complete.");
}


async function createTaxonomy(taxonomies: ITaxonomy) {
    for (const data of taxonomies.data) {
        await taxonomies.class.create({
            name: data.name,
            description: data.description,
            iri: data.iri,
        }).save();
    }
}

async function deleteTaxonomy(TaxonomyClass: typeof ProjectType) {
    await TaxonomyClass.deleteAll({}, { cascade: true });
}

async function isTaxonomyModified(taxonomies: ITaxonomy) {
    const existing = await taxonomies.class.findAll<InstanceType<typeof taxonomies.class>>();
    if (existing.length !== taxonomies.data.length) {
        return true;
    }
    for (const data of taxonomies.data) {
        if (!existing.some(item => item.name === data.name && item.description === data.description)) {
            return true;
        }
    }
    return false;
}

async function getAllTaxonomies(TaxonomyClass: typeof ProjectType) {
    return await TaxonomyClass.findAll<InstanceType<typeof TaxonomyClass>>(1000);
}

// Retrieve taxonomy data by class IRI
export function getTaxonomyByIri(classIri: string) {
    return taxonomyCache[classIri] || [];
}

export function getTaxonomyByClass(TaxonomyClass: typeof ProjectType) {
    const { classIri } = getClassMeta(TaxonomyClass);
    return getTaxonomyByIri(PM.ensurePrefixed(classIri));
}

export function getTaxonomyOptionByIri(TaxonomyClass: typeof ProjectType, iri: string) {
    const taxonomy = getTaxonomyByClass(TaxonomyClass);
    return taxonomy.find(item => item.iri === iri) || undefined;
}

function nameToIri(instanceBase: string, name: string) {
    return `${instanceBase}_${name.replace(/\s+/g, '_').toLowerCase()}`;
}