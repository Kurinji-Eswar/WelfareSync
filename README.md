# WelfareSync Engine
## Scalable Multi-Tenant Resident Welfare Analytics & Monitoring System

---

## Project Status

*   **Status**: Completed
*   **Academic Year**: 2025–2026
*   **Documentation**:
    *   [docs/SRS.md](docs/SRS.md)
    *   [docs/HLD.md](docs/HLD.md)
    *   [docs/LLD.md](docs/LLD.md)
    *   [docs/DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md)
    *   [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)
    *   [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)
    *   [docs/TESTING_REPORT.md](docs/TESTING_REPORT.md)
    *   [docs/ARCHITECTURE_REPORT.md](docs/ARCHITECTURE_REPORT.md)
    *   [docs/FINAL_PROJECT_REPORT.md](docs/FINAL_PROJECT_REPORT.md)
    *   [docs/VIVA_PREPARATION.md](docs/VIVA_PREPARATION.md)
*   **Implementation Stacks**:
    *   PostgreSQL
    *   MongoDB
    *   Redis
    *   Node.js
    *   Express.js

---

## Author
*   **Author Name**: Kurinji Eswar J A
*   **Degree**: Bachelor of Computer Applications
*   **Academic Project**: Academic Year 2025–2026

---

## Project Description
The **WelfareSync Engine** is a backend service designed to automate resident welfare monitoring in elderly homes, care homes, shelters, and rehabilitation centers. It processes health telemetry logs asynchronously, updates resident well-being scores, registers automated alert warnings, and aggregates metrics across multiple isolated care organizations using a single system instance.

---

## Problem Statement
In care facilities, tracking resident health indicators involves processing large amounts of diverse data (e.g., blood pressure, diet volumes, medication adherence). Traditional architectures encounter performance bottlenecks:
*   **Manual Records**: Error-prone and lack real-time risk identification.
*   **SQL Schema Migrations**: Rigid relational structures make modifications to dynamic telemetry formats complex.
*   **Read/Write Resource Bottlenecks**: Running calculations over millions of raw log entries blocks database reads and slows API response times.
*   **Data Isolation Risks**: Multi-tenant systems must enforce logical boundaries to prevent organizations from accessing each other's resident records.

---

## Key Features
*   **Multi-Tenant Architecture**: Shared-database, shared-schema configuration logic isolates data using verification checks.
*   **Tenant Isolation Middleware**: Validates incoming request headers (`X-Tenant-ID`) against signed token credentials.
*   **Dynamic Care Logging**: Schema-flexible timelines in MongoDB ingest dynamic medication, nutrition, activity, and vitals records.
*   **Redis Event Pipeline**: Decouples computations using Redis Pub/Sub, keeping API write response times low.
*   **Analytics Recalculator**: Implements time-decay algorithms and resident-specific weight configurations.
*   **Notification Engine**: Automatically logs warnings in PostgreSQL when resident welfare indexes drop below 50.
*   **Aggregated Overview Dashboard**: Compiles facility metrics from pre-calculated SQL tables to ensure low latency.

---

## System Architecture

The engine uses a decoupled event-driven data flow to route client inputs to databases:

```
Caretaker Client
      ↓
REST API Gateway (Auth & Tenant Validation)
      ↓
WelfareSync Engine (Express Server)
      ↓ (Save Log Document)
MongoDB (care_logs Collection)
      ↓ (Confirm Write & Publish Event)
Redis Pub/Sub (Channel: 'care-log-created')
      ↓ (Broadcast Event)
Analytics Subscriber
      ↓ (Trigger recency scoring)
Analytics Worker
      ↓ (Read past 1000 documents)
MongoDB
      ↓ (Calculate Welfare Index)
PostgreSQL (Upsert metrics to resident_analytics)
      ↓ (If Welfare Index < 50)
Notification Service (Insert to notifications table)
      ↓ (Read Pre-Calculated Caches)
Guardian Dashboard / Overview API
```

---

## Hybrid Database Architecture

WelfareSync implements a hybrid database layout to manage the dual demands of transactional safety and telemetry ingestion:

### 1. PostgreSQL (ACID Metadata)
*   **Used For**: Organizational tenants, user credentials, refresh tokens, active institutions, resident demographic profiles, pre-calculated score indices, and alert logs.
*   **Selected Because**: Provides reliable ACID compliance, referential integrity, and cascading deletions to keep child records clean when parent records are removed.

### 2. MongoDB (Timeline Data Store)
*   **Used For**: Daily caretaker logs and health telemetry events.
*   **Selected Because**: Provides schema flexibility (accommodating medication, nutrition, vitals, and activity records in a single collection) and document-oriented write speed.

### 3. Redis (In-Memory Broker)
*   **Used For**: Routing event notifications via the `care-log-created` channel.
*   **Selected Because**: Provides low-latency, in-memory Pub/Sub messaging to decouple computational calculations from the main HTTP API thread.

---

## Redis Event Pipeline

The event pipeline processes health records asynchronously:
1.  **POST /logs**: Caretakers post a health record to the API.
2.  **MongoDB Write**: The Express controller saves the care log document to MongoDB.
3.  **Redis Publish**: The controller publishes the log metadata to the `care-log-created` channel and returns a success response.
4.  **Analytics Worker**: The subscriber receives the message and triggers the background worker.
5.  **Score Recalculation**: The worker fetches up to 1000 historical logs for the resident, recalculates category scores, and updates the `resident_analytics` PostgreSQL table.
6.  **Alert Trigger**: If the computed Welfare Index is $< 50$, the worker inserts a warning into the PostgreSQL `notifications` table.

---

## Technology Stack
*   **Backend framework**: Node.js, Express.js
*   **Databases**: PostgreSQL (SQL-native), MongoDB (NoSQL document store)
*   **Message Broker**: Redis Pub/Sub
*   **Database Drivers**: pg (node-postgres), Mongoose
*   **Authentication & Security**: JWT with token version tracking, bcrypt hashing, Helmet hardening, CORS, and NoSQL/SQL parameterized input validation.

---

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```ini
# App Server configurations
PORT=5000
NODE_ENV=development

# PostgreSQL Connection Credentials
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=welfaresync_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<your_database_password>
PGPOOL_MAX=10

# MongoDB Connection String
MONGODB_URI=mongodb://127.0.0.1:27017/welfaresync_mongo

# Redis Connection Setup
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Authorization Credentials
JWT_SECRET=super_secret_jwt_signature_hash_phrase
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 3. Running the Project

#### Database Services Setup
*   Ensure PostgreSQL and MongoDB services are running locally on their default ports.
*   Run the Redis container:
    ```bash
    docker run -d --name redis-welfaresync -p 6379:6379 redis:alpine
    ```

#### Start Server
```bash
npm run dev
```

---

## Repository Structure

The project directory is structured as follows:
*   `src/config/`: Configuration layer establishing native PostgreSQL client pools, MongoDB Mongoose clients, and Redis broker connections.
*   `src/middleware/`: Express middleware pipelines handling JWT decoding (`authenticate`), logical multi-tenancy verification (`tenantValidation`), and privilege checks (`authorize`).
*   `src/modules/`: Modular business logic folders split by domains (e.g. `auth`, `residents`, `logs`, `dashboard`). Each module encapsulates its respective Express router, controllers handlers, service logic, and repositories.
*   `src/routes/`: Main router mapping prefix paths and hosting the `/health` API.
*   `src/workers/`: Background computational workers recalculating scores.
*   `src/events/`: Event Pub/Sub logic containing Redis publishers and subscribers.
*   `docs/`: Verification suite and comprehensive technical specifications documentation.
*   `README.md`: Root project guide.
*   `LICENSE`: MIT project license.
*   `.env`: Local environment properties configuration keys template.

---

## Documentation Index

All technical files are stored in the `/docs` directory:
1.  **[docs/SRS.md](docs/SRS.md)**: Software Requirements Specification.
2.  **[docs/HLD.md](docs/HLD.md)**: High-Level Design.
3.  **[docs/LLD.md](docs/LLD.md)**: Low-Level Design.
4.  **[docs/DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md)**: Database Schemas and Index Designs.
5.  **[docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)**: REST Endpoints JSON Payloads.
6.  **[docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)**: Local Startup Guide.
7.  **[docs/TESTING_REPORT.md](docs/TESTING_REPORT.md)**: Manual Test Cases and Traces.
8.  **[docs/ARCHITECTURE_REPORT.md](docs/ARCHITECTURE_REPORT.md)**: Architecture Decision Records (ADRs).
9.  **[docs/FINAL_PROJECT_REPORT.md](docs/FINAL_PROJECT_REPORT.md)**: Full Academic Thesis Report.
10. **[docs/VIVA_PREPARATION.md](docs/VIVA_PREPARATION.md)**: Examiner Questions and Answers.
11. **[docs/POSTMAN_COLLECTION.md](docs/POSTMAN_COLLECTION.md)**: Postman collection configurations.
12. **[docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)**: Project folder architecture.

---

## System Boundaries

### Current Academic Scope
*   **Single-Node Operations**: Express applications and background workers run as local Node.js processes.
*   **Local Databases**: Relational and document databases run on standalone local instances.
*   **In-Memory Event Brokers**: Redis Pub/Sub does not persist messages.
*   **Manual Validation**: Test cases are executed using manual testing configurations and Postman collections.

### Future Production Enhancements
*   **Container Orchestration**: Deploying system components using Docker Compose and Kubernetes.
*   **Message Broker Upgrades**: Transitioning Redis Pub/Sub to Redis Streams or Apache Kafka to provide persistent event logging.
*   **Real-Time Alerts**: Integrating WebSockets to push warning alerts to client dashboards in real-time.
*   **External Integrations**: Connecting external notification services (such as Twilio and SendGrid) to send SMS and email alerts directly to guardians.
*   **Observability**: Adding Prometheus monitoring and Grafana metrics dashboards.

---

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.