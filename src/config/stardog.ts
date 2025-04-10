import {Connection, query, db} from "stardog";
import {SparqlJsonParser} from "sparqljson-parse";

const stardogConn = new Connection({
    username: process.env.STARDOG_USERNAME as string,
    password: process.env.STARDOG_PASSWORD as string,
    endpoint: process.env.STARDOG_ENDPOINT as string,
});

const sparqlJsonParser = new SparqlJsonParser();

export const configureStardog = async () => {
    const dbName = 'parcel2';

    const result = await db.list(stardogConn);
    if (result.status === 401) {
        throw new Error("Stardog authentication failed");
    } else if (result.status === 200 && !result.body.databases.includes(dbName)) {
        await db.create(stardogConn, dbName, {});
        console.log(`Created Stardog database: ${dbName}`);
    }

    // Get how many triples are in the database
    const response = await query.execute(
        stardogConn,
        'parcel2',
        'select (count(*) as ?count) where { ?s ?p ?o }',
        'application/sparql-results+json',
        {
            limit: 10,
            reasoning: false,
            offset: 0,
        }
    )
    if (response.status !== 200) {
        console.error("❌ Stardog query failed:", response.status, response.body);
        throw new Error("Stardog query failed");
    }
    const results = sparqlJsonParser.parseJsonResults(response.body);
    console.log("✅ Stardog connected; " + results[0].count.value + " triples in the database");
}

