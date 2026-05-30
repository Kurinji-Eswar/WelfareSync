# Low Level Design (LLD)
## WelfareSync Engine
### Scalable Multi-Tenant Resident Welfare Analytics & Monitoring System

---

## 1. Introduction

### 1.1 Document Purpose
This Low Level Design (LLD) document defines the concrete software design specifications, class structures, database queries, and logical flows for the **WelfareSync Engine**. It acts as a bridge between the High Level Design (HLD) and the codebase implementation.

### 1.2 System Context
The WelfareSync Engine is built as a modular monolithic backend using Node.js and Express.js. It interfaces with PostgreSQL for relational integrity, MongoDB for document timelines, and Redis for pub/sub messaging.

### 1.3 References
*   *WelfareSync Software Requirements Specification (SRS)* - [docs/SRS.md](file:///k:/Kuralara_CareConnect/WelfareSync/docs/SRS.md)
*   *WelfareSync High Level Design (HLD)* - [docs/HLD.md](file:///k:/Kuralara_CareConnect/WelfareSync/docs/HLD.md)

### 1.4 Directory Structure Mapping
```
src/
├── config/             # Database and Cache configurations
├── constants/          # Role and status enums
├── events/             # Pub/Sub event publishers and subscribers
├── middleware/         # Auth, Tenant, and Error validation handlers
├── modules/            # Domain-specific modules (routes, controllers, services, repositories)
├── routes/             # Global API route aggregator
├── utils/              # Utility helpers (AppError, Async Handler)
└── workers/            # Background processing workers
```

---

## 2. Module Design Approach

The WelfareSync codebase adopts a modular architectural pattern. Each business module (directory under `src/modules/`) is strictly isolated and implements the following layers:

```
+-------------------------------------------------------------+
| 1. Route Layer (Express.Router)                             |
|    - Endpoint bindings, path parameter extractions          |
|    - Middleware interceptors (authenticate, tenantValidation)|
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| 2. Controller Layer                                         |
|    - Maps HTTP requests, extracts payloads (body, query)    |
|    - Builds standard JSON response envelopes                |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| 3. Service Layer                                            |
|    - Enforces business rules and validation logic           |
|    - Executes calculations (e.g., scoring aggregates)       |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| 4. Repository Layer                                         |
|    - Encapsulates database execution (SQL/Mongoose)         |
|    - Converts raw database rows into domain objects         |
+-------------------------------------------------------------+
```

### 2.1 Layer Specifications
*   **Routes**: Defines routes and assigns middleware chains (e.g., `authenticate`, `tenantValidation`, `authorize([roles])`).
*   **Controller Layer**: Invokes domain services via async/await, catching operational errors via a global `asyncHandler` wrapper.
*   **Service Layer**: Executes core business calculations, sanitizes payloads, and queries repositories.
*   **Repository Layer**: Writes query strings and parameters to PG client pools, or interacts with Mongoose models.
*   **Validation Logic**: Asserts key types, strings, lengths, and structures before parsing payloads down to DB queries.
*   **Authentication Flow**: Validates client access tokens via Bearer tokens in headers.
*   **Authorization Flow**: Rejects actions when the authenticated user’s role does not match permissions.
*   **Database Operations**: Restricts queries to the current `tenant_id` context.
*   **Error Handling**: Instantiates and throws custom `AppError` objects containing HTTP statuses, which are caught and processed by global middleware.

---

## 3. Authentication Module Design

### 3.1 Implemented Endpoints
1.  `POST /api/v1/auth/tenants` (Onboard tenant and Admin user)
2.  `POST /api/v1/auth/register` (Register caretaker/guardian under tenant context)
3.  `POST /api/v1/auth/login` (User authentication)
4.  `POST /api/v1/auth/refresh` (Rotates JWT access/refresh pair)
5.  `POST /api/v1/auth/logout` (Invalidates refresh token session)
6.  `POST /api/v1/auth/logout-all` (Increments database version to invalidate all sessions)
7.  `GET /api/v1/auth/me` (Retrieves user information from active session)

### 3.2 Component Details
*   **Routes** (`routes.js`): Maps public endpoints (`/login`, `/refresh`, `/logout`, `/tenants`) and protected routes (`/register`, `/logout-all`, `/me`) using Express Router.
*   **Controller Layer** (`controller.js`): Processes credentials, executes login/logout actions, and returns token pairs.
*   **Service Layer** (`service.js`): Manages token creation (JWT), parses expiry dates, compares passwords using Bcrypt, and increments `tokenVersion` to invalidate active tokens on logout.
*   **Repository Layer** (`repository.js`): Interfaces with the `tenants`, `users`, and `refresh_tokens` PostgreSQL tables.
*   **Validation Logic**: Checks email formats, asserts password length ($\ge 8$), and restricts registration roles to `CARETAKER` or `GUARDIAN`.
*   **Authentication Flow**: Uses JWT Access Tokens in request headers.
*   **Authorization Flow**: Retains Admin-only access to registration: `authorize([roles.ADMIN])`.
*   **Database Operations**:
    *   *Transaction Insertion*: Onboard transactions write to `tenants` and `users` simultaneously within a SQL transaction block (`BEGIN` / `COMMIT`).
    *   *Email Scoping*: Restricts user logins to the resolved tenant:
        ```sql
        SELECT * FROM users WHERE tenant_id = $1 AND email = LOWER($2);
        ```
*   **Error Handling**: Throws custom errors for incorrect credentials (401), invalid tokens (401), or duplicate slugs (409).

---

## 4. Institution Module Design

### 4.1 Implemented Endpoints
1.  `POST /api/v1/institutions` (Creates institution record)
2.  `GET /api/v1/institutions` (List active institutions for a tenant)
3.  `GET /api/v1/institutions/:id` (Retrieve detail information)
4.  `PUT /api/v1/institutions/:id` (Update institution info)
5.  `DELETE /api/v1/institutions/:id` (Archive institution status)

### 4.2 Component Details
*   **Routes** (`routes.js`): Binds endpoints. Restricts POST, PUT, and DELETE routes to Admin.
*   **Controller Layer** (`controller.js`): Captures route params (`req.params.id`) and payload properties (`req.body`).
*   **Service Layer** (`service.js`): Validates contact phone numbers, emails, and verifies unique Darpan NGO portal codes.
*   **Repository Layer** (`repository.js`): Interfaces with the SQL `institutions` table.
*   **Validation Logic**: Verifies required strings (name, address, contact email) and checks that Darpan IDs are unique within the tenant:
    ```sql
    CREATE UNIQUE INDEX IF NOT EXISTS idx_institutions_tenant_darpan_id
    ON institutions(tenant_id, darpan_id) WHERE darpan_id IS NOT NULL;
    ```
*   **Authentication Flow**: Resolves requests via the `authenticate` middleware.
*   **Authorization Flow**: Grants read-only access to all roles, but restricts creation and modifications to Admins.
*   **Database Operations**:
    *   *Soft Archive*: Soft deletes records by updating the status column instead of executing a hard delete:
        ```sql
        UPDATE institutions SET status = 'ARCHIVED' WHERE tenant_id = $1 AND id = $2;
        ```
*   **Error Handling**: Throws errors if an institution is not found (404) or if the Darpan ID is already in use (409).

---

## 5. Resident Module Design

### 5.1 Implemented Endpoints
1.  `POST /api/v1/residents` (Register resident with weights)
2.  `GET /api/v1/residents` (List active residents under tenant context)
3.  `GET /api/v1/residents/:id` (Get resident profile)
4.  `PUT /api/v1/residents/:id` (Update weights and profile)
5.  `DELETE /api/v1/residents/:id` (Archive resident status)

### 5.2 Component Details
*   **Routes** (`routes.js`): Configures route mappings. Binds GET requests to Caretakers, Admins, and Guardians.
*   **Controller Layer** (`controller.js`): Passes resident profiles and IDs between services and routers.
*   **Service Layer** (`service.js`): Validates weight configurations (`weight_medication`, `weight_nutrition`, `weight_vitals`) and clamps values to ensure they are non-negative.
*   **Repository Layer** (`repository.js`): Interfaces with the SQL `residents` table.
*   **Validation Logic**: Checks that weights are valid numbers ($\ge 0$).
*   **Authentication Flow**: Identifies token details from the active session.
*   **Authorization Flow**: Restricts POST, PUT, and DELETE operations to Admins.
*   **Database Operations**:
    *   *Insert Record*:
        ```sql
        INSERT INTO residents (tenant_id, first_name, last_name, gender, date_of_birth, admission_date, weight_medication, weight_nutrition, weight_vitals)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
        ```
    *   *Archive Record*: Updates the status column to `ARCHIVED`.
*   **Error Handling**: Returns HTTP 404 if a resident profile is not found or has been archived.

---

## 6. Care Logs Module Design

### 6.1 Implemented Endpoints
1.  `POST /api/v1/logs` (Caretaker logs care event)
2.  `GET /api/v1/logs` (Search/query care logs)
3.  `GET /api/v1/logs/:id` (Fetch individual log details)
4.  `GET /api/v1/residents/:residentId/logs` (Fetch care logs for a resident)

### 6.2 Component Details
*   **Routes** (`routes.js`): Binds POST requests to Caretakers and Admins. Binds GET requests to all authenticated users.
*   **Controller Layer** (`controller.js`): Formats parameters and passes payload arrays.
*   **Service Layer** (`service.js`): 
    *   Verifies that the target resident exists and is not archived in PostgreSQL.
    *   Performs NoSQL sanitization on incoming JSON details.
    *   Saves the log to MongoDB.
    *   Publishes a notification event containing metadata to Redis.
*   **Repository Layer** (`repository.js`): Wraps Mongoose database queries.
*   **Validation Logic**: Rejects MongoDB updates containing dot (`.`) or dollar (`$`) characters to prevent NoSQL query injection.
*   **Mongoose Document Model**:
    ```javascript
    const careLogSchema = new mongoose.Schema({
      tenantId: { type: String, required: true, index: true },
      residentId: { type: String, required: true, index: true },
      caretakerId: { type: String, required: true },
      type: { type: String, required: true, enum: ['medication', 'nutrition', 'vitals', 'activity'] },
      details: { type: mongoose.Schema.Types.Mixed, required: true },
      recordedAt: { type: Date, required: true, index: true }
    });
    ```
*   **Authentication & Authorization Flow**: Verifies headers, scopes, and session status. Guardians can only retrieve logs for residents they are authorized to monitor.
*   **Database Operations**: Writes documents to MongoDB and reads timeline records sorted in descending chronological order:
    ```javascript
    CareLog.find({ tenantId, residentId }).sort({ recordedAt: -1 }).limit(limit).skip(offset);
    ```
*   **Error Handling**: Validates Mongoose query formats and throws an error if input validation fails (400).

---

## 7. Analytics Module Design

### 7.1 Implemented Endpoints
1.  `GET /api/v1/analytics/residents/:residentId` (Retrieve resident analytics profile)
2.  `POST /api/v1/analytics/test-low-score/:residentId` (Admin-only testing trigger)

### 7.2 Component Details
*   **Routes** (`routes.js`): Maps endpoints and verifies user roles.
*   **Controller Layer** (`controller.js`): Maps route parameters and returns scores.
*   **Service Layer** (`service.js`):
    *   Fetches resident details and their configured metric weights from PostgreSQL.
    *   Retrieves recent care logs from MongoDB.
    *   Calculates category averages:
        $$S_{category} = \frac{\sum_{i=1}^{n} \text{details.score}_i}{n}$$
    *   If no explicit scores are present, uses fallback logic: **weighted welfare score computation based on care log categories and resident-configured weights**.
    *   Calculates the overall Welfare Index ($WI$):
        $$WI = \frac{(W_m \cdot S_m) + (W_n \cdot S_n) + (W_v \cdot S_v)}{W_m + W_n + W_v}$$
    *   Saves the results to the database via an upsert in the `resident_analytics` table.
*   **Repository Layer** (`repository.js`): Interacts with the `resident_analytics` PostgreSQL table.
*   **Validation Logic**: Asserts UUID structures.
*   **Authentication & Authorization Flow**: Retains Admin-only access for the low-score test route.
*   **Database Operations**:
    *   *Upsert Score*:
        ```sql
        INSERT INTO resident_analytics (tenant_id, resident_id, medication_score, nutrition_score, vitals_score, activity_score, welfare_index)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (tenant_id, resident_id)
        DO UPDATE SET medication_score = EXCLUDED.medication_score, ...
        ```
*   **Error Handling**: Returns HTTP 404 if the target resident record is missing.

---

## 8. Notification Module Design

### 8.1 Implemented Endpoints
1.  `GET /api/v1/notifications` (List alerts for a tenant)
2.  `GET /api/v1/notifications/residents/:residentId` (List notifications for a resident)
3.  `PATCH /api/v1/notifications/:id/read` (Mark notification as read)

### 8.2 Component Details
*   **Routes** (`routes.js`): Registers path handlers.
*   **Controller Layer** (`controller.js`): Resolves route IDs and status parameters.
*   **Service Layer** (`service.js`): Manages alert generation and updates status fields from `UNREAD` to `READ`.
*   **Repository Layer** (`repository.js`): Interfaces with the SQL `notifications` table.
*   **Validation Logic**: Verifies UUID parameters.
*   **Authentication & Authorization Flow**: Restricts Guardians to reading notifications scoped only to their authorized residents.
*   **Database Operations**:
    *   *Insert Alert*:
        ```sql
        INSERT INTO notifications (tenant_id, resident_id, type, title, message)
        VALUES ($1, $2, 'LOW_WELFARE_SCORE', $3, $4);
        ```
    *   *Update Alert State*:
        ```sql
        UPDATE notifications SET status = 'READ', updated_at = NOW() WHERE tenant_id = $1 AND id = $2;
        ```
*   **Error Handling**: Returns HTTP 404 if the target alert does not exist under the resolved tenant context.

---

## 9. Dashboard Module Design

### 9.1 Implemented Endpoints
1.  `GET /api/v1/dashboard/overview` (Facility metrics summary)
2.  `GET /api/v1/dashboard/residents` (Resident risk summaries)
3.  `GET /api/v1/dashboard/notifications` (Facility warning notifications)
4.  `GET /api/v1/dashboard/residents/:residentId` (Resident metrics details view)

### 9.2 Component Details
*   **Routes** (`routes.js`): Restricts route access to Admins and Guardians.
*   **Controller Layer** (`controller.js`): Formats parameters and returns aggregated profiles.
*   **Service Layer** (`service.js`): Compiles metrics, calculates average index values, maps risk categories, and retrieves lists of unread alerts.
*   **Repository Layer** (`repository.js`): Combines data from SQL tables (`residents`, `resident_analytics`, and `notifications`).
*   **Validation Logic**: Parses pagination values.
*   **Authentication & Authorization Flow**: Verifies request access headers. Guardians are restricted to viewing metrics of residents they are authorized to monitor.
*   **Database Operations**:
    *   *Aggregate Metrics Query*:
        ```sql
        SELECT 
          COUNT(r.id)::INTEGER AS resident_count,
          COUNT(r.id) FILTER (WHERE r.status = 'ACTIVE')::INTEGER AS active_residents,
          COUNT(r.id) FILTER (WHERE ra.welfare_index < 40)::INTEGER AS high_risk_residents,
          COALESCE(AVG(ra.welfare_index), 0)::NUMERIC(6, 2) AS average_welfare_index,
          (SELECT COUNT(n.id)::INTEGER FROM notifications n WHERE n.tenant_id = $1 AND n.status = 'UNREAD') AS unread_notifications
        FROM residents r
        LEFT JOIN resident_analytics ra ON ra.tenant_id = r.tenant_id AND ra.resident_id = r.id
        WHERE r.tenant_id = $1;
        ```
*   **Error Handling**: Returns HTTP 404 if a resident profile is not found.

---

## 10. Security Design Details

The system enforces several security controls to protect sensitive medical and administrative data:
*   **JWT Bearer Token Security**: API requests must include a Bearer token in the `Authorization` header. Signature audits are executed using SHA-256 keys.
*   **Authorization Header Validation**: Middleware parses headers, validates tokens against format requirements, and rejects requests that do not match the expected structure:
    ```javascript
    const [, token] = authorization.match(/^Bearer\s+(.+)$/i) || [];
    ```
*   **Token Version Revocation**: The system checks token versions on every request. If a user's session is terminated, their database record is updated:
    ```sql
    UPDATE users SET token_version = token_version + 1 WHERE id = $1;
    ```
    This immediately invalidates any active access or refresh tokens matching the old version.
*   **Express Helmet Header Configuration**: Binds Helmet middleware to configure secure HTTP headers:
    *   `Content-Security-Policy`: Blocks cross-site scripting (XSS) vectors.
    *   `X-Frame-Options`: Set to `DENY` to prevent clickjacking.
    *   `X-Content-Type-Options`: Set to `nosniff`.
*   **CORS Whitelist Scopes**: Rejects requests from origins not explicitly defined in the application's configuration.
*   **NoSQL Query Sanitization**: Sanitizes input fields to strip properties containing MongoDB operator characters:
    ```javascript
    const containsUnsafeMongoKey = (value) => {
      // Logic scanning and rejecting keys starting with '$' or containing '.'
    };
    ```

---

## 11. Multi-Tenant Validation Flow

Multi-tenant security is enforced by a sequential middleware chain:

```
                  +--------------------------------+
                  |      HTTP Request Arrives      |
                  +---------------+----------------+
                                  |
                                  v
+------------------------------------------------------------------+
|                    1. authenticate Middleware                    |
| - Extracts Bearer Token from Authorization Header.               |
| - Verifies JWT signature and checks token expiration.            |
| - Queries PostgreSQL user records.                               |
| - Validates user status is ACTIVE and token version matches.     |
| - Populates req.auth with userId, tenantId, and role.            |
+---------------------------------+--------------------------------+
                                  |
                                  v
+------------------------------------------------------------------+
|                  2. tenantValidation Middleware                  |
| - Extracts tenant ID from req.headers['x-tenant-id'].            |
| - Asserts header is present and authentication context exists.   |
| - Validates req.headers['x-tenant-id'] === req.auth.tenantId.    |
| - Rejects request with HTTP 403 on mismatch.                     |
+---------------------------------+--------------------------------+
                                  |
                                  v
+------------------------------------------------------------------+
|                    3. authorize Middleware                       |
| - Verifies user role is in the endpoint's allowed roles list.   |
| - Passes control to downstream Route Controller.                 |
+------------------------------------------------------------------+
```

---

## 12. PostgreSQL Interaction Flow

PostgreSQL operations utilize connection pools managed by the `pg` library:
*   **Pool Configuration**: Managed via `src/config/postgres.js`. Reconnections use exponential backoff strategies to handle interruptions.
*   **Client Connections**: SQL queries use the connection pool:
    ```javascript
    const result = await pool.query(sqlQuery, parameterBindings);
    ```
*   **SQL Transaction Logic**: Operations requiring atomic updates are executed inside transaction blocks to prevent partial writes:
    ```javascript
    await client.query('BEGIN');
    // execute queries...
    await client.query('COMMIT');
    ```
    If an error occurs, the transaction is rolled back:
    ```javascript
    await client.query('ROLLBACK');
    ```

---

## 13. MongoDB Interaction Flow

MongoDB interactions use the Mongoose ODM framework:
*   **Connection Pool Lifecycle**: The connection pool is initialized at application startup and closed during graceful shutdowns:
    ```javascript
    const connectMongo = async () => {
      await mongoose.connect(process.env.MONGO_URI);
    };
    ```
*   **Query Constraints**: Queries are scoped to the client's tenant ID:
    ```javascript
    const logs = await CareLog.find({ tenantId, residentId });
    ```
*   **Mongoose Indexes**: Schema indexes are defined to optimize queries and enforce data isolation constraints at the storage layer.

---

## 14. Redis Event Processing Flow

Event processing uses Redis Pub/Sub to decouple write actions from background tasks:
*   **Publisher Operations**: When a Care Log is created, the system publishes a message payload containing reference IDs:
    ```javascript
    await redisClient.publish('care-log-created', JSON.stringify(payload));
    ```
*   **Subscriber Operations**: The subscriber listens for events, parses incoming payloads, and triggers background processing:
    ```javascript
    await subscriberClient.subscribe('care-log-created', async (message) => {
      const event = JSON.parse(message);
      await processCareLogEvent(event);
    });
    ```
*   **Error Catching**: Processing failures are caught and logged without affecting the main API thread.

---

## 15. Request Lifecycle Flow

Each API request follows a standard execution path:

```
[Client Request]
       │
       ▼
[Express Routing Engine]
       │
       ▼
[authenticate Middleware] ──(Fails)──► [HTTP 401 Unauthorized]
       │
       ▼
[tenantValidation Middleware] ──(Fails)──► [HTTP 403 Forbidden]
       │
       ▼
[authorize Middleware] ──(Fails)──► [HTTP 403 Forbidden]
       │
       ▼
[Route Controller]
       │
       ▼
[Service Logic Layer] ──(Throws AppError)──► [Global Error Handler]
       │                                              │
       ▼                                              ▼
[Repository DB Query]                         [Format HTTP JSON]
       │                                              │
       ▼                                              ▼
[Send JSON Response] ◄────────────────────────────────┘
```

---

## 16. Error Handling Strategy

The system implements a centralized error handling strategy:
*   **AppError Helper**: A custom error class extending `Error` to handle operational status codes and capture stack traces:
    ```javascript
    class AppError extends Error {
      constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
      }
    }
    ```
*   **Global Error Handler Middleware**: Caught errors are processed by the global error handler (`errorHandler.js`), which formats the response payload:
    ```javascript
    res.status(err.statusCode || 500).json({
      success: false,
      error: {
        message: err.message || 'Internal Server Error'
      }
    });
    ```
*   **Database Error Mapping**: System-level errors (such as duplicate key constraint violations in PostgreSQL or validation failures in Mongoose) are caught and mapped to user-friendly error messages before being returned to the client.

---

## 17. Current Academic Scope

WelfareSync Engine is currently configured for a localized academic deployment:
*   **Single Node Deployment**: The application runs on a single node without load balancing.
*   **Single PostgreSQL Instance**: Uses a single database node without read replicas.
*   **Single MongoDB Instance**: Operates on a single node without replica sets.
*   **Redis Pub/Sub**: Event processing uses the standard Pub/Sub transport, meaning messages are not persisted.
*   **Manual API Testing**: Verification is conducted using Postman collections and unit test suites.
*   **Infrastructure Exclusions**: Does not use Kubernetes, CI/CD pipelines, or WebSocket notifications.

---

## 18. Future Production Enhancements

To prepare the platform for production, several upgrades are planned:
*   **Docker Compose**: Multi-container orchestration configurations for local development and testing.
*   **Kubernetes**: Deploying stateless API containers and database pods across clusters.
*   **Redis Streams / Kafka**: Replacing Redis Pub/Sub with persistent brokers to support consumer offset tracking and queue durability.
*   **Email & SMS Gateways**: Integrating external services (e.g., SendGrid, Twilio) to deliver critical notifications to guardians and caretakers.
*   **WebSocket Dashboard Updates**: Adding real-time bi-directional messaging to push wellness index changes directly to client dashboards.
*   **Multi-Region Deployment**: Setting up active-passive database replication across geographically distributed nodes.
*   **Nginx API Gateway**: Implementing reverse proxies for rate limiting, SSL termination, and static asset caching.
*   **CI/CD Pipeline & Observability**: Automating deployment workflows (e.g., GitHub Actions) and integrating monitoring tools (e.g., Prometheus, Grafana) to track system performance.

---

## 19. Conclusion

This Low Level Design defines the concrete implementation specifications for the **WelfareSync Engine**. By defining clear routes, isolating tenant scopes, and separating heavy database operations from the API request lifecycle, the system meets the performance, security, and structural requirements defined in the SRS and HLD. This document serves as the final technical reference for the development and verification of the platform.
