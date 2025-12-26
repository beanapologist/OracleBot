# Setting Up the Standalone GitHub Repository

This guide will help you create a new GitHub repository for the Oracle Monitor bot.

## Step 1: Create New Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `oracle-monitor` (or your preferred name)
3. Description: "Automated testing and monitoring bot for COINjecture Holographic Oracle smart contract"
4. Visibility: **Public** (recommended) or Private
5. **Do NOT** initialize with README, .gitignore, or license (we'll add our own)
6. Click "Create repository"

## Step 2: Initialize Local Repository

```bash
cd contracts/bot-standalone

# Initialize git
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Oracle Monitor bot"

# Add remote (using SSH)
git remote add origin git@github.com:beanapologist/OracleBot.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Update Repository URLs

After creating the repo, update these files with your actual repository URL:

1. **package.json** - Update `repository.url`:
   ```json
   "repository": {
     "type": "git",
     "url": "https://github.com/YOUR_USERNAME/oracle-monitor.git"
   }
   ```

2. **README.md** - Update any references to repository URLs

## Step 4: Configure GitHub Secrets (Optional)

For CI/CD to work with custom settings:

1. Go to: `Settings → Secrets and variables → Actions`
2. Add secrets (optional, defaults provided):
   - `ORACLE_ADDRESS`: Contract address
   - `AMOY_RPC_URL`: RPC endpoint URL

## Step 5: Verify CI/CD

1. Push a commit to trigger the workflow
2. Go to: `Actions` tab
3. Verify the workflow runs successfully

## Step 6: Add Topics/Tags

Add relevant topics to your repository:
- `blockchain`
- `oracle`
- `monitoring`
- `ethereum`
- `polygon`
- `smart-contracts`
- `testing`

## Step 7: Create Release (Optional)

```bash
# Tag a release
git tag -a v1.0.0 -m "Initial release"
git push origin v1.0.0
```

Then create a release on GitHub with release notes.

## Repository Structure

Your final repository should have:

```
oracle-monitor/
├── .github/
│   └── workflows/
│       └── oracle-tests.yml
├── bot/
│   ├── testOracle.js
│   ├── monitorOracle.js
│   └── contractABI.json
├── .env.example
├── .gitignore
├── package.json
├── README.md
├── LICENSE
└── SETUP_GITHUB_REPO.md
```

## Next Steps

1. ✅ Repository created and pushed
2. ✅ CI/CD workflow configured
3. ✅ Documentation complete
4. 🎉 Ready to use!

## Quick Commands Reference

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/oracle-monitor.git
cd oracle-monitor

# Install dependencies
npm install

# Run tests
npm test

# Start monitoring
npm run monitor
```

## Support

For issues or questions:
- Open an issue on GitHub
- Check the README.md for usage instructions
- Review the bot documentation

