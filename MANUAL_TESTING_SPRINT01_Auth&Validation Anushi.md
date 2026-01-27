# Manual Testing Documentation

This document outlines the manual testing procedures for the Recipe Management System API.

## Authentication

### Endpoints

| Endpoint | Method | Body / Notes |
|----------|--------|--------------|
| `/api/auth/register` | POST | `{ "f_name": "John", "l_name": "Doe", "email": "john@example.com", "password": "Test123!", "confirm_password": "Test123!" }` |
| `/api/auth/login` | POST | `{ "email": "john@example.com", "password": "Test123!" }` |
| `/api/auth/admin/login` | POST | `{ "email": "admin@example.com", "password": "Admin123!" }` |
| `/api/auth/me` | GET | Header: `Authorization: Bearer {{user_token}}` |
| `/api/auth/admin/me` | GET | Header: `Authorization: Bearer {{admin_token}}` |
| `/api/auth/logout` | POST | Header: `Authorization: Bearer {{user_token}}` |

## Recipes

### Endpoints

| Endpoint | Method | Body / Notes |
|----------|--------|--------------|
| `/api/recipes` | GET | Public, no auth |
| `/api/recipes` | POST | `{ "title": "Cookies", "description": "Yummy", "category": "Dessert", "rating": 5 }`, Header: `Authorization: Bearer {{user_token}}` |
| `/api/recipes/mine` | GET | Header: `Authorization: Bearer {{user_token}}` |
| `/api/recipes/admin/all` | GET | Header: `Authorization: Bearer {{admin_token}}` |
| `/api/recipes/{{recipe_id}}` | DELETE | Header: `Authorization: Bearer {{user_token}}` |
| `/api/recipes/admin/{{recipe_id}}` | DELETE | Header: `Authorization: Bearer {{admin_token}}` |

## Security Testing

### Test Cases

| Test | Endpoint | Method | Notes |
|------|----------|--------|-------|
| Rate Limit | `/api/auth/login` | POST | Send >20 requests rapidly, expect 429 |
| Body Size Limit | `/api/auth/register` | POST | Payload >10KB, expect 413 |
| Invalid Token | `/api/auth/me` | GET | Header: `Authorization: Bearer invalid_token`, expect 401 |
| Missing Auth | `/api/recipes/mine` | GET | No Authorization header, expect 401 |

## Role-Based Access Control (RBAC)

### Test Scenarios

| Scenario | Endpoint | Method | Expected Result |
|----------|----------|--------|-----------------|
| Regular user access | `/api/auth/me`, `/api/recipes/mine`, `/api/recipes` | GET/POST | Should succeed with user token |
| Regular user admin routes | `/api/auth/admin/me`, `/api/recipes/admin/all` | GET | Should return 403 with user token |
| Admin full access | All routes | GET/POST/DELETE | Should succeed with admin token |
| Regular user admin login | `/api/auth/admin/login` | POST | Should return 403 |

## Testing Instructions

### Prerequisites
- API server running
- Postman or similar API testing tool
- Valid user credentials
- Valid admin credentials

### Test Execution
1. Start with authentication endpoints to obtain tokens
2. Test regular user endpoints with user token
3. Test admin endpoints with admin token
4. Verify security measures (rate limiting, body size limits)
5. Test RBAC scenarios to ensure proper access control

### Expected Behaviors
- All endpoints should return appropriate HTTP status codes
- Authentication tokens should be validated correctly
- Role-based access should be enforced
- Security measures should prevent abuse
