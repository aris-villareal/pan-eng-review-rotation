# 📄 PAN Staff Documentation Rotation

A Slack app that manages weekly rotation for sharing articles in PAN Staff meetings. The bot notifies the `#pan-staff` channel every Friday at 9:00 AM about whose turn it is to share an article for the upcoming Wednesday staff meeting.

## 🎯 Purpose

This rotation system ensures fair distribution of article sharing responsibilities among PAN staff members for weekly meetings, with automated Slack notifications and interactive management features.

## ✨ Features

- **📅 Weekly Notifications**: Automated Friday reminders at 9:00 AM
- **🎯 Staff Channel Integration**: Posts to `#pan-staff` Slack channel  
- **⏭️ Skip Functionality**: Interactive buttons to advance rotation
- **📊 Rotation Tracking**: Persistent state management with Vercel KV
- **🔄 Auto-Rotation**: Handles weekly progression automatically
- **⚡ Serverless**: Vercel deployment with global scaling

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Slack workspace with admin access
- Vercel account
- Upstash account (for KV storage)

### 1. Slack App Setup

1. **Create Slack App**: [https://api.slack.com/apps](https://api.slack.com/apps)
2. **Add Bot Scopes**:
   - `chat:write`
   - `channels:read` 
   - `users:read`
3. **Enable Interactive Components**: Point to `https://your-app.vercel.app/api/slack`
4. **Install to Workspace**: Generate Bot User OAuth Token

### 2. Vercel & Upstash Setup

```bash
# Install Vercel CLI
npm install -g vercel

# Clone and setup project
git clone <your-repo-url> pan-staff-doc-rotation
cd pan-staff-doc-rotation
npm install

# Deploy to Vercel
vercel

# Add Upstash KV integration via Vercel marketplace
# Visit: https://vercel.com/marketplace/upstash
```

### 3. Environment Configuration

Set these variables in Vercel dashboard:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_CHANNEL_ID=C1234567890  # #pan-staff channel ID
SLACK_SIGNING_SECRET=your-signing-secret
ENABLE_INTERACTIONS=true
TIMEZONE=America/New_York
```

### 4. Test the Setup

```bash
# Test Slack connection locally
npm start -- --test --use-kv

# Preview current rotation
npm start -- --dry-run --use-kv

# Test Vercel deployment
curl https://your-app.vercel.app/api/slack
```

## 📋 Usage

### Slack Interactive Features

**Skip to Next Person**:
- Click "⏭️ Skip to Next" button in rotation messages
- Immediately advances rotation and updates KV state
- Updates message with new current user

### CLI Commands

```bash
# Send weekly notification with KV storage
npm start -- --use-kv

# Send weekly notification with local files
npm start

# Test Slack connection
npm start -- --test --use-kv

# Preview message without sending (KV mode)
npm start -- --dry-run --use-kv

# Show rotation statistics (KV mode)
npm start -- --stats --use-kv

# Preview upcoming rotations
npm start -- --preview=6 --use-kv
```

## 🗄️ Storage Options

### Vercel KV with Upstash (Recommended)

**Advantages**:
- ✅ Persistent across all deployments
- ✅ Shared between Slack buttons and GitHub Actions
- ✅ Automatic backups and scaling
- ✅ Zero-config initialization

**Usage**: Add `--use-kv` flag to CLI commands

## 🔧 Configuration

### Default Participants

The rotation includes these default participants (update manually as needed):

```json
{
  "users": [
    { "id": "staff.member1", "startDate": "2025-01-17" },
    { "id": "staff.member2", "startDate": "2025-01-17" },
    { "id": "staff.member3", "startDate": "2025-01-17" }
  ],
  "currentIndex": 0,
  "lastRotationDate": "2025-01-17",
  "startDate": "2025-01-17",
  "config": {
    "frequency": "weekly",
    "schedule": { "time": "09:00" }
  }
}
```

### Environment Variables

| Variable               | Required | Default | Description                                         |
| ---------------------- | -------- | ------- | --------------------------------------------------- |
| SLACK_BOT_TOKEN        | ✅        | -      | Slack bot OAuth token                               |
| SLACK_CHANNEL_ID       | ✅        | -      | Target Slack channel ID (#pan-staff)               |
| SLACK_SIGNING_SECRET   | ✅*      | -      | For signature verification (*Required for buttons) |
| ENABLE_INTERACTIONS    | ❌        | false   | Enable interactive features                         |
| TIMEZONE               | ❌        | UTC     | Timezone for scheduling                             |
| KV_REST_API_URL        | Auto     | -      | Vercel KV endpoint (auto-configured)                |
| KV_REST_API_TOKEN      | Auto     | -      | Vercel KV token (auto-configured)                   |

## 📱 Slack Message Format

```
📄 Staff Documentation Rotation
Week of Jan 20 - Jan 26, 2025

This week's article presenter: @staff.member2

Reminder for Wednesday's staff meeting:
• Please prepare an interesting article to share
• 5-10 minute presentation/discussion
• Focus on industry trends, best practices, or innovation
• Share the article link in advance if possible

[⏭️ Skip to Next]

Questions? Reach out to this week's presenter! 📚
```

## 🔄 Deployment Architecture

### Vercel Functions (Interactive Features)

- **api/slack.ts**: Handles button clicks and signature verification
- **api/rotation-state.ts**: Provides KV state access for GitHub Actions
- **Auto-scaling**: Serverless functions scale automatically
- **Persistent State**: All button interactions saved to KV

### GitHub Actions (Weekly Notifications)

- **Read-Only**: Only reads current state, never modifies
- **Scheduled**: Runs every Friday at 9:00 AM UTC
- **Reliable**: Uses committed workflow in repository
- **Uses KV**: Fetches current rotation state via API

### State Synchronization

- **Single Source of Truth**: Vercel KV database
- **Consistent**: Both Slack buttons and GitHub Actions use same state
- **Persistent**: Manual skips persist and affect weekly notifications

## 🛠️ Operational Tips

### Managing Vercel KV

**View Current State**:
```bash
curl https://your-app.vercel.app/api/rotation-state | jq
```

**Check Database in Vercel**:
1. Vercel Dashboard → Storage → Your KV Database
2. View data, metrics, and connection info

**Backup Strategy**:
- KV data is automatically backed up by Upstash
- Export state via API for additional backups
- State can be reconstructed from repository history if needed

### Monitoring and Debugging

**Check Vercel Function Logs**:
1. Vercel Dashboard → Functions
2. View real-time logs for api/slack.ts

**GitHub Actions Logs**:
1. Repository → Actions
2. View logs for weekly runs

**Test Endpoints**:
```bash
# Test Slack endpoint health
curl https://your-app.vercel.app/api/slack

# Check current rotation state  
curl https://your-app.vercel.app/api/rotation-state
```

### Common Maintenance Tasks

**Update User List**:
- Modify the embedded defaults in `src/services/KVStorageService.ts`
- Or manually update via KV dashboard
- Changes take effect immediately

**Reset Rotation**:
- Clear KV database in Vercel dashboard
- Next access will reinitialize with defaults

**Change Schedule**:
- Update cron schedule in `.github/workflows/weekly-notification.yml`
- Changes take effect on next push

## 🧪 Testing

### Local Development

```bash
# Test with local storage
npm start -- --dry-run

# Test with KV integration
npm start -- --dry-run --use-kv

# Test Slack connectivity
npm start -- --test --use-kv
```

### Production Testing

```bash
# Manual trigger GitHub Action (with dry-run)
# Go to Actions tab → Weekly Staff Documentation Rotation → Run workflow
# Select "Run in dry-run mode"

# Test Vercel functions
curl -X POST https://your-app.vercel.app/api/slack
```

## 🛠️ Troubleshooting

### Common Issues

**"Invalid signature" from Slack**:
- Verify `SLACK_SIGNING_SECRET` is correctly set in Vercel
- Ensure request URL in Slack app matches deployed Vercel URL
- Check signing secret format (no extra whitespace)

**"Missing KV environment variables"**:
- Verify KV database is connected to Vercel project
- Check `KV_REST_API_URL` and `KV_REST_API_TOKEN` exist
- Redeploy Vercel project after adding KV

**GitHub Action "should not update state" error**:
- Verify you're using the latest version with read-only KV access
- Check GitHub Action is using `--use-kv` flag
- Ensure KV API endpoint is accessible

**Button clicks not working**:
- Verify `ENABLE_INTERACTIONS=true` in Vercel
- Check Slack app Interactive Components URL is correct
- Test Vercel function endpoint directly

### Debug Commands

```bash
# Check KV state
curl https://your-app.vercel.app/api/rotation-state | jq '.data | {currentIndex, currentUser: .users[.currentIndex].id}'

# Test local KV integration
npm start -- --stats --use-kv

# Validate environment
npm start -- --test --use-kv
```

## 🔐 Security

- **Signature Verification**: All Slack requests validated with signing secret
- **Environment Variables**: Sensitive data stored in Vercel environment
- **Minimal Permissions**: Only required Slack scopes
- **Read-Only GitHub Actions**: Cannot modify rotation state
- **HTTPS Only**: All communication encrypted

## 📈 Scaling and Performance

- **Serverless**: Auto-scaling Vercel functions
- **Global CDN**: Fast response times worldwide
- **Upstash KV**: Redis-compatible with global replication
- **Rate Limiting**: Built-in Slack API rate limiting
- **Efficient**: Minimal KV operations and Slack calls

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Test with both local and KV storage modes
4. Ensure Vercel deployment works
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Need help?** Check the troubleshooting section or open an issue!