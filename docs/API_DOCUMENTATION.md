# API Documentation Specification
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

### 1.1 Protocol & Request Standards
The WelfareSync Engine exposes a RESTful API over HTTP/HTTPS. All request bodies and response payloads are strictly formatted in JSON.
*   **Base API Prefix**: `/api/v1`
*   **Default Success Envelope**: Success responses return an HTTP status code along with a standardized JSON envelope:
    ```json
    {
      "success": true,
      "data": { ... }
    }
    ```
*   **Default Error Envelope**: Error responses return a status code along with a standardized error payload:
    ```json
    {
      "success": false,
      "error": {
        "message": "Error description details"
      }
    }
    ```

---

## 2. Role-Based Access Control (RBAC) Matrix

WelfareSync enforces strict access boundaries across three distinct roles:

| API Module | Endpoint Path | HTTP Verb | ADMIN | CARETAKER | GUARDIAN | Description |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Utility** | `/health` | `GET` | Public | Public | Public | System health checks. |
| **Auth** | `/auth/tenants` | `POST` | Public | Public | Public | Onboards a new tenant and Admin user. |
| | `/auth/login` | `POST` | Public | Public | Public | User authentication login. |
| | `/auth/refresh` | `POST` | Public | Public | Public | Rotates JWT access and refresh tokens. |
| | `/auth/logout` | `POST` | Public | Public | Public | Revokes a session refresh token. |
| | `/auth/register` | `POST` | **Allowed** | Denied | Denied | Admin registers Caretakers or Guardians. |
| | `/auth/logout-all`| `POST` | **Allowed** | **Allowed** | **Allowed** | Revokes all active session refresh tokens. |
| | `/auth/me` | `GET` | **Allowed** | **Allowed** | **Allowed** | Retrieves current session user info. |
| **Institutions**| `/institutions` | `POST` | **Allowed** | Denied | Denied | Registers a new physical facility. |
| | `/institutions` | `GET` | **Allowed** | **Allowed** | **Allowed** | Lists active institutions for a tenant. |
| | `/institutions/:id`| `GET` | **Allowed** | **Allowed** | **Allowed** | Fetches institutional details. |
| | `/institutions/:id`| `PUT` | **Allowed** | Denied | Denied | Modifies institutional details. |
| | `/institutions/:id`| `DELETE` | **Allowed** | Denied | Denied | Soft-archives an institution. |
| **Residents** | `/residents` | `POST` | **Allowed** | Denied | Denied | Registers a resident with score weights. |
| | `/residents` | `GET` | **Allowed** | **Allowed** | Denied | Lists active residents for a tenant. |
| | `/residents/:id` | `GET` | **Allowed** | **Allowed** | **Allowed** | Fetches resident profile biodata. |
| | `/residents/:id` | `PUT` | **Allowed** | Denied | Denied | Modifies resident weights and details. |
| | `/residents/:id` | `DELETE` | **Allowed** | Denied | Denied | Archives a resident profile. |
| **Care Logs** | `/logs` | `POST` | **Allowed** | **Allowed** | Denied | Caretaker logs a resident care event. |
| | `/logs` | `GET` | **Allowed** | **Allowed** | **Allowed** | Queries historical logs under tenant context.|
| | `/logs/:id` | `GET` | **Allowed** | **Allowed** | **Allowed** | Fetches details of a specific care log. |
| | `/residents/:residentId/logs`| `GET` | **Allowed** | **Allowed** | **Allowed** | Fetches timeline logs for a resident. |
| **Analytics** | `/analytics/residents/:residentId`| `GET` | **Allowed** | **Allowed** | **Allowed** | Fetches compiled welfare index metrics. |
| | `/analytics/test-low-score/:residentId`| `POST` | **Allowed** | Denied | Denied | Test trigger for low score notifications. |
| **Notifications**| `/notifications` | `GET` | **Allowed** | **Allowed** | **Allowed** | Lists alert logs scoped to the tenant. |
| | `/notifications/residents/:residentId`| `GET` | **Allowed** | **Allowed** | **Allowed** | Lists alert logs scoped to a resident. |
| | `/notifications/:id/read`| `PATCH` | **Allowed** | **Allowed** | **Allowed** | Marks warning alert status as READ. |
| **Dashboard** | `/dashboard/overview`| `GET` | **Allowed** | Denied | **Allowed** | Fetches facility aggregate counts. |
| | `/dashboard/residents`| `GET` | **Allowed** | Denied | **Allowed** | Fetches resident risk status profiles. |
| | `/dashboard/notifications`| `GET` | **Allowed** | Denied | **Allowed** | Fetches unread warning alert list. |
| | `/dashboard/residents/:residentId`| `GET` | **Allowed** | Denied | **Allowed** | Fetches ward detail dashboard summaries. |

---

## 3. Global Request Standards

Except for public utility and authentication endpoints, all API requests must include the following headers:
*   `Authorization`: `Bearer <Access_Token>` (Validates identity and resolves user role/claims).
*   `X-Tenant-ID`: `<Tenant_UUID>` (Secures logical data separation).

The `tenantValidation` middleware validates that the `X-Tenant-ID` header matches the `tenantId` claim stored in the parsed JWT access token, preventing cross-tenant access.

---

## 4. Utility APIs

### 4.1 Service Health Check (`GET /health`)
Retrieves the operational health status of the service engine.
*   **Authentication Requirements**: None (Public)
*   **Tenant Requirements**: None
*   **Headers**: None
*   **Path Parameters**: None
*   **Query Parameters**: None
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "service": "WelfareSync Engine",
            "status": "ok",
            "timestamp": "2026-05-30T16:00:00.000Z"
          }
        }
        ```
*   **Error Response Examples**: None (Service unavailability resolves to Gateway Timeout 504 / Bad Gateway 502 at server proxy level).

---

## 5. Authentication APIs

### 5.1 Onboard Tenant (`POST /auth/tenants`)
Onboards a new tenant and registers the initial Admin user.
*   **Authentication Requirements**: None (Public)
*   **Tenant Requirements**: None
*   **Headers**:
    *   `Content-Type`: `application/json`
*   **Path Parameters**: None
*   **Query Parameters**: None
*   **Request Example**:
    ```json
    {
      "name": "Kuralara Care Center",
      "slug": "kuralara-care",
      "admin": {
        "name": "Arun Kumar",
        "email": "admin@kuralara.org",
        "password": "SecurePassword123"
      }
    }
    ```
*   **Success Response Example**:
    *   `201 Created`
        ```json
        {
          "success": true,
          "data": {
            "tenant": {
              "id": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "name": "Kuralara Care Center",
              "slug": "kuralara-care",
              "isActive": true,
              "createdAt": "2026-05-30T16:00:00.000Z",
              "updatedAt": "2026-05-30T16:00:00.000Z"
            },
            "user": {
              "id": "e5b82e8d-8a8d-4be9-81a1-f3b145a9018e",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "name": "Arun Kumar",
              "email": "admin@kuralara.org",
              "role": "ADMIN",
              "status": "ACTIVE",
              "tokenVersion": 0,
              "createdAt": "2026-05-30T16:00:00.000Z",
              "updatedAt": "2026-05-30T16:00:00.000Z"
            },
            "accessToken": "eyJhbGciOi...",
            "refreshToken": "eyJhbGciOi..."
          }
        }
        ```
*   **Error Response Examples**:
    *   `400 Bad Request` (Password length or missing credentials)
        ```json
        {
          "success": false,
          "error": {
            "message": "Password must be at least 8 characters"
          }
        }
        ```
    *   `409 Conflict` (Tenant slug or email already in use)
        ```json
        {
          "success": false,
          "error": {
            "message": "Tenant slug is already in use"
          }
        }
        ```

### 5.2 User Login (`POST /auth/login`)
Authenticates user credentials.
*   **Authentication Requirements**: None (Public)
*   **Tenant Requirements**: Optional. Recommended in header `X-Tenant-ID` or in request body payload.
*   **Headers**:
    *   `Content-Type`: `application/json`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184` (Optional)
*   **Path Parameters**: None
*   **Query Parameters**: None
*   **Request Example**:
    ```json
    {
      "email": "admin@kuralara.org",
      "password": "SecurePassword123"
    }
    ```
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "user": {
              "id": "e5b82e8d-8a8d-4be9-81a1-f3b145a9018e",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "name": "Arun Kumar",
              "email": "admin@kuralara.org",
              "role": "ADMIN",
              "status": "ACTIVE",
              "tokenVersion": 0,
              "createdAt": "2026-05-30T16:00:00.000Z",
              "updatedAt": "2026-05-30T16:00:00.000Z"
            },
            "accessToken": "eyJhbGciOi...",
            "refreshToken": "eyJhbGciOi..."
          }
        }
        ```
*   **Error Response Examples**:
    *   `401 Unauthorized`
        ```json
        {
          "success": false,
          "error": {
            "message": "Invalid email or password"
          }
        }
        ```
    *   `403 Forbidden` (Inactive tenant or user account)
        ```json
        {
          "success": false,
          "error": {
            "message": "Tenant is invalid or inactive"
          }
        }
        ```

### 5.3 Refresh Tokens (`POST /auth/refresh`)
Rotates JWT access and refresh token pairs.
*   **Authentication Requirements**: None (Public)
*   **Tenant Requirements**: None
*   **Headers**:
    *   `Content-Type`: `application/json`
*   **Path Parameters**: None
*   **Query Parameters**: None
*   **Request Example**:
    ```json
    {
      "refreshToken": "eyJhbGciOi..."
    }
    ```
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "user": {
              "id": "e5b82e8d-8a8d-4be9-81a1-f3b145a9018e",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "name": "Arun Kumar",
              "email": "admin@kuralara.org",
              "role": "ADMIN",
              "status": "ACTIVE",
              "tokenVersion": 1,
              "createdAt": "2026-05-30T16:00:00.000Z",
              "updatedAt": "2026-05-30T16:00:00.000Z"
            },
            "accessToken": "eyJhbGciOi...",
            "refreshToken": "eyJhbGciOi..."
          }
        }
        ```
*   **Error Response Examples**:
    *   `401 Unauthorized` (Token expired or revoked)
        ```json
        {
          "success": false,
          "error": {
            "message": "Invalid refresh token"
          }
        }
        ```

### 5.4 User Logout (`POST /auth/logout`)
Invalidates a specific session refresh token.
*   **Authentication Requirements**: None (Public)
*   **Tenant Requirements**: None
*   **Headers**:
    *   `Content-Type`: `application/json`
*   **Path Parameters**: None
*   **Query Parameters**: None
*   **Request Example**:
    ```json
    {
      "refreshToken": "eyJhbGciOi..."
    }
    ```
*   **Success Response Example**:
    *   `204 No Content` (Returns an empty response body)
*   **Error Response Examples**:
    *   `400 Bad Request` (Missing refresh token parameter)
        ```json
        {
          "success": false,
          "error": {
            "message": "Refresh token is required"
          }
        }
        ```

### 5.5 Register Caretaker/Guardian (`POST /auth/register`)
Allows Tenant Admins to register caretakers and guardians.
*   **Authentication Requirements**: JWT Access Token with role `ADMIN`.
*   **Tenant Requirements**: Yes (Matching X-Tenant-ID header verified against JWT tenantId claim).
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
    *   `Content-Type`: `application/json`
*   **Path Parameters**: None
*   **Query Parameters**: None
*   **Request Example**:
    ```json
    {
      "name": "Sunita Rani",
      "email": "caretaker@kuralara.org",
      "password": "CaretakerPassword123",
      "role": "CARETAKER"
    }
    ```
*   **Success Response Example**:
    *   `201 Created`
        ```json
        {
          "success": true,
          "data": {
            "user": {
              "id": "b3f6b9c9-0fa7-4f65-9856-ee04434ef9b2",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "name": "Sunita Rani",
              "email": "caretaker@kuralara.org",
              "role": "CARETAKER",
              "status": "ACTIVE",
              "tokenVersion": 0,
              "createdAt": "2026-05-30T16:05:00.000Z",
              "updatedAt": "2026-05-30T16:05:00.000Z"
            }
          }
        }
        ```
*   **Error Response Examples**:
    *   `400 Bad Request` (Invalid user role registration attempt, e.g. trying to register an ADMIN)
        ```json
        {
          "success": false,
          "error": {
            "message": "Only CARETAKER and GUARDIAN users can be registered here"
          }
        }
        ```
    *   `409 Conflict` (Email is already registered for this tenant)
        ```json
        {
          "success": false,
          "error": {
            "message": "Email is already registered for this tenant"
          }
        }
        ```

### 5.6 Global Session Revocation (`POST /auth/logout-all`)
Invalidates all active access and refresh tokens for the authenticated user by incrementing their token version.
*   **Authentication Requirements**: JWT Access Token (Any Role).
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**: None
*   **Query Parameters**: None
*   **Request Example**: None
*   **Success Response Example**:
    *   `204 No Content` (Empty response body)
*   **Error Response Examples**:
    *   `401 Unauthorized` (Token invalid or missing)
        ```json
        {
          "success": false,
          "error": {
            "message": "Invalid or expired access token"
          }
        }
        ```

### 5.7 Get Authenticated Profile (`GET /auth/me`)
Retrieves details of the currently logged-in user.
*   **Authentication Requirements**: JWT Access Token (Any Role).
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**: None
*   **Query Parameters**: None
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "user": {
              "id": "e5b82e8d-8a8d-4be9-81a1-f3b145a9018e",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "name": "Arun Kumar",
              "email": "admin@kuralara.org",
              "role": "ADMIN",
              "status": "ACTIVE",
              "tokenVersion": 1,
              "createdAt": "2026-05-30T16:00:00.000Z",
              "updatedAt": "2026-05-30T16:00:00.000Z"
            }
          }
        }
        ```

---

## 6. Institution APIs

### 6.1 Create Institution (`POST /institutions`)
Registers a physical facility branch.
*   **Authentication Requirements**: JWT Access Token with role `ADMIN`.
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
    *   `Content-Type`: `application/json`
*   **Path Parameters**: None
*   **Query Parameters**: None
*   **Request Example**:
    ```json
    {
      "name": "Kuralara Elderly Care Branch",
      "darpanId": "TN/2026/012345",
      "address": "123 Care Street, Chennai",
      "contactEmail": "chennai@kuralara.org",
      "contactPhone": "+914423456789"
    }
    ```
*   **Success Response Example**:
    *   `201 Created`
        ```json
        {
          "success": true,
          "data": {
            "institution": {
              "id": "a1827e8d-8a8d-4be9-81a1-f3b145a9018e",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "name": "Kuralara Elderly Care Branch",
              "darpanId": "TN/2026/012345",
              "address": "123 Care Street, Chennai",
              "contactEmail": "chennai@kuralara.org",
              "contactPhone": "+914423456789",
              "status": "ACTIVE",
              "createdAt": "2026-05-30T16:10:00.000Z",
              "updatedAt": "2026-05-30T16:10:00.000Z"
            }
          }
        }
        ```
*   **Error Response Examples**:
    *   `409 Conflict` (Darpan ID duplicate for tenant)
        ```json
        {
          "success": false,
          "error": {
            "message": "Darpan ID is already registered for this tenant"
          }
        }
        ```

### 6.2 List Institutions (`GET /institutions`)
Retrieves institutions registered under the tenant.
*   **Authentication Requirements**: JWT Access Token (Any Role).
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**: None
*   **Query Parameters**:
    *   `status`: (Optional string filter: `ACTIVE` | `INACTIVE` | `ARCHIVED`)
    *   `limit`: (Optional integer pagination limit, default: `25`, max: `100`)
    *   `offset`: (Optional integer pagination offset, default: `0`)
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "institutions": [
              {
                "id": "a1827e8d-8a8d-4be9-81a1-f3b145a9018e",
                "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
                "name": "Kuralara Elderly Care Branch",
                "darpanId": "TN/2026/012345",
                "address": "123 Care Street, Chennai",
                "contactEmail": "chennai@kuralara.org",
                "contactPhone": "+914423456789",
                "status": "ACTIVE",
                "createdAt": "2026-05-30T16:10:00.000Z",
                "updatedAt": "2026-05-30T16:10:00.000Z"
              }
            ]
          }
        }
        ```

### 6.3 Get Institution details (`GET /institutions/:id`)
Retrieves institutional detailed configuration profile.
*   **Authentication Requirements**: JWT Access Token (Any Role).
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**:
    *   `id`: UUID of the target physical institution.
*   **Query Parameters**: None
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "institution": {
              "id": "a1827e8d-8a8d-4be9-81a1-f3b145a9018e",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "name": "Kuralara Elderly Care Branch",
              "darpanId": "TN/2026/012345",
              "address": "123 Care Street, Chennai",
              "contactEmail": "chennai@kuralara.org",
              "contactPhone": "+914423456789",
              "status": "ACTIVE",
              "createdAt": "2026-05-30T16:10:00.000Z",
              "updatedAt": "2026-05-30T16:10:00.000Z"
            }
          }
        }
        ```
*   **Error Response Examples**:
    *   `404 Not Found` (Target ID not found under the caller's tenant boundary)
        ```json
        {
          "success": false,
          "error": {
            "message": "Institution not found"
          }
        }
        ```

### 6.4 Update Institution (`PUT /institutions/:id`)
Modifies institutional details.
*   **Authentication Requirements**: JWT Access Token with role `ADMIN`.
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
    *   `Content-Type`: `application/json`
*   **Path Parameters**:
    *   `id`: UUID of the target physical institution.
*   **Query Parameters**: None
*   **Request Example**:
    ```json
    {
      "address": "New Branch Address Road, Chennai",
      "contactPhone": "+914498765432"
    }
    ```
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "institution": {
              "id": "a1827e8d-8a8d-4be9-81a1-f3b145a9018e",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "name": "Kuralara Elderly Care Branch",
              "darpanId": "TN/2026/012345",
              "address": "New Branch Address Road, Chennai",
              "contactEmail": "chennai@kuralara.org",
              "contactPhone": "+914498765432",
              "status": "ACTIVE",
              "createdAt": "2026-05-30T16:10:00.000Z",
              "updatedAt": "2026-05-30T16:15:00.000Z"
            }
          }
        }
        ```

### 6.5 Soft Archive Institution (`DELETE /institutions/:id`)
Toggles status of the institution to `ARCHIVED`.
*   **Authentication Requirements**: JWT Access Token with role `ADMIN`.
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**:
    *   `id`: UUID of the target physical institution.
*   **Query Parameters**: None
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "institution": {
              "id": "a1827e8d-8a8d-4be9-81a1-f3b145a9018e",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "name": "Kuralara Elderly Care Branch",
              "darpanId": "TN/2026/012345",
              "address": "New Branch Address Road, Chennai",
              "contactEmail": "chennai@kuralara.org",
              "contactPhone": "+914498765432",
              "status": "ARCHIVED",
              "createdAt": "2026-05-30T16:10:00.000Z",
              "updatedAt": "2026-05-30T16:18:00.000Z"
            }
          }
        }
        ```

---

## 7. Resident APIs

### 7.1 Register Resident (`POST /residents`)
Registers a resident with custom welfare score weights.
*   **Authentication Requirements**: JWT Access Token with role `ADMIN`.
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
    *   `Content-Type`: `application/json`
*   **Path Parameters**: None
*   **Query Parameters**: None
*   **Request Example**:
    ```json
    {
      "firstName": "Raman",
      "lastName": "Nathan",
      "gender": "MALE",
      "dateOfBirth": "1945-08-15",
      "admissionDate": "2026-05-01",
      "weightMedication": 1.5,
      "weightNutrition": 1.0,
      "weightVitals": 2.0
    }
    ```
*   **Success Response Example**:
    *   `201 Created`
        ```json
        {
          "success": true,
          "data": {
            "resident": {
              "id": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "firstName": "Raman",
              "lastName": "Nathan",
              "gender": "MALE",
              "dateOfBirth": "1945-08-15T00:00:00.000Z",
              "admissionDate": "2026-05-01T00:00:00.000Z",
              "status": "ACTIVE",
              "weightMedication": 1.5,
              "weightNutrition": 1,
              "weightVitals": 2,
              "createdAt": "2026-05-30T16:20:00.000Z"
            }
          }
        }
        ```

### 7.2 List Residents (`GET /residents`)
Lists active residents under the tenant context.
*   **Authentication Requirements**: JWT Access Token with role `ADMIN` or `CARETAKER`.
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**: None
*   **Query Parameters**:
    *   `status`: (Optional string filter: `ACTIVE` | `ARCHIVED`, default: `ACTIVE`)
    *   `limit`: (Optional integer, default: `25`, max: `100`)
    *   `offset`: (Optional integer, default: `0`)
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "residents": [
              {
                "id": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
                "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
                "firstName": "Raman",
                "lastName": "Nathan",
                "gender": "MALE",
                "dateOfBirth": "1945-08-15T00:00:00.000Z",
                "admissionDate": "2026-05-01T00:00:00.000Z",
                "status": "ACTIVE",
                "weightMedication": 1.5,
                "weightNutrition": 1,
                "weightVitals": 2,
                "createdAt": "2026-05-30T16:20:00.000Z"
              }
            ]
          }
        }
        ```

### 7.3 Get Resident details (`GET /residents/:id`)
Fetches resident profile biodata.
*   **Authentication Requirements**: JWT Access Token (Any Role). Guardian role will be validated against matching designated ward mappings (throws a `403` assignment error if not authorized).
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**:
    *   `id`: UUID of the target resident.
*   **Query Parameters**: None
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "resident": {
              "id": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "firstName": "Raman",
              "lastName": "Nathan",
              "gender": "MALE",
              "dateOfBirth": "1945-08-15T00:00:00.000Z",
              "admissionDate": "2026-05-01T00:00:00.000Z",
              "status": "ACTIVE",
              "weightMedication": 1.5,
              "weightNutrition": 1,
              "weightVitals": 2,
              "createdAt": "2026-05-30T16:20:00.000Z"
            }
          }
        }
        ```

### 7.4 Update Resident (`PUT /residents/:id`)
Modifies resident weights and biodata fields.
*   **Authentication Requirements**: JWT Access Token with role `ADMIN`.
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
    *   `Content-Type`: `application/json`
*   **Path Parameters**:
    *   `id`: UUID of the target resident.
*   **Query Parameters**: None
*   **Request Example**:
    ```json
    {
      "firstName": "Raman",
      "lastName": "Nathan Updated",
      "weightVitals": 2.5
    }
    ```
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "resident": {
              "id": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "firstName": "Raman",
              "lastName": "Nathan Updated",
              "gender": "MALE",
              "dateOfBirth": "1945-08-15T00:00:00.000Z",
              "admissionDate": "2026-05-01T00:00:00.000Z",
              "status": "ACTIVE",
              "weightMedication": 1.5,
              "weightNutrition": 1,
              "weightVitals": 2.5,
              "createdAt": "2026-05-30T16:20:00.000Z"
            }
          }
        }
        ```

### 7.5 Soft Archive Resident (`DELETE /residents/:id`)
Sets resident status to `ARCHIVED`.
*   **Authentication Requirements**: JWT Access Token with role `ADMIN`.
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**:
    *   `id`: UUID of the target resident.
*   **Query Parameters**: None
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "resident": {
              "id": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "firstName": "Raman",
              "lastName": "Nathan Updated",
              "gender": "MALE",
              "dateOfBirth": "1945-08-15T00:00:00.000Z",
              "admissionDate": "2026-05-01T00:00:00.000Z",
              "status": "ARCHIVED",
              "weightMedication": 1.5,
              "weightNutrition": 1,
              "weightVitals": 2.5,
              "createdAt": "2026-05-30T16:20:00.000Z"
            }
          }
        }
        ```

---

## 8. Care Logs APIs

### 8.1 Submit Care Log (`POST /logs`)
Logs a resident care event. Once written to MongoDB, this publishes a message payload on Redis Pub/Sub channel `care-log-created`.
*   **Authentication Requirements**: JWT Access Token with role `ADMIN` or `CARETAKER`.
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
    *   `Content-Type`: `application/json`
*   **Path Parameters**: None
*   **Query Parameters**: None
*   **Request Example**:
    ```json
    {
      "residentId": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
      "caretakerId": "e5b82e8d-8a8d-4be9-81a1-f3b145a9018e",
      "type": "vitals",
      "recordedAt": "2026-05-30T16:00:00.000Z",
      "details": {
        "systolic": 120,
        "diastolic": 80,
        "pulse": 72,
        "temperature": 98.6,
        "score": 90
      }
    }
    ```
*   **Success Response Example**:
    *   `201 Created`
        ```json
        {
          "success": true,
          "data": {
            "log": {
              "id": "6516df4b2f4a1b001258d4a9",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "residentId": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
              "caretakerId": "e5b82e8d-8a8d-4be9-81a1-f3b145a9018e",
              "type": "vitals",
              "details": {
                "systolic": 120,
                "diastolic": 80,
                "pulse": 72,
                "temperature": 98.6,
                "score": 90
              },
              "recordedAt": "2026-05-30T16:00:00.000Z",
              "createdAt": "2026-05-30T16:00:01.000Z",
              "updatedAt": "2026-05-30T16:00:01.000Z"
            }
          }
        }
        ```
*   **Error Response Examples**:
    *   `400 Bad Request` (NoSQL Injection attempt - keys starting with `$` or containing `.`)
        ```json
        {
          "success": false,
          "error": {
            "message": "details contains unsafe keys"
          }
        }
        ```
    *   `404 Not Found` (Resident profile not registered or is soft-archived)
        ```json
        {
          "success": false,
          "error": {
            "message": "Resident not found"
          }
        }
        ```

### 8.2 Search Care Logs (`GET /logs`)
Queries care logs using various filters.
*   **Authentication Requirements**: JWT Access Token (Any Role).
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**: None
*   **Query Parameters**:
    *   `residentId`: (Optional UUID filter)
    *   `type`: (Optional enum filter: `medication` | `nutrition` | `vitals` | `activity`)
    *   `recordedFrom`: (Optional ISO DateTime string start range)
    *   `recordedTo`: (Optional ISO DateTime string end range)
    *   `limit`: (Optional pagination page limit, default: `25`, max: `100`)
    *   `offset`: (Optional pagination offset)
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "logs": [
              {
                "id": "6516df4b2f4a1b001258d4a9",
                "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
                "residentId": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
                "caretakerId": "e5b82e8d-8a8d-4be9-81a1-f3b145a9018e",
                "type": "vitals",
                "details": {
                  "systolic": 120,
                  "diastolic": 80,
                  "pulse": 72,
                  "temperature": 98.6,
                  "score": 90
                },
                "recordedAt": "2026-05-30T16:00:00.000Z",
                "createdAt": "2026-05-30T16:00:01.000Z",
                "updatedAt": "2026-05-30T16:00:01.000Z"
              }
            ]
          }
        }
        ```

### 8.3 Fetch Individual Log Detail (`GET /logs/:id`)
Retrieves a specific care event log by ID.
*   **Authentication Requirements**: JWT Access Token (Any Role).
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**:
    *   `id`: MongoDB ObjectId of the target care log.
*   **Query Parameters**: None
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "log": {
              "id": "6516df4b2f4a1b001258d4a9",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "residentId": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
              "caretakerId": "e5b82e8d-8a8d-4be9-81a1-f3b145a9018e",
              "type": "vitals",
              "details": {
                "systolic": 120,
                "diastolic": 80,
                "pulse": 72,
                "temperature": 98.6,
                "score": 90
              },
              "recordedAt": "2026-05-30T16:00:00.000Z",
              "createdAt": "2026-05-30T16:00:01.000Z",
              "updatedAt": "2026-05-30T16:00:01.000Z"
            }
          }
        }
        ```
*   **Error Response Examples**:
    *   `400 Bad Request` (Invalid hexadecimal MongoDB structure)
        ```json
        {
          "success": false,
          "error": {
            "message": "Invalid log id"
          }
        }
        ```
    *   `404 Not Found` (Record does not exist)
        ```json
        {
          "success": false,
          "error": {
            "message": "Care log not found"
          }
        }
        ```

### 8.4 Fetch Resident Logs Timeline (`GET /residents/:residentId/logs`)
Fetches all care logs matching a target resident.
*   **Authentication Requirements**: JWT Access Token (Any Role).
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**:
    *   `residentId`: UUID of the target resident.
*   **Query Parameters**:
    *   `type`: (Optional care log type enum filter)
    *   `recordedFrom`: (Optional ISO DateTime string range start)
    *   `recordedTo`: (Optional ISO DateTime string range end)
    *   `limit`: (Optional pagination page limit, default: `25`)
    *   `offset`: (Optional pagination offset)
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "logs": [
              {
                "id": "6516df4b2f4a1b001258d4a9",
                "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
                "residentId": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
                "caretakerId": "e5b82e8d-8a8d-4be9-81a1-f3b145a9018e",
                "type": "vitals",
                "details": {
                  "systolic": 120,
                  "diastolic": 80,
                  "pulse": 72,
                  "temperature": 98.6,
                  "score": 90
                },
                "recordedAt": "2026-05-30T16:00:00.000Z",
                "createdAt": "2026-05-30T16:00:01.000Z",
                "updatedAt": "2026-05-30T16:00:01.000Z"
              }
            ]
          }
        }
        ```

---

## 9. Analytics APIs

### 9.1 Fetch Resident Analytics Score (`GET /analytics/residents/:residentId`)
Retrieves pre-calculated welfare scores. If scores are missing, it triggers an on-demand calculation.
*   **Authentication Requirements**: JWT Access Token (Any Role).
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**:
    *   `residentId`: UUID of the target resident.
*   **Query Parameters**: None
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "resident": {
              "id": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "firstName": "Raman",
              "lastName": "Nathan",
              "gender": "MALE",
              "dateOfBirth": "1945-08-15T00:00:00.000Z",
              "admissionDate": "2026-05-01T00:00:00.000Z",
              "status": "ACTIVE",
              "weightMedication": 1.5,
              "weightNutrition": 1,
              "weightVitals": 2,
              "createdAt": "2026-05-30T16:20:00.000Z"
            },
            "scores": {
              "medication": 100,
              "nutrition": 95,
              "vitals": 90,
              "activity": 85
            },
            "welfareIndex": 92.5,
            "updatedAt": "2026-05-30T16:22:00.000Z"
          }
        }
        ```
*   **Error Response Examples**:
    *   `404 Not Found`
        ```json
        {
          "success": false,
          "error": {
            "message": "Resident not found"
          }
        }
        ```

### 9.2 Test Trigger Low Welfare score (`POST /analytics/test-low-score/:residentId`)
Admin testing trigger to simulate a low welfare index ($WI = 25$) and generate a system alert (warning notification written to SQL).
*   **Authentication Requirements**: JWT Access Token with role `ADMIN`.
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**:
    *   `residentId`: UUID of the target resident.
*   **Query Parameters**: None
*   **Request Example**: None
*   **Success Response Example**:
    *   `201 Created`
        ```json
        {
          "success": true,
          "data": {
            "resident": {
              "id": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "firstName": "Raman",
              "lastName": "Nathan",
              "gender": "MALE",
              "dateOfBirth": "1945-08-15T00:00:00.000Z",
              "admissionDate": "2026-05-01T00:00:00.000Z",
              "status": "ACTIVE",
              "weightMedication": 1.5,
              "weightNutrition": 1,
              "weightVitals": 2,
              "createdAt": "2026-05-30T16:20:00.000Z"
            },
            "scores": {
              "medication": 100,
              "nutrition": 95,
              "vitals": 90,
              "activity": 85
            },
            "welfareIndex": 25,
            "notification": {
              "id": "n1827e8d-8a8d-4be9-81a1-f3b145a9018e",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "residentId": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
              "type": "LOW_WELFARE_SCORE",
              "title": "Resident Welfare Warning",
              "message": "Resident welfare index dropped below threshold.",
              "status": "UNREAD",
              "createdAt": "2026-05-30T16:25:00.000Z",
              "updatedAt": "2026-05-30T16:25:00.000Z"
            }
          }
        }
        ```

---

## 10. Notification APIs

### 10.1 List Tenant Notifications (`GET /notifications`)
Lists alert logs scoped to the tenant.
*   **Authentication Requirements**: JWT Access Token (Any Role).
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**: None
*   **Query Parameters**:
    *   `status`: (Optional status filter: `UNREAD` | `READ`)
    *   `limit`: (Optional pagination page limit, default: `25`)
    *   `offset`: (Optional pagination offset)
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "notifications": [
              {
                "id": "n1827e8d-8a8d-4be9-81a1-f3b145a9018e",
                "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
                "residentId": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
                "type": "LOW_WELFARE_SCORE",
                "title": "Resident Welfare Warning",
                "message": "Resident welfare index dropped below threshold.",
                "status": "UNREAD",
                "createdAt": "2026-05-30T16:25:00.000Z",
                "updatedAt": "2026-05-30T16:25:00.000Z"
              }
            ]
          }
        }
        ```

### 10.2 List Resident Notifications (`GET /notifications/residents/:residentId`)
Lists alert warning notifications targeting a specific resident.
*   **Authentication Requirements**: JWT Access Token (Any Role).
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**:
    *   `residentId`: UUID of the target resident.
*   **Query Parameters**:
    *   `status`: (Optional status filter: `UNREAD` | `READ`)
    *   `limit`: (Optional pagination limit)
    *   `offset`: (Optional pagination offset)
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "notifications": [
              {
                "id": "n1827e8d-8a8d-4be9-81a1-f3b145a9018e",
                "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
                "residentId": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
                "type": "LOW_WELFARE_SCORE",
                "title": "Resident Welfare Warning",
                "message": "Resident welfare index dropped below threshold.",
                "status": "UNREAD",
                "createdAt": "2026-05-30T16:25:00.000Z",
                "updatedAt": "2026-05-30T16:25:00.000Z"
              }
            ]
          }
        }
        ```

### 10.3 Mark Notification as Read (`PATCH /notifications/:id/read`)
Transition alert state of a warning from `UNREAD` to `READ`.
*   **Authentication Requirements**: JWT Access Token (Any Role).
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**:
    *   `id`: UUID of the target notification alert record.
*   **Query Parameters**: None
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "notification": {
              "id": "n1827e8d-8a8d-4be9-81a1-f3b145a9018e",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "residentId": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
              "type": "LOW_WELFARE_SCORE",
              "title": "Resident Welfare Warning",
              "message": "Resident welfare index dropped below threshold.",
              "status": "READ",
              "createdAt": "2026-05-30T16:25:00.000Z",
              "updatedAt": "2026-05-30T16:28:00.000Z"
            }
          }
        }
        ```

---

## 11. Dashboard APIs

### 11.1 Dashboard Overview (`GET /dashboard/overview`)
Fetches facility summary metric counts.
*   **Authentication Requirements**: JWT Access Token with role `ADMIN` or `GUARDIAN`.
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**: None
*   **Query Parameters**: None
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "residentCount": 150,
            "activeResidents": 142,
            "highRiskResidents": 3,
            "unreadNotifications": 5,
            "averageWelfareIndex": 82.4
          }
        }
        ```

### 11.2 List Residents Risk summaries (`GET /dashboard/residents`)
Lists active resident welfare risk classifications.
*   **Authentication Requirements**: JWT Access Token with role `ADMIN` or `GUARDIAN`.
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**: None
*   **Query Parameters**:
    *   `limit`: (Optional page limit pagination parameter, default: `25`)
    *   `offset`: (Optional page offset)
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "residents": [
              {
                "resident": {
                  "id": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
                  "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
                  "firstName": "Raman",
                  "lastName": "Nathan",
                  "gender": "MALE",
                  "dateOfBirth": "1945-08-15T00:00:00.000Z",
                  "admissionDate": "2026-05-01T00:00:00.000Z",
                  "status": "ACTIVE",
                  "weightMedication": 1.5,
                  "weightNutrition": 1,
                  "weightVitals": 2,
                  "createdAt": "2026-05-30T16:20:00.000Z"
                },
                "welfareIndex": 35,
                "riskLevel": "HIGH"
              }
            ]
          }
        }
        ```

### 11.3 Fetch Facility Alerts (`GET /dashboard/notifications`)
Retrieves unread alert lists for the facility.
*   **Authentication Requirements**: JWT Access Token with role `ADMIN` or `GUARDIAN`.
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**: None
*   **Query Parameters**:
    *   `limit`: (Optional pagination page limit, default: `25`)
    *   `offset`: (Optional pagination offset)
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "notifications": [
              {
                "id": "n1827e8d-8a8d-4be9-81a1-f3b145a9018e",
                "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
                "residentId": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
                "type": "LOW_WELFARE_SCORE",
                "title": "Resident Welfare Warning",
                "message": "Resident welfare index dropped below threshold.",
                "status": "UNREAD",
                "createdAt": "2026-05-30T16:25:00.000Z",
                "updatedAt": "2026-05-30T16:25:00.000Z"
              }
            ]
          }
        }
        ```

### 11.4 Get Resident Dashboard (`GET /dashboard/residents/:residentId`)
Retrieves compiled profile, analytics indices, and unread notifications for a specific ward.
*   **Authentication Requirements**: JWT Access Token with role `ADMIN` or `GUARDIAN`.
*   **Tenant Requirements**: Yes.
*   **Headers**:
    *   `Authorization`: `Bearer eyJhbGciOi...`
    *   `X-Tenant-ID`: `c4d79c6d-5db3-4df4-a8c4-c2c61ee36184`
*   **Path Parameters**:
    *   `residentId`: UUID of the target resident.
*   **Query Parameters**:
    *   `limit`: (Optional pagination limit for alerts sub-list)
    *   `offset`: (Optional pagination offset for alerts sub-list)
*   **Request Example**: None
*   **Success Response Example**:
    *   `200 OK`
        ```json
        {
          "success": true,
          "data": {
            "resident": {
              "id": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
              "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
              "firstName": "Raman",
              "lastName": "Nathan",
              "gender": "MALE",
              "dateOfBirth": "1945-08-15T00:00:00.000Z",
              "admissionDate": "2026-05-01T00:00:00.000Z",
              "status": "ACTIVE",
              "weightMedication": 1.5,
              "weightNutrition": 1,
              "weightVitals": 2,
              "createdAt": "2026-05-30T16:20:00.000Z"
            },
            "analytics": {
              "scores": {
                "medication": 100,
                "nutrition": 95,
                "vitals": 90,
                "activity": 85
              },
              "welfareIndex": 92.5,
              "updatedAt": "2026-05-30T16:22:00.000Z"
            },
            "notifications": [
              {
                "id": "n1827e8d-8a8d-4be9-81a1-f3b145a9018e",
                "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
                "residentId": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
                "type": "LOW_WELFARE_SCORE",
                "title": "Resident Welfare Warning",
                "message": "Resident welfare index dropped below threshold.",
                "status": "UNREAD",
                "createdAt": "2026-05-30T16:25:00.000Z",
                "updatedAt": "2026-05-30T16:25:00.000Z"
              }
            ]
          }
        }
        ```
*   **Error Response Examples**:
    *   `404 Not Found` (Resident profile not registered or is soft-archived)
        ```json
        {
          "success": false,
          "error": {
            "message": "Resident not found"
          }
        }
        ```

---

## 12. Dashboard Data Aggregation

Dashboard endpoints aggregate statistics by querying relational tables within PostgreSQL:
1.  **Aggregated Counts**: 
    The dashboard retrieves the general statistics of the facility by grouping metrics at the tenant level. It uses conditional aggregation:
    *   `residentCount`: `COUNT(residents.id)`
    *   `activeResidents`: `COUNT(residents.id) FILTER (WHERE residents.status = 'ACTIVE')`
    *   `highRiskResidents`: `COUNT(residents.id) FILTER (WHERE resident_analytics.welfare_index < 40)`
    *   `averageWelfareIndex`: `AVG(resident_analytics.welfare_index)`
    *   `unreadNotifications`: A subquery count on the `notifications` table filtering on `status = 'UNREAD'`.
2.  **Risk Level Classification**:
    The system maps the numeric welfare index ($WI$) values to discrete risk classes:
    *   $WI < 40 \implies \text{HIGH Risk}$
    *   $40 \le WI < 70 \implies \text{MEDIUM Risk}$
    *   $WI \ge 70 \implies \text{LOW Risk}$
3.  **Resident Dashboard Compound Join**:
    The resident dashboard endpoint (`GET /dashboard/residents/:residentId`) executes a compound query fetching properties across three distinct schemas:
    *   Queries PostgreSQL for the `resident` profile block (`residents` table).
    *   Joins the pre-calculated welfare scores and index (`resident_analytics` table).
    *   Retrieves the timeline array of warning alert items (`notifications` table).

---

## 13. Global Response & Error Codes

All operational error states return a standard error JSON envelope matching the HTTP status:
```json
{
  "success": false,
  "error": {
    "message": "Specific error description details"
  }
}
```

Common status codes returned by the API:
*   `400 Bad Request`: Payload validation failed, parameters missing, or invalid parameter types provided.
*   `401 Unauthorized`: Authentication token is missing, expired, or invalid.
*   `403 Forbidden`: Access denied due to role boundaries (e.g. CARETAKER attempting to CRUD residents) or cross-tenant access violations.
*   `404 Not Found`: Target resource (resident, institution, care log, or notification) does not exist under caller's tenant context.
*   `409 Conflict`: Resource unique index collision (e.g. tenant slug or institution darpanId already in use).
*   `500 Internal Server Error`: Severe database connection failure or server processing error.

---

## 14. Academic & Production Boundaries

### 14.1 Current Academic Scope
The API service is running under a stateless Node.js environment backed by single-node instances of PostgreSQL (relational profile, session tokens, analytics, and notification records) and MongoDB (care log documents), utilizing standard Redis channels for async Pub/Sub event distribution.
*   No container orchestration (e.g., Kubernetes) is configured.
*   Single-node database storage without clustering, read replication, or automated sharding.
*   Session security utilizes JWT validation in memory without high-availability token store clusters.

### 14.2 Future Production Enhancements
Transitioning the current architecture to an enterprise production environment would require:
1.  **Rate Limiting**: Integrating middleware (e.g., `express-rate-limit` using a Redis store) to mitigate Denial of Service (DoS) and brute-force authentication attempts.
2.  **API Gateway & SSL Termination**: Deploying an API gateway (e.g., Kong, Nginx, or AWS API Gateway) to manage cross-cutting concerns like global logging, rate limiting, and SSL/TLS termination before reaching the Express.js runtime.
3.  **WebSocket Telemetry Integration**: Transitioning real-time notifications from HTTP polling to WebSocket channels backed by Redis adapter clusters to distribute live warnings dynamically.
4.  **Distributed Session Stores**: Implementing a multi-region Redis cluster for access token validation and session blacklisting.
