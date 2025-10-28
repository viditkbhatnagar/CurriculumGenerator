# Auth0 Setup Guide

This guide walks you through setting up Auth0 for the Curriculum Generator App.

## Prerequisites

- An Auth0 account (sign up at https://auth0.com)
- Admin access to create applications and APIs

## Step 1: Create Auth0 Application

1. Log in to your Auth0 Dashboard
2. Navigate to **Applications** → **Applications**
3. Click **Create Application**
4. Choose a name (e.g., "Curriculum Generator App")
5. Select **Single Page Web Applications**
6. Click **Create**

## Step 2: Configure Application Settings

In your application settings:

1. **Allowed Callback URLs**: Add your frontend URLs
   ```
   http://localhost:3000/callback
   https://your-domain.com/callback
   ```

2. **Allowed Logout URLs**: Add your frontend URLs
   ```
   http://localhost:3000
   https://your-domain.com
   ```

3. **Allowed Web Origins**: Add your frontend URLs
   ```
   http://localhost:3000
   https://your-domain.com
   ```

4. **Allowed Origins (CORS)**: Add your backend URLs
   ```
   http://localhost:4000
   https://api.your-domain.com
   ```

5. Save changes

## Step 3: Create Auth0 API

1. Navigate to **Applications** → **APIs**
2. Click **Create API**
3. Enter details:
   - **Name**: Curriculum Generator API
   - **Identifier**: `https://api.curriculum-generator.com` (or your domain)
   - **Signing Algorithm**: RS256
4. Click **Create**

## Step 4: Configure API Permissions

1. In your API settings, go to **Permissions** tab
2. Add the following scopes:

   ```
   read:programs
   write:programs
   read:users
   write:users
   read:audit-logs
   admin:all
   ```

3. Save changes

## Step 5: Set Up Roles

1. Navigate to **User Management** → **Roles**
2. Create three roles:

   **Administrator Role**
   - Name: `Administrator`
   - Description: Full system access
   - Permissions: All scopes (admin:all, read:*, write:*)

   **SME Role**
   - Name: `SME`
   - Description: Subject Matter Expert
   - Permissions: read:programs, write:programs

   **Student Role**
   - Name: `Student`
   - Description: Student access
   - Permissions: read:programs

## Step 6: Configure Rules (Optional)

Create a rule to add custom claims to tokens:

1. Navigate to **Auth Pipeline** → **Rules**
2. Click **Create Rule**
3. Choose **Empty rule**
4. Name it "Add User Roles to Token"
5. Add this code:

```javascript
function addRolesToToken(user, context, callback) {
  const namespace = 'https://curriculum-app.com';
  const assignedRoles = (context.authorization || {}).roles || [];

  // Add roles to token
  context.idToken[namespace + '/roles'] = assignedRoles;
  context.accessToken[namespace + '/roles'] = assignedRoles;
  
  // Add email to token
  context.idToken[namespace + '/email'] = user.email;
  context.accessToken[namespace + '/email'] = user.email;

  callback(null, user, context);
}
```

6. Save the rule

## Step 7: Get Credentials

From your Auth0 Dashboard:

1. **Application Credentials** (from Applications → Your App → Settings):
   - Domain: `your-tenant.auth0.com`
   - Client ID: `abc123...`
   - Client Secret: `xyz789...`

2. **API Identifier** (from Applications → APIs → Your API):
   - Identifier: `https://api.curriculum-generator.com`

## Step 8: Configure Environment Variables

Update your `.env` files:

**Backend** (`packages/backend/.env`):
```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.curriculum-generator.com
```

**Frontend** (`packages/frontend/.env.local`):
```bash
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your-client-id
NEXT_PUBLIC_AUTH0_AUDIENCE=https://api.curriculum-generator.com
NEXT_PUBLIC_AUTH0_REDIRECT_URI=http://localhost:3000/callback
```

## Step 9: Test Authentication

### Test with curl

1. Get a test token from Auth0:
   ```bash
   curl --request POST \
     --url https://your-tenant.auth0.com/oauth/token \
     --header 'content-type: application/json' \
     --data '{
       "client_id":"your-client-id",
       "client_secret":"your-client-secret",
       "audience":"https://api.curriculum-generator.com",
       "grant_type":"client_credentials"
     }'
   ```

2. Use the token to test your API:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:4000/api/auth/me
   ```

## Step 10: Create Test Users

1. Navigate to **User Management** → **Users**
2. Click **Create User**
3. Enter email and password
4. Click **Create**
5. Assign role:
   - Click on the user
   - Go to **Roles** tab
   - Click **Assign Roles**
   - Select appropriate role (Administrator, SME, or Student)

## Security Best Practices

1. **Use HTTPS in production**: Never use HTTP for authentication
2. **Rotate secrets regularly**: Change client secrets periodically
3. **Enable MFA**: Require multi-factor authentication for admins
4. **Monitor logs**: Review Auth0 logs for suspicious activity
5. **Set token expiration**: Configure appropriate token lifetimes
6. **Use refresh tokens**: Implement refresh token rotation
7. **Validate tokens**: Always validate tokens on the backend

## Troubleshooting

### "Invalid token" errors

- Verify `AUTH0_DOMAIN` matches your tenant
- Check `AUTH0_AUDIENCE` matches your API identifier
- Ensure token hasn't expired
- Verify JWKS endpoint is accessible

### "Insufficient permissions" errors

- Check user has correct role assigned
- Verify role permissions include required scopes
- Ensure custom rule is adding roles to token

### CORS errors

- Add frontend URL to Allowed Origins in Auth0
- Check CORS configuration in backend
- Verify credentials are included in requests

### Token not containing roles

- Verify custom rule is enabled and working
- Check rule execution logs in Auth0
- Ensure namespace matches in rule and backend

## Additional Resources

- [Auth0 Documentation](https://auth0.com/docs)
- [Auth0 Node.js Quickstart](https://auth0.com/docs/quickstart/backend/nodejs)
- [Auth0 React SDK](https://auth0.com/docs/quickstart/spa/react)
- [JWT.io](https://jwt.io) - Debug JWT tokens

## Support

For Auth0-specific issues:
- Auth0 Community: https://community.auth0.com
- Auth0 Support: https://support.auth0.com

For application issues:
- Check application logs
- Review audit logs in database
- Contact development team
