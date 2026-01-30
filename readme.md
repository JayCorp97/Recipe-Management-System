# Recipe Management System

A modern, user-friendly web application to create, organize, and manage recipes. Users can add recipes with ingredients, instructions, categories, and images, making it easy to build a personal cookbook or manage recipes for home or professional use.

---

## 📌 Features

- **User Authentication** – Login, registration, OTP-based login
- **CRUD Recipes** – Create, read, update, and delete recipes
- **Categorization** – Breakfast, Desserts, Vegetarian, etc.
- **Step-by-step Instructions** – For every recipe
- **Image Upload** – Upload photos for recipes (drag-and-drop, validation)
- **Search & Filter** – Quickly find recipes (client-side)
- **Responsive Design** – Works on desktop and mobile
- **Activity Feed** – Real-time recipe create/update/delete tracking (Socket.IO)
- **Comments** – Add and view comments on recipes
- **Admin** – Admin-only routes (all recipes, delete any recipe)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- npm or yarn

### 1. Install & Configure

```bash
cd Recipe-Management-System/backend
npm install
```

Create a `.env` file in the `backend` folder:

```env
MONGO_URI=mongodb://localhost:27017/recipe-management
JWT_SECRET=your-secret-key-change-in-production
PORT=5000
```

### 2. Run the App

```bash
npm start
```

- Backend + frontend: **http://localhost:5000**
- Frontend is served as static files from `../frontend`
- API base: **http://localhost:5000/api**

---

## 👤 Admin Setup

An admin user is required for admin-only endpoints (`GET /api/recipes/admin/all`, `DELETE /api/recipes/admin/:id`, `GET /api/auth/admin/me`).

### Option 1: Using the script (recommended)

1. Ensure `MONGO_URI` and `JWT_SECRET` are set in `backend/.env`.
2. From `backend`, run:

   ```bash
   npm run create-admin
   ```

   This uses defaults:
   - **Email:** `admin@example.com`
   - **Password:** `Admin123!`
   - **Name:** Admin User

3. Optional – override with env vars:

   ```bash
   ADMIN_EMAIL=admin@myapp.com ADMIN_PASSWORD=MySecure123! npm run create-admin
   ```

   Supported: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FNAME`, `ADMIN_LNAME`.

4. If a user with that email already exists, the script updates them to `role: "admin"` instead of creating a new user.

5. Log in via `POST /api/auth/login` with the admin email/password. Use the returned JWT as `Authorization: Bearer <token>` for admin routes.

### Option 2: Manual creation

1. Register a normal user via `POST /api/auth/register`.
2. In MongoDB, set that user’s `role` to `"admin"`:

   ```js
   db.users.updateOne(
     { email: "your-admin@example.com" },
     { $set: { role: "admin" } }
   )
   ```

### ⚠️ Security

- Change the default admin password after first login.
- Use a strong `JWT_SECRET` in production.
- Keep `.env` out of version control.

---

## 📡 API Reference (Working Endpoints)

All APIs that work in the project are listed below. For protected routes, send the JWT in the header:

```
Authorization: Bearer <your-jwt-token>
```

Error responses use a standard shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": "Optional string or array"
  }
}
```

Common `error.code` values: `VALIDATION_ERROR`, `AUTH_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMIT_EXCEEDED`, `PAYLOAD_TOO_LARGE`, `SERVER_ERROR`.

---

### Auth APIs

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| POST | `/api/auth/register` | Public | Register a new user |
| POST | `/api/auth/login` | Public | Login, get JWT |
| POST | `/api/auth/request-otp` | Public | Request OTP for email (dev: logged to console) |
| POST | `/api/auth/verify-otp` | Public | Verify OTP, get JWT |
| GET | `/api/auth/me` | Auth | Current user (exclude password) |
| GET | `/api/auth/admin/me` | Admin | Current admin user |
| GET | `/api/auth/public/:id` | Auth | User by ID (requires JWT). Prefer `GET /api/users/public/:id` for public access. |
| POST | `/api/auth/logout` | Auth | Logout (client should discard token) |

#### POST `/api/auth/register`

**Request (JSON):**

```json
{
  "f_name": "Jane",
  "l_name": "Doe",
  "email": "jane@example.com",
  "password": "SecurePass1!",
  "confirm_password": "SecurePass1!"
}
```

- Password: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character.
- `confirm_password` must match `password`.

**Response `201`:**

```json
{
  "message": "Registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error `400` (e.g. validation, email exists, passwords mismatch):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": ["Email already exists"]
  }
}
```

---

#### POST `/api/auth/login`

**Request (JSON):**

```json
{
  "email": "jane@example.com",
  "password": "SecurePass1!"
}
```

**Response `200`:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error `401`:**

```json
{
  "error": {
    "code": "AUTH_ERROR",
    "message": "Invalid email or password"
  }
}
```

---

#### POST `/api/auth/request-otp`

**Request (JSON):**

```json
{
  "email": "jane@example.com"
}
```

**Response `200`:**

```json
{
  "message": "OTP sent successfully"
}
```

In development, the OTP is logged to the server console.

---

#### POST `/api/auth/verify-otp`

**Request (JSON):**

```json
{
  "email": "jane@example.com",
  "otp": "123456"
}
```

**Response `200`:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

#### GET `/api/auth/me`

**Headers:** `Authorization: Bearer <token>`

**Response `200`:**

```json
{
  "_id": "...",
  "f_name": "Jane",
  "l_name": "Doe",
  "email": "jane@example.com",
  "role": "user",
  "active": 1,
  "created_date": "2025-01-15T10:00:00.000Z"
}
```

Password is never returned.

---

#### GET `/api/auth/admin/me`

**Headers:** `Authorization: Bearer <admin-token>`

**Response `200`:** Same shape as `GET /api/auth/me` (admin user).

**Error `403`:** Token valid but user is not admin.

---

#### POST `/api/auth/logout`

**Headers:** `Authorization: Bearer <token>`

**Response `200`:**

```json
{
  "message": "Logged out successfully"
}
```

Server does not invalidate the JWT; the client should remove the token (e.g. from `localStorage`).

---

### User APIs

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/users/public/:id` | Public | Public user info by ID |

#### GET `/api/users/public/:id`

**Response `200`:**

```json
{
  "user": {
    "id": "...",
    "name": "Jane Doe",
    "role": "user",
    "avatarUrl": "images/chef.png"
  }
}
```

**Error `404`:** `{ "message": "User not found" }`

---

### Recipe APIs

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/recipes` | Public | List all recipes |
| GET | `/api/recipes/mine` | Auth | Current user’s recipes |
| GET | `/api/recipes/:id` | Auth (owner) | Recipe by ID (owner only) |
| POST | `/api/recipes` | Auth | Create recipe |
| PUT | `/api/recipes/:id` | Auth (owner) | Update recipe (owner only) |
| DELETE | `/api/recipes/:id` | Auth (owner) | Delete recipe (owner only) |
| POST | `/api/recipes/bulk-delete` | Auth (owner/admin) | Soft-delete multiple recipes (owner: own; admin: any) |
| POST | `/api/recipes/bulk-restore` | Auth (owner/admin) | Restore multiple recipes from trash |
| GET | `/api/recipes/trash` | Auth (owner/admin) | List soft-deleted recipes (trash) |
| POST | `/api/recipes/:id/restore` | Auth (owner/admin) | Restore one recipe from trash |
| GET | `/api/recipes/admin/all` | Admin | List all recipes (admin) |
| DELETE | `/api/recipes/admin/:id` | Admin | Delete any recipe (admin) |

#### GET `/api/recipes`

**Response `200`:**

```json
{
  "recipes": [
    {
      "_id": "...",
      "userId": "...",
      "title": "Pasta Carbonara",
      "desc": "Classic Italian pasta.",
      "category": "Dinner",
      "rating": 5,
      "imageUrl": "/uploads/1234567-photo.jpg",
      "ingredients": [" spaghetti", "eggs", "bacon" ],
      "instructions": [" Boil water", "Cook pasta", "..." ],
      "difficulty": "Medium",
      "dietary": ["Vegetarian"],
      "tags": ["pasta", "italian"],
      "notes": "Serve immediately.",
      "cookingTime": 20,
      "prepTime": 10,
      "servings": 4,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

#### GET `/api/recipes/mine`

**Headers:** `Authorization: Bearer <token>`

**Response `200`:** `{ "recipes": [ ... ] }` (same shape as above, filtered by current user).

---

#### GET `/api/recipes/:id`

**Headers:** `Authorization: Bearer <token>`

**Response `200`:**

```json
{
  "recipe": {
    "_id": "...",
    "userId": "...",
    "title": "Pasta Carbonara",
    "desc": "...",
    "category": "Dinner",
    "rating": 5,
    "imageUrl": "/uploads/...",
    "ingredients": [],
    "instructions": [],
    "difficulty": "Medium",
    "dietary": [],
    "tags": [],
    "notes": "",
    "cookingTime": 0,
    "prepTime": 0,
    "servings": 0,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Error `403`:** Not owner. **`404`:** Recipe not found.

---

#### POST `/api/recipes`

**Headers:** `Authorization: Bearer <token>`

**Body:** Either **JSON** or **multipart/form-data** (when including an image).

- **JSON (no image):**  
  Send `Content-Type: application/json`. Optional image via `imageUrl` string.

- **Multipart (with image):**  
  Send `Content-Type: multipart/form-data`. Include a file field named `image` (jpeg, png, webp, gif; max 5MB). Other fields as form fields.

**Example JSON body:**

```json
{
  "title": "Pasta Carbonara",
  "category": "Dinner",
  "description": "Classic Italian pasta with eggs and bacon.",
  "rating": 5,
  "ingredients": ["spaghetti", "eggs", "bacon", "parmesan"],
  "instructions": ["Boil water.", "Cook pasta al dente.", "Mix with egg and bacon."],
  "difficulty": "Medium",
  "dietary": ["Vegetarian"],
  "tags": ["pasta", "italian", "quick"],
  "notes": "Serve immediately.",
  "cookingTime": 20,
  "prepTime": 10,
  "servings": 4
}
```

- **Required:** `title`, `description`.
- **Optional:** `category`, `rating`, `ingredients[]`, `instructions[]`, `difficulty` (`Easy`|`Medium`|`Hard`), `dietary[]`, `tags[]`, `notes`, `cookingTime`, `prepTime`, `servings`, `image` (file) or `imageUrl` (string).

**Response `201`:**

```json
{
  "message": "Recipe saved",
  "recipe": { "_id": "...", "userId": "...", "title": "...", ... }
}
```

**Error `409` (duplicate title for same user):**

```json
{
  "message": "You already have a recipe with the title \"...\". Please use a different title.",
  "duplicate": true,
  "existingTitle": "..."
}
```

---

#### PUT `/api/recipes/:id`

**Headers:** `Authorization: Bearer <token>`

**Body:** Same as POST (JSON or multipart with optional `image`). Only provided fields are updated; others remain unchanged. `title` and `description` are required.

**Response `200`:**

```json
{
  "message": "Recipe updated",
  "recipe": { "_id": "...", ... }
}
```

**Error `403`:** Not owner. **`404`:** Not found. **`409`:** Duplicate title (same format as POST).

---

#### DELETE `/api/recipes/:id`

**Headers:** `Authorization: Bearer <token>`

**Response `200`:**

```json
{
  "message": "Recipe deleted"
}
```

**Error `403`:** Not owner. **`404`:** Not found.

---

#### POST `/api/recipes/bulk-delete`

**Headers:** `Authorization: Bearer <token>`

**Body:** `{ "ids": [ "<recipeId1>", "<recipeId2>", ... ] }`

Soft-deletes multiple recipes (moves to trash). Owner can only delete their own recipes; admin can delete any. Returns how many were deleted and their ids.

**Response `200`:**

```json
{
  "message": "Bulk delete completed",
  "deleted": 2,
  "deletedIds": [ "...", "..." ]
}
```

**Error `400`:** Missing or empty `ids` array.

---

#### POST `/api/recipes/bulk-restore`

**Headers:** `Authorization: Bearer <token>`

**Body:** `{ "ids": [ "<recipeId1>", "<recipeId2>", ... ] }`

Restores multiple recipes from trash. Owner can only restore their own; admin can restore any.

**Response `200`:**

```json
{
  "message": "Bulk restore completed",
  "restored": 2,
  "restoredIds": [ "...", "..." ]
}
```

---

#### GET `/api/recipes/trash`

**Headers:** `Authorization: Bearer <token>`

Returns soft-deleted recipes. Owner sees only their own; admin sees all.

**Response `200`:** `{ "recipes": [ ... ] }`

---

#### POST `/api/recipes/:id/restore`

**Headers:** `Authorization: Bearer <token>`

Restores one recipe from trash (owner or admin).

**Response `200`:** `{ "message": "Recipe restored", "recipe": { ... } }`

**Error `400`:** Recipe not in trash. **`403`:** Not allowed. **`404`:** Not found.

---

#### GET `/api/recipes/admin/all`

**Headers:** `Authorization: Bearer <admin-token>`

**Response `200`:**

```json
{
  "recipes": [ ... ],
  "count": 42
}
```

**Error `403`:** Not admin.

---

#### DELETE `/api/recipes/admin/:id`

**Headers:** `Authorization: Bearer <admin-token>`

**Response `200`:** `{ "message": "Recipe deleted" }`

**Error `403`:** Not admin. **`404`:** Not found.

---

### Comments APIs

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/comments/:recipeId` | Public | Comments for a recipe |
| POST | `/api/comments` | Auth | Add a comment |

#### GET `/api/comments/:recipeId`

**Response `200`:**

```json
{
  "comments": [
    {
      "_id": "...",
      "recipe_id": "...",
      "user_id": "...",
      "comment": "Looks delicious!",
      "created_date": "..."
    }
  ]
}
```

---

#### POST `/api/comments`

**Headers:** `Authorization: Bearer <token>`

**Request (JSON):**

```json
{
  "recipe_id": "recipe-mongo-id-here",
  "comment": "Looks delicious!"
}
```

**Response `201`:**

```json
{
  "message": "Comment added",
  "comment": {
    "_id": "...",
    "recipe_id": "...",
    "user_id": "...",
    "comment": "Looks delicious!",
    "created_date": "..."
  }
}
```

**Error `400`:** Missing `recipe_id` or `comment`.

---

### Activities API

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/activities` | Public | Recent recipe create/update/delete activity |

#### GET `/api/activities`

**Query:** `?limit=20` (optional, default 20)

**Response `200`:**

```json
{
  "activities": [
    {
      "_id": "...",
      "userName": "Jane Doe",
      "action": "created",
      "recipeTitle": "Pasta Carbonara",
      "createdAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

`action` is one of: `created`, `updated`, `deleted`.

---

## 📁 Project Structure

```
Recipe-Management-System/
├── backend/
│   ├── app.js           # Express app, routes, middleware
│   ├── server.js        # HTTP server, DB, Socket.IO
│   ├── .env             # MONGO_URI, JWT_SECRET, PORT (create this)
│   ├── middleware/      # auth, validation, rate-limit, roles
│   ├── models/          # User, Recipe, Activity, Comment
│   ├── routes/          # auth, recipes, users, comments, activities
│   ├── scripts/
│   │   └── createAdminSimple.js   # Admin setup script
│   └── uploads/         # Recipe images (created by multer)
└── frontend/            # Static HTML, CSS, JS
```

---

## 🔧 Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start server (backend + serve frontend) |
| `npm run create-admin` | Create or upgrade admin user |
| `npm test` | Run tests |
| `npm run test:integration` | Run integration tests |

---

## 📝 Notes

- **Auth:** JWT expiry is 24 hours. Store the token securely (e.g. `localStorage`) and send it as `Authorization: Bearer <token>` for protected routes.
- **Images:** Recipe images are stored under `backend/uploads`. Allowed types: jpeg, png, webp, gif. Max 5MB.
- **Rate limiting:** Auth routes (`/api/auth/*`) are rate-limited (see `middleware/rateLimiter.js`).
- **Body size:** Auth request body limited to 10KB; other JSON to 1MB.
