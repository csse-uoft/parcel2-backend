import { OntologyClass, OntologyProp, OwlClass, XSD } from "../services/owl/ontology";
import { Person } from "./person.model";
import { LiteralSpec } from "../services/owl/sparql-utils";

@OntologyClass('bedeo:Contact', { instanceBase: 'bedeo:contact' })
export class Contact extends OwlClass<Contact> {
    @OntologyProp('schema:telephone', { max: 1, datatype: XSD.string, pattern: /^\+\d{7,15}$/ })
    declare phone?: string;

    @OntologyProp('schema:email', { max: 1, datatype: XSD.string, pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ })
    declare email?: string | LiteralSpec;

    @OntologyProp('bedeo:has_contact_name', { exactly: 1, datatype: XSD.string })
    declare contactName: string;
}
