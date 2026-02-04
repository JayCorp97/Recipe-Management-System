# Admin Module Features

This document summarizes the completed admin capabilities and how they map to the user stories and technical requirements.

## Scope Overview
- Admin-only authentication flow and route protection
- Category management (CRUD)
- Recipe management (list, filter, delete, bulk delete)
- User management (list, search, deactivate, delete, bulk ops)
- Audit logging for admin actions
- Analytics and dynamic dashboard charts
- Real-time data refresh across admin UI

## Authentication & Access Control
- JWT-based authentication with admin-only route enforcement
- Shared auth middleware for token validation and user status checks
- Role-based middleware enforcing admin-only access
- Self-protection rules prevent admin self-deactivation/deletion
- Protection against altering other admin users

## US1: Admin Category Management
- Category model with MongoDB schema and slugs
- Admin-only CRUD endpoints with validation
- Safeguards against deleting categories in use by recipes
- UI for list, add, edit, delete
- Immediate UI refresh on changes
- Audit trail for create/update/delete

## US2: Admin Recipe Management
- Admin API to list all recipes with pagination and filtering
- Search with regex across title, description, category, and tags
- Role-protected delete with confirmation modal
- Soft delete and hard delete modes
- Bulk delete operations
- Immediate UI updates after deletion
- Audit trail for admin deletions

## US3: Admin User Management
- Admin API to list users with pagination and search
- Regex search across first name, last name, email
- Status management (active/suspended/deleted)
- Deactivation blocks login/access
- Soft delete with audit trail
- Hard delete with data constraints (prevents deletion if related data exists)
- Bulk deactivate and bulk delete
- Self-protection and admin-protection rules
- UI with confirmation modals and bulk actions

## Admin Analytics & Insights
- Aggregation pipelines using:
  - $match, $group, $project, $lookup, $unwind, $bucket, $dateToString
- Time-based trends for users and recipes
- Growth percentage calculations
- Rating distribution buckets
- Role breakdown
- Category usage insights
- Tag insights with average rating

## Admin Dashboard UI
- Dedicated admin dashboard with sidebar navigation
- Responsive layout for desktop and smaller screens
- Metrics cards for totals and growth
- Dynamic chart updates (Chart.js) for:
  - User trends
  - Recipe trends
  - Rating buckets
  - Role breakdown
- Auto-refresh and manual refresh controls

## Error Handling & Validation
- Standardized error responses for admin APIs
- Input validation on all admin endpoints
- Defensive checks for invalid IDs and missing payloads

## Audit Trails
- Admin actions are recorded via `AdminAudit`
- Tracks actor, action, target, and timestamps

## Data Seeding (Demo)
- `npm run seed-demo` creates:
  - Demo admin and users
  - Categories
  - Sample recipes

## Key Admin Entry Points
- Admin login: `http://localhost:5000/admin-login.html`
- Admin dashboard: `http://localhost:5000/admin-dashboard.html`

