# High Level Design (HLD)
## WelfareSync Engine
### Scalable Multi-Tenant Resident Welfare Analytics & Monitoring System

---

## Academic Metadata

| Property               | Details                                                             |
| :--------------------- | :------------------------------------------------------------------ |
| **Author**             | Kurinji Eswar J A                                                   |
| **Degree**             | Bachelor of Technology (B.Tech), Computer Science and Engineering   |
| **Academic Year**      | 2026–2027                                                           |
| **Project Supervisor** | Dr. Ajey Prasaath K.B                                               |
| **Designation**        | Assistant Professor                                                 |
| **Institution**        | SRM Institute of Science and Technology, Tiruchirappalli Campus   |

---

## 1. Introduction

### 1.1 Document Purpose
This High Level Design (HLD) document defines the architectural blueprint, systems design, and processing paradigms for the **WelfareSync Engine**. It establishes the technical relationships between the application servers, database layers, event-driven pipes, and analytical workers. 

### 1.2 System Scope
The WelfareSync Engine is a backend service providing multi-tenant management, resident health monitoring, unstructured care logging, and real-time automated welfare telemetry calculation. By combining relational database logic, document-based event storage, and asynchronous worker queues, the engine provides high performance and strict data isolation across welfare institutions.

### 1.3 Intended Audience
This document is prepared for software engineers, database administrators, system architects, QA engineers, and compliance auditors. It assumes familiarity with Node.js, relational database models, document stores, and event-driven micro-architectures.

---

## 2. Architecture Overview

The WelfareSync Engine uses a multi-layered, service-oriented architecture. The system is split into four distinct layers:

```
+-------------------------------------------------------------+
|                     1. Presentation Layer                   |
|          Express.js Routing / REST API Controller Endpoint  |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                      2. Application Layer                   |
|        Auth, Institution, Resident, Logging, & Dashboards   |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                     3. Event & Messaging Layer              |
|        Redis Pub/Sub (Asynchronous Worker Recalculation)    |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                      4. Data & Storage Layer                |
|  PostgreSQL (Relational/ACID)  |   MongoDB (Event Timeline) |
+-------------------------------------------------------------+
```

1.  **Presentation Layer**: Express.js routes and controllers exposing unified HTTP REST APIs to clients (Caretakers, Admins, and Guardians).
2.  **Application Layer**: Contains business logic, authorization middleware, input sanitization, and database query builders.
3.  **Event & Messaging Layer**: Decoupled asynchronous event broker powered by Redis Pub/Sub, responsible for distributing tasks to workers.
4.  **Data & Storage Layer**: A hybrid storage environment comprising PostgreSQL for structured administrative metadata, and MongoDB for dynamic telemetry logs.

---

## 3. System Components

*   **API Gateways & REST Controllers**: Route HTTP traffic, authenticate incoming tokens, validate requests, and enforce headers (`X-Tenant-ID`).
*   **Authentication Middleware**: Resolves tenant scope, checks JWT claims, and queries database token versions to prevent use of revoked sessions.
*   **Care Logs Publisher**: Publishes lightweight JSON payloads to Redis immediately upon saving care logs to MongoDB.
*   **Analytics Subscriber**: A background service listening to Redis channels, acting as the entry point for worker tasks.
*   **Analytics Worker**: Performs weighted welfare score computation based on care log categories and resident-configured weights, and updates resident analytics records.
*   **Notification Engine**: Assesses scores and inserts warnings directly into PostgreSQL when thresholds are violated.
*   **Guardian Dashboard Compiler**: Aggregates resident info, historical scores, and notifications from PostgreSQL to serve read requests.

---

## 4. Request Flow

The system splits read and write workloads into separate flows to optimize response times.

### 4.1 Write Flow: Care Log Submission
```
Client         Controller      MongoDB      Redis Pub/Sub    Background Worker
  |                 |             |               |                  |
  |--- POST /logs ->|             |               |                  |
  |    (Auth check) |             |               |                  |
  |                 |-- Save ---->|               |                  |
  |                 |   Log       |               |                  |
  |                 |<- Success --|               |                  |
  |                 |                             |                  |
  |                 |---- Publish event --------->|                  |
  |                 |     (care-log-created)      |                  |
  |                 |                             |--- Send task --->|
  |<-- HTTP 201 ----|                             |                  |  |-- Recalculate
  |                 |                             |                  |  |   Welfare Index
  |                 |                             |                  |  |<-- Update DB
```

### 4.2 Read Flow: Dashboard Overview Query
```
Client                Controller          PostgreSQL (Relational DB)
  |                       |                           |
  |--- GET /dashboard --->|                           |
  |    (Header validation)|                           |
  |                       |-- Scan compiled table ---->|
  |                       |   (tenant & user scoped)  |
  |                       |<-- Pre-calculated data ---|
  |<-- JSON payload ------|                           |
```

---

## 5. Hybrid Database Architecture

The WelfareSync Engine implements a **Hybrid Database Architecture** using PostgreSQL, MongoDB, and Redis.

```
                    +-----------------------------+
                    |    WelfareSync Backend      |
                    +------+-------------+--------+
                           |             |
            +--------------+             +---------------+
            | Relational                                 | Document Streams
            v                                            v
+------------------------+                      +------------------------+
|       PostgreSQL       |                      |        MongoDB         |
|   (ACID Metadata)      |                      |   (Flexible Events)    |
+------------------------+                      +------------------------+
| Tenants, Users,        |                      | Daily Care Logs:       |
| Institutions,          |                      | - Vitals, Medication,  |
| Residents, Analytics,  |                      |   Nutrition, Activity  |
| Notifications          |                      | - Flexible payloads    |
+------------------------+                      +------------------------+
```

### 5.1 Why PostgreSQL is Used
PostgreSQL serves as the system's relational registry. It is selected for:
*   **Relational Integrity**: Enforces structural relations between Tenants, Users, Institutions, Residents, and Notifications.
*   **ACID Compliance**: Ensures critical business actions (such as Tenant onboarding and user session versioning) are transactionally safe.
*   **Index Optimization**: Compound indexes support queries filtered by `tenant_id`, such as resolving users or fetching metrics.

### 5.2 Why MongoDB is Used
MongoDB serves as the event timeline store. It is selected for:
*   **Flexible Schema Support**: Care logs have different schemas (e.g., medication requires dosage/frequency; vitals require blood pressure/temperature). MongoDB allows storing these varied shapes in a single `care_logs` collection without requiring rigid database migrations.
*   **Write Throughput**: Document-oriented append-only writes allow caretakers to save logs quickly.
*   **Rich Querying**: Document structures permit indexing nested telemetry logs (e.g., `details.score`).

### 5.3 Why Redis is Used
Redis serves as the system’s message broker and pub/sub transport. It is selected for:
*   **High Throughput & Low Latency**: In-memory queuing routes event messages between services in microseconds.
*   **Asynchronous Decoupling**: Offloads analytics operations from the main HTTP API event loop.

### 5.4 Benefits of Hybrid Database Architecture
*   **Workload Isolation**: CPU-heavy calculation tasks do not impact the transactional database layer. Write-heavy logs target MongoDB, while metadata queries run on PostgreSQL.
*   **Best-of-Both-Worlds Data Strategy**: Combines the strict schema validations and relational enforcement of SQL with the schema flexibility and write performance of NoSQL.
*   **Performance Optimization**: Dashboards fetch pre-calculated telemetry scores from PostgreSQL in under 50ms, avoiding expensive real-time scans across millions of raw care logs.

---

## 6. PostgreSQL Layer

### 6.1 Database Schema Diagram
```
  +------------------+          +------------------+          +------------------+
  |     tenants      |          |      users       |          |  refresh_tokens  |
  +------------------+          +------------------+          +------------------+
  | id (PK) UUID     |<----+    | id (PK) UUID     |<----+    | id (PK) UUID     |
  | name VARCHAR     |     |    | tenant_id (FK)   |     |    | tenant_id (FK)   |
  | slug VARCHAR     |     |    | name VARCHAR     |     +----| user_id (FK)     |
  | is_active BOOLEAN|     |    | email VARCHAR    |          | token_hash TEXT  |
  +------------------+     |    | role VARCHAR     |          | version INTEGER  |
                           |    | token_version INT|          +------------------+
                           |    +------------------+
                           |
                           +----+--------------------------------+
                           |                                     |
                           v                                     v
  +------------------+   +------------------+   +------------------+   +------------------+
  |   institutions   |   |    residents     |   |resident_analytics|   |  notifications   |
  +------------------+   +------------------+   +------------------+   +------------------+
  | id (PK) UUID     |   | id (PK) UUID     |<--| id (PK) UUID     |   | id (PK) UUID     |
  | tenant_id (FK)   |   | tenant_id (FK)   |   | tenant_id (FK)   |   | tenant_id (FK)   |
  | name VARCHAR     |   | first_name VARCH |   | resident_id (FK) |   | resident_id (FK) |
  | darpan_id VARCHAR|   | last_name VARCHAR|   | medication_score |   | type VARCHAR     |
  | status VARCHAR   |   | status VARCHAR   |   | nutrition_score  |   | title VARCHAR    |
  +------------------+   | wt_medication NUM|   | vitals_score     |   | status VARCHAR   |
                         | wt_nutrition NUM |   | activity_score   |   +------------------+
                         | wt_vitals NUM    |   | welfare_index    |
                         +------------------+   +------------------+
```

### 6.2 Transactional Integrity and Constraints
*   **Onboarding Rollbacks**: Tenant registration and Admin creation are executed inside SQL transactions (`BEGIN ... COMMIT`). If user creation fails, the tenant insert is rolled back.
*   **Unique Index Scopes**: Multi-tenant isolation is supported by relational constraints, such as unique indexes on `users(tenant_id, LOWER(email))` and `institutions(tenant_id, darpan_id)`.
*   **Foreign Key Constraints**: All child entities map to the `tenants` and `residents` tables with `ON DELETE CASCADE` rules, keeping data clean when parent records are deleted.

---

## 7. MongoDB Timeline Layer

The MongoDB database stores unstructured logging streams in the `care_logs` collection.

### 7.1 Mongoose Collection Schema
```javascript
{
  tenantId: { type: String, required: true },
  residentId: { type: String, required: true },
  caretakerId: { type: String, required: true },
  type: { type: String, required: true, enum: ['medication', 'nutrition', 'vitals', 'activity'] },
  details: { type: mongoose.Schema.Types.Mixed, required: true },
  recordedAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
}
```

### 7.2 Core Indexing Strategy
To optimize analytical scans, compound and single indices are defined:
*   `{ tenantId: 1 }`: Filters logs scoped to a specific tenant.
*   `{ residentId: 1 }`: Collects timeline logs for a specific resident.
*   `{ recordedAt: -1 }`: Sorts care histories chronologically.
*   `{ tenantId: 1, residentId: 1, recordedAt: -1 }`: Optimizes searches for a resident's history.
*   `{ tenantId: 1, type: 1, recordedAt: -1 }`: Optimizes queries grouped by log type (e.g. for vitals aggregation).

---

## 8. Redis Event Pipeline

### 8.1 Implemented Event Flow Diagram
The event pipeline processes health records asynchronously:

```
+------------------------------------+
| HTTP POST /api/v1/residents/       |
|            :residentId/logs        |
+-----------------+------------------+
                  |
                  | 1. Writes document
                  v
+------------------------------------+
| MongoDB: care_logs collection      |
+-----------------+------------------+
                  |
                  | 2. Confirms write
                  v
+------------------------------------+
| Express Controller Publish Method  |
+-----------------+------------------+
                  |
                  | 3. Publishes to Redis channel: 'care-log-created'
                  v
+------------------------------------+
| Redis Pub/Sub: care-log-created    |
+-----------------+------------------+
                  |
                  | 4. Broadcasts event payload
                  v
+------------------------------------+
| Event: AnalyticsSubscriber.js      |
+-----------------+------------------+
                  |
                  | 5. Triggers background worker execution
                  v
+------------------------------------+
| Worker: analyticsWorker.js         |
+-----------------+------------------+
                  |
                  | 6. Fetches recent logs & recalculates scores
                  v
+------------------------------------+
| SQL Update: resident_analytics     |
+-----------------+------------------+
                  |
                  | 7. If Welfare Index < 50, triggers service
                  v
+------------------------------------+
| Service: notificationsService.js   |
+-----------------+------------------+
                  |
                  | 8. Inserts alert record
                  v
+------------------------------------+
| PostgreSQL: notifications table    |
+------------------------------------+
```

### 8.2 Payload Formats
The messaging payload contains only reference values to minimize memory overhead:
```json
{
  "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
  "residentId": "a92e21b8-68e1-4541-b0e6-ee328b9d6287",
  "caretakerId": "b1827e8d-8a8d-4be9-81a1-f3b145a9018e",
  "logId": "6516df4b2f4a1b001258d4a9",
  "type": "vitals",
  "recordedAt": "2026-05-30T10:10:00.000Z"
}
```

---

## 9. Analytics Worker Architecture

The analytics worker computes scores based on resident care log histories.

### 9.1 Score Calculations
When an event triggers processing, the worker retrieves up to 1000 historical logs for the target resident and processes them:
1.  **Group Logs by Type**: Logs are filtered into `medication`, `nutrition`, `vitals`, and `activity` sub-arrays.
2.  **Calculate Category Sub-scores ($S$):**
    *   **Explicit Score Averaging**: If logs in a category contain numerical scores (`details.score`), the sub-score is the average of these scores:
        $$S_{category} = \frac{\sum_{i=1}^{n} \text{details.score}_i}{n}$$
    *   **weighted welfare score computation based on care log categories and resident-configured weights**: If no explicit scores are present, the category score is computed using the weighted welfare score computation based on care log categories and resident-configured weights.

### 9.2 Weighted Welfare Index Computation
The overall Welfare Index ($WI$) is computed as a weighted average of the Medication ($S_m$), Nutrition ($S_n$), and Vitals ($S_v$) scores. The weights ($W_m, W_n, W_v$) are configured on the resident's profile:
$$WI = \frac{(W_m \cdot S_m) + (W_n \cdot S_n) + (W_v \cdot S_v)}{W_m + W_n + W_v}$$

The resulting value is clamped between 0 and 100, and saved via an upsert in the PostgreSQL `resident_analytics` table.

---

## 10. Notification Service Architecture

The Notification Service generates and manages system alerts.

*   **Low Score Detection**: If the recalculated Welfare Index ($WI$) of a resident is $< 50$, the system automatically invokes the notification service.
*   **Database Isolation**: Alerts are saved to the PostgreSQL `notifications` table, scoped to the resident's `tenant_id` to ensure tenant isolation.
*   **Alert Lifecycle**: Notifications default to `UNREAD`. Authorized users and guardians can fetch alerts and transition their status to `READ` via targeted API requests.

---

## 11. Guardian Dashboard Architecture

The Dashboard module compiles health metrics to provide a real-time status overview.

*   **Risk Level Categorization**: The system maps the numerical Welfare Index ($WI$) into a categorical Risk Level:
    *   $WI < 40 \implies \text{HIGH Risk}$
    *   $40 \le WI < 70 \implies \text{MEDIUM Risk}$
    *   $WI \ge 70 \implies \text{LOW Risk}$
*   **Access Control**: Guardians are restricted by middleware to accessing only the records of residents they are authorized to monitor.
*   **Aggregated Metrics**: Dashboard endpoints query PostgreSQL tables using indexes on `tenant_id` to fetch the resident count, active status, high-risk resident count, and average welfare index in a single query.

---

## 12. Multi-Tenant Design

The WelfareSync Engine implements logical multi-tenancy using a shared-database, shared-schema strategy.

```
                  +--------------------------------+
                  |  HTTP Request (X-Tenant-ID)    |
                  +---------------+----------------+
                                  |
                                  v
+------------------------------------------------------------------+
|                  Auth Middleware Tenant Check                    |
| 1. Extracts tenant ID from headers and access token claims.      |
| 2. Verifies client tenant ID matches access token tenant ID.     |
+---------------------------------+--------------------------------+
                                  |
                                  v
+------------------------------------------------------------------+
|                    Tenant Isolation Enforcement                  |
| - Relational Tables: Enforces "WHERE tenant_id = contextId".     |
| - Mongo Collections: Enforces "{ tenantId: contextId }" filters. |
+------------------------------------------------------------------+
```

### 12.1 Isolation Mechanisms
*   **Header Scoping**: Tenant-scoped API requests must include the `X-Tenant-ID` header.
*   **Context Verification**: Middleware validates that the `tenantId` in the JWT matches the `X-Tenant-ID` header of the request, preventing tenant spoofing.
*   **Query-Level Filtering**: All database operations include explicit filters (`WHERE tenant_id = $1` in SQL, and `{ tenantId: contextId }` in MongoDB). Cross-tenant queries are blocked at the repository layer.

---

## 13. Security Architecture

*   **Express Helmet Hardening**: Sets secure HTTP response headers (e.g., CSP, HSTS, X-Content-Type-Options) and removes signatures like `X-Powered-By`.
*   **Session Revocation**: JWT claims include a `tokenVersion`. If user access is revoked, the system increments the user's `token_version` in the database, rendering any active access and refresh tokens invalid on the next verification.
*   **NoSQL Injection Prevention**: Validates incoming details payloads, rejecting MongoDB queries containing dot (`.`) or dollar (`$`) symbols.
*   **CORS Configuration**: Limits API requests to whitelisted origins defined in environment configurations.

---

## 14. Scalability Considerations

*   **Stateless Services**: Application server instances do not store local state, allowing them to scale horizontally behind a load balancer.
*   **Database Sharding**: The MongoDB care logs collection is designed to support horizontal scaling using `tenantId` as the shard key.
*   **Decoupled Architecture**: Redis Pub/Sub offloads CPU-intensive analytics recalculations to separate background processes, keeping API response loops unblocked.

---

## 15. Current Academic Scope

* Single Node Deployment
* Single PostgreSQL Instance
* Single MongoDB Instance
* Redis Pub/Sub
* Manual API Testing
* No Kubernetes
* No CI/CD
* No WebSocket Notifications

---

## 16. Future Production Enhancements

* Docker Compose
* Kubernetes
* Redis Streams
* Kafka
* Email Notifications
* SMS Notifications
* WebSocket Dashboard Updates
* Multi-Region Deployment
* Nginx API Gateway
* CI/CD Pipeline
* Observability Stack

---

## 17. Conclusion

The **WelfareSync Engine** architecture provides a performant foundation for resident care management. By using PostgreSQL for administrative relations, MongoDB for flexible logging, and Redis for task queues, the system keeps transactional processes isolated from heavy calculations. This High Level Design establishes the technical framework required to maintain security, scalability, and multi-tenant isolation across all system modules.
