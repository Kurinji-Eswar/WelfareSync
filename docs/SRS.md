# Software Requirements Specification (SRS)
## WelfareSync Engine
### Scalable Multi-Tenant Resident Welfare Analytics & Monitoring System

---

## 1. Introduction

### 1.1 Purpose
This document specifies the Software Requirements Specification (SRS) for the **WelfareSync Engine**, a scalable, multi-tenant Resident Welfare Analytics & Monitoring System. This specification provides a comprehensive description of the system's functional capabilities, performance criteria, security architecture, data schemas, and event-driven analytical workflows. It serves as the primary technical agreement and reference for developers, system architects, database administrators, and QA engineers.

### 1.2 System Scope
The WelfareSync Engine is a backend platform designed to modernize and digitize resident care operations across welfare institutions (e.g., care homes, shelters, and rehabilitation centers). The system features:
*   **Logical Multi-Tenancy**: Complete data isolation across independent institutions (tenants) using a single, unified database schema.
*   **Hybrid Database Architecture**: Utilizing PostgreSQL for relational, highly-structured metadata (tenants, users, institutions, residents, analytics, notifications) and MongoDB for high-velocity, flexible-schema care event streams (care logs).
*   **Event-Driven Analytics**: Offloading computationally expensive scoring routines via Redis Pub/Sub to background workers, decoupling critical API endpoints from background data processing.
*   **Welfare Profiling**: Implementing mathematical formulas to compute real-time wellness indices based on caretaker logs and alert guardians to critical changes.

### 1.3 Definitions, Acronyms, and Abbreviations
*   **SRS**: Software Requirements Specification
*   **NGO**: Non-Governmental Organization
*   **Darpan ID**: The unique identification code assigned to voluntary organizations/NGOs in India by the government via the NGO-Darpan portal.
*   **JWT**: JSON Web Token
*   **Pub/Sub**: Publish/Subscribe event pattern
*   **ACID**: Atomicity, Consistency, Isolation, Durability
*   **CORS**: Cross-Origin Resource Sharing
*   **NoSQL**: Not Only SQL (referring here to MongoDB)
*   **Welfare Index ($WI$)**: A calculated percentage (0–100) representing a resident's current physiological, nutritional, and medical stability.

### 1.4 References
1. *IEEE Std 830-1998*, IEEE Recommended Practice for Software Requirements Specifications.
2. Node.js Documentation (`https://nodejs.org/docs`).
3. PostgreSQL Database Documentation (`https://www.postgresql.org/docs`).
4. MongoDB Manual (`https://www.mongodb.com/docs`).
5. Redis Documentation (`https://redis.io/docs`).

### 1.5 Document Overview
The remainder of this document outlines the core specifications. Section 2 describes the problem context, while Section 3 defines the objectives. Section 4 identifies the system stakeholders. Sections 5 and 6 detail the functional and non-functional requirements. Section 7 presents formalized Use Cases. Sections 8 and 9 discuss system assumptions and constraints, followed by a concluding summary in Section 10.

---

## 2. Problem Statement

### 2.1 Context of Care Homes and Welfare Institutions
Welfare institutions, such as specialized care homes, orphanages, senior care centers, and shelters, house residents with complex health, medical, and nutritional needs. In many developing regions, these facilities operate under constrained resources. Operational tracking of daily care activities remains overwhelmingly manual, paper-based, and fragmented.

### 2.2 Existing Inefficiencies
The primary operational challenges addressed by the WelfareSync Engine include:
1.  **Manual Record Bottlenecks**: Care logs (medication administration, vitals, nutrition intake) recorded on paper sheets are highly susceptible to loss, transcription errors, and omissions.
2.  **Delayed Care Interventions**: Due to static paper records, there are no active mechanisms to detect gradual physiological decline or sudden anomalies. Decline is often observed only *after* severe medical emergencies manifest.
3.  **Lack of Centralized and Standardized NGO Auditing**: Regulatory authorities (such as those matching institutions to national NGO portals like India's Darpan platform) have no real-time transparency or digital audit logs to verify compliance, leading to accountability gaps.
4.  **Fragmented Guardian Communication**: Family members or sponsors (Guardians) are often left in the dark, dependent on sporadic, subjective phone calls rather than transparent, data-driven wellness updates.

### 2.3 System Goal
The goal of the WelfareSync Engine is to provide a highly secure, multi-tenant digital backbone that tracks daily care events, translates unstructured logs into structured health telemetry, computes a weighted welfare index, and delivers immediate, event-driven notifications to guardians and administrators when safety thresholds are breached.

---

## 3. Objectives

### 3.1 Business Objectives
*   **Standardize Operations**: Establish digital forms and logs for caretakers, eliminating paper logs across multiple care home branches.
*   **Strengthen Regulatory Verification**: Incorporate Darpan ID verification to ensure that only registered and audited institutions can register as tenants.
*   **Empower Families (Guardians)**: Provide an active, read-only dashboard for guardians to monitor their ward's status, building trust and transparency.
*   **Proactive Welfare Triggers**: Implement automatic notification workflows to notify personnel of anomalies within minutes rather than days.

### 3.2 Technical & Architectural Objectives
*   **Strict Logical Multi-Tenancy**: Guarantee that data belonging to Tenant A is mathematically inaccessible to users of Tenant B, operating under a Shared-Database, Shared-Schema model.
*   **Hybrid Data Strategy**: Leverage PostgreSQL for transactional metadata requiring rigid relations and ACID safety, and MongoDB for scalable, non-relational care log streams.
*   **High Throughput & Decoupled Architecture**: Utilize Redis Pub/Sub to offload analytical calculations from the HTTP request-response thread, maintaining Target API response latency under 100ms under normal operating conditions.
*   **Session Revocation Security**: Support instant token-level user revocation using JWT claims mapped to incremental `token_version` records in the database, avoiding traditional expensive database lookups on every middleware execution.

---

## 4. Stakeholders

| Stakeholder Role | Description | Core Operations in WelfareSync Engine |
| :--- | :--- | :--- |
| **Tenant Administrator** (Admin) | Authorized manager representing the specific institution. | Configures the tenant profile, registers caretakers and guardians, archives residents, adjusts analytics weight profiles, and monitors overall facility metrics. |
| **Caretaker** | On-the-ground staff directly responsible for resident care. | Submits care logs (medication, vitals, nutrition, activities) via API/App, and updates resident status. |
| **Guardian** | Authorized family member or sponsor of a specific resident. | Accesses a read-only portal to view the ward's Welfare Index history, logs, risk level, and unread alerts. |
| **Regulatory Authority** | Government or compliance auditors verifying NGO credentials. | Inspects institution records, audits compliance via Darpan registration IDs, and validates audit logs. |

---

## 5. Functional Requirements

### 5.1 Authentication Requirements
*   **REQ-AUTH-0**: The system shall allow creation of a new tenant along with an initial administrator account through a dedicated tenant onboarding endpoint.
    *   The onboarding process shall:
        *   Create tenant record
        *   Create administrator account
        *   Generate JWT access token
        *   Generate JWT refresh token
        *   Return tenant and administrator information
    *   Implementation Reference: `POST /api/v1/auth/tenants`
*   **REQ-AUTH-1**: The system must enforce multi-tenancy at the database level. Every user and query must resolve to a specific `tenant_id` UUID.
*   **REQ-AUTH-2**: User email addresses must be unique *within* a specific tenant scope (verified via a unique PostgreSQL compound index on `(tenant_id, LOWER(email))`), allowing the same email address to exist across separate tenants if necessary.
*   **REQ-AUTH-3**: The system must support role-based access control (RBAC), validating user roles (`ADMIN`, `CARETAKER`, `GUARDIAN`) on every request.
*   **REQ-AUTH-4**: Session management must use short-lived JWT Access Tokens (e.g., 15 minutes) and longer-lived, database-logged Refresh Tokens.
*   **REQ-AUTH-5**: The system must implement token-versioning. If an Admin logs out a user or changes credentials, the user's `token_version` in the database is incremented, immediately rendering any active access/refresh tokens invalid on their next verification.

```
Access Token JWT Claims:
{
  "userId": "UUID",
  "tenantId": "UUID",
  "role": "ADMIN" | "CARETAKER" | "GUARDIAN",
  "tokenVersion": Integer
}
```

### 5.2 Multi-Tenant Requirements
*   **REQ-MT-1**: Every request shall be associated with a tenantId.
*   **REQ-MT-2**: The X-Tenant-ID header shall be validated.
*   **REQ-MT-3**: The tenantId contained in the JWT token shall match the tenant context of the request.
*   **REQ-MT-4**: Cross-tenant access shall be prohibited.
*   **REQ-MT-5**: Analytics processing shall remain tenant-scoped.
*   **REQ-MT-6**: Notification generation and retrieval shall remain tenant-scoped.
*   **REQ-MT-7**: Resident records, institutions, logs, analytics, and notifications shall be isolated between tenants.

### 5.3 Institution Management Module
*   **REQ-INST-1**: The system must support registration of tenants via a unique slug (e.g., `kuralara-care-center`). Slugs must be validated and saved in lowercase.
*   **REQ-INST-2**: The institution model must support an optional `darpan_id` field. The system must enforce uniqueness on `(tenant_id, darpan_id)` to prevent duplicate NGO registrations under a single tenant.
*   **REQ-INST-3**: Institutions must have a status lifecycle: `ACTIVE`, `INACTIVE`, or `ARCHIVED`. Inactive and archived institutions must have all associated user and client sessions blocked immediately.

### 5.4 Resident Management Module
*   **REQ-RES-1**: Administrators must be able to register residents with core biodata: First Name, Last Name, Gender, Date of Birth, Admission Date, and Status (`ACTIVE` or `ARCHIVED`).
*   **REQ-RES-2**: The resident profile must store custom analytical weight parameters for the Welfare Index calculation:
    *   `weight_medication` (Numeric, default 1.0)
    *   `weight_nutrition` (Numeric, default 1.0)
    *   `weight_vitals` (Numeric, default 1.0)
*   **REQ-RES-3**: The system must validate that all weights assigned to a resident are non-negative numeric values ($\ge 0$).

### 5.5 Care Logging Module
*   **REQ-LOG-1**: Caretakers must be able to log daily care events. Logs must be written to MongoDB for high-velocity write throughput and flexible payload support.
*   **REQ-LOG-2**: Every Care Log document must strictly contain the following fields:
    *   `tenantId` (String representation of tenant UUID)
    *   `residentId` (String representation of resident UUID)
    *   `caretakerId` (String representation of caretaker UUID)
    *   `type` (Enum: `medication`, `nutrition`, `vitals`, `activity`)
    *   `details` (Mixed object representing type-specific telemetry data)
    *   `recordedAt` (Date when the event physically took place)
*   **REQ-LOG-3**: Care Log details must be scanned programmatically to prevent MongoDB key injection (rejecting keys containing `$` or `.`).

### 5.6 Event-Driven Real-time Analytics Module
*   **REQ-AN-1**: Upon successful insertion of a Care Log in MongoDB, the system must immediately publish a `care-log-created` event to a Redis Pub/Sub channel.
*   **REQ-AN-2**: An asynchronous analytics background worker must subscribe to the Redis channel, parse incoming log payloads, and execute the analytical recalculation offline.
*   **REQ-AN-3**: For a given resident, the analytics engine must query their recent historical care logs (bounded by `ANALYTICS_LOG_LIMIT` which defaults to 1000 logs) and compute four distinct sub-scores: Medication, Nutrition, Vitals, and Activity.
*   **REQ-AN-4**: Individual category scores must be computed using two methods:
    1.  **Explicit Score Average**: If logs of that type contain explicit scores (`log.details.score`), the sub-score is the mathematical average of those scores, clamped between 0 and 100:
        $$Score_{category} = \frac{\sum_{i=1}^{n} ExplicitScore_i}{n}$$
    2.  **Recency-Based Decay**: If no explicit scores are present, the sub-score defaults to the maximum recency score among logs of that type, where age is calculated as $t_{age} = \text{now}() - \text{recordedAt}$:
        *   $t_{age} \le 1 \text{ day} \implies 100$
        *   $t_{age} \le 3 \text{ days} \implies 85$
        *   $t_{age} \le 7 \text{ days} \implies 70$
        *   $t_{age} \le 14 \text{ days} \implies 50$
        *   $t_{age} > 14 \text{ days} \implies 25$
        *   No logs present $\implies 0$
*   **REQ-AN-5**: The system must calculate the overall Welfare Index ($WI$) as a weighted average of the Medication ($S_m$), Nutrition ($S_n$), and Vitals ($S_v$) scores using the custom weights stored on the resident's profile ($W_m, W_n, W_v$):
    $$WI = \frac{(W_m \cdot S_m) + (W_n \cdot S_n) + (W_v \cdot S_v)}{W_m + W_n + W_v}$$
*   **REQ-AN-6**: Calculated scores must be saved in the PostgreSQL `resident_analytics` table via an atomic upsert operation keyed on `(tenant_id, resident_id)`.

```
                +----------------------------+
                |    Caretaker Care Log      |
                +-------------+--------------+
                              |
                              | 1. HTTP POST
                              v
                +----------------------------+
                |    MongoDB Event Store     |
                +-------------+--------------+
                              |
                              | 2. Trigger Event
                              v
                +----------------------------+
                |    Redis Pub/Sub Channel   |
                +-------------+--------------+
                              |
                              | 3. Asynchronous Broadcast
                              v
                +----------------------------+
                |  Analytics Background Host |
                +-------------+--------------+
                              |
                              | 4. Recalculate Score &
                              |    Weighted Average
                              v
                +----------------------------+
                |   PostgreSQL Analytics     |
                +----------------------------+
```

### 5.7 Notification Requirements
*   **REQ-NOT-1**: Generate notifications when a resident welfare index falls below the configured threshold.
*   **REQ-NOT-2**: Store notifications in PostgreSQL.
*   **REQ-NOT-3**: Notifications shall remain tenant-isolated.
*   **REQ-NOT-4**: Guardians and authorized users shall be able to retrieve notifications.
*   **REQ-NOT-5**: Notifications shall support unread status tracking.

### 5.8 Dashboard Requirements
*   **REQ-DASH-1**: Provide dashboard overview metrics.
*   **REQ-DASH-2**: Provide resident risk summaries.
*   **REQ-DASH-3**: Provide unread notification summaries.
*   **REQ-DASH-4**: Provide resident detail dashboard views.
*   **REQ-DASH-5**: The system must automatically map the numerical Welfare Index into a color-coded categorical Risk Level:
    *   $WI < 40 \implies \text{HIGH Risk}$
    *   $40 \le WI < 70 \implies \text{MEDIUM Risk}$
    *   $WI \ge 70 \implies \text{LOW Risk}$
*   **REQ-DASH-6**: Guardians must be restricted to accessing logs and dashboards only for residents for whom they are authorized.
*   **Implementation Reference**:
    *   `GET /api/v1/dashboard/overview`
    *   `GET /api/v1/dashboard/residents`
    *   `GET /api/v1/dashboard/residents/:residentId`
    *   `GET /api/v1/dashboard/notifications`

---

## 6. Non-Functional Requirements

### 6.1 Performance and Latency
*   **NFR-PERF-1**: Response time for Care Log registration (`POST /api/v1/logs`) must be less than 80ms under typical loads (100 requests/sec), accomplished by writing to MongoDB and publishing asynchronously to Redis without waiting for analytical calculation.
*   **NFR-PERF-2**: Read queries for dashboards (`GET /api/v1/dashboard/overview`) must serve responses within 50ms, relying on pre-calculated PostgreSQL tables instead of on-the-fly aggregations.

### 6.2 Scalability
*   **NFR-SCAL-1**: The stateless application server layers must be horizontally scalable behind a load balancer.
*   **NFR-SCAL-2**: The write-heavy Care Log component (MongoDB) must be designed to support horizontal sharding by `tenantId` to ensure performance scales with system growth.

### 6.3 Security
*   **NFR-SEC-1**: The system must hide internal technologies by removing headers like `X-Powered-By` and implementing Helmet middleware to set secure HTTP headers (e.g., Content Security Policy, HSTS, X-Content-Type-Options).
*   **NFR-SEC-2**: Authentication middleware must verify token validity, signature, and expiration before permitting route access.
*   **NFR-SEC-3**: To prevent NoSQL injection, all incoming MongoDB queries must reject keys containing dot (`.`) or dollar (`$`) symbols.
*   **NFR-SEC-4**: CORS must be configured using explicit, domain-specific whitelists loaded from environment configurations, disabling open-ended wildcards (`*`) in production.

### 6.4 Reliability and Data Integrity
*   **NFR-REL-1**: Relational data must be secured in PostgreSQL using foreign key constraints with cascade deletes to maintain relational integrity.
*   **NFR-REL-2**: Connection pools for PostgreSQL, MongoDB, and Redis must implement reconnection strategies with exponential backoff to handle network interruptions.

### 6.5 Maintainability and Testability
*   **NFR-MNT-1**: The codebase must be modularized into distinct directories for routes, controllers, services, repositories, and workers.
*   **NFR-MNT-2**: Database initialization scripts must be idempotent, creating tables, extensions, and indices safely without risking data loss.

---

## 7. Use Cases

### Use Case 1: User Authentication & Tenant Resolution
*   **Actor**: Caretaker / Admin / Guardian
*   **Preconditions**: The user has been registered by a Tenant Admin and the Tenant status is `ACTIVE`.
*   **Basic Flow**:
    1.  The user sends an HTTP POST request to `/api/v1/auth/login` containing `tenantId`, `email`, and `password`.
    2.  The system queries PostgreSQL for the user matching `tenantId` and `email`.
    3.  The system verifies user status is `ACTIVE` and compares the password hash using Bcrypt.
    4.  The system issues a JWT Access Token containing user claims and a JWT Refresh Token.
    5.  The refresh token hash is saved to the database.
*   **Alternate Flow**:
    *   *Invalid Tenant*: If the tenant is inactive or archived, the request is rejected with HTTP 403.
    *   *Incorrect Credentials*: If the password or email does not match, the request returns HTTP 401.
*   **Postconditions**: The user obtains access and refresh tokens scoped to their tenant.

### Use Case 2: Care Log Submission
*   **Actor**: Caretaker
*   **Preconditions**: Caretaker is authenticated and holds a valid access token.
*   **Basic Flow**:
    1.  Caretaker sends HTTP POST to `/api/v1/logs` with resident details and care log data.
    2.  The system validates the request payload and sanitizes keys.
    3.  The system verifies the resident exists and is active in PostgreSQL.
    4.  The system saves the log to MongoDB.
    5.  The system publishes a payload containing `tenantId`, `residentId`, and `logId` to Redis Pub/Sub under the channel `care-log-created`.
    6.  The system returns HTTP 201 to the client.
*   **Postconditions**: The Care Log is recorded, and the recalculation event is published.

### Use Case 3: Welfare Score Recalculation
*   **Actor**: Analytics Background Worker
*   **Preconditions**: Redis subscriber is connected and listening to the `care-log-created` channel.
*   **Basic Flow**:
    1.  The Redis subscriber receives a message from the channel.
    2.  The subscriber invokes the analytics service to compute scores for the target resident.
    3.  The analytics service retrieves the resident's historical care logs from MongoDB.
    4.  The service calculates sub-scores (Medication, Nutrition, Vitals, Activity) using recency-decay or averages.
    5.  The service computes the overall Welfare Index ($WI$) based on the resident's configured weights.
    6.  The service updates the database using an upsert operation.
    7.  If the Welfare Index is $< 50$, the worker invokes the notification service.
*   **Postconditions**: The resident's analytics profile is updated in PostgreSQL.

### Use Case 4: View Guardian Dashboard
*   **Actor**: Guardian
*   **Preconditions**: The Guardian is authenticated and authorized to access the specific resident's data.
*   **Basic Flow**:
    1.  The Guardian sends HTTP GET to `/api/v1/dashboard/residents/:residentId`.
    2.  The system checks authorization parameters.
    3.  The system queries PostgreSQL for the resident profile, current analytics, and associated alerts.
    4.  The system maps the numeric score to a Risk Level (LOW, MEDIUM, HIGH).
    5.  The dashboard returns the formatted JSON payload.
*   **Postconditions**: The Guardian views the current welfare status.

---

## 8. Assumptions

### 8.1 Technical Assumptions
*   **Infrastructure Availability**: A containerized deployment environment (e.g., Docker, Kubernetes) is available to orchestrate the Node.js API process, MongoDB database, PostgreSQL database, and Redis cache.
*   **Clock Synchronization**: System clocks across API nodes, database hosts, and background workers are synchronized via Network Time Protocol (NTP) to ensure accuracy in recency score calculations.

### 8.2 Operational Assumptions
*   **Staff Training**: Caretakers receive training on input requirements to ensure logged data is accurate and free of spelling errors.
*   **Secure Client Storage**: Client devices (browsers, mobile apps) are assumed to store JWT tokens securely, protecting them from unauthorized access.

---

## 9. Constraints

### 9.1 Technical Constraints
*   **Application Threading**: Because Node.js is single-threaded, CPU-bound operations (like computing statistics for large log volumes) must remain isolated in background processes or workers to prevent API latency spikes.
*   **Network Latency**: Since the architecture spans PostgreSQL, MongoDB, and Redis, physical network distance between these servers must be minimized (e.g., hosted in the same VPC) to prevent request delays.

### 9.2 Compliance Constraints
*   **Darpan Portability**: Institution verification depends on the availability and structure of the external NGO-Darpan data format. Changes to national registration schemas may require schema updates in WelfareSync.
*   **Regulatory Privacy**: In compliance with health data guidelines, personal data must be stored securely, and access logs must be kept to monitor access to resident profiles.

---

## 10. Conclusion

The **WelfareSync Engine** represents a modern, architectural approach to resident welfare monitoring in care facilities. By using a hybrid database design, the platform leverages the strengths of both relational and document-oriented databases:
1.  **PostgreSQL** maintains strict multi-tenant metadata constraints, relational integrity, and pre-calculated dashboards.
2.  **MongoDB** handles high-volume caretakers' logs, supporting varying schemas without requiring database migrations.
3.  **Redis Pub/Sub** decouples write operations from analytical recalculations, keeping system performance consistent as the platform scales.

This Software Requirements Specification establishes a clear blueprint for development, ensuring the system remains secure, performant, and compliant with modern operational standards.
