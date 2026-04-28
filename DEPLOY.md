# Deploy CareBand to Render.com (Free)

This makes the tracking link work on ANY phone, anywhere in the world.

## Steps:

### 1. Push code to GitHub
```bash
git init
git add .
git commit -m "CareBand full system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/careband.git
git push -u origin main
```

### 2. Go to Render.com
- Open https://render.com
- Sign up with GitHub (free)
- Click "New" > "Web Service"
- Connect your GitHub repo (careband)

### 3. Configure on Render
- **Name:** careband
- **Runtime:** Node
- **Build Command:** `npm install`
- **Start Command:** `node server/index.js`
- **Plan:** Free

### 4. Add Environment Variables
Click "Environment" tab and add:
- `MONGO_URI` = `mongodb+srv://Bhuvana:T0c0rk9UWW7Zvqgv@cluster0.z6zryu1.mongodb.net/careband?retryWrites=true&w=majority&appName=Cluster0`
- `JWT_SECRET` = `careband_super_secret_key_2024`
- `EMAIL_USER` = `anupamaks209@gmail.com`
- `EMAIL_PASS` = `fejofztbkldsgmkd`
- `NODE_ENV` = `production`

### 5. Deploy
Click "Create Web Service" — it will build and deploy.

You'll get a URL like: `https://careband.onrender.com`

### 6. Done!
- Login: `https://careband.onrender.com`
- Patient tracking: `https://careband.onrender.com/track.html?id=PATIENT_ID`

The tracking link now works on ANY phone because:
- It's on the real internet (not localhost)
- Render provides HTTPS automatically (GPS works on phones)
- No same-WiFi requirement
