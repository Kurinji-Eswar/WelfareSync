# Project Structure Guide
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

## 1. Project Overview
The **WelfareSync Engine** codebase is built using Node.js and Express.js, adopting a modular, service-oriented structure. The business logic is organized into self-contained feature directories under `src/modules/`, ensuring a clean separation of concerns and scaling paths.

---

## 2. Complete Folder Tree

```
WelfareSync/
├── docs/
│   ├── postman/
│   │   └── WelfareSync.postman_collection.json
│   ├── API_DOCUMENTATION.md
│   ├── ARCHITECTURE_REPORT.md
│   ├── DATABASE_DESIGN.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── FINAL_PROJECT_REPORT.md
│   ├── HLD.md
│   ├── LLD.md
│   ├── POSTMAN_COLLECTION.md
│   ├── PROJECT_STRUCTURE.md
│   ├── SRS.md
│   ├── TESTING_REPORT.md
│   └── VIVA_PREPARATION.md
├── src/
│   ├── config/
│   │   ├── mongodb.js
│   │   ├── postgres.js
│   │   └── redis.js
│   ├── constants/
│   │   └── roles.js
│   ├── events/
│   │   ├── publishers/
│   │   │   └── careLogPublisher.js
│   │   └── subscribers/
│   │       └── analyticsSubscriber.js
│   ├── middleware/
│   │   ├── authenticate.js
│   │   ├── authorize.js
│   │   ├── errorHandler.js
│   │   └── tenantValidation.js
│   ├── modules/
│   │   ├── analytics/
│   │   │   ├── controller.js
│   │   │   ├── repository.js
│   │   │   ├── routes.js
│   │   │   └── service.js
│   │   ├── auth/
│   │   │   ├── controller.js
│   │   │   ├── repository.js
│   │   │   ├── routes.js
│   │   │   └── service.js
│   │   ├── dashboard/
│   │   │   ├── controller.js
│   │   │   ├── repository.js
│   │   │   ├── routes.js
│   │   │   └── service.js
│   │   ├── institutions/
│   │   │   ├── controller.js
│   │   │   ├── repository.js
│   │   │   ├── routes.js
│   │   │   └── service.js
│   │   ├── logs/
│   │   │   ├── models/
│   │   │   │   └── CareLog.js
│   │   │   ├── controller.js
│   │   │   ├── repository.js
│   │   │   ├── routes.js
│   │   │   └── service.js
│   │   ├── notifications/
│   │   │   ├── controller.js
│   │   │   ├── repository.js
│   │   │   ├── routes.js
│   │   │   └── service.js
│   │   └── residents/
│   │       ├── controller.js
│   │       ├── repository.js
│   │       ├── routes.js
│   │       └── service.js
│   ├── routes/
│   │   └── index.js
│   ├── utils/
│   │   ├── AppError.js
│   │   └── asyncHandler.js
│   ├── workers/
│   │   └── analyticsWorker.js
│   └── server.js
├── .env
├── .gitignore
├── LICENSE
├── package.json
├── package-lock.json
└── README.md
```

---

## 3. Structural Layers Detailed Breakdown

### 3.1 Configuration Layer (`src/config/`)
Handles database initializations and connection client pooling:
*   `postgres.js`: Creates the native `pg` client connection pool, exposing SQL query runners.
*   `mongodb.js`: Establishes connections to MongoDB using the Mongoose client library.
*   `redis.js`: Connects to Redis and exports publisher/subscriber client instances.

### 3.2 Middleware Layer (`src/middleware/`)
Intercepts HTTP requests to enforce validation policies:
*   `authenticate.js`: Extracts and decodes JWT access credentials, setting `req.auth`.
*   `tenantValidation.js`: Enforces multi-tenancy logical isolation, verifying the request header `X-Tenant-ID` matches the user's token context `req.auth.tenantId`.
*   `authorize.js`: Enforces Role-Based Access Control (RBAC) checking allowed role lists against `req.auth.role`.
*   `errorHandler.js`: Intercepts operational database and application errors, outputting a standardized JSON envelope.

### 3.3 Modules Layer (`src/modules/`)
Features are encapsulated within self-contained directories. Each module contains:
*   `routes.js`: Express router mapping endpoints to authorized policies and controllers.
*   `controller.js`: Handles HTTP payloads, extract queries/parameters, and directs commands to service layers.
*   `service.js`: Houses business logic (validations, calculations, event dispatches).
*   `repository.js`: Encapsulates database execution (native SQL parameterized executions, Mongoose models queries).

### 3.4 Routing Layer (`src/routes/`)
*   `index.js`: Exposes `/api/v1` routes, routing sub-routes to respective logic module files, and containing the `/health` API status checker.

### 3.5 Worker Layer (`src/workers/`)
*   `analyticsWorker.js`: Asynchronous background processor triggered by the Redis subscriber, compiling category scores and weighted Welfare Index values.

### 3.6 Event Messaging Layer (`src/events/`)
Decouples computational execution:
*   `publishers/careLogPublisher.js`: Dispatches JSON event metadata payloads to Redis.
*   `subscribers/analyticsSubscriber.js`: Listens to the `care-log-created` channel and routes tasks to background workers.

---

## 4. Code Flow Mappings

### 4.1 Synchronous HTTP Request Flow
Enforces request processing layers:
```
Client Request (HTTP GET /dashboard/overview)
     ↓
Express Router (src/routes/index.js)
     ↓
JWT Authentication Middleware (src/middleware/authenticate.js)
     ↓
Tenant Validation Middleware (src/middleware/tenantValidation.js)
     ↓
Role Authorization Middleware (src/middleware/authorize.js)
     ↓
Dashboard Controller (src/modules/dashboard/controller.js)
     ↓
Dashboard Service (src/modules/dashboard/service.js)
     ↓
Dashboard Repository (src/modules/dashboard/repository.js)
     ↓
PostgreSQL Database (Native SQL Parameterized Queries)
     ↓
JSON Response Payload (HTTP 200 OK)
```

### 4.2 Asynchronous Event Pipeline Flow
Decoupled computations triggered by caretaker logs entries:
```
Caretaker POST /logs
     ↓
Logs Controller saves record in MongoDB collection 'care_logs'
     ↓
Logs Service publishes metadata to Redis channel 'care-log-created'
     ↓
API returns HTTP 201 Created to Caretaker Client (Decoupled API loop ends)
     ↓
Redis Subscriber intercepts event message
     ↓
Analytics Worker fetches past 1000 logs for the resident from MongoDB
     ↓
Analytics Worker calculates decay scoring averages and weighted Welfare Index
     ↓
Analytics Worker upserts pre-calculated scores in SQL 'resident_analytics' table
     ↓ (If Welfare Index < 50)
Notification Service writes WARNING alert record into SQL 'notifications' table
```

### 4.3 Security Validation Flow
Defines the multi-layered security checking pipeline:
```
Client API Request
     ↓
JWT Token Signature Checked (Authenticate)
     ↓
X-Tenant-ID Header compared with token.tenantId (Tenant Isolation Check)
     ↓
Check User Role in JWT claims matches API permissions (RBAC check)
     ↓
SQL Parameterized Query / NoSQL Payload check (Injection Prevention)
     ↓
Access Granted / Controller Logic Executed
```

---

## 5. Architectural Component Mapping

To understand how the folder structures map to system architectural roles:
1.  **Administrative Metadata Register**: Mapped to PostgreSQL repositories (`src/modules/auth/`, `src/modules/residents/`, `src/modules/institutions/`).
2.  **Telemetry Care Logs Timeline**: Mapped to MongoDB models and repositories (`src/modules/logs/`).
3.  **Event Ingestion Queue**: Mapped to Redis publisher/subscriber pipelines (`src/events/`).
4.  **Analytics Computation Processor**: Mapped to background workers (`src/workers/`).
5.  **Analytics metrics Cache**: Mapped to PostgreSQL repositories (`src/modules/analytics/`).
6.  **Unread alerts warning logs**: Mapped to PostgreSQL repositories (`src/modules/notifications/`).
7.  **Low Latency dashboard overview metrics compiles**: Mapped to PostgreSQL repositories (`src/modules/dashboard/`).
