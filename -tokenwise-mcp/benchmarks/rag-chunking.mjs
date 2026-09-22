/**
 * Builds a ~8000-token document from mixed-topic paragraphs and uses
 * chunk_document to retrieve only the chunks relevant to a query,
 * measuring the resulting token reduction vs. sending the whole document.
 */
import { chunkDocument, countTokens } from "../dist/index.js";

const PARAGRAPHS = [
  "Authentication is the process of verifying the identity of a user or system, typically via passwords, tokens, or certificates.",
  "JWT (JSON Web Tokens) are compact, URL-safe tokens that encode claims and are commonly used for stateless authentication between services.",
  "OAuth 2.0 provides delegated authorization, allowing a third-party application to obtain limited access to a user's resources without sharing credentials.",
  "OpenID Connect is an identity layer built on top of OAuth 2.0 that allows clients to verify the identity of an end user.",
  "Passwords should always be hashed with a slow algorithm such as bcrypt or argon2, never stored in plain text or with fast hashes like MD5.",
  "Rate limiting protects APIs from abuse by capping the number of requests a client can make in a given time window.",
  "Exponential backoff with jitter is the recommended retry strategy for transient failures in distributed systems.",
  "Database indexes speed up read queries at the cost of additional write overhead and storage; use EXPLAIN ANALYZE to find missing indexes.",
  "Redis is an in-memory data store often used for caching frequently accessed data, session storage, and rate-limit counters.",
  "Container orchestration platforms like Kubernetes manage deployment, scaling, and networking for containerized applications.",
  "Continuous integration pipelines run automated tests on every commit to catch regressions early in the development cycle.",
  "Observability combines logging, metrics, and distributed tracing to help engineers understand system behavior in production.",
  "Microservices architectures split an application into small, independently deployable services that communicate over a network.",
  "Content delivery networks cache static assets at edge locations close to users to reduce latency and origin load.",
  "Database sharding splits a large dataset across multiple servers to improve scalability beyond a single machine's limits.",
  "Feature flags allow new functionality to be deployed to production but enabled gradually or only for specific user segments.",
];

// Build the doc as topic blocks (each paragraph repeated to form a ~500-token
// section) so that relevant content is concentrated in a few chunks, like a
// real multi-topic knowledge base / docs site.
let doc = "";
for (const p of PARAGRAPHS) {
  doc += (p + " ").repeat(25);
}

const query = "Explain JWT-based authentication: how do JWT tokens verify a user's identity?";
const result = chunkDocument(doc, query, 3, 400);

const totalTokens = countTokens(doc);
const returnedTokens = result.chunks.reduce((sum, c) => sum + countTokens(c), 0);

console.log("RAG chunking benchmark");
console.log("=======================");
console.log(`Query: "${query}"\n`);
console.log(`Document tokens:  ${totalTokens}`);
console.log(`Total chunks:     ${result.totalChunks} (chunkSize=400)`);
console.log(`Returned chunks:  ${result.returnedChunks}`);
console.log(`Returned tokens:  ${returnedTokens}`);
console.log(`Reduction:        ${(100 * (1 - returnedTokens / totalTokens)).toFixed(1)}%\n`);

result.chunks.forEach((c, idx) => {
  console.log(`-- Chunk ${idx + 1} (excerpt) --`);
  console.log(c.slice(0, 160) + "...\n");
});
