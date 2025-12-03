import {Connection, query, db} from "stardog";
import {SparqlJsonParser} from "sparqljson-parse";

export const stardogConn = new Connection({
    username: process.env.STARDOG_USERNAME as string,
    password: process.env.STARDOG_PASSWORD as string,
    endpoint: process.env.STARDOG_ENDPOINT as string,
});
export const STARDOG_DB_NAME = process.env.STARDOG_DB_NAME || 'parcel2';

const sparqlJsonParser = new SparqlJsonParser();

export const configureStardog = async () => {
    const dbName = STARDOG_DB_NAME;

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
        dbName,
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

export async function clearStardogDatabase() {
    const dbName = STARDOG_DB_NAME;
    // Start a transaction to clear the database
    const {transactionId } = await db.transaction.begin(stardogConn, dbName);

    const response = await db.clear(stardogConn, dbName, transactionId);
    if (response.status !== 200) {
        console.error("❌ Failed to clear Stardog database:", response.status, response.body);
        await db.transaction.rollback(stardogConn, dbName, transactionId);
        throw new Error("Failed to clear Stardog database");
    }
    // Commit the transaction
    await db.transaction.commit(stardogConn, dbName, transactionId);

    console.log(`✅ Cleared Stardog database: ${dbName}`);
}
