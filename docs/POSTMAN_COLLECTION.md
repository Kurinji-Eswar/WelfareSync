# Postman Collection & Integration Testing Guide
## WelfareSync Engine

---

## 1. Introduction
This document serves as the guide for setting up and executing integration tests using Postman for the **WelfareSync Engine**. It details environment variables, authorization patterns, tenant isolation setups, and the exact testing sequence to validate the system's endpoints.

---

## 2. Collection Setup & Environment Variables

To run the testing sequence, configure a Postman Environment with the following variables:
*   `baseUrl`: `http://127.0.0.1:5000/api/v1`
*   `tenantId`: (Dynamic UUID returned during tenant onboarding)
*   `adminToken`: (JWT access token returned during admin login)
*   `caretakerToken`: (JWT access token returned during caretaker registration and login)
*   `residentId`: (UUID returned during resident registration)
*   `institutionId`: (UUID returned during institution creation)
*   `notificationId`: (UUID of notifications warning generated automatically)

---

## 3. Required Scoping Headers

Unless hitting public routes, all requests must contain:
1.  `Authorization`: `Bearer <accessToken>` (JWT tokens authenticating users)
2.  `X-Tenant-ID`: `<tenantId>` (Scoping header checking tenant validation limits)

---

## 4. End-to-End Testing Sequence

Follow this sequence to test system functionality:

### Step 1: Onboard Tenant & Admin User
*   **Endpoint**: `POST {{baseUrl}}/auth/tenants`
*   **Description**: Registers a new care organization (tenant) and initializes the first administrator.
*   **Headers**: None (Public Endpoint).
*   **Request Payload**:
    ```json
    {
      "name": "Kuralara Care Center",
      "slug": "kuralara-care",
      "adminName": "Tenant Admin",
      "adminEmail": "admin@welfaresync.org",
      "adminPassword": "strongPassword123"
    }
    ```
*   **Expected Status Code**: `201 Created`
*   **Response Payload**:
    ```json
    {
      "success": true,
      "data": {
        "tenant": {
          "id": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
          "name": "Kuralara Care Center",
          "slug": "kuralara-care",
          "isActive": true,
          "createdAt": "2026-05-31T11:00:00.000Z",
          "updatedAt": "2026-05-31T11:00:00.000Z"
        },
        "admin": {
          "id": "b1827e8d-8a8d-4be9-81a1-f3b145a9018e",
          "name": "Tenant Admin",
          "email": "admin@welfaresync.org",
          "role": "ADMIN",
          "status": "ACTIVE"
        }
      }
    }
    ```
*   **Verification Notes**: Save the returned tenant `id` value into the environment variables as `tenantId`.

---

### Step 2: Authenticate Administrator Login
*   **Endpoint**: `POST {{baseUrl}}/auth/login`
*   **Description**: Authenticates administrator credentials and retrieves active tokens.
*   **Headers**: None.
*   **Request Payload**:
    ```json
    {
      "email": "admin@welfaresync.org",
      "password": "strongPassword123"
    }
    ```
*   **Expected Status Code**: `200 OK`
*   **Response Payload**:
    ```json
    {
      "success": true,
      "data": {
        "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
        "refreshToken": "eyJhbGciOiJIUzI1NiIsIn...",
        "user": {
          "id": "b1827e8d-8a8d-4be9-81a1-f3b145a9018e",
          "name": "Tenant Admin",
          "email": "admin@welfaresync.org",
          "role": "ADMIN",
          "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184"
        }
      }
    }
    ```
*   **Verification Notes**: Save the `accessToken` value as `adminToken`.

---

### Step 3: Register Caretaker Account
*   **Endpoint**: `POST {{baseUrl}}/auth/register`
*   **Description**: Registers a Caretaker account within the organization.
*   **Headers**:
    *   `Authorization`: `Bearer {{adminToken}}`
    *   `X-Tenant-ID`: `{{tenantId}}`
*   **Request Payload**:
    ```json
    {
      "name": "Caretaker User",
      "email": "caretaker@welfaresync.org",
      "password": "caretakerPass123",
      "role": "CARETAKER"
    }
    ```
*   **Expected Status Code**: `201 Created`
*   **Response Payload**:
    ```json
    {
      "success": true,
      "data": {
        "id": "a92e21b8-68e1-4541-b0e6-ee328b9d6287",
        "name": "Caretaker User",
        "email": "caretaker@welfaresync.org",
        "role": "CARETAKER",
        "status": "ACTIVE",
        "createdAt": "2026-05-31T11:05:00.000Z"
      }
    }
    ```
*   **Verification Notes**: The caretaker can log in using `POST /auth/login` to retrieve their credentials, saving it as `caretakerToken`.

---

### Step 4: Create Institution Workspace
*   **Endpoint**: `POST {{baseUrl}}/institutions`
*   **Description**: Configures physical shelter workspaces or home branches.
*   **Headers**:
    *   `Authorization`: `Bearer {{adminToken}}`
    *   `X-Tenant-ID`: `{{tenantId}}`
*   **Request Payload**:
    ```json
    {
      "name": "Kuralara Elderly Wing A",
      "darpanId": "TN/2026/001425",
      "status": "ACTIVE"
    }
    ```
*   **Expected Status Code**: `201 Created`
*   **Response Payload**:
    ```json
    {
      "success": true,
      "data": {
        "id": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
        "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
        "name": "Kuralara Elderly Wing A",
        "darpanId": "TN/2026/001425",
        "status": "ACTIVE",
        "createdAt": "2026-05-31T11:08:00.000Z",
        "updatedAt": "2026-05-31T11:08:00.000Z"
      }
    }
    ```
*   **Verification Notes**: Save the returned institution `id` as `institutionId`.

---

### Step 5: Register Resident Profile
*   **Endpoint**: `POST {{baseUrl}}/residents`
*   **Description**: Registers a resident profile and configures the category weights used to calculate the Welfare Index.
*   **Headers**:
    *   `Authorization`: `Bearer {{adminToken}}`
    *   `X-Tenant-ID`: `{{tenantId}}`
*   **Request Payload**:
    ```json
    {
      "firstName": "John",
      "lastName": "Doe",
      "weightMedication": 1.5,
      "weightNutrition": 1.0,
      "weightVitals": 2.0,
      "status": "ACTIVE"
    }
    ```
*   **Expected Status Code**: `201 Created`
*   **Response Payload**:
    ```json
    {
      "success": true,
      "data": {
        "id": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
        "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
        "firstName": "John",
        "lastName": "Doe",
        "status": "ACTIVE",
        "weightMedication": 1.5,
        "weightNutrition": 1.0,
        "weightVitals": 2.0,
        "createdAt": "2026-05-31T11:10:00.000Z",
        "updatedAt": "2026-05-31T11:10:00.000Z"
      }
    }
    ```
*   **Verification Notes**: Save the returned resident `id` as `residentId`.

---

### Step 6: Create Telemetry Care Log
*   **Endpoint**: `POST {{baseUrl}}/logs`
*   **Description**: Caretakers write health telemetry inputs to MongoDB, publishing events to Redis.
*   **Headers**:
    *   `Authorization`: `Bearer {{caretakerToken}}`
    *   `X-Tenant-ID`: `{{tenantId}}`
*   **Request Payload**:
    ```json
    {
      "residentId": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
      "type": "vitals",
      "details": {
        "systolic": 110,
        "diastolic": 70,
        "pulse": 68,
        "score": 10.00
      },
      "recordedAt": "2026-05-31T11:12:00.000Z"
    }
    ```
*   **Expected Status Code**: `201 Created`
*   **Response Payload**:
    ```json
    {
      "success": true,
      "data": {
        "id": "6516df4b2f4a1b001258d4b9",
        "tenantId": "c4d79c6d-5db3-4df4-a8c4-c2c61ee36184",
        "residentId": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
        "caretakerId": "a92e21b8-68e1-4541-b0e6-ee328b9d6287",
        "type": "vitals",
        "details": {
          "systolic": 110,
          "diastolic": 70,
          "pulse": 68,
          "score": 10.00
        },
        "recordedAt": "2026-05-31T11:12:00.000Z",
        "createdAt": "2026-05-31T11:12:05.000Z",
        "updatedAt": "2026-05-31T11:12:05.000Z"
      }
    }
    ```
*   **Verification Notes**: This write dispatches an asynchronous task to Redis. The worker processes calculations and writes computed indices to PostgreSQL.

---

### Step 7: Query Resident Analytics Metrics
*   **Endpoint**: `GET {{baseUrl}}/analytics/residents/{{residentId}}`
*   **Description**: Retrieves calculated category scores and the overall Welfare Index ($WI$).
*   **Headers**:
    *   `Authorization`: `Bearer {{adminToken}}`
    *   `X-Tenant-ID`: `{{tenantId}}`
*   **Expected Status Code**: `200 OK`
*   **Response Payload**:
    ```json
    {
      "success": true,
      "data": {
        "resident": {
          "id": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
          "firstName": "John",
          "lastName": "Doe"
        },
        "analytics": {
          "medicationScore": 100.00,
          "nutritionScore": 20.00,
          "vitalsScore": 10.00,
          "activityScore": 85.00,
          "welfareIndex": 42.22,
          "updatedAt": "2026-05-31T11:12:06.000Z"
        }
      }
    }
    ```
*   **Verification Notes**: Confirm that calculations apply the configured weights correctly and that the Welfare Index ($WI$) drops below the critical threshold (50.00).

---

### Step 8: List Warning Notifications
*   **Endpoint**: `GET {{baseUrl}}/notifications`
*   **Description**: Retrieves warning notifications triggered by the Analytics Worker.
*   **Headers**:
    *   `Authorization`: `Bearer {{adminToken}}`
    *   `X-Tenant-ID`: `{{tenantId}}`
*   **Expected Status Code**: `200 OK`
*   **Response Payload**:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "2382f7d1-0a4b-4819-81a1-f3b145a9018e",
          "residentId": "e92e21b8-68e1-4541-b0e6-ee328b9d6287",
          "type": "WARNING",
          "title": "Low welfare index warning alert log",
          "status": "UNREAD",
          "createdAt": "2026-05-31T11:12:06.000Z"
        }
      ]
    }
    ```
*   **Verification Notes**: Displays the automatically generated alert. Save the notification `id` as `notificationId`.

---

### Step 9: Retrieve Dashboard Overview
*   **Endpoint**: `GET {{baseUrl}}/dashboard/overview`
*   **Description**: Serves aggregated metrics for the facility, reading from pre-calculated SQL tables.
*   **Headers**:
    *   `Authorization`: `Bearer {{adminToken}}`
    *   `X-Tenant-ID`: `{{tenantId}}`
*   **Expected Status Code**: `200 OK`
*   **Response Payload**:
    ```json
    {
      "success": true,
      "data": {
        "totalResidents": 1,
        "averageWelfareIndex": 42.22,
        "highRiskCount": 1,
        "mediumRiskCount": 0,
        "lowRiskCount": 0,
        "unreadNotificationsCount": 1
      }
    }
    ```
*   **Verification Notes**: The dashboard compiler aggregates pre-calculated values in PostgreSQL cache tables to ensure low latency.
