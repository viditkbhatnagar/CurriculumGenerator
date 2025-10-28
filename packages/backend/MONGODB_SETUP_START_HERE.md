# 🚀 MongoDB Atlas Setup - Start Here

Welcome! This guide will help you set up MongoDB Atlas for the Curriculum Generator App.

## 📋 What You Need

- MongoDB Atlas account (free to create)
- 15-20 minutes
- Credit card (for M10 cluster, even with free credits)

## 🎯 Quick Start (Choose Your Path)

### Path 1: Quick Setup (Recommended)
**Best for**: Getting started quickly

1. Read: `MONGODB_ATLAS_QUICKSTART.md`
2. Follow the 8 quick steps
3. Run: `npm run test:mongodb-connection`

**Time**: ~15 minutes

### Path 2: Detailed Setup
**Best for**: Understanding every detail

1. Read: `MONGODB_ATLAS_SETUP.md`
2. Follow comprehensive instructions
3. Use: `.kiro/specs/mongodb-render-migration/TASK_2_CHECKLIST.md` to track progress
4. Run all verification scripts

**Time**: ~25 minutes

## 📝 Step-by-Step (Ultra Quick)

### 1. Create Atlas Account & Cluster (10 min)
- Go to: https://www.mongodb.com/cloud/atlas/register
- Create account
- Build database → Dedicated → M10 tier
- Choose region (us-east-1 recommended)
- Wait for cluster creation

### 2. Configure Access (2 min)
- Network Access → Add IP → Allow from Anywhere (0.0.0.0/0)
- Database Access → Add User → Create username/password
- **Save password securely!**

### 3. Create Vector Search Index (3 min)
- Search tab → Create Search Index → JSON Editor
- Name: `knowledge_base_vector_index`
- Database: `curriculum_db`
- Collection: `knowledgebases`
- Paste JSON from quickstart guide
- Wait for "Active" status

### 4. Get Connection String (1 min)
- Connect button → Connect your application
- Copy connection string
- Replace username and password
- Add `/curriculum_db` after host

### 5. Configure & Test (2 min)
```bash
# Add to packages/backend/.env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/curriculum_db?retryWrites=true&w=majority

# Test connection
npm run test:mongodb-connection

# Create indexes
npm run create:indexes

# Test vector search (optional)
npm run test:vector-search
```

## ✅ Success Checklist

After setup, you should see:

```
✓ Connected to MongoDB Atlas successfully
✓ Database 'curriculum_db' is accessible
✓ Collection operations working correctly
✓ Vector search index is active
✅ All checks passed!
```

## 🆘 Common Issues

### "Connection timed out"
→ Check Network Access whitelist in Atlas

### "Bad auth"
→ Verify username/password in connection string
→ URL-encode special characters in password

### "Vector search not supported"
→ Upgrade to M10 or higher cluster tier

### "Index not found"
→ Create vector search index in Atlas Search UI
→ Wait for status to be "Active"

## 📚 Documentation Files

| File | Purpose | When to Use |
|------|---------|-------------|
| `MONGODB_SETUP_START_HERE.md` | This file | Starting point |
| `MONGODB_ATLAS_QUICKSTART.md` | Quick reference | Fast setup |
| `MONGODB_ATLAS_SETUP.md` | Detailed guide | Comprehensive setup |
| `TASK_2_CHECKLIST.md` | Progress tracker | Track completion |
| `scripts/README.md` | Script documentation | Understanding scripts |

## 🔧 Available Commands

```bash
# Test MongoDB connection
npm run test:mongodb-connection

# Create performance indexes
npm run create:indexes

# Test vector search functionality
npm run test:vector-search
```

## 💰 Cost Information

**M10 Cluster** (required for vector search):
- ~$57/month (AWS us-east-1)
- ~$0.08/hour
- Includes: 2GB RAM, 10GB storage, vector search

**Free Tier (M0)**:
- $0/month
- No vector search support
- Good for development only (without vector search)

## 🎓 What's Next?

After completing MongoDB Atlas setup:

1. ✅ Task 2 complete
2. → Proceed to Task 3: Migrate database layer
3. → Implement Mongoose models
4. → Update services to use MongoDB

## 📞 Need Help?

1. Check troubleshooting sections in documentation
2. Review error messages from test scripts
3. Verify all prerequisites are met
4. Check MongoDB Atlas status page

## 🔗 Useful Links

- MongoDB Atlas: https://cloud.mongodb.com
- Atlas Documentation: https://docs.atlas.mongodb.com/
- Vector Search Guide: https://www.mongodb.com/docs/atlas/atlas-vector-search/
- Mongoose Docs: https://mongoosejs.com/

---

**Ready to start?** Open `MONGODB_ATLAS_QUICKSTART.md` and follow the steps!

**Need more detail?** Open `MONGODB_ATLAS_SETUP.md` for comprehensive instructions.

**Want to track progress?** Use `.kiro/specs/mongodb-render-migration/TASK_2_CHECKLIST.md`

Good luck! 🚀
