# Prep Backend

Express + TypeScript API for PrepForge, backed by MongoDB.

## Local development

1. Use Node.js 22 or compatible.
2. Install dependencies with `npm ci`.
3. Copy `.env.example` to `.env` and configure `MONGODB_URI`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET`.
4. For the local frontend, set `CLIENT_ORIGIN=http://localhost:5173`.
5. Run `npm run dev`. Health check: `GET http://localhost:8080/api/health`.

## Deploy to Render

A `render.yaml` Blueprint is included. In Render, create a new **Blueprint** for this repository and use the file to provision the web service. When prompted, provide `MONGODB_URI` from your MongoDB Atlas cluster. The Blueprint generates both JWT secrets and configures the production frontend origins for CORS. Do not paste database credentials or signing secrets into source control.

After Render finishes deploying, verify `https://<your-render-service>.onrender.com/api/health` returns HTTP 200 and `database: "connected"`.

Then set the GitHub repository Actions variable `VITE_API_URL` in `yuv9799/prep-frontend` to `https://<your-render-service>.onrender.com/api` and run the frontend GitHub Pages workflow. Also ensure the backend `CLIENT_ORIGIN` includes the exact deployed frontend origin if you use a different domain.

The frontend sends bearer access tokens and a refresh token in the request body so sessions can be restored after an SPA reload even when browsers block cross-site cookies. Logout also sends the refresh token in the body so it can be revoked.
