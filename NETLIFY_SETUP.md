# Taskify - Netlify Deployment Guide

## What Changed

Your Node.js server has been converted to work with **Netlify Functions** (serverless). This allows you to deploy on Netlify's free tier.

### New Files:
- `netlify.toml` - Netlify configuration
- `netlify/functions/api.js` - Serverless API handler
- `.gitignore` - Git ignore patterns
- Updated `package.json` - Build and dev scripts

### How It Works:

1. Your **static files** (`public/` folder) are served directly
2. All `/api/*` requests are routed to the serverless function
3. Data is stored in `db/tasks.json` file

## Deployment Steps

1. **Connect your GitHub repo to Netlify:**
   - Go to https://app.netlify.com
   - Click "New site from Git"
   - Select your GitHub account and this repository
   - Set build command: `npm install && npm run build`
   - Set publish directory: `public`

2. **Deploy:**
   - Netlify will automatically deploy on every push to `main`

## Local Testing

Run locally before deploying:

```bash
npm install
npm run dev
```

Then visit `http://localhost:8888`

## API Endpoints

The API works the same as before:

- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create a task
- `PUT /api/tasks/:id` - Update a task
- `DELETE /api/tasks/:id` - Delete a task

## Troubleshooting

If you still see the 404 error after deployment:

1. Check Netlify build logs in your dashboard
2. Make sure `public/index.html` exists
3. Verify the `netlify.toml` file is in the repo root
4. Clear your browser cache and try again

---

**Your app is now Netlify-ready! 🚀**
