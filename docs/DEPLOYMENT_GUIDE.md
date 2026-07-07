# Deployment Guide Specification
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
This deployment guide provides a step-by-step technical walkthrough for setting up and deploying the **WelfareSync Engine**. WelfareSync is a hybrid-database, multi-tenant Resident Welfare Analytics and Monitoring System. The application utilizes Node.js and Express.js, using PostgreSQL for structured metadata, configuration, and index summaries, MongoDB for high-write telemetry logs, and Redis for Pub/Sub messaging and event processing.

### 1.1 Hybrid Database Purpose
WelfareSync leverages a Hybrid Database Architecture, combining SQL, NoSQL, and in-memory cache/broker solutions to achieve secure multi-tenancy, high write throughput, and event-driven telemetry analysis:
*   **PostgreSQL**:
    *   Structured relational data
    *   Tenants
    *   Users
    *   Residents
    *   Analytics
    *   Notifications
*   **MongoDB**:
    *   Timeline-oriented care logs
    *   Flexible schemas
    *   High write throughput
*   **Redis**:
    *   Event-driven processing
    *   Pub/Sub messaging
    *   Analytics worker triggers

#### Benefits of the Hybrid Database Architecture
By using a hybrid model, WelfareSync inherits the specific strengths of each database engine rather than compromising with a single general-purpose database:
1.  **Strict Relational Consistency and Security**: PostgreSQL enforces relational referential integrity, unique index constraints, and transaction isolation levels across tenants, users, and core profile configurations.
2.  **Flexible Schema Telemetry Storage**: Care logs have varying dynamic metrics (e.g. blood pressure, glucose, nutritional logs, physical activity milestones) which are naturally modeled as schema-less JSON documents in MongoDB without schema migration overhead.
3.  **High Write Scalability**: Appending high-frequency care log writes directly to MongoDB avoids locking critical tables in PostgreSQL, preventing lock contention and ensuring constant database responsiveness.
4.  **Decoupled Async Event Processing**: Offloading calculated index computations from the synchronous request-response flow to a Redis-backed Pub/Sub queue reduces client latency and enables the analytics engine to compute resident indices asynchronously.

This document is structured to serve as an engineering guide for local verification, academic evaluation, and viva defense reviews.


---

## 2. Deployment Objectives
The primary deployment objectives for the WelfareSync Engine are:
1.  **Reliability**: Ensure clean, ordered startup dependencies where databases initialize and bind before the application accepts incoming requests.
2.  **Logical Isolation**: Guarantee that environment variables, secrets, and database credentials are separated and secured.
3.  **Validation**: Verify that the dual-database setup (SQL + NoSQL) and the event pipeline are functioning.
4.  **Security**: Enforce tenant boundary checks and secure JWT bearer configurations.

---

## 3. System Requirements
The minimal and recommended system specifications for deploying the WelfareSync Engine locally are:

*   **Minimum Specification**:
    *   **CPU**: Dual-core x86_64 Processor (Intel Core i3 or AMD Ryzen 3 equivalent).
    *   **RAM**: 4 GB System Memory.
    *   **Disk Space**: 10 GB of free storage.
*   **Recommended Specification**:
    *   **CPU**: Quad-core Processor (Intel Core i5 / AMD Ryzen 5 or higher).
    *   **RAM**: 8 GB System Memory (to support concurrent database services and docker containers).
    *   **Disk Space**: 20 GB of free SSD storage.

---

## 4. Software Prerequisites
Ensure the following software packages are installed on the local system:

*   **Node.js**: v18.0.0 (LTS) or higher.
*   **PostgreSQL**: v14.0 or higher.
*   **MongoDB**: v6.0 or higher (Community Edition).
*   **Docker Desktop**: Required to execute the Redis message broker container.
*   **Git**: v2.30 or higher (for codebase repository management).

---

## 5. Project Structure Overview
The primary configuration and startup assets within the codebase are structured as follows:
```
WelfareSync/
├── docs/                      # Suite of system architecture documents
├── src/
│   ├── server.js              # System entry point
│   ├── config/                # Database connections configuration
│   │   ├── postgres.js        # PostgreSQL pool configuration
│   │   ├── mongo.js           # Mongoose driver binding
│   │   └── redis.js           # Redis client configurations
│   ├── middleware/            # Auth and tenant validations
│   ├── modules/               # Domain-specific routes, controllers, and schemas
│   └── workers/               # Telemetry background event processors
├── .env                       # Environment configuration file
├── package.json               # Package dependency configuration
└── package-lock.json          # Dependency lock specifications
```

---

## 6. Environment Variable Configuration
WelfareSync manages its configuration variables inside a `.env` file located in the root directory. Modify these parameters to match your local setup:

| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `PORT` | The Express HTTP server port binding | `5000` |
| `POSTGRES_HOST` | Relational database server host | `localhost` |
| `POSTGRES_PORT` | Relational database server port | `5432` |
| `POSTGRES_DB` | PostgreSQL target database name | `Welfaresync` |
| `POSTGRES_USER` | Relational database administrator user | `postgres` |
| `POSTGRES_PASSWORD` | PostgreSQL database user password | `<your_database_password>` |
| `MONGO_URI` | MongoDB connection URI string | `mongodb://localhost:27017/welfaresync` |
| `REDIS_URL` | Redis connection URL string | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | Secret key used to sign JWT Access Tokens | `super_secret_access_key` |
| `JWT_REFRESH_SECRET`| Secret key used to sign JWT Refresh Tokens| `super_secret_refresh_key`|

---

## 7. PostgreSQL Setup
PostgreSQL handles tenant schemas, user records, refresh session hashes, physical institution configurations, active resident profiles, calculated analytics index summaries, and warning notifications.

1.  **Start PostgreSQL Service**:
    *   On Windows, open PowerShell as Administrator and execute:
        ```powershell
        net start postgresql-x64-15
        ```
        *(Note: Replace `15` with the installed version number of PostgreSQL, or start it via `services.msc`).*
2.  **Create the Application Database**:
    *   Connect to the default PostgreSQL administrative console using command-line:
        ```bash
        psql -U postgres
        ```
    *   Create the database specified in `.env`:
        ```sql
        CREATE DATABASE "Welfaresync";
        ```
    *   Verify the database is created:
        ```sql
        \l
        ```
    *   Exit the client console:
        ```sql
        \q
        ```

---

## 8. MongoDB Setup
MongoDB serves as the append-only telemetry repository storing residents' care event documents (`care_logs`).

1.  **Start MongoDB Daemon Service**:
    *   On Windows, run PowerShell as Administrator and execute:
        ```powershell
        net start MongoDB
        ```
2.  **Verify DB Status**:
    *   To verify that MongoDB is running on port `27017`, execute:
        ```bash
        mongosh --eval "db.runCommand({ connectionStatus: 1 })"
        ```
    *   The console should return a successful authentication status object:
        ```json
        { "authInfo": { "readOnly": false } }
        ```

---

## 9. Redis Setup
Redis operates as the real-time event broker processing telemetry signals asynchronously.

1.  **Launch the Redis Container**:
    *   **Initial container creation**: To download and start the Redis v7 broker for the first time, execute the following Docker run command:
        ```bash
        docker run --name welfaresync-redis -p 6379:6379 -d redis:7
        ```
    *   **Subsequent startup**: After the initial container is created, the system stores its configuration. For normal daily development workflows, restart the existing container using:
        ```bash
        docker start welfaresync-redis
        ```
2.  **Verify Container Runtime State**:
    *   List active containers to confirm Redis is running:
        ```bash
        docker ps -f name=welfaresync-redis
        ```
3.  **Ping Redis Broker**:
    *   Verify connectivity using the Redis CLI tool inside the running container:
        ```bash
        docker exec -it welfaresync-redis redis-cli ping
        ```
    *   Expected Broker Response:
        ```
        PONG
        ```

---

## 10. Node.js Application Setup
1.  **Navigate to Code Directory**:
    *   Open terminal and navigate to the project directory:
        ```bash
        cd WelfareSync
        ```
2.  **Create Configuration File**:
    *   Create a `.env` file in the root folder using the template parameters defined in Section 6.

---

## 11. Dependency Installation
Install Node.js packages and libraries compiled in `package.json`:

1.  **Execute Package Installation**:
    ```bash
    npm install
    ```
2.  **Verify Local Module Integrity**:
    Ensure the installation completes without errors and lists key dependencies (`pg`, `mongoose`, `redis`, `jsonwebtoken`, `bcrypt`, `helmet`, `express`).

---

## 12. Database Initialization Process
WelfareSync automates schema creation on server startup.
1.  **PostgreSQL Tables Generation**:
    When the server boots, connection pools are initiated. The application checks for the existence of relational tables and executes DDL creation scripts in sequence:
    *   `tenants` → `users` → `refresh_tokens` → `institutions` → `residents` → `resident_analytics` → `notifications`.
2.  **MongoDB Lazy Creation**:
    The Mongoose driver initiates connectivity to the `care_logs` database. Collections and matching indexes are generated dynamically when the first care log event is posted.

---

## 13. Redis Event Pipeline Verification
The event system processes logs asynchronously:
```
[Express Client] 
     ↓ POST /logs
[MongoDB Care Logs Collection] (Sync Write)
     ↓ Event Dispatch
[Redis Publisher] 
     ↓ Publish Channel "care-log-created"
[Redis Subscriber] 
     ↓ Trigger Event Handler
[Analytics Worker] (Async Calculation)
     ↓ Re-evaluate Welfare Score 
[PostgreSQL resident_analytics Table] (Update Score)
     ↓ Drop Below 50 Threshold?
[PostgreSQL notifications Table] (Insert System Warning)
```

---

## 14. Application Startup Procedure
Run the following steps to start the application:

1.  **Start Server in Development Mode**:
    Execute the startup script in the workspace root directory:
    ```bash
    npm run dev
    ```
2.  **Verify Console Connection Outputs**:
    The console will output status logs as components initialize:
    ```
    MongoDB connected
    Redis publisher client connected
    Redis subscriber client connected
    Subscribed to Redis channel: care-log-created
    WelfareSync Engine listening on port 5000
    ```

---

## 15. Postman API Verification
To verify the application end-to-end using Postman:

1.  **Import Collection**: Load the Postman collection located at `docs/postman/welfaresync_collection.json`.
2.  **Step 1: Onboard Tenant & Admin**:
    *   Submit a `POST` request to `/api/v1/auth/tenants`. This registers the tenant and returns access and refresh JWT tokens.
3.  **Step 2: Authenticate**:
    *   Submit a `POST` request to `/api/v1/auth/login`. Verify that tokens are returned. Set the returned `accessToken` as a Bearer token in the headers for subsequent requests.
4.  **Step 3: Register Resident**:
    *   Submit a `POST` request to `/api/v1/residents` with custom weights. Retrieve the created resident's `id`.
5.  **Step 4: Create Care Log**:
    *   Submit a `POST` request to `/api/v1/logs` detailing vitals or medication metrics. Verify that a `201 Created` status is returned.
6.  **Step 5: Verify Dashboard Update**:
    *   Submit a `GET` request to `/api/v1/dashboard/overview`. Verify that counts and average welfare indexes are updated.

---

## 16. Multi-Tenant Deployment Considerations
To prevent cross-tenant data leaks, verify that:
*   Every request header includes `X-Tenant-ID`.
*   The `tenantValidation` middleware intercepts requests to verify that the `X-Tenant-ID` header matches the `tenantId` claim stored within the decoded JWT access token. If a tenant ID mismatch occurs, the server responds with a `403 Forbidden` error.

---

## 17. Security Configuration

*   **JWT Secrets**: Use a cryptographically strong, random string (e.g., 256-bit entropy) for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in production environments. Never commit these keys to version control.
*   **Database Credentials**: Exclude plain-text passwords from configuration files. Securely store them within environment variables.
*   **Tenant Isolation**: Ensure all SQL operations include a `WHERE tenant_id = $1` filter clause. Similarly, MongoDB logs must filter on the `tenantId` property.
*   **Environment Variable Protection**: Maintain the root `.gitignore` file to ensure the `.env` configuration file is excluded from repository commits:
    ```
    # Dependency folders
    node_modules/

    # Local configuration
    .env
    ```

---

## 18. Deployment Verification Checklist

Use the following checklist to verify a successful deployment:

1.  **[ ] PostgreSQL connectivity**: Verify Postgres connection pool status by confirming that the application boots completely without any database initialization error logs.
2.  **[ ] MongoDB connectivity**: Ensure connection status is active by querying:
    ```bash
    mongosh --eval "db.stats()"
    ```
3.  **[ ] Redis container status**: Confirm the Redis container is running:
    ```bash
    docker inspect -f '{{.State.Status}}' welfaresync-redis
    ```
    *Expected output:* `running`.
4.  **[ ] Redis Pub/Sub connectivity**: Verify that the subscriber worker is listening by checking the console logs for the subscription confirmation message.
5.  **[ ] Node.js application startup**: Verify that the application is running and bound to the configured port:
    ```bash
    curl -I http://localhost:5000/api/v1/health
    ```
    *Expected output:* `HTTP/1.1 200 OK`.
6.  **[ ] Authentication API verification**: Verify authentication by submitting a `POST` request to `/api/v1/auth/login` and confirming that the response returns valid `accessToken` and `refreshToken` properties.
7.  **[ ] Care Log creation verification**: Submit a care log and verify its database insertion:
    ```bash
    mongosh welfaresync --eval "db.care_logs.find().sort({createdAt: -1}).limit(1)"
    ```
8.  **[ ] Analytics Worker execution verification**: Check the console output of the worker to confirm that the `care-log-created` event was processed successfully.
9.  **[ ] Notification generation verification**: Query PostgreSQL to verify that a notification alert is created when the welfare index drops below 50:
    ```sql
    SELECT * FROM notifications ORDER BY created_at DESC LIMIT 1;
    ```
10. **[ ] Dashboard API verification**: Verify that aggregate statistics are generated correctly by submitting a `GET` request to `/api/v1/dashboard/overview`.

---

## 19. Troubleshooting Guide

*   **Port Collision Errors (EADDRINUSE)**:
    *   *Cause*: Another service is using port `5000`, `5432`, `27017`, or `6379`.
    *   *Solution*: Identify the process using the port and terminate it:
        ```powershell
        netstat -ano | findstr :5000
        taskkill /PID <PID> /F
        ```
        Or change the `PORT` variable in the `.env` file to an unused port.
*   **Database Connection Failures (ECONNREFUSED)**:
    *   *Cause*: PostgreSQL or MongoDB service is stopped.
    *   *Solution*: Verify service states using Windows services console or systemctl tools, and start them if necessary.
*   **Authentication Validation Failures (403 Forbidden)**:
    *   *Cause*: The `X-Tenant-ID` header is missing, or it does not match the tenant ID claim inside the JWT token.
    *   *Solution*: Ensure the request headers include a valid `X-Tenant-ID` that matches the authenticated user's tenant ID.

---

## 20. Current Academic Scope
The current system deployment configuration is tailored for academic evaluation and validation:
*   **Local Setup**: Runs on a single local development machine.
*   **Databases**: Runs single, local instances of PostgreSQL and MongoDB.
*   **Event Broker**: Runs a single Redis Docker container.
*   **Orchestration**: Started manually using the command-line interface, which simplifies environment validation and debugging during academic viva reviews.

---

## 21. Future Production Enhancements
To scale WelfareSync for production environments, consider the following enhancements:

1.  **Docker Compose Orchestration**:
    Automate multi-container setups by defining a `docker-compose.yml` file to manage configuration, volumes, and startup sequences for the application server, PostgreSQL, MongoDB, and Redis.
2.  **Nginx API Gateway**:
    Configure Nginx to handle rate limiting, SSL/TLS termination, and reverse proxy routing before traffic reaches the Express.js application server.
3.  **CI/CD Pipeline Integration**:
    Establish automated testing and deployment workflows using platforms like GitHub Actions or GitLab CI to run test suites and deploy verified builds automatically.
4.  **Kubernetes Orchestration**:
    Containerize services into pods, and manage replication, auto-scaling, and health checks across a Kubernetes cluster.
5.  **Centralized Monitoring & Logging**:
    Integrate monitoring tools (Prometheus and Grafana) and logging stacks (Elasticsearch, Logstash, and Kibana) to collect metrics and centralize error logs.
6.  **Multi-Region Deployment**:
    Deploy instances across multiple geographic regions with synchronized databases to minimize latency and ensure high availability.

---

## 22. Conclusion
The WelfareSync Engine is designed for reliable and secure multi-tenant operation. By following the startup sequence (PostgreSQL → MongoDB → Redis → Node.js Application) and completing the deployment verification checklist, you can deploy a verified local instance of the system suitable for academic defense and evaluation.
