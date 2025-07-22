import "../../models/address.model";
import "../../models/organization.model";
import "../../models/contact.model";
import "../../models"

import { writeFileSync } from "node:fs";

import { generateOntologyTTL } from './ontology-generator';

const ttl = generateOntologyTTL({includeShacl: true});
writeFileSync("parcel2.ttl", ttl);
console.log("✅ parcel2.ttl created");