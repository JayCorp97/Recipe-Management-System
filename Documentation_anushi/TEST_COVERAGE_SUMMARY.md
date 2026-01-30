# Test Coverage Summary

**Recipe Management System – Backend Authentication & API Testing**

This document summarizes automated end-to-end API testing implemented with **Mocha** (and Chai/Supertest) for reliability and security of the backend authentication system, plus **Postman** collections for manual/automated API checks.

---

## 1. Testing Stack

| Component        | Technology              | Purpose                                      |
|-----------------|-------------------------|----------------------------------------------|
| Test runner     | Mocha                   | E2E and unit test execution                  |
| Assertions      | Chai                    | Expected vs actual assertions                |
| HTTP client     | Supertest               | Request/response against Express app         |
| API collections | Postman (v2.1)          | Auth & Admin endpoint requests and scripts  |

**Last full run:** 199 tests passing (Mocha).

---

## 2. Tested Workflows

### 2.1 Auth Workflows (Mocha – `backend/test/routes/auth.test.js`)

| Workflow / Area              | Description                                                                 | Tests |
|-----------------------------|-----------------------------------------------------------------------------|-------|
| **User registration**       | POST `/api/auth/register` with valid/invalid data                          | 7     |
| **User login**              | POST `/api/auth/login` with valid/invalid/inactive user                    | 5     |
| **OTP request**             | POST `/api/auth/request-otp` for existing/inactive/non-existent user       | 3     |
| **OTP verify**              | POST `/api/auth/verify-otp` with valid/invalid/expired OTP                  | 3     |
| **Get current user**       | GET `/api/auth/me` with/without token                                       | 2     |
| **Get admin user**         | GET `/api/auth/admin/me` as admin vs regular user                           | 2     |
| **Logout**                  | POST `/api/auth/logout` with/without token                                  | 2     |

**Covered behaviors:** duplicate email (400), password mismatch (400), weak password (400), password hashing, email normalization, JWT on register/login, invalid/inactive login (401/403), OTP lifecycle, auth required (401), admin-only (403).

### 2.2 Admin Workflows (Mocha)

| Workflow / Area              | Description                                                                 | Location |
|-----------------------------|-----------------------------------------------------------------------------|----------|
| **Admin auth**              | GET `/api/auth/admin/me` – admin returns 200, user returns 403             | `auth.test.js` |
| **Admin list recipes**      | GET `/api/recipes/admin/all` – admin gets all, user gets 403               | `recipes.test.js`, `workflows.test.js` |
| **Admin delete recipe**     | DELETE `/api/recipes/admin/:id` – admin can delete any recipe; user 403    | `recipes.test.js`, `workflows.test.js` |
| **Full admin workflow**     | Login as admin → view all recipes → delete any recipe; user blocked on admin routes | `workflows.test.js` |

**Covered behaviors:** adminOnly middleware, user vs admin token, 401 without token, 403 for non-admin on admin routes.

### 2.3 Integration Workflows (Mocha – `backend/test/integration/workflows.test.js`)

| Workflow                                      | Description                                                                 |
|-----------------------------------------------|-----------------------------------------------------------------------------|
| **Full user lifecycle**                       | Register → Login → GET /me → Create recipe → View → Update → Delete         |
| **Admin lifecycle**                           | Create admin → Login → GET /api/recipes/admin/all → DELETE /api/recipes/admin/:id |
| **User vs admin isolation**                  | Regular user cannot call GET `/api/auth/admin/me` or GET `/api/recipes/admin/all` |
| **Multi-user**                                | Multiple users; each sees only own recipes; admin sees all                 |

---

## 3. Expected vs Actual Results

### 3.1 Auth Endpoints

| Endpoint / Scenario                    | Expected Result              | Actual Result (Mocha) |
|--------------------------------------|------------------------------|------------------------|
| POST `/api/auth/register` (valid)    | 201, `message`, `token`      | Pass                   |
| POST `/api/auth/register` (duplicate email) | 400, VALIDATION_ERROR | Pass                   |
| POST `/api/auth/register` (passwords mismatch) | 400, error mentions match | Pass           |
| POST `/api/auth/register` (weak password) | 400, VALIDATION_ERROR  | Pass                   |
| POST `/api/auth/register`            | Password stored hashed       | Pass                   |
| POST `/api/auth/register`            | Email stored lowercase       | Pass                   |
| POST `/api/auth/login` (valid)       | 200, `token`                 | Pass                   |
| POST `/api/auth/login` (invalid email) | 401, AUTH_ERROR           | Pass                   |
| POST `/api/auth/login` (invalid password) | 401, AUTH_ERROR         | Pass                   |
| POST `/api/auth/login` (inactive user) | 403, FORBIDDEN             | Pass                   |
| POST `/api/auth/request-otp` (valid)  | 200, OTP stored/sent message | Pass                   |
| POST `/api/auth/request-otp` (user not found) | 404, NOT_FOUND        | Pass                   |
| POST `/api/auth/verify-otp` (valid)   | 200, `token`, OTP cleared    | Pass                   |
| POST `/api/auth/verify-otp` (invalid/expired) | 401, AUTH_ERROR       | Pass                   |
| GET `/api/auth/me` (with token)       | 200, user without password   | Pass                   |
| GET `/api/auth/me` (no token)         | 401                          | Pass                   |
| GET `/api/auth/admin/me` (admin)      | 200, `role: admin`           | Pass                   |
| GET `/api/auth/admin/me` (user)       | 403, FORBIDDEN               | Pass                   |
| POST `/api/auth/logout` (with token)   | 200, message “Logged out”    | Pass                   |
| POST `/api/auth/logout` (no token)    | 401                          | Pass                   |

### 3.2 Admin Endpoints

| Endpoint / Scenario                          | Expected Result           | Actual Result (Mocha) |
|---------------------------------------------|---------------------------|------------------------|
| GET `/api/auth/admin/me` (admin token)       | 200, role admin           | Pass                   |
| GET `/api/auth/admin/me` (user token)       | 403                       | Pass                   |
| GET `/api/recipes/admin/all` (admin token)  | 200, `recipes`, `count`   | Pass                   |
| GET `/api/recipes/admin/all` (user token)   | 403                       | Pass                   |
| GET `/api/recipes/admin/all` (no token)     | 401                       | Pass                   |
| DELETE `/api/recipes/admin/:id` (admin)     | 200, “Recipe deleted by admin” | Pass             |
| DELETE `/api/recipes/admin/:id` (user)      | 403                       | Pass                   |
| DELETE `/api/recipes/admin/:id` (no token)  | 401                       | Pass                   |

### 3.3 Mocha Run Summary

| Metric        | Value   |
|---------------|---------|
| Total tests   | 199     |
| Passing       | 199     |
| Failing       | 0       |
| Last run      | ~18 s   |

---

## 4. Postman Collections

Two Postman v2.1 collections are provided for manual and automated checks:

### 4.1 Auth Endpoints (`postman/Auth-Endpoints.postman_collection.json`)

- **Variables:** `baseUrl` (e.g. `http://localhost:3000`), `token`, `testEmail`, `testPassword`
- **Requests:** Register (success, duplicate email, weak password), Login (success, invalid credentials), Request OTP (success, user not found), Get Me (with/without token), Logout (with/without token)
- **Tests:** Status codes and response body checks (e.g. token presence, error codes)

**Usage:** Import into Postman, set `baseUrl` and optionally `testEmail`/`testPassword`. Run “Register - Success” then “Login - Success” to set `token` for protected requests.

### 4.2 Admin Endpoints (`postman/Admin-Endpoints.postman_collection.json`)

- **Variables:** `baseUrl`, `adminToken`, `userToken`, `recipeId`
- **Requests:** GET `/api/auth/admin/me` (admin / user / no token), GET `/api/recipes/admin/all` (admin / user / no token), DELETE `/api/recipes/admin/:id` (admin / user / no token)
- **Tests:** Status codes and error codes (401/403) and admin-only success responses

**Usage:** Create an admin (e.g. `npm run create-admin` in backend), login via Auth collection, set `adminToken`. Optionally create a user and recipe and set `userToken` and `recipeId` to test 403 cases.

---

## 5. How to Run

### Mocha (backend)

```bash
cd backend
npm test
```

Optional:

- `npm run test:integration` – integration tests only  
- `npm run test:coverage` – with coverage (if nyc is configured)

### Postman

1. Import `postman/Auth-Endpoints.postman_collection.json` and `postman/Admin-Endpoints.postman_collection.json`.
2. Set collection variables (`baseUrl`, and for Admin: `adminToken`, optionally `userToken`, `recipeId`).
3. Run the collection (or individual requests) and review test results in the Postman test tab.

---

## 6. Summary

| Deliverable                         | Status   | Location / Notes                                      |
|-------------------------------------|----------|--------------------------------------------------------|
| Postman collection – Auth endpoints | Complete | `postman/Auth-Endpoints.postman_collection.json`       |
| Postman collection – Admin endpoints| Complete | `postman/Admin-Endpoints.postman_collection.json`      |
| Mocha E2E API tests – Auth          | Complete | `backend/test/routes/auth.test.js`                    |
| Mocha E2E API tests – Admin         | Complete | `backend/test/routes/auth.test.js`, `recipes.test.js`, `workflows.test.js` |
| Test coverage summary               | Complete | This document (workflows + expected vs actual)        |

**Conclusion:** Postman collections for Auth and Admin endpoints are in place, Mocha-based E2E API testing is implemented and passing, and this document provides the test coverage summary with tested workflows and expected vs actual results.
