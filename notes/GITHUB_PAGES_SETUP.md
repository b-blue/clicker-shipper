# GitHub Pages Deployment Guide

## Setup Summary

Your project is now configured for automatic GitHub Pages deployment via GitHub Actions. Here's what was configured:

### Changes Made

1. ✅ **Vite Config** - Updated `base` path to `/clicker-shipper/`
2. ✅ **package.json** - Updated repo info and add homepage URL
3. ✅ **GitHub Actions** - Created automatic build & deploy workflow
4. ✅ **.nojekyll** - Added to prevent Jekyll processing issues
5. ✅ **Asset Paths** - Already using relative paths (no changes needed)

---

## Step-by-Step Deployment

### 1. Initial Repository Setup

First-time setup only:

```bash
# Make sure everything is committed
git add .
git commit -m "Configure for GitHub Pages deployment"

# Push to GitHub (main branch)
git push origin main
```

### 2. Enable GitHub Pages

In your GitHub repository settings:

1. Go to **Settings** → **Pages**
2. Under "Source", select:
   - **Deploy from a branch**
   - **Branch:** `gh-pages` (will be created by GitHub Actions)
   - **Folder:** `/ (root)`
3. Click **Save**

**⚠️ Important:** Make sure you don't have an existing gh-pages branch yet - GitHub Actions will create it automatically.

### 3. GitHub Actions Workflow Execute

Once you push to `main`, GitHub Actions will automatically:

1. ✅ Checkout your code
2. ✅ Install dependencies (`npm ci`)
3. ✅ Run tests (`npm run test`)
4. ✅ Build the project (`npm run build-nolog`)
5. ✅ Deploy to `gh-pages` branch

**Deployment automatically happens on every push to `main`**

### 4. View Your Live Site

After the first deployment:
- **URL:** `https://bblue.github.io/clicker-shipper/`
- **Status:** Check repository → **Actions** tab to see workflow progress
- **Time:** Usually deploys in 1-2 minutes

---

## Asset Paths Explained

Your assets are already configured correctly:

### Files Being Deployed
```
dist/
├── index.html          ← Served at /clicker-shipper/
├── assets/             ← Phaser compiled code
├── data/
│   ├── config.json     ← Loaded via relative path: data/config.json
│   └── items.json      ← Loaded via relative path: data/items.json
├── items/
│   ├── [sprite].png    ← Loaded via relative path: assets/items/[id].png
│   └── dial.png
└── style.css
```

**Why relative paths work:**
- Vite's `base: '/clicker-shipper/'` handles the prefix
- All asset requests are resolved from the correct base
- No hardcoded absolute paths needed

---

## How It Works: The Workflow

### On Each Push to `main`:

```
┌─────────────────────┐
│  git push origin main
└──────────────────┬──┘
                   ↓
        ┌──────────────────────────┐
        │ GitHub Actions Triggered │
        └──────────────┬───────────┘
                       ↓
        ┌──────────────────────────┐
        │ 1. Checkout code         │
        │ 2. Setup Node 18         │
        │ 3. npm ci (install)      │
        │ 4. npm run test          │
        │ 5. npm run build-nolog   │
        └──────────────┬───────────┘
                       ↓
        ┌──────────────────────────┐
        │ Build artifacts created: │
        │ - dist/                  │
        │ - Coverage reports       │
        └──────────────┬───────────┘
                       ↓
        ┌──────────────────────────┐
        │ Deploy Pages artifact    │
        │ to gh-pages branch       │
        └──────────────┬───────────┘
                       ↓
        ┌──────────────────────────┐
        │ Live at GitHub Pages URL │
        │ bblue.github.io/         │
        │ clicker-shipper/         │
        └──────────────────────────┘
```

---

## Testing Locally Before Deployment

### Build Locally (Same as CI/CD)
```bash
# Install dependencies
npm install

# Run tests
npm run test

# Build exactly like GitHub Actions does
npm run build-nolog

# Check the dist folder was created
ls -la dist/
```

### Serve Locally to Test
```bash
# Install http-server globally (one-time)
npm install -g http-server

# Serve dist folder with correct base path
cd dist
http-server -c-1 -o

# Navigate to: http://localhost:8080/clicker-shipper/
```

---

## Troubleshooting

### Issue: Assets not loading (404 errors)

**Cause:** Base path mismatch

**Check:**
```bash
# Verify base path in vite config
grep "base:" vite/config.prod.mjs
# Should show: base: '/clicker-shipper/',

# Verify it's used in Phaser loads
grep -r "data/" src/
# Should be: 'data/config.json' (no leading slash)
```

**Fix:** Confirm vite/config.prod.mjs has:
```javascript
base: '/clicker-shipper/',
```

---

### Issue: GitHub Actions workflow fails

**Check workflow status:**
1. Go to your repo → **Actions** tab
2. Click on the failed workflow
3. Inspect the logs to see where it failed

**Common causes:**
- ❌ Tests failing → Fix tests locally, push again
- ❌ Build errors → Run `npm run build-nolog` locally to debug
- ❌ Missing dependencies → Run `npm ci` locally to verify

---

### Issue: Pages shows 404

**Potential cause:** Pages source not configured

**Fix:**
1. Go to **Settings** → **Pages**
2. Verify:
   - Source: "Deploy from a branch"
   - Branch: `gh-pages`
   - Folder: `/ (root)`
3. Click **Save**

---

### Issue: Changes not appearing

**Likely causes:**
1. **Browser cache** → Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
2. **Deployment pending** → Check **Actions** tab for workflow status
3. **Base path issue** → Verify base path matches your repo name

---

## File Structure for Deployment

```
clicker-shipper/
├── .github/
│   └── workflows/
│       └── deploy.yml          ← GitHub Actions workflow
├── public/
│   ├── .nojekyll               ← Prevents Jekyll processing
│   ├── style.css
│   ├── data/
│   │   ├── config.json
│   │   └── items.json
│   ├── assets/
│   │   ├── items/
│   │   │   ├── [all sprites].png
│   │   │   └── dial.png
│   │   └── [other assets]
│   └── index.html
├── src/
│   ├── game/
│   ├── main.ts
│   └── [source files]
├── vite/
│   ├── config.dev.mjs          ← Local development
│   └── config.prod.mjs         ← Production (base: '/clicker-shipper/')
├── package.json                ← Updated with repo info
└── [other config files]
```

---

## Production Checklist

Before pushing to deploy:

- [ ] All code committed
- [ ] Tests passing locally: `npm run test`
- [ ] Builds locally: `npm run build-nolog`
- [ ] `dist/` folder generated correctly
- [ ] No console errors when testing dist build
- [ ] Repository pushed to GitHub
- [ ] GitHub Pages source configured
- [ ] .nojekyll file in public folder

---

## Manual Deployment (Optional)

If you ever need to manually deploy instead of using GitHub Actions:

```bash
# Build the project
npm run build-nolog

# Force push dist folder to gh-pages branch
git subtree push --prefix dist origin gh-pages

# Your site will update at: https://bblue.github.io/clicker-shipper/
```

---

## Future Maintenance

### Updating Dependencies
```bash
npm update
npm run test
git push origin main  # GitHub Actions handles deployment
```

### Large Format Changes
```bash
# Make your changes
git add .
git commit -m "Description of changes"
git push origin main  # Automatic deployment!
```

### Rollback (if needed)
If something breaks after deployment:
```bash
git revert <commit-hash>
git push origin main
# GitHub Actions will redeploy automatically
```

---

## Key URLs

- **Live Site:** https://bblue.github.io/clicker-shipper/
- **GitHub Repo:** https://github.com/bblue/clicker-shipper
- **Workflow Runs:** https://github.com/bblue/clicker-shipper/actions
- **Settings:** https://github.com/bblue/clicker-shipper/settings/pages

---

## Summary

Your Circle Shipper game is now configured for seamless GitHub Pages deployment:

✅ **Automatic:** Push to main → GitHub Actions builds & deploys  
✅ **Fast:** 1-2 minute deployment time  
✅ **Reliable:** Tests run before each deployment  
✅ **Simple:** No manual steps needed after initial setup  

Just push to `main` and your game is live! 🚀
