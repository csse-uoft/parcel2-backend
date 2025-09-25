import { initTests } from "./test/init"

import { Organization } from '../../models/organization.model';
import { OntologyValidator } from './validator';
import { SparqlBuilder } from './sparql-builder';
import { Contact } from "../../models/contact.model";
import "../../models/address.model";
import "../../models/organization-registration.model"

// build some test data
// const c1 = Object.assign(new ContactInfo(), { firstName: 'Ada', lastName: 'Lovelace' });
// const c2 = Object.assign(new ContactInfo(), { firstName: 'Grace', lastName: 'Hopper' });
//
// const org = new Organization({
//     legalName: 'Analytical Engines Inc.',
//     description: 'Early computer consultancy',
//     primaryContact: c1
// });
// // 1️⃣ run validation
// try {
//     OntologyValidator.validate(org);   // throws if anything breaks a rule
//     // 2️⃣ only then build SPARQL
//     console.log(SparqlBuilder.insert(org));
// } catch (err) {
//     console.error('Validation error:', (err as Error).message);
// }
//
// const org2 = new Organization({
//     legalName:   'Analytical Engines Inc.',
//     description: 'Early computer consultancy',
//     primaryContact: new ContactInfo({
//         firstName: 'Ada',
//         lastName:  'Lovelace',
//         email:     { value: 'ada@example.com', datatype: 'xsd:anyURI' }
//     }),
// });
//
// console.log(SparqlBuilder.insert(org2));
//
// const contact = new ContactInfo({
//     firstName: "Ada",
//     lastName:  "Lovelace",
//     email:     { value: "ada@example.com", datatype: "xsd:anyURI" } // OK
// });
// console.log(SparqlBuilder.insert(contact));

const org3 = Organization.create({
    legalNames: [{hasValue: 'Analytical Engines Inc.'}],
    description: 'Early computer consultancy.',
    primaryContact: Contact.create({
        contactName: 'Ada Lovelace',
        email: { value: 'ada@example.com', datatype: 'xsd:string' }
    }),
    primaryAddress: {
        streetNumber: '123',
        streetName: 'Main',
        streetType: 'St',
        localityName: 'Toronto',
        provinceCode: 'ON',
        postalCode: 'M5J 2N8',
        countryCode: 'CA'
    },
    organizationType: new NamedNode('http://example.com/ontology/OrganizationType/Company'),
    briefDescription: 'A company that specializes in analytical engines.',
});


// Validate + build SPARQL

// OntologyValidator.validate(org3);
// console.log(SparqlBuilder.insert(org3));


import { configureStardog } from "../../config/stardog";

import { executeSparqlUpdate } from "../stardog";
import { NamedNode } from "rdf-data-factory";


async function test() {
    await initTests();

    // insert the organization into the database
    await org3.save()

    console.log(org3)
    // await executeSparqlUpdate(SparqlBuilder.insert(org3, 'ex:organization_123'));


    const org4 = await Organization.findByIri<Organization>(
        org3.iri!,
        { reasoning: false }
    );

    console.log("Found organization:")
    console.log(org4)

    // update the organization
    org4!.description = 'Early computer consultancy, specializing in analytical engines.';
    await org4!.save();

    // await org4!.delete({ cascade: true });
    console.log(org4)
    console.log(JSON.stringify(org4, null, 2));
    // console.log(JSON.stringify(org4?.toJSONLD(), null, 2));

    const orgs = await Organization.find<Organization>({primaryAddress: { localityName: 'Toronto' } });
    console.log(`Found ${orgs.length} organizations in Toronto`);
    orgs.forEach(o => console.log(orgs));
}

test()