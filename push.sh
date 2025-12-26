#!/bin/bash
# Script to push Oracle Monitor bot to GitHub

set -e

echo "🚀 Pushing Oracle Monitor to GitHub..."
echo "Repository: https://github.com/beanapologist/OracleBot"
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
fi

# Check if remote exists
if ! git remote get-url origin &>/dev/null; then
    echo "🔗 Adding remote origin (SSH)..."
    git remote add origin git@github.com:beanapologist/OracleBot.git
else
    echo "✅ Remote already configured"
    git remote set-url origin git@github.com:beanapologist/OracleBot.git
fi

# Add all files
echo "📝 Staging files..."
git add .

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "⚠️  No changes to commit"
else
    echo "💾 Creating commit..."
    git commit -m "Initial commit: Oracle Monitor bot for COINjecture Holographic Oracle

- Comprehensive test suite with multiple scenarios
- Continuous monitoring bot
- CI/CD integration (GitHub Actions)
- Docker and systemd support
- Complete documentation"
fi

# Set branch to main
git branch -M main

# Push to GitHub
echo "⬆️  Pushing to GitHub (SSH)..."
echo ""
echo "Using SSH authentication."
echo "Make sure your SSH key is added to GitHub."
echo ""

git push -u origin main

echo ""
echo "✅ Successfully pushed to GitHub!"
echo "🔗 View repository: https://github.com/beanapologist/OracleBot"
echo ""
echo "Next steps:"
echo "1. Verify files are on GitHub"
echo "2. Check GitHub Actions workflow is set up"
echo "3. Add repository topics (blockchain, oracle, monitoring, etc.)"

