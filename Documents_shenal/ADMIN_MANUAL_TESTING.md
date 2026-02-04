# Admin Manual Testing

This document lists manual test cases for all admin capabilities.

## 1) Admin Authentication

### MT-01 Admin Login (Success)
- Steps:
  1. Open `http://localhost:5000/admin-login.html`
  2. Enter admin email and password
  3. Click **Admin Login**
- Expected:
  - Redirect to `admin-dashboard.html`
  - Admin sidebar and header visible

### MT-02 Admin Login (Non‑admin)
- Steps:
  1. Use a regular user’s email/password on admin login
- Expected:
  - Access denied (403) / blocked
  - User cannot access admin dashboard

### MT-03 Admin Auth Guard
- Steps:
  1. Clear `localStorage` token
  2. Navigate to `admin-dashboard.html`
- Expected:
  - Redirect to admin login

---

## 2) User Management

### MT-04 List Users (Pagination/Search)
- Steps:
  1. Open **Manage Users**
  2. Search by name/email
  3. Use pagination
- Expected:
  - List updates based on filters
  - Pagination metadata correct

### MT-05 Deactivate User
- Steps:
  1. Click **Deactivate** on a user
  2. Confirm modal
- Expected:
  - Status shows **Suspended**
  - User cannot login

### MT-06 Activate User
- Steps:
  1. Click **Activate** on a suspended user
- Expected:
  - Status shows **Active**
  - User can login

### MT-07 Soft Delete User
- Steps:
  1. Click **Delete**
  2. Choose **Soft Delete**
- Expected:
  - Status shows **Deleted**
  - User cannot login

### MT-08 Hard Delete User (With Data)
- Steps:
  1. Attempt **Hard Delete** for user with recipes/comments
- Expected:
  - Operation blocked with validation error

### MT-09 Self‑Protection
- Steps:
  1. Attempt to deactivate/delete your own admin account
- Expected:
  - Operation blocked

### MT-10 Admin‑Protection
- Steps:
  1. Attempt to deactivate/delete another admin
- Expected:
  - Operation blocked (403)

### MT-11 Bulk Deactivate
- Steps:
  1. Select multiple users
  2. Click **Bulk Deactivate**
- Expected:
  - Users become **Suspended**
  - Protected users are skipped

### MT-12 Bulk Delete
- Steps:
  1. Select multiple users
  2. Click **Bulk Delete** (soft/hard)
- Expected:
  - Soft delete applies
  - Hard delete skips users with data
  - Skipped reasons returned

---

## 3) Category Management

### MT-13 Create Category
- Steps:
  1. Click **Add Category**
  2. Enter name/description/status
- Expected:
  - Category appears in list

### MT-14 Update Category
- Steps:
  1. Edit category fields
- Expected:
  - Category updates in list
  - Recipe category updates when name changes

### MT-15 Delete Category (Unused)
- Steps:
  1. Delete a category not used by recipes
- Expected:
  - Category removed

### MT-16 Delete Category (In Use)
- Steps:
  1. Delete a category assigned to a recipe
- Expected:
  - 409 error, category not removed

---

## 4) Recipe Management

### MT-17 List Recipes (Filters/Search)
- Steps:
  1. Filter by category/status
  2. Search by title/desc/tags
- Expected:
  - Results filtered correctly

### MT-18 Delete Recipe (Soft)
- Steps:
  1. Delete recipe with **Soft** mode
- Expected:
  - Recipe marked deleted

### MT-19 Delete Recipe (Hard)
- Steps:
  1. Delete recipe with **Hard** mode
- Expected:
  - Recipe removed permanently

### MT-20 Bulk Delete Recipes
- Steps:
  1. Select multiple recipes
  2. Bulk delete (soft/hard)
- Expected:
  - Recipes removed/soft deleted
  - Skips invalid IDs

---

## 5) Analytics & Insights

### MT-21 Overview Metrics
- Steps:
  1. Open **Insights**
- Expected:
  - Total users, recipes, categories, avg rating visible

### MT-22 Trends (Range)
- Steps:
  1. Change date range 7/30/90 days
- Expected:
  - Charts update with new data

### MT-23 Rating Buckets
- Steps:
  1. View ratings chart
- Expected:
  - Buckets populated with counts

### MT-24 Role Breakdown
- Steps:
  1. View role breakdown chart
- Expected:
  - Admin vs user bars visible

### MT-25 Category Usage & Tag Insights
- Steps:
  1. View tables
- Expected:
  - Top categories/tags sorted by usage

---

## 6) Audit Trails

### MT-26 Admin Audit Log
- Steps:
  1. Perform any admin action (delete user/category/recipe)
- Expected:
  - AdminAudit entry created

