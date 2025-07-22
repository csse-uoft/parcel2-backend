import 'reflect-metadata';
import { query } from "stardog";
import { STARDOG_DB_NAME, stardogConn } from "../../config/stardog";
import { IBindings, SparqlJsonParser } from "sparqljson-parse";
import * as RDF from "@rdfjs/types";
// export * from "../owl/sparql-utils";

const sparqlJsonParser = new SparqlJsonParser();

export interface StardogQueryParams {
    queryString: string;
    limit?: number;
    offset?: number;
    reasoning?: boolean;
    onData?: (bindings: IBindings) => void;
    onVariables?: (variables: RDF.Variable[]) => void;
}

export async function executeSparqlQuery(queryObject: StardogQueryParams): Promise<IBindings[] | void> {
    if (!queryObject.queryString) {
        throw new Error("Query string is required");
    }

    if (queryObject.onData || queryObject.onVariables) {
        return executeSparqlQueryStream(queryObject);
    }

    const response = await query.execute(
        stardogConn,
        STARDOG_DB_NAME,
        queryObject.queryString,
        'application/sparql-results+json',
        {
            limit: queryObject.limit || 100, // TODO: fetch all results if no limit is specified
            offset: queryObject.offset || 0,
            reasoning: queryObject.reasoning || false,
        }
    )
    if (response.status !== 200) {
        console.error("❌ Stardog query failed:", response.status, response.body);
        throw new Error("Stardog query failed");
    }
    const results = sparqlJsonParser.parseJsonResults(response.body);
    return results;
}

export async function executeSparqlQueryStream(queryObject: StardogQueryParams): Promise<void> {
    return new Promise(((resolve, reject) => {
        query.execute(
            stardogConn,
            STARDOG_DB_NAME,
            queryObject.queryString,
            'application/sparql-results+json',
            {
                limit: queryObject.limit || 100,
                offset: queryObject.offset || 0,
                reasoning: queryObject.reasoning || false,
            },
            {
                onResponseStart: (response) => {
                    if (response.status !== 200) {
                        console.error("❌ Stardog query failed:", response.status, response.body);
                        throw new Error("Stardog query failed");
                    }

                    // @ts-ignore
                    sparqlJsonParser.parseJsonResultsStream(response.body)
                        .on("data", (bindings) => {
                            if (queryObject.onData) {
                                queryObject.onData(bindings);
                            }
                        })
                        .on("variables", (variables) => {
                            if (queryObject.onVariables) {
                                queryObject.onVariables(variables);
                            }
                        })
                        .on("end", () => {
                            resolve();
                        })
                        .on("error", (error) => {
                            console.error("❌ Stardog query stream error:", error);
                            reject(error);
                        })

                }
            }
        )
    }));
}

export async function executeSparqlUpdate(updateString: string, opts?: {reasoning?: boolean}): Promise<void> {
    console.log("Executing SPARQL Update:", updateString);
    const response = await query.execute(
        stardogConn,
        STARDOG_DB_NAME,
        updateString,
        "text/plain",           // Accept
        {
            reasoning: opts?.reasoning || false, // Enable reasoning if specified
        }
    );


    if (response.status !== 200) {
        /* eslint-disable no-console */
        console.error("❌ Stardog update failed:", response.status, response.body);
        throw new Error("Stardog update failed");
    }
}
