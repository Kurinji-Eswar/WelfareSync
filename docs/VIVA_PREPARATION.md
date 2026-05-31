# Viva Preparation Guide: WelfareSync Engine
## Scalable Multi-Tenant Resident Welfare Analytics & Monitoring System

---

## 1. Project Introduction (1-Minute Answer)
"WelfareSync is a multi-tenant backend engine designed to automate resident health and welfare monitoring in care facilities. It implements a **Hybrid Database Architecture** using PostgreSQL for structured metadata, MongoDB for dynamic care telemetry logs, and Redis for Pub/Sub messaging. 

Caretakers enter records (vitals, nutrition, medication) which are stored in MongoDB. Log writes publish events to Redis, triggering background workers to compute a resident’s Welfare Index ($WI$). If a resident's index drops below 50, a warning alert is registered in PostgreSQL. 

The system isolates data logically across institutions using a shared-database, shared-schema strategy. It serves reads from pre-calculated SQL tables to ensure low latency under normal operating conditions."

---

## 2. Project Introduction (3-Minute Answer)
"WelfareSync is a scalable backend solution designed to manage resident welfare tracking across multiple care institutions. 

Our system addresses database bottlenecks by implementing a **Hybrid Database Architecture**:
1.  **PostgreSQL** serves as the administrative registry, managing Tenants, User credentials, Resident weights, and calculated health metrics. It ensures transactional safety (ACID compliance) for onboarding and alerts logging.
2.  **MongoDB** stores high-write care logs. Because logs vary in details (e.g. vitals track blood pressure, nutrition tracks food ounces), MongoDB's schema flexibility allows storing these dynamic structures without schema migrations.
3.  **Redis** acts as an in-memory Pub/Sub broker, decoupling computational workflows.

When a caretaker posts a log, the API saves the document in MongoDB, publishes a message to Redis, and returns a success response. Decoupled from the HTTP thread, a background subscriber triggers the **Analytics Worker**. The worker calculates category scores using time-based decay algorithms, applying configured weights to update the resident's overall Welfare Index ($WI$). 

If the score drops below 50, the worker inserts a warning notification in PostgreSQL. Overview dashboards query these SQL-cached indices rather than raw document timelines, providing low-latency responses under normal operating conditions."

---

## 3. Project Introduction (5-Minute Answer)
"WelfareSync is a backend system designed for elderly homes, shelters, and care facilities to track resident well-being across multiple organizations. 

### Core Architectural Decisions:
*   **Logical Multi-Tenancy**: We implement logical segregation using a shared-database, shared-schema strategy. A tenant validation middleware extracts the `X-Tenant-ID` header and verifies it matches the authenticated tenant scope in the JWT (`req.auth.tenantId`). Queries in PostgreSQL (`WHERE tenant_id = $1`) and MongoDB (`{ tenantId: tenantId }`) enforce this boundary, preventing cross-tenant leakage.
*   **Storage Decoupling**: Transactional tables, access version registries, and pre-calculated averages reside in PostgreSQL. Polymorphic telemetry records reside in the MongoDB `care_logs` collection.
*   **Asynchronous Processing**: HTTP threads offload computational tasks. A POST request to `/api/v1/logs` writes to MongoDB, publishes to Redis, and returns immediately. Background processes run calculations asynchronously.
*   **Scoring & Decay Models**: The Analytics Worker retrieves historical logs, grouping them into medication, nutrition, vitals, and activity. Scores decay based on log recency to reflect real-world monitoring gaps. A weighted average computes the Welfare Index ($WI$):
    $$WI = \text{clampScore}\left(\frac{(W_{\text{med}} \times S_{\text{med}}) + (W_{\text{nut}} \times S_{\text{nut}}) + (W_{\text{vit}} \times S_{\text{vit}})}{W_{\text{med}} + W_{\text{nut}} + W_{\text{vit}}}\right)$$
    Activity scores are calculated but excluded from the index due to schema constraints.
*   **Caching & Dashboards**: Overview metrics are pre-calculated and cached in PostgreSQL tables, avoiding expensive aggregations over raw logs."

---

## 4. Problem Statement
Care facilities track heterogeneous telemetry datasets. Forcing these streams into a traditional normalized SQL database requires complex schema migrations when formats change. Conversely, running analytics over millions of raw log entries blocks database reads and slows API response times. Additionally, cloud providers must support multiple independent institutions (tenants) using a single deployed system, which requires verification to prevent cross-tenant data leaks.

---

## 5. Project Objectives
*   **Logical Isolation**: Enforce logical multi-tenancy across SQL tables and NoSQL documents.
*   **Dynamic Logging**: Ingest Care Logs using document schemas that accommodate varying structures.
*   **Asynchronous Calculations**: Decouple score calculations from HTTP write request cycles.
*   **Alert Generation**: Insert warning alerts in PostgreSQL automatically when the Welfare Index drops below 50.
*   **Low Latency Reads**: Serve overview dashboards quickly using pre-calculated SQL tables.

---

## 6. System Architecture Explanation
The WelfareSync Engine uses a layered architecture to isolate presentation, logic, event-driven messaging, and storage.

```
+-------------------------------------------------------------+
|                     1. Presentation Layer                   |
|          Express.js Routing / REST API Controller Endpoint  |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                      2. Application Layer                   |
|       Auth Check, Tenant Isolation Middleware, SQL/NoSQL Repo|
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                     3. Event & Messaging Layer              |
|        Redis Pub/Sub (Channel: 'care-log-created')          |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                      4. Data & Storage Layer                |
|  PostgreSQL (ACID Metadata)   |   MongoDB (Care Log Stream) |
+-------------------------------------------------------------+
```

1.  **Caretaker Clients** connect to the Express REST API.
2.  **Auth & Validation Middleware** checks JWTs and header tenant IDs.
3.  **Controllers** save logs to MongoDB and publish events to Redis.
4.  **Redis Subscriber** triggers the **Analytics Worker** to update SQL metrics.
5.  **Dashboard Services** read pre-calculated metrics from PostgreSQL.

---

## 7. Hybrid Database Architecture Viva Questions

### Q: Why PostgreSQL?
**A**: PostgreSQL manages administrative entities requiring transactional safety, strong relational constraints, and structured queries.

### Q: Why MongoDB?
**A**: MongoDB stores daily caretaker logs. Because logs vary in structures, MongoDB's schema flexibility allows storing these dynamic structures without schema migrations.

### Q: Why Redis?
**A**: Redis acts as an in-memory Pub/Sub broker to route calculation tasks, decoupling calculations from HTTP threads.

### Q: Why not use only PostgreSQL?
**A**: Storing high-write, polymorphic care logs in SQL requires schema migrations when formats change, and executing real-time metrics calculations over raw log entries blocks database reads and slows API response times.

### Q: Why not use only MongoDB?
**A**: MongoDB lacks the strict ACID transactional safety required for administrative processes like tenant onboarding, user registrations, and notification logs.

---

## 8. PostgreSQL Viva Questions

### Q: How do you enforce relational constraints?
**A**: Foreign keys are defined with `ON DELETE CASCADE` constraints:
```sql
ALTER TABLE residents ADD CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
```
If a tenant is deleted, all related resident profiles, user accounts, and notifications are removed automatically.

### Q: How do you handle onboarding transactions?
**A**: Tenant registration uses raw SQL transactions (`BEGIN` and `COMMIT` via a dedicated client connection) to wrap tenant creation and administrative user initialization. If the admin user insert fails, the transaction is rolled back, preventing orphaned tenant workspaces.

---

## 9. MongoDB Viva Questions

### Q: What is the care logs schema design?
**A**: Each document contains structured metadata fields alongside a flexible `details` object:
```json
{
  "tenantId": "String (indexed)",
  "residentId": "String (indexed)",
  "type": "String",
  "details": "Mixed Schema Payload",
  "recordedAt": "Date"
}
```

### Q: What is your indexing strategy?
**A**: We define a compound index on `{ tenantId: 1, residentId: 1, recordedAt: -1 }` to optimize chronological timeline scans for a specific resident.

---

## 10. Redis Viva Questions

### Q: Explain the Redis Event Pipeline.
**A**:
1.  API saves a care log in MongoDB.
2.  API publishes a JSON payload to the Redis channel `care-log-created`.
3.  API returns success to the caretaker client.
4.  The background subscription listener intercepts the payload and passes it to the `analyticsWorker` context.

### Q: What happens if Redis fails?
**A**: In our current academic scope, Redis Pub/Sub does not persist messages. If the broker fails, events are lost. In production, we plan to transition to Redis Streams to ensure message persistence.

---

## 11. Multi-Tenant Architecture Viva Questions

### Q: How do you enforce logical data isolation?
**A**: The validation middleware extracts the `X-Tenant-ID` header and verifies it matches the authenticated tenant context `req.auth.tenantId`:
```javascript
const tenantId = req.headers['x-tenant-id'];
if (tenantId !== req.auth.tenantId) {
  throw new AppError('Tenant access denied', 403);
}
```
Repository queries append explicit tenant qualifiers to all queries:
- *SQL*: `WHERE tenant_id = $1`
- *NoSQL*: `{ tenantId: tenantId }`

---

## 12. Authentication & Security Viva Questions

### Q: How does token versioning work?
**A**: User records include a `token_version` column. Upon logout or password update, the version is incremented, rendering existing tokens invalid on the next request.

### Q: How do you prevent injections?
**A**: SQL queries use parameterized bindings (`$1`, `$2`), and NoSQL inputs are sanitized to block keys containing dot (`.`) or dollar (`$`) symbols.

---

## 13. Analytics Engine Viva Questions

### Q: How does score decay work?
**A**: If logs do not contain explicit numerical values, scores decay based on log recency:
*   $\le 1 \text{ day} \implies 100$, $\le 3 \text{ days} \implies 85$, $\le 7 \text{ days} \implies 70$, $\le 14 \text{ days} \implies 50$, else $25$.

### Q: Why is Activity Score excluded from the Welfare Index?
**A**: Activity scores are calculated by the Analytics Worker but are excluded from the weighted Welfare Index computation due to schema constraints, where weights are only configured for medication, nutrition, and vitals.

---

## 14. Dashboard Viva Questions

### Q: How do you aggregate dashboard metrics?
**A**: Dashboard queries compile metrics from pre-calculated values in PostgreSQL cache tables (`resident_analytics` and `notifications`), avoiding expensive scans of raw records.

---

## 15. API Design Viva Questions

### Q: How is the API structured?
**A**: We follow REST principles, grouping routes logically under `/api/v1/auth`, `/api/v1/residents`, `/api/v1/logs`, and `/api/v1/dashboard`. We use standard HTTP methods (`GET`, `POST`, `PATCH`, `DELETE`) and status codes (`200`, `201`, `400`, `401`, `403`, `404`, `500`).

---

## 16. Deployment Viva Questions

### Q: What is the startup sequence?
**A**: PostgreSQL (5432) $\rightarrow$ MongoDB (27017) $\rightarrow$ Redis (6379) $\rightarrow$ Node.js app (5000).

---

## 17. Current Academic Scope
*   **Single-Node Deployments**: Express application and background workers run as local Node.js processes.
*   **Local Databases**: Standalone PostgreSQL and MongoDB instances.
*   **In-Memory Event Brokers**: Redis Pub/Sub does not persist messages.
*   **Manual Evaluation**: Verified using manual tests and Postman collections.

---

## 18. Future Production Enhancements
*   **Container Orchestration**: Deploying API instances, background workers, and databases using Docker Compose and Kubernetes.
*   **Message Broker Upgrades**: Transitioning Redis Pub/Sub to Redis Streams or Apache Kafka to provide persistent event logging.
*   **Real-Time Alerts**: Integrating WebSockets to push warning alerts to client dashboards in real-time.
*   **External Integrations**: Connecting external notification services (such as Twilio and SendGrid) to send SMS and email alerts directly to guardians.
*   **Observability**: Adding Prometheus monitoring and Grafana metrics dashboards.

---

## 19. Frequently Asked Viva Questions (Top 50)

#### 1. What is logical multi-tenancy?
Logical multi-tenancy runs multiple clients on a single deployed instance, isolating data using filters (`tenantId`) in code rather than isolating databases physically.

#### 2. Why is Knex.js not used?
We use raw SQL parameterized queries via the native `pg` client pool to control database transactions directly.

#### 3. What is the default port for PostgreSQL?
Port 5432.

#### 4. What is the default port for MongoDB?
Port 27017.

#### 5. What is the default port for Redis?
Port 6379.

#### 6. What is the role of `tokenVersion` in the database?
It enables session revocation. If the version is incremented, tokens signed with the old version are rejected.

#### 7. How does the system handle SQL Injection?
By using parameterized queries (`$1`, `$2`) to ensure input parameters are treated as data, not executable code.

#### 8. How does the system handle NoSQL Injection?
By sanitizing input bodies to remove characters like `$` or `.`, preventing MongoDB query manipulation.

#### 9. What is a compound index in MongoDB?
An index on multiple fields (e.g. `{ tenantId: 1, residentId: 1, recordedAt: -1 }`) to optimize queries that filter by tenant and resident, sorted by date.

#### 10. Why do we exclude Activity Score from the Welfare Index?
Because the PostgreSQL `residents` table does not define an activity weight column, restricting calculations to medication, nutrition, and vitals.

#### 11. What triggers a warning alert?
A computed Welfare Index ($WI$) dropping below 50.

#### 12. Where are warning alerts stored?
In the PostgreSQL `notifications` table.

#### 13. What is the default status of a notification?
`UNREAD`.

#### 14. What API endpoint marks a notification as read?
`PATCH /api/v1/notifications/:id/read`.

#### 15. How does score decay work when no logs are submitted?
If no logs are present, the category score is set to 0.

#### 16. What is the purpose of Knex migrations?
We do not use Knex migrations. Tables are initialized programmatically on startup within repository scripts.

#### 17. How is the database connection pool defined?
We use the `pg` client's `Pool` class, configuring connection limits using the `PGPOOL_MAX` environment variable.

#### 18. What does CORS stand for?
Cross-Origin Resource Sharing. It restricts browser API requests to whitelisted origins.

#### 19. What is Helmet.js?
A middleware that secures Express apps by setting various HTTP headers.

#### 20. How is multi-tenant scope validation enforced on routes?
Through validation middleware that verifies incoming `X-Tenant-ID` headers match the user's authenticated token scope.

#### 21. What happens when a tenant is deleted?
The foreign key constraints with `ON DELETE CASCADE` delete related residents, user accounts, and notifications in PostgreSQL.

#### 22. What is the purpose of Redis Pub/Sub?
To decouple computations, allowing the API to return a response immediately while workers process analytics in the background.

#### 23. What payload is published to Redis?
A lightweight JSON object containing entity IDs:
`{ "tenantId", "residentId", "logId", "type" }`.

#### 24. Why is the Redis payload kept small?
To minimize network overhead and memory consumption on the message broker.

#### 25. How does MongoDB handle flexible schemas?
By using the Mongoose schema type `Mixed`, allowing the `details` field to store arbitrary JSON payloads.

#### 26. What does `ON DELETE CASCADE` prevent?
Orphaned database records, maintaining referential integrity automatically.

#### 27. What is Knex.transaction() replaced with?
Raw SQL queries: `BEGIN`, `COMMIT`, and `ROLLBACK`.

#### 28. What HTTP status code represents a resource creation?
`201 Created`.

#### 29. What HTTP status code represents access forbidden?
`403 Forbidden`.

#### 30. What HTTP status code represents unauthorized access?
`401 Unauthorized`.

#### 31. What is the role of refresh tokens?
To generate new short-lived access tokens without requiring users to log in again.

#### 32. Where are refresh tokens stored?
In the PostgreSQL `refresh_tokens` table.

#### 33. How does the system handle password security?
By hashing passwords using `bcrypt` before storing them in PostgreSQL.

#### 34. What is the default value of the Welfare Index?
0.

#### 35. What is the Welfare Index clamped between?
0 and 100.

#### 36. What mathematical function limits computed scores?
A custom `clampScore` function:
`Math.max(0, Math.min(100, Number(score.toFixed(2))))`.

#### 37. How does the dashboard compiler calculate averages?
By querying calculated fields in PostgreSQL cache tables, avoiding expensive scans of raw records.

#### 38. What is the shard key for scaling MongoDB care logs?
`tenantId`.

#### 39. What is the purpose of the `gen_random_uuid()` function?
To generate UUID keys natively in PostgreSQL.

#### 40. Why are care logs not stored in PostgreSQL?
Storing high-write, polymorphic care logs in SQL requires schema migrations when formats change, and executing real-time metrics calculations over raw log entries blocks database reads and slows API response times.

#### 41. How does the background worker handle errors?
By trapping exceptions inside try-catch blocks, logging execution details, and releasing database connections.

#### 42. What happens if a caretaker submits an invalid log type?
The API returns a `400 Bad Request` error.

#### 43. Who can view the overview dashboard?
Users authorized with `ADMIN` or `GUARDIAN` roles.

#### 44. What is the purpose of Knexfile.js?
It does not exist. Databases are configured using native connections in `src/config/`.

#### 45. What is the purpose of the `X-Tenant-ID` header?
To scope API requests, allowing the system to identify the target tenant and isolate data queries.

#### 46. How are database credentials protected?
By loading credentials from environment variables (`.env`) instead of hardcoding them in files.

#### 47. What does the API return when a request fails authentication?
`401 Unauthorized` with a standardized JSON error envelope.

#### 48. What is the benefit of stateless API design?
It allows scaling the API layer horizontally behind load balancers.

#### 49. What is the academic scope of the deployment?
A single-node deployment running local database instances.

#### 50. What is the planned production messaging upgrade?
Transitioning from Redis Pub/Sub to Redis Streams or Apache Kafka to provide persistent event logging.

---

## 20. Difficult Examiner Questions

### Examiner: "If Redis Pub/Sub is fire-and-forget, what happens if the subscriber crashes? Aren't calculations lost?"
**Answer**: "Yes, in the current academic single-node setup, Redis Pub/Sub does not persist messages. If the subscriber crashes, events are lost. To address this limitation in production, we plan to transition to **Redis Streams** or **Apache Kafka** to provide persistent event logging and consumer group offset management, ensuring no calculations are lost."

### Examiner: "Why use a shared-database, shared-schema multi-tenant model? Isn't a database-per-tenant model more secure?"
**Answer**: "A database-per-tenant model provides physical isolation but increases hosting costs and makes schema migrations complex. A shared-database, shared-schema model is cost-effective and isolates data logically in the repository layer, enforcing filters (`tenantId`) on all queries."

### Examiner: "Your background worker reads up to 1000 logs from MongoDB to recalculate scores. If a resident has millions of logs, won't this query slow down over time?"
**Answer**: "The background worker queries up to 1000 historical logs, sorted chronologically. This limits query sizes and prevents performance degradation as the database grows."

### Examiner: "If a user session is revoked, how do you prevent them from using their active JWT?"
**Answer**: "User records include a `token_version` column. Upon logout or session revocation, the version is incremented. The token validation middleware queries PostgreSQL to verify that the token's version matches the database record (`token_version`). If it doesn't match, the token is rejected."

---

## 21. Viva Defense Tips
*   **Draw the diagrams clearly**: When presenting, sketch the hybrid database layout first to explain why PostgreSQL and MongoDB are combined.
*   **Explain Decoupling**: Emphasize how Redis Pub/Sub decouples write operations from calculations, keeping API response times low.
*   **Highlight Isolation**: Explain how the middleware verifies `X-Tenant-ID` headers against JWT scopes, preventing cross-tenant data leaks.
*   **Acknowledge Boundaries**: Clearly define the current academic scope (single-node, local databases) and production enhancements (Kubernetes, Redis Streams, Kafka).

---

## 22. Common Architecture Diagrams Explanation

### 22.1 Kuralara CareConnect Ecosystem Architecture Diagram
*   **What it shows**: How client applications (Caretaker App, Guardian Portal, Central Admin) connect to the central WelfareSync API, and how data flows internally between MongoDB, Redis, and PostgreSQL.
*   **How to explain it**: "This diagram illustrates the broader Kuralara CareConnect Ecosystem. Caretakers log inputs via mobile apps, guardians monitor metrics via portals, and administrators manage organizations via admin portals. All clients connect to the WelfareSync API. Data is saved in MongoDB, events are dispatched to Redis, and background workers write calculated health metrics and notifications to PostgreSQL."
*   **Common examiner question**: "How do these portals access the same backend instance without data leakage?"
*   **Model answer**: "All client requests must include the `X-Tenant-ID` header. The backend middleware validates this header against the authenticated user's JWT scope, appending the verified tenant ID to all database queries."

### 22.2 WelfareSync Internal Architecture Diagram
*   **What it shows**: The four-layer system architecture (Presentation, Application, Event-driven Messaging, and Storage).
*   **How to explain it**: "The internal system is organized into four layers: Presentation, Application, Event-driven Messaging, and Storage. The Presentation layer handles HTTP requests and input validations. The Application layer executes authorization checks and queries database repositories. The Event-driven Messaging layer decouples computations using Redis Pub/Sub, and the Storage layer houses administrative metadata in PostgreSQL and care logs in MongoDB."
*   **Common examiner question**: "Why separate the Presentation and Application layers?"
*   **Model answer**: "To separate concerns. The Presentation layer handles routing and input validations, while the Application layer manages business logic and database queries, allowing us to update APIs without altering core logic."

### 22.3 Hybrid Database Architecture Diagram
*   **What it shows**: The division of data between relational databases, document stores, and in-memory caches.
*   **How to explain it**: "We implement a hybrid database layout to manage the dual demands of transactional safety and telemetry ingestion. Relational metadata structures (tenants, users, resident profiles, computed analytics, and notifications) reside in PostgreSQL. Polymorphic telemetry records reside in the MongoDB `care_logs` collection. Redis handles the Pub/Sub messaging channel `care-log-created`, routing notification events instantly to background workers."
*   **Common examiner question**: "Can you use PostgreSQL JSONB instead of MongoDB?"
*   **Model answer**: "We can, but storing high-write, polymorphic care logs in SQL requires schema migrations when formats change, and executing real-time metrics calculations over raw log entries blocks database reads and slows API response times."

### 22.4 Redis Event Pipeline Diagram
*   **What it shows**: The sequence of events when a care log is recorded.
*   **How to explain it**: "This sequence diagram illustrates the event pipeline:
    1. Caretakers post logs.
    2. API saves the document in MongoDB.
    3. API publishes an event to Redis.
    4. API returns success to the client.
    5. The Redis subscriber triggers the Analytics Worker to update SQL metrics.
    6. If the Welfare Index is under 50, a warning alert is registered in PostgreSQL."
*   **Common examiner question**: "What happens if step 5 fails after step 2 completes?"
*   **Model answer**: "The care log is stored in MongoDB, but the resident's metrics cache is not updated. In production, we plan to implement a transaction log and retry queue to process failed events."

### 22.5 Authentication Flow Diagram
*   **What it shows**: The validation middleware checking JWT scopes and `X-Tenant-ID` headers.
*   **How to explain it**: "This flowchart illustrates the authentication flow:
    1. Middleware validates the JWT signature and expiration.
    2. The validation middleware verifies that the header `X-Tenant-ID` matches the `tenantId` in the authenticated context (`req.auth.tenantId`).
    3. If they mismatch, access is forbidden.
    4. If they match, the backend queries PostgreSQL to verify the token version matches the database record (`token_version`)."
*   **Common examiner question**: "Why check the token version on every request?"
*   **Model answer**: "To verify that the user's session has not been revoked. If a user logs out, their database version is incremented, rendering existing tokens invalid on the next request."

### 22.6 Dashboard Aggregation Flow Diagram
*   **What it shows**: How dashboard overview queries are compiled.
*   **How to explain it**: "This diagram shows the aggregation pipeline. Instead of scanning MongoDB logs, overview dashboards query pre-calculated metrics in PostgreSQL cache tables (`resident_analytics` and `notifications`), compiling counts and averages in a single SQL query."
*   **Common examiner question**: "Why query PostgreSQL instead of MongoDB?"
*   **Model answer**: "Scanning MongoDB logs requires expensive aggregations over raw records, which blocks database reads and slows API response times. Querying pre-calculated SQL tables provides low-latency responses under normal operating conditions."
