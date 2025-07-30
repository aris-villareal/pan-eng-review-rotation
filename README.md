# Slack Forum Owner Rotation Notifier

A TypeScript application that automatically manages weekly forum owner rotations with interactive Slack controls and persistent state management. Perfect for teams that need to rotate responsibilities like forum moderation, support duties, or weekly tasks.

## 🌟 Features

- **Interactive Slack Buttons**: Skip to next person and view upcoming schedule
- **Persistent State Management**: Uses Vercel KV (Upstash) for reliable state storage
- **Automated Weekly Notifications**: Sends rich Slack messages every Friday at 10:00 AM UTC
- **Smart Rotation Logic**: Uses ISO week numbers for consistent rotation
- **Dual Deployment**: Vercel serverless functions + GitHub Actions
- **Manual Control**: Skip rotations on-demand while maintaining sync
- **Comprehensive CLI**: Test, preview, and manage rotations locally
- **Zero-Config KV**: Automatic fallback to embedded defaults
- **TypeScript**: Full type safety and modern JavaScript features

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  GitHub Actions │───▶│    CLI App      │───▶│   Slack API     │
│   (Weekly @10AM)│    │  (Read-Only)    │    │ (Notifications) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Vercel KV     │◀────┬──────────────┐
                       │   (Upstash)     │     │              │
                       └─────────────────┘     │              │
                                ▲              │              │
                                │              │              │
┌─────────────────┐    ┌─────────────────┐     │              │
│   Slack Users   │───▶│ Vercel Functions│─────┘              │
│ (Button Clicks) │    │ (Interactive)   │                    │
└─────────────────┘    └─────────────────┘                    │
                                │                              │
                                └──────────────────────────────┘
                                       Slack API
```

## 🚀 Quick Start

### 1. Clone and Setup

```bash
git clone <your-repo>
cd slack-rotation-notifier
npm install
```

### 2. Create Slack App

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name your app (e.g., "Forum Rotation Bot")
4. Select your workspace

### 3. Configure Slack App Permissions

**OAuth & Permissions** → **Bot Token Scopes**:
- `chat:write` - Send messages to channels
- `chat:write.public` - Send to channels without joining

**Interactive Components**:
1. Go to **Interactive Components**
2. Turn on "Interactivity"
3. **Request URL**: `https://your-vercel-app.vercel.app/api/slack`
4. Save Changes

### 4. Deploy to Vercel

#### Setup Vercel Project

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy project
vercel

# Follow prompts to create project
```

#### Add Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. **Settings** → **Environment Variables**
3. Add these variables for **Production**, **Preview**, and **Development**:

```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_CHANNEL_ID=C1234567890
SLACK_SIGNING_SECRET=your-signing-secret-here
ENABLE_INTERACTIONS=true
TIMEZONE=America/New_York
```

#### Setup Upstash KV Database

1. In Vercel dashboard: **Storage** → **Create Database**
2. Select **KV** (powered by Upstash)
3. Name it (e.g., "rotation-state")
4. **Connect to Project** → Select your project
5. Vercel will automatically add KV environment variables

### 5. Update Slack App Interactive URL

After Vercel deployment:
1. Copy your Vercel app URL: `https://your-app.vercel.app`
2. In Slack App settings: **Interactive Components**
3. Update **Request URL** to: `https://your-app.vercel.app/api/slack`

### 6. Configure GitHub Actions

**Add Repository Secrets** (Settings → Secrets and variables → Actions):
- `SLACK_BOT_TOKEN`: Your bot token
- `SLACK_CHANNEL_ID`: Your channel ID

**Add Repository Variables** (optional):
- `TIMEZONE`: Your preferred timezone (default: UTC)

### 7. Test the Setup

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

**View Upcoming Schedule**:
- Click "📅 Show Schedule" button
- Shows next 6 weeks of rotation (ephemeral message)
- Reflects any manual skips made

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

### Operational Commands

```bash
# Check KV state remotely
curl https://your-app.vercel.app/api/rotation-state

# Validate Slack endpoint
curl https://your-app.vercel.app/api/slack
```

## 🗄️ Storage Options

### Option 1: Vercel KV (Recommended for Production)

**Advantages**:
- ✅ Persistent across all deployments
- ✅ Shared between Slack buttons and GitHub Actions
- ✅ Automatic backups and scaling
- ✅ Zero-config initialization

**Usage**: Add `--use-kv` flag to CLI commands

### Option 2: Local Files (Development/Testing)

**Advantages**:
- ✅ Simple file-based storage
- ✅ Version controlled state
- ✅ No external dependencies

**Usage**: Default behavior without `--use-kv` flag

## 🔧 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SLACK_BOT_TOKEN` | ✅ | - | Slack bot OAuth token |
| `SLACK_CHANNEL_ID` | ✅ | - | Target Slack channel ID |
| `SLACK_SIGNING_SECRET` | ✅* | - | For signature verification (*Required for buttons) |
| `ENABLE_INTERACTIONS` | ❌ | false | Enable interactive features |
| `TIMEZONE` | ❌ | UTC | Timezone for scheduling |
| `KV_REST_API_URL` | Auto | - | Vercel KV endpoint (auto-configured) |
| `KV_REST_API_TOKEN` | Auto | - | Vercel KV token (auto-configured) |

### User Configuration

The rotation starts with embedded defaults but can be customized:

```json
{
  "users": [
    { "id": "aris.villareal", "startDate": "2025-07-18" },
    { "id": "steeve.bete", "startDate": "2025-07-18" },
    { "id": "eddie.davies", "startDate": "2025-07-18" }
  ],
  "currentIndex": 0,
  "lastRotationDate": "2025-07-21",
  "startDate": "2025-07-18",
  "config": {
    "frequency": "weekly",
    "schedule": { "time": "09:00" }
  }
}
```

**Finding Slack User IDs**:
- Use display names without @ symbol (e.g., `"aris.villareal"`)
- Or use full User IDs (e.g., `"U123456789"`)

## 📱 Slack Message Format

The bot sends rich interactive messages:

```
🏆 Forum Owner Rotation
Week of Jan 22 - Jan 28, 2025

This week's forum owner: @eddie.davies

Role responsibilities:
• Monitor forum discussions  
• Escalate important issues
• Facilitate team communication
• Weekly summary on Friday

[⏭️ Skip to Next]  [📅 Show Schedule]

Questions? Reach out to this week's owner! 👋
```

## 🔄 Deployment Architecture

### Vercel Functions (Interactive Features)
- **api/slack.ts**: Handles button clicks and signature verification
- **api/rotation-state.ts**: Provides KV state access for GitHub Actions
- **Auto-scaling**: Serverless functions scale automatically
- **Persistent State**: All button interactions saved to KV

### GitHub Actions (Weekly Notifications)
- **Read-Only**: Only reads current state, never modifies
- **Scheduled**: Runs every Friday at 10:00 AM UTC
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
# Go to Actions tab → Weekly Forum Owner Rotation → Run workflow
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