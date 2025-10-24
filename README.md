# Parcel2 Backend

Parcel2 Backend exposes the Express 5 API, Socket.IO gateway, and OWL-to-Stardog ORM for the Parcel2 platform. It handles authentication, opportunity management, real-time chat, uploads, and ontology-driven data access.

## Prerequisites

- Node.js 20 LTS (or >= 18.18)
- npm 10+
- Docker (for local Redis and MongoDB containers)
- Access to a Stardog instance (remote cloud)

## Setting up stardog cloud
1. Create a new Stardog Free instance on Stardog Cloud.
2. Go to "Quick Actions" -> "Manage endpoints", copy the endpoint URL. This URL is used to set the `STARDOG_ENDPOINT` environment variable.
3. Go back to the main page of the stardog cloud and navigate to the "Stardog STUDIO".
4. You will be automatically logged in. On the left sidebar, click on "Security" (A lock icon). On the "USERS" panel, click on "Add" button to create a new user. Remember the username and password, as they will be used to set the `STARDOG_USERNAME` and `STARDOG_PASSWORD` environment variables.
5. In the "USERS" panel, you will see the new user you just created. Click on the user you created and click on "Assign Roles" button. Assign the "admin" and "cloud" role to this user. This will allow the user to have administrative privileges on the Stardog instance.
6. Now the stardog cloud is ready to be used with the Parcel2 backend.

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Copy the environment template**
   ```bash
   cp .env.template .env
   ```
   (Windows: `copy .env.template .env`)
3. **Set environment variables**
   - `PORT` (default 3005)
   - `FRONTEND_URL`
   - `SESSION_SECRET`, `JWT_SECRET`
   - `MONGO_URI`, `REDIS_URL`
   - `STARDOG_ENDPOINT`, `STARDOG_USERNAME`, `STARDOG_PASSWORD`
   - `STARDOG_DB_NAME`: name of the Stardog DB to use (e.g., `parcel2`) default to `parcel2`
   - Mail configuration (`MAIL_*`)
   - Google OAuth keys (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
4. **Start backing services** (see [Docker Services](#docker-services) below for quick commands).
5. **Run the development server**
   ```powershell
   npm run dev
   ```
6. Open the frontend against `http://localhost:3005` (adjust to match `PORT`).
7. On the initial launch the backend creates an admin user automatically, the login email is `admin@parcel.com` and the default password is logged in the terminal.

The dev server uses `ts-node` to boot. On boot it validates the mailer and OAuth configuration, ensures upload directories exist, connects to Redis, MongoDB, and Stardog, seeds the admin user, and hydrates taxonomy data from `src/taxonomy`.

## Docker Services

Run these commands from Terminal to start MongoDB and Redis containers. Update volume paths as needed for persistent storage.

### MongoDB
```bash
docker run \
  --name parcel2-mongo \
  -p 27017:27017 \
  -v ${PWD}/docker-data/mongo:/data/db \
  -d mongo:7
```

### Redis
```bash
docker run \
  --name parcel2-redis \
  -p 6379:6379 \
  -v ${PWD}/docker-data/redis:/data \
  -d redis:7-alpine \
  --save 60 1 --loglevel warning
```

To stop and remove the containers when finished:
```bash
docker stop parcel2-mongo parcel2-redis
```
```bash
docker rm parcel2-mongo parcel2-redis
```

Ensure your `.env` points `MONGO_URI` to `mongodb://localhost:27017/parcel2` and `REDIS_URL` to `redis://localhost:6379` (adjust if you change ports).

## npm Scripts

- `npm run dev` – Start the TypeScript development server.
- `npm run build` – Compile to the `dist/` directory.
- `npm start` – Run the compiled JavaScript from `dist/` (set `NODE_ENV=production`).
- `npm run cleanup:tmp` – Move or delete expired temporary uploads.
- `npm run cleanup:tmp:dry` – Preview cleanup actions without making changes.

## Production Build

1. `npm install`
2. `npm run build`
3. Configure production environment variables (can use `.env` and `.env.production`).
4. `npm start`

## Project Layout

- `src/index.ts` – Application entry point and service bootstrapping.
- `src/config` – Connections and service configuration (MongoDB, Redis, Stardog, mailer, uploads).
- `src/controllers` – Route handlers for auth, admin, opportunities, uploads, etc.
- `src/routes` – Express route registration for API modules.
- `src/services` – Integrations (authentication, OWL/Stardog ORM, uploads, search helpers).
- `src/sockets` – Socket.IO gateway for real-time chat.
- `src/taxonomy` – OWL ontology files used to seed Stardog.
- `jobs/cleanupTmp.ts` – Temp upload janitor logic.
- `public/uploads` – Uploaded assets; `uploads/tmp` holds pending files.

## Troubleshooting

- **Mailer or OAuth errors**: The server validates these early; check `.env` values and third-party credentials.
- **Authentication failures**: Ensure the frontend points to the same origin designated by `FRONTEND_URL`, and that `SESSION_SECRET` and `JWT_SECRET` are set.
- **Ontology or SPARQL issues**: Inspect `src/services/owl` for validation logs and the generated SPARQL queries.
- **Upload problems**: Verify `uploads.finalizeUrlList` is called when persisting records and that the temp janitor is run periodically.

## Additional Notes

- There are currently no automated tests; rely on targeted scripts and manual verification.
- When running the janitor (`npm run cleanup:tmp`), ensure no active uploads are in progress.
- Remember to keep Stardog accessible; network or credential issues will prevent the API from starting.
