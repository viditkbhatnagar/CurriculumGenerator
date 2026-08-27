# Render Environment Variables Configuration

## Frontend Environment Variables

Add these environment variables in your Render frontend service settings:

```
NEXT_PUBLIC_API_URL=https://curriculum-api-bsac.onrender.com
```

## Backend Environment Variables

The backend should already have these set, but verify:

```
MONGODB_URI=<your-mongodb-connection-string>
OPENAI_API_KEY=<your-openai-api-key>
NODE_ENV=production
PORT=4000
```

## How to Set Environment Variables in Render

1. Go to your Render dashboard
2. Select your frontend service (`curriculum-frontend-xfyx`)
3. Click on "Environment" in the left sidebar
4. Click "Add Environment Variable"
5. Add `NEXT_PUBLIC_API_URL` with value `https://curriculum-api-bsac.onrender.com`
6. Click "Save Changes"
7. Render will automatically redeploy with the new environment variable

## Important Notes

- Environment variables starting with `NEXT_PUBLIC_` are embedded at build time
- After changing `NEXT_PUBLIC_*` variables, you MUST trigger a new build
- The `.env` file in the repository is only for local development
- Production uses Render's environment variables, not the `.env` file

## Verification

After setting the environment variable and redeploying:

1. Open browser developer tools (F12)
2. Go to Network tab
3. Click any button that makes an API call
4. Check the request URL - it should start with `https://curriculum-api-bsac.onrender.com`
5. If it still shows `localhost:4000`, clear your browser cache and hard refresh (Ctrl+Shift+R)
