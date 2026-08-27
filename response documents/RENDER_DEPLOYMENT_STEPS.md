# 🚀 Render Deployment Guide - Curriculum Generator

Complete step-by-step guide to deploy your Curriculum Generator app on Render.

## 📋 Prerequisites

Before starting, make sure you have:

1. **GitHub Repository** - Your code pushed to GitHub
2. **MongoDB Atlas Account** - For the database (free tier works)
3. **OpenAI API Key** - For GPT-5 content generation
4. **Auth0 Account** (optional) - For authentication
5. **Render Account** - Sign up at [render.com](https://render.com)

---

## Step 1: Set Up MongoDB Atlas (Free)

### 1.1 Create MongoDB Cluster

1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up or log in
3. Click **"Build a Database"**
4. Choose **"M0 FREE"** tier
5. Select a cloud provider (AWS recommended) and region close to Oregon (for Render)
6. Click **"Create Cluster"** (takes 3-5 minutes)

### 1.2 Create Database User

1. Go to **Security → Database Access**
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Set username: `curriculum_user`
5. Set a strong password (save it!)
6. Set privileges: **"Read and write to any database"**
7. Click **"Add User"**

### 1.3 Configure Network Access

1. Go to **Security → Network Access**
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (or `0.0.0.0/0`)
4. Click **"Confirm"**

### 1.4 Get Connection String

1. Go to **Deployment → Database**
2. Click **"Connect"** on your cluster
3. Choose **"Drivers"**
4. Copy the connection string (looks like):
   ```
   mongodb+srv://curriculum_user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Replace `<password>` with your actual password
6. Add database name before `?`:
   ```
   mongodb+srv://curriculum_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/curriculum_db?retryWrites=true&w=majority
   ```

---

## Step 2: Push Code to GitHub

```bash
# Make sure all changes are committed
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

---

## Step 3: Deploy on Render

### Option A: Using Blueprint (Recommended - One-Click Deploy)

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **"New"** → **"Blueprint"**
3. Connect your GitHub repository
4. Select the repository containing `render.yaml`
5. Click **"Apply"**
6. Render will automatically create all services!

### Option B: Manual Setup

If Blueprint doesn't work, create services manually:

#### 3.1 Create Redis Database

1. Click **"New"** → **"Redis"**
2. Name: `curriculum-redis`
3. Region: **Oregon**
4. Plan: **Starter** (free)
5. Click **"Create Redis"**
6. Copy the **Internal Redis URL** (for later)

#### 3.2 Create Backend API Service

1. Click **"New"** → **"Web Service"**
2. Connect your GitHub repo
3. Configure:
   - **Name**: `curriculum-api`
   - **Region**: Oregon
   - **Branch**: main
   - **Root Directory**: `packages/backend`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Click **"Create Web Service"**

#### 3.3 Create Frontend Service

1. Click **"New"** → **"Web Service"**
2. Connect your GitHub repo
3. Configure:
   - **Name**: `curriculum-frontend`
   - **Region**: Oregon
   - **Branch**: main
   - **Root Directory**: `packages/frontend`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Click **"Create Web Service"**

#### 3.4 Create Worker Service (Optional - for background jobs)

1. Click **"New"** → **"Background Worker"**
2. Connect your GitHub repo
3. Configure:
   - **Name**: `curriculum-worker`
   - **Region**: Oregon
   - **Branch**: main
   - **Root Directory**: `packages/backend`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run worker`
4. Click **"Create Background Worker"**

---

## Step 4: Configure Environment Variables

### 4.1 Backend API Environment Variables

Go to your `curriculum-api` service → **Environment** tab and add:

| Key                  | Value                                      | Notes                          |
| -------------------- | ------------------------------------------ | ------------------------------ |
| `NODE_ENV`           | `production`                               | Required                       |
| `PORT`               | `4000`                                     | Required                       |
| `MONGODB_URI`        | `mongodb+srv://...`                        | Your MongoDB connection string |
| `REDIS_URL`          | (from Render Redis)                        | Auto-linked if using Blueprint |
| `OPENAI_API_KEY`     | `sk-...`                                   | Your OpenAI API key            |
| `OPENAI_CHAT_MODEL`  | `gpt-5`                                    | GPT-5 model                    |
| `CORS_ORIGINS`       | `https://curriculum-frontend.onrender.com` | Your frontend URL              |
| `ENCRYPTION_KEY`     | (generate)                                 | Click "Generate"               |
| `API_SIGNING_SECRET` | (generate)                                 | Click "Generate"               |
| `LOG_LEVEL`          | `info`                                     | Optional                       |

**Optional Auth0 variables:**
| Key | Value |
|-----|-------|
| `AUTH0_DOMAIN` | `your-tenant.auth0.com` |
| `AUTH0_AUDIENCE` | `https://your-api-identifier` |

### 4.2 Frontend Environment Variables

Go to your `curriculum-frontend` service → **Environment** tab and add:

| Key                           | Value                                 | Notes            |
| ----------------------------- | ------------------------------------- | ---------------- |
| `NODE_ENV`                    | `production`                          | Required         |
| `NEXT_PUBLIC_API_URL`         | `https://curriculum-api.onrender.com` | Your backend URL |
| `NEXT_PUBLIC_AUTH0_DOMAIN`    | `your-tenant.auth0.com`               | Optional         |
| `NEXT_PUBLIC_AUTH0_CLIENT_ID` | `your-client-id`                      | Optional         |

### 4.3 Worker Environment Variables (if created)

Copy the same variables as the backend API.

---

## Step 5: Deploy and Verify

### 5.1 Trigger Deployment

After setting environment variables:

1. Go to each service
2. Click **"Manual Deploy"** → **"Deploy latest commit"**
3. Wait for deployment (5-10 minutes)

### 5.2 Check Deployment Status

Watch the logs for each service:

- ✅ **Green checkmark** = Deployed successfully
- 🔴 **Red X** = Deployment failed (check logs)

### 5.3 Verify Services

1. **Backend Health Check**:

   ```
   https://curriculum-api.onrender.com/health
   ```

   Should return: `{"status":"ok"}`

2. **Frontend**:
   ```
   https://curriculum-frontend.onrender.com
   ```
   Should show your app!

---

## Step 6: Post-Deployment Setup

### 6.1 Run Database Migrations

SSH into your backend service (or use Render Shell):

```bash
npm run migrate:up
```

### 6.2 Seed Initial Data (Optional)

```bash
npm run seed:prompts
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. "Build failed"

- Check `packages/backend` and `packages/frontend` have correct `package.json`
- Ensure all dependencies are listed

#### 2. "Cannot connect to MongoDB"

- Verify MongoDB connection string is correct
- Check Network Access allows `0.0.0.0/0`
- Ensure database user has correct permissions

#### 3. "CORS error"

- Add your frontend URL to `CORS_ORIGINS`
- Format: `https://your-frontend.onrender.com`

#### 4. "OpenAI API error"

- Verify `OPENAI_API_KEY` is set correctly
- Check you have API credits

#### 5. "Redis connection failed"

- Ensure Redis service is running
- Check `REDIS_URL` is correct

### View Logs

1. Go to your service on Render
2. Click **"Logs"** tab
3. Look for error messages

---

## 📊 Estimated Costs

| Service       | Plan    | Monthly Cost |
| ------------- | ------- | ------------ |
| Frontend      | Starter | **Free**     |
| Backend API   | Starter | **Free**     |
| Worker        | Starter | **Free**     |
| Redis         | Starter | **Free**     |
| MongoDB Atlas | M0      | **Free**     |

**Total: $0/month** (on free tiers)

### Paid Plans (for production)

| Service     | Plan     | Monthly Cost |
| ----------- | -------- | ------------ |
| Frontend    | Standard | $7           |
| Backend API | Standard | $7           |
| Worker      | Standard | $7           |
| Redis       | Standard | $10          |

---

## 🎉 Your URLs

After deployment, your services will be available at:

- **Frontend**: `https://curriculum-frontend.onrender.com`
- **Backend API**: `https://curriculum-api.onrender.com`
- **Health Check**: `https://curriculum-api.onrender.com/health`

---

## 📝 Quick Checklist

- [ ] MongoDB Atlas cluster created
- [ ] Database user created with password
- [ ] Network access configured (0.0.0.0/0)
- [ ] Code pushed to GitHub
- [ ] Render account created
- [ ] Blueprint applied OR services created manually
- [ ] Environment variables set for all services
- [ ] Services deployed successfully
- [ ] Health check passing
- [ ] Frontend accessible

---

## 🔄 Auto-Deploy

Render automatically deploys when you push to the `main` branch:

```bash
git add .
git commit -m "Update feature"
git push origin main
# Render auto-deploys in ~5 minutes
```

---

## Need Help?

- **Render Docs**: [render.com/docs](https://render.com/docs)
- **MongoDB Atlas Docs**: [docs.atlas.mongodb.com](https://docs.atlas.mongodb.com)
- **OpenAI Docs**: [platform.openai.com/docs](https://platform.openai.com/docs)
