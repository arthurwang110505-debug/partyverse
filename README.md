# PARTYVERSE
# One Room. Ten Games. Infinite Chaos.

## Quick Start
\`\`\`bash
npm install
cp .env.example .env.local  # Add your Firebase config
npm run dev
\`\`\`

## Firebase Setup
1. Go to https://console.firebase.google.com/
2. Create a new project
3. Enable **Realtime Database** (start in test mode)
4. Enable **Authentication** → Anonymous sign-in
5. Copy config to .env.local

## Database Rules
\`\`\`json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": "root.child('rooms').child($roomCode).child('players').child(auth.uid).exists()",
        "players": {
          "$playerId": {
            ".write": "auth.uid === $playerId || root.child('rooms').child($roomCode).child('hostPlayerId').val() === auth.uid"
          }
        },
        "status": {
          ".write": "data.parent().child('hostPlayerId').val() === auth.uid"
        },
        "settings": {
          ".write": "data.parent().child('hostPlayerId').val() === auth.uid"
        },
        "gameState": {
          ".write": "true"
        }
      }
    }
  }
}
\`\`\`
