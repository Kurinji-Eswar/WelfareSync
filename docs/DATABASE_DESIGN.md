# Database Design Document
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
This Database Design Document provides a comprehensive technical specification of the data storage tier of the **WelfareSync Engine**. It details the hybrid database strategy, schema layouts, relationships, constraints, indexes, security parameters, and data flows required to build a multi-tenant resident monitoring backend.

### 1.2 System Context & References
The data storage tier maps directly to the modular boundaries defined in the system documentation:
*   *Software Requirements Specification (SRS)* - [docs/SRS.md](SRS.md)
*   *High Level Design (HLD)* - [docs/HLD.md](HLD.md)
*   *Low Level Design (LLD)* - [docs/LLD.md](LLD.md)

### 1.3 Technology Versions
*   **Relational Storage**: PostgreSQL $\ge 14$
*   **Document Storage**: MongoDB $\ge 6.0$
*   **In-Memory Message Broker**: Redis $\ge 6.2$

---

## 2. Hybrid Database Architecture Overview

The WelfareSync Engine implements a **Hybrid Database Architecture** by combining PostgreSQL, MongoDB, and Redis into a single cohesive storage tier. 

```
                                  +---------------------------+
                                  |    WelfareSync Backend    |
                                  +----+-------------+----+---+
                                       |             |    |
          +----------------------------+             |    +----------------------------+
          | Relational Transactions                  | Cache & Messaging                       | Document Streams
          v                                          v                                         v
+-----------------------------+          +-----------------------------+          +-----------------------------+
|         PostgreSQL          |          |            Redis            |          |           MongoDB           |
|       (ACID Metadata)       |          |      (Event Pipeline)       |          |      (Event Timeline)       |
+-----------------------------+          +-----------------------------+          +-----------------------------+
| - tenants, users,           |          | - care-log-created channel  |          | - care_logs collection      |
|   refresh_tokens            |          | - Publisher / Subscriber    |          | - Unstructured details      |
| - institutions, residents   |          | - Decoupled background task |          | - High-velocity write path  |
| - analytics, notifications  |          |   distribution              |          | - Timeline event sorting    |
+-----------------------------+          +-----------------------------+          +-----------------------------+
```

### 2.1 Storage Segregation Strategy
*   **PostgreSQL**: Serves as the relational engine, housing administrative entities requiring strict integrity, relational foreign key constraints, and transaction safety.
*   **MongoDB**: Serves as a dynamic event timeline store, managing caretakers' logging records which contain varying, unstructured payloads.
*   **Redis**: Serves as the asynchronous messaging pipeline, passing event payloads from write APIs to the analytics worker.

### 2.2 Benefits of Hybrid Database Architecture
1.  **Strict Transactional Safety**: High-integrity data (such as tenant onboarding, billing parameters, user credentials, and session tables) are protected by PostgreSQL's ACID transactional boundaries.
2.  **Telemetry Payload Flexibility**: Resident daily events (vitals, activities, medications, meals) vary in details (e.g., blood pressure checks vs. dietary quantities). MongoDB handles these schema differences within a single collection without requiring database migrations.
3.  **API Workload Isolation**: API endpoints accept and write Care Logs to MongoDB, broadcast a lightweight event to Redis, and resolve immediately. CPU-intensive analytical computations are processed asynchronously in the background.
4.  **Optimized Read Latency**: Dashboards serve aggregate stats and risk levels directly from pre-computed PostgreSQL tables in under 50ms, avoiding costly runtime aggregations across millions of raw Mongo log documents.

---

## 3. PostgreSQL Design Overview

PostgreSQL is configured as the transactional core of the WelfareSync Engine.
*   **Role**: Manages multi-tenant administrative profiles, authentication keys, institution registration records, resident configurations, pre-calculated score indices, and system alerts.
*   **ACID Guarantees**: Restricts administrative changes (such as creating a new tenant and matching Admin user) inside SQL transaction blocks (`BEGIN` ... `COMMIT`).
*   **Database Constraints**: Implements unique constraints, non-null assertions, foreign keys with cascaded deletes, and value boundaries to prevent data corruption.

---

## 4. MongoDB Design Overview

MongoDB functions as the write-heavy document repository.
*   **Role**: Stores unstructured care logs recorded by caretakers (medications, nutrition logs, vitals checks, activity diaries).
*   **Data Model**: Uses a single, horizontally partitionable collection (`care_logs`) with reference fields mapping back to PostgreSQL UUID values.
*   **Indexing Strategy**: Implements compound indices to optimize chronological fetches grouped by tenant and resident IDs.

---

## 5. Redis Design Overview

Redis acts as the low-latency message distribution layer.
*   **Role**: Transports lightweight event metadata from the HTTP Express controller thread to background analytics subscribers.
*   **Data Model**: Uses standard Redis Pub/Sub channels.
*   **Lifespan**: Message payloads are short-lived and parsed in-memory, minimizing Redis RAM footprint.

---

## 6. PostgreSQL Schema Design

### 6.1 Table: `tenants`
Stores independent institution tenants.
*   **Constraints**: `slug` must be unique and lowercase.
*   **Schema**:
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Unique tenant identifier. |
| `name` | `VARCHAR(180)` | `NOT NULL` | Legal name of the institution. |
| `slug` | `VARCHAR(120)` | `NOT NULL`, `UNIQUE` | Lowercase URL-friendly tenant slug. |
| `is_active` | `BOOLEAN` | `NOT NULL`, `DEFAULT TRUE` | Flags if the tenant is active. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Date of registration. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Date of last update. |

### 6.2 Table: `users`
Stores user authentication records.
*   **Constraints**: Compound unique constraint on `(tenant_id, LOWER(email))`.
*   **Schema**:
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Unique user identifier. |
| `tenant_id` | `UUID` | `NOT NULL`, `REFERENCES tenants(id) ON DELETE CASCADE` | Associated tenant ID. |
| `name` | `VARCHAR(120)` | `NOT NULL` | Full name of the user. |
| `email` | `VARCHAR(255)` | `NOT NULL` | Lowercase login email. |
| `password_hash`| `TEXT` | `NOT NULL` | Bcrypt hashed password. |
| `role` | `VARCHAR(50)` | `NOT NULL`, `CHECK (role IN ('ADMIN', 'CARETAKER', 'GUARDIAN'))`| User access role. |
| `status` | `VARCHAR(20)` | `NOT NULL`, `DEFAULT 'ACTIVE'`, `CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'))`| Account status. |
| `token_version`| `INTEGER` | `NOT NULL`, `DEFAULT 0` | Incremental counter for token revocation. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Date of registration. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Date of last update. |

### 6.3 Table: `refresh_tokens`
Tracks user sessions for token rotations.
*   **Schema**:
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Token record identifier. |
| `tenant_id` | `UUID` | `NOT NULL`, `REFERENCES tenants(id) ON DELETE CASCADE` | Associated tenant ID. |
| `user_id` | `UUID` | `NOT NULL`, `REFERENCES users(id) ON DELETE CASCADE` | Associated user ID. |
| `token_hash` | `TEXT` | `NOT NULL`, `UNIQUE` | SHA-256 hash of the refresh token string. |
| `token_version`| `INTEGER` | `NOT NULL` | Copied version claim from user profile. |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | Session expiry timestamp. |
| `revoked_at` | `TIMESTAMPTZ` | `NULL` | Timestamp when user logged out. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Token issuance date. |

### 6.4 Table: `institutions`
Registers physical facilities owned by a tenant.
*   **Constraints**: Compound unique constraint on `(tenant_id, darpan_id)`.
*   **Schema**:
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Unique institution identifier. |
| `tenant_id` | `UUID` | `NOT NULL`, `REFERENCES tenants(id) ON DELETE CASCADE` | Associated tenant ID. |
| `name` | `VARCHAR(180)` | `NOT NULL` | Name of the facility. |
| `darpan_id` | `VARCHAR(120)` | `NULL` | Government NGO Darpan Portal registry code. |
| `address` | `TEXT` | `NOT NULL` | Address details. |
| `contact_email`| `VARCHAR(255)` | `NOT NULL` | Contact email. |
| `contact_phone`| `VARCHAR(40)` | `NOT NULL` | Contact phone number. |
| `status` | `VARCHAR(30)` | `NOT NULL`, `DEFAULT 'ACTIVE'`, `CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED'))`| Status configuration. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Date created. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Last modified date. |

### 6.5 Table: `residents`
Tracks resident biodata and scoring parameters.
*   **Constraints**: Weights must be non-negative.
*   **Schema**:
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Unique resident identifier. |
| `tenant_id` | `UUID` | `NOT NULL`, `REFERENCES tenants(id) ON DELETE CASCADE` | Associated tenant ID. |
| `first_name` | `VARCHAR(120)` | `NOT NULL` | First name. |
| `last_name` | `VARCHAR(120)` | `NOT NULL` | Last name. |
| `gender` | `VARCHAR(30)` | `NOT NULL` | Gender. |
| `date_of_birth`| `DATE` | `NOT NULL` | Birth date. |
| `admission_date`| `DATE` | `NOT NULL` | Admission date. |
| `status` | `VARCHAR(30)` | `NOT NULL`, `DEFAULT 'ACTIVE'`, `CHECK (status IN ('ACTIVE', 'ARCHIVED'))` | Operational status. |
| `weight_medication`| `NUMERIC(8,3)`| `NOT NULL`, `DEFAULT 1`, `CHECK (weight_medication >= 0)` | Analytics weight for medication. |
| `weight_nutrition`| `NUMERIC(8,3)`| `NOT NULL`, `DEFAULT 1`, `CHECK (weight_nutrition >= 0)` | Analytics weight for nutrition. |
| `weight_vitals` | `NUMERIC(8,3)`| `NOT NULL`, `DEFAULT 1`, `CHECK (weight_vitals >= 0)` | Analytics weight for vitals. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Admission record creation date. |

### 6.6 Table: `resident_analytics`
Stores compiled sub-scores and overall welfare indexes.
*   **Constraints**: Compound unique constraint on `(tenant_id, resident_id)`. All scores must fall between 0 and 100.
*   **Schema**:
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Unique analytics identifier. |
| `tenant_id` | `UUID` | `NOT NULL`, `REFERENCES tenants(id) ON DELETE CASCADE` | Associated tenant ID. |
| `resident_id` | `UUID` | `NOT NULL`, `REFERENCES residents(id) ON DELETE CASCADE` | Associated resident ID. |
| `medication_score`| `NUMERIC(6,2)`| `NOT NULL`, `DEFAULT 0`, `CHECK (medication_score BETWEEN 0 AND 100)`| Calculated medication sub-score. |
| `nutrition_score` | `NUMERIC(6,2)`| `NOT NULL`, `DEFAULT 0`, `CHECK (nutrition_score BETWEEN 0 AND 100)` | Calculated nutrition sub-score. |
| `vitals_score` | `NUMERIC(6,2)`| `NOT NULL`, `DEFAULT 0`, `CHECK (vitals_score BETWEEN 0 AND 100)` | Calculated vitals sub-score. |
| `activity_score` | `NUMERIC(6,2)`| `NOT NULL`, `DEFAULT 0`, `CHECK (activity_score BETWEEN 0 AND 100)` | Calculated activity sub-score. |
| `welfare_index` | `NUMERIC(6,2)`| `NOT NULL`, `DEFAULT 0`, `CHECK (welfare_index BETWEEN 0 AND 100)`| Weighted welfare index ($WI$). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Initial score generation date. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Date of last update. |

> [!NOTE]
> The `activity_score` is computed and saved in this table for comprehensive behavioral monitoring. However, it is excluded from the weighted `welfare_index` ($WI$) calculation because the `residents` table schema design restricts scoring weights to medication, nutrition, and vitals.

### 6.7 Table: `notifications`
Stores warning alerts.
*   **Schema**:
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Unique notification identifier. |
| `tenant_id` | `UUID` | `NOT NULL`, `REFERENCES tenants(id) ON DELETE CASCADE` | Associated tenant ID. |
| `resident_id` | `UUID` | `NOT NULL`, `REFERENCES residents(id) ON DELETE CASCADE` | Target resident ID. |
| `type` | `VARCHAR(50)` | `NOT NULL`, `CHECK (type IN ('LOW_WELFARE_SCORE'))`| Alert classification. |
| `title` | `VARCHAR(255)`| `NOT NULL` | Short alert header. |
| `message` | `TEXT` | `NOT NULL` | Description of the alert. |
| `status` | `VARCHAR(20)` | `NOT NULL`, `DEFAULT 'UNREAD'`, `CHECK (status IN ('UNREAD', 'READ'))`| Alert read status. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Alert generation date. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Date of last status change. |

---

## 7. MongoDB Collection Design

### 7.1 Collection: `care_logs`
Manages event logs recorded by caretakers.

*   **Document Structure Schema**:
```json
{
  "_id": "ObjectId",
  "tenantId": "String (UUID format, index: 1)",
  "residentId": "String (UUID format, index: 1)",
  "caretakerId": "String (UUID format)",
  "type": "String (Enum: medication | nutrition | vitals | activity, index: 1)",
  "details": "Mixed (JSON document containing details specific to log type)",
  "recordedAt": "Date (index: -1)",
  "createdAt": "Date (index: 1)"
}
```

*   **Sub-schemas for `details` Field**:
    *   *Type: `medication`*
        ```json
        { "name": "Aspirin", "dosage": "75mg", "administration": "Oral", "score": 100 }
        ```
    *   *Type: `vitals`*
        ```json
        { "systolic": 120, "diastolic": 80, "pulse": 72, "temperature": 98.6, "score": 90 }
        ```
    *   *Type: `nutrition`*
        ```json
        { "meal": "Breakfast", "item": "Oatmeal and Milk", "percentage_consumed": 100, "score": 100 }
        ```
    *   *Type: `activity`*
        ```json
        { "activity": "Physical Therapy", "duration_minutes": 30, "score": 85 }
        ```

---

## 8. Redis Event Channel Design

*   **Channel**: `care-log-created`
*   **Publisher**: Triggered when a new Care Log is saved to MongoDB. The controller serializes and publishes a message payload containing reference values to the channel:
    ```javascript
    await publisherRedisClient.publish('care-log-created', JSON.stringify(payload));
    ```
*   **Subscriber**: A background process listening to the channel. Upon receiving a message, it parses the payload and triggers the analytics worker:
    ```javascript
    await subscriberRedisClient.subscribe('care-log-created', async (message) => {
      const event = JSON.parse(message);
      await processCareLogEvent(event);
    });
    ```
*   **Analytics Worker Flow**:
    1.  Receives event payload.
    2.  Fetches configured weights for the resident from PostgreSQL.
    3.  Queries recent care logs for the resident from MongoDB.
    4.  Executes the **weighted welfare score computation based on care log categories and resident-configured weights**.
    5.  Saves the updated index values to PostgreSQL.
    6.  If $WI < 50$, calls the Notification Service to insert a system alert.

---

## 9. Entity Relationship Design

The relational database tables, MongoDB documents, and Redis event channels map to the following schema:

```
  POSTGRESQL (Relational Metadata & Core Index Tables)
  
  +------------------+          +------------------+          +------------------+
  |     tenants      |          |      users       |          |  refresh_tokens  |
  +------------------+          +------------------+          +------------------+
  | id (PK) UUID     |<----+    | id (PK) UUID     |<----+    | id (PK) UUID     |
  | name VARCHAR     |     |    | tenant_id (FK)   |     |    | tenant_id (FK)   |
  | slug VARCHAR     |     |    | email VARCHAR    |     +----| user_id (FK)     |
  | is_active BOOLEAN|     |    | password_hash    |          | token_hash TEXT  |
  +------------------+     |    | role VARCHAR     |          +------------------+
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
  | darpan_id VARCHAR|   | status VARCHAR   |   | medication_score |   | type VARCHAR     |
  | status VARCHAR   |   | wt_medication NUM|   | nutrition_score  |   | title VARCHAR    |
  +------------------+   | wt_nutrition NUM |   | vitals_score     |   | status VARCHAR   |
                         | wt_vitals NUM    |   | welfare_index    |   +------------------+
                         +------------------+   +------------------+
                                   ▲
                                   │ (Reference Linking by ID Strings)
  =================================│===================================================
  MONGODB (Document Event Store)   │
                                   │
                           +-------+----------+
                           |    care_logs     |
                           +------------------+
                           | _id (PK) ObjectId|
                           | tenantId String  |
                           | residentId String| (String matches PostgreSQL resident UUID)
                           | caretakerId Str  |
                           | type VARCHAR     |
                           | details MIXED    |
                           +------------------+
                                   │
                                   │ (Trigger Publisher Hook)
  =================================│===================================================
  REDIS PUB/SUB (Message Pipeline) │
                                   v
                      +--------------------------+
                      | Event: care-log-created  |
                      +--------------------------+
                      | - Publish event metadata |
                      | - Trigger background     |
                      |   Analytics Worker       |
                      +--------------------------+
```

---

## 10. Tenant Isolation Strategy

Data isolation across tenants is enforced using a logical isolation strategy:
*   **Database Isolation Fields**: PostgreSQL tables and MongoDB collections contain a tenant identifier (`tenant_id` / `tenantId`).
*   **Query Isolation**: Database queries must include explicit tenant filters:
    *   *SQL*: `WHERE tenant_id = $1`
    *   *NoSQL*: `{ tenantId: contextId }`
*   **Middleware Enforcement**: Incoming request headers are parsed to extract the tenant ID:
    ```javascript
    const tenantId = req.headers['x-tenant-id'];
    ```
    This value is compared against the `tenantId` claim stored in the validated JWT token, preventing access to data belonging to other tenants.

---

## 11. Data Flow Between Databases

The flow of health telemetry and analytics updates occurs across the hybrid databases:

```
[Caretaker Client]
       │
       ▼ (1. HTTP POST: Care Log Entry)
[Express API Controller]
       │
       ├─► (2. Saves Document) ──► [MongoDB care_logs Collection]
       │
       ▼ (3. Confirms Save)
[Express Event Publisher Hook]
       │
       ▼ (4. Broadcasts message payload)
[Redis channel: 'care-log-created']
       │
       ▼ (5. Triggers subscriber execution)
[Background Worker Task Queue]
       │
       ├─► (6. Queries history) ──► [MongoDB care_logs Collection]
       │
       ▼ (7. Calculates welfare index & upserts data)
[PostgreSQL Table: resident_analytics]
       │
       ▼ (8. If WI < 50, triggers alert insertion)
[PostgreSQL Table: notifications]
```

---

## 12. Analytics Data Storage Design

*   **Analytics Storage**: Telemetry calculations are stored in the PostgreSQL `resident_analytics` table.
*   **Compound Constraints**: To prevent duplicate score profiles, the system enforces a compound unique constraint on `(tenant_id, resident_id)`.
*   **Upsert Calculations**: Background workers update analytics data using atomic upsert operations to prevent query collisions.

---

## 13. Notification Data Storage Design

*   **Notification Storage**: System alerts are stored in the PostgreSQL `notifications` table.
*   **Alert Indexing**: Notifications include compound indexes on `(tenant_id, status)` and `(tenant_id, resident_id)` to optimize dashboard read performance.
*   **Status Tracking**: Alerts default to `UNREAD` and can be marked as `READ` via targeted patch requests, updating the status column and timestamps in PostgreSQL.

---

## 14. Database Security Considerations

*   **SQL Injection Protection**: All PostgreSQL queries use parameterized binding parameters instead of raw string concatenation.
*   **NoSQL Injection Hardening**: Incoming payloads are validated to strip keys containing MongoDB operators (dot `.` or dollar `$`).
*   **Bcrypt Password Protection**: Password entries are encrypted using 12-round Bcrypt salting processes.
*   **Token Session Control**: Checking `token_version` on every authenticated request ensures that revoked access tokens are immediately rejected.

---

## 15. Indexing Strategy

To maintain performance, several database indexes are defined:

### 15.1 PostgreSQL Relational Indexes
*   `tenants(slug)`: Unique index to optimize tenant lookup during onboarding.
*   `users(tenant_id, LOWER(email))`: Unique index to prevent duplicate emails within a tenant.
*   `institutions(tenant_id, darpan_id)`: Unique index to prevent duplicate NGO registrations under a tenant.
*   `resident_analytics(tenant_id, resident_id)`: Unique index to optimize analytics retrieval.
*   `notifications(tenant_id, resident_id, status)`: Compound index to optimize alert fetches on dashboards.

### 15.2 MongoDB Document Indexes
*   `{ tenantId: 1, residentId: 1, recordedAt: -1 }`: Compound index to optimize chronological fetches of a resident's logs.
*   `{ tenantId: 1, type: 1, recordedAt: -1 }`: Compound index to optimize queries filtered by event type.

---

## 16. Backup and Recovery Strategy

*   **PostgreSQL Backups**: Standard database dumps are generated daily using utility tools:
    ```bash
    pg_dump -U postgres -d welfaresync -F c -b -v -f welfaresync_backup.dump
    ```
*   **MongoDB Backups**: Timeline databases are backed up using archive tools:
    ```bash
    mongodump --uri="mongodb://localhost:27017/welfaresync" --archive=mongobackup.archive
    ```
*   **Redis recovery**: Persistence is configured using append-only logging (AOF) with standard synchronization parameters.

---

## 17. Current Academic Scope

WelfareSync Engine is currently configured for a localized academic deployment:
*   **Single Node Deployment**: The application runs on a single node without load balancing.
*   **Single PostgreSQL Instance**: Uses a single database node without read replicas.
*   **Single MongoDB Instance**: Operates on a single node without replica sets.
*   **Redis Pub/Sub**: Event processing uses the standard Pub/Sub transport, meaning messages are not persisted.
*   **Manual Testing**: Verification is conducted using Postman collections and unit test suites.
*   **Infrastructure Exclusions**: Does not use Kubernetes, CI/CD pipelines, or WebSocket notifications.

---

## 18. Future Production Enhancements

To prepare the platform for production, several upgrades are planned:
*   **Docker Compose**: Multi-container configurations for local testing.
*   **Kubernetes**: Deploying stateless API containers and database pods across clusters.
*   **Redis Streams / Kafka**: Replacing Redis Pub/Sub with persistent brokers to support consumer offset tracking and queue durability.
*   **Email & SMS Gateways**: Integrating external services (e.g., SendGrid, Twilio) to deliver critical notifications.
*   **WebSocket Dashboard Updates**: Adding real-time updates to push score changes directly to client dashboards.
*   **Multi-Region Deployment**: Setting up active-passive database replication across geographically distributed nodes.
*   **Nginx API Gateway**: Implementing reverse proxies for rate limiting and SSL termination.
*   **CI/CD Pipeline & Observability**: Automating deployment workflows and integrating monitoring tools (e.g., Prometheus, Grafana) to track system performance.

---

## 19. Conclusion

This Database Design specification provides a performant data storage tier for the **WelfareSync Engine**. By separating operational logs in MongoDB from relational metadata in PostgreSQL, and using Redis to route background calculations, the platform maintains multi-tenant isolation, security, and performance across all system modules.
