# Slack Forum Owner Rotation Notifier

A TypeScript application that automatically manages weekly forum owner rotations and sends notifications to Slack channels. Perfect for teams that need to rotate responsibilities like forum moderation, support duties, or weekly tasks.

## 🌟 Features

- **Automated Weekly Notifications**: Sends rich Slack messages every Monday
- **Smart Rotation Logic**: Uses ISO week numbers for consistent rotation
- **GitHub Actions Integration**: Zero-cost automated scheduling
- **Flexible Configuration**: Environment-based settings with validation
- **Comprehensive CLI**: Test, preview, and manage rotations locally
- **Error Handling**: Robust error handling with detailed logging
- **TypeScript**: Full type safety and modern JavaScript features

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  GitHub Actions │───▶│  Node.js App    │───▶│   Slack API     │
│   (Scheduler)   │    │  (TypeScript)   │    │   (Bot Token)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   JSON Storage  │
                       │ (User Rotation) │
                       └─────────────────┘
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

In your Slack app settings:

**OAuth & Permissions** → **Scopes** → **Bot Token Scopes**:
- `chat:write` - Send messages to channels
- `channels:read` - Read channel information
- `users:read` - Read user information

**Install App** → **Install to Workspace** → Copy the **Bot User OAuth Token**

### 4. Environment Configuration

Create a `.env` file:

```bash
# Required
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_CHANNEL_ID=C1234567890

# Optional
TIMEZONE=America/New_York
NODE_ENV=production
```

**Finding your Channel ID:**
1. Right-click on your Slack channel
2. Select "Copy link"
3. Extract ID from URL: `https://workspace.slack.com/archives/C1234567890`

### 5. Configure Users

Edit `src/config/users.json`:

```json
{
  "users": [
    {
      "id": "U123456789",
      "name": "John Doe",
      "startDate": "2024-01-01"
    },
    {
      "id": "U987654321", 
      "name": "Jane Smith",
      "startDate": "2024-01-01"
    }
  ],
  "currentIndex": 0,
  "lastRotationDate": "2024-01-01",
  "startDate": "2024-01-01"
}
```

**Finding Slack User IDs:**
```bash
# Method 1: From user profile URL
https://workspace.slack.com/team/U123456789

# Method 2: Mention user in Slack, then copy the mention
@john.doe → <@U123456789|john.doe>
```

### 6. Test the Setup

```bash
# Build the project
npm run build

# Test Slack connection
npm start -- --test

# Preview current rotation (dry run)
npm start -- --dry-run

# Show rotation statistics
npm start -- --stats
```

### 7. Setup GitHub Actions

1. **Add Repository Secrets** (Settings → Secrets and variables → Actions):
   - `SLACK_BOT_TOKEN`: Your bot token
   - `SLACK_CHANNEL_ID`: Your channel ID

2. **Add Repository Variables** (optional):
   - `TIMEZONE`: Your preferred timezone (default: UTC)

3. **Enable Actions**: The workflow will run automatically every Monday at 9 AM UTC

## 📋 Usage

### CLI Commands

```bash
# Send weekly notification (production)
npm start

# Test Slack connection and send test message
npm start -- --test

# Preview message without sending
npm start -- --dry-run

# Show rotation statistics
npm start -- --stats

# Preview upcoming rotations (4 weeks by default)
npm start -- --preview=6
```

### Development Commands

```bash
# Run in development mode
npm run dev

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Linting and formatting
npm run lint
npm run lint:fix
npm run format

# Build for production
npm run build
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SLACK_BOT_TOKEN` | ✅ | - | Slack bot OAuth token |
| `SLACK_CHANNEL_ID` | ✅ | - | Target Slack channel ID |
| `TIMEZONE` | ❌ | UTC | Timezone for scheduling |
| `NODE_ENV` | ❌ | production | Environment mode |

### User Configuration

The `src/config/users.json` file contains:

- **users**: Array of rotation participants
- **currentIndex**: Current position in rotation (0-based)
- **lastRotationDate**: ISO date of last rotation
- **startDate**: ISO date when rotation began

### GitHub Actions Workflow

The workflow (`Weekly Forum Owner Rotation`) can be:

- **Automatically triggered**: Every Monday at 9 AM UTC
- **Manually triggered**: With options for dry-run or connection testing

## 📱 Slack Message Format

The bot sends rich messages with:

```
🏆 Forum Owner Rotation
Week of Jan 8 - Jan 14

This week's forum owner: @john.doe

Role responsibilities:
• Monitor forum discussions  
• Escalate important issues
• Facilitate team communication
• Weekly summary on Friday

Questions? Reach out to this week's owner! 👋
```

## 🔄 Rotation Logic

- **Week-based**: Uses ISO week numbers for consistency
- **Round-robin**: Cycles through users in order
- **Catch-up**: Automatically advances if weeks are missed
- **Timezone-aware**: Respects configured timezone

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### Integration Testing

```bash
# Test full workflow without sending message
npm start -- --dry-run

# Test Slack connectivity
npm start -- --test
```

### Manual Testing

```bash
# Check rotation preview
npm start -- --preview=4

# View current statistics
npm start -- --stats
```

## 🛠️ Troubleshooting

### Common Issues

**"Missing required environment variables"**
- Ensure `.env` file exists with `SLACK_BOT_TOKEN` and `SLACK_CHANNEL_ID`
- Check token format starts with `xoxb-`

**"Slack connection failed"**
- Verify bot token is correct
- Ensure bot is added to the target channel
- Check bot has required permissions (`chat:write`, `channels:read`)

**"User not found at index"**
- Check `users.json` has valid user entries
- Verify `currentIndex` is within array bounds
- Validate user ID format (should start with `U`)

**"Invalid Slack channel ID format"**
- Channel ID should be ~11 characters starting with `C`
- Get ID from channel URL or Slack settings

**GitHub Actions failures**
- Check repository secrets are set correctly
- Verify workflow has required permissions
- Review action logs for specific errors

### Debugging

Enable debug logging:

```bash
NODE_ENV=development npm start -- --dry-run
```

Check rotation state:

```bash
npm start -- --stats
```

Validate configuration:

```bash
npm start -- --test
```

## 🔐 Security

- **Secrets Management**: Use GitHub secrets for sensitive data
- **Token Scope**: Minimal required Slack permissions
- **Validation**: Input validation and error handling
- **No Data Storage**: Only local JSON files, no external databases

## 📈 Future Enhancements

- [ ] Web dashboard for user management
- [ ] Slack slash commands for manual rotation
- [ ] Holiday/vacation handling
- [ ] Multiple rotation groups
- [ ] Database storage option
- [ ] Analytics and reporting
- [ ] Email notifications backup
- [ ] Custom message templates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Need help?** Check the troubleshooting section or open an issue! 