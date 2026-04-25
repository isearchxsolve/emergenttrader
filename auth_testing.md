# Auth-Gated App Testing Playbook

## Step 1: Create Test User & Session
```
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Test Backend
- GET /api/auth/me with Authorization: Bearer <token>
- POST /api/bots, /api/trades etc with bearer token

## Step 3: Browser
Add cookie session_token to context, then navigate to /dashboard.

## Checklist
- user_id is custom UUID (not _id)
- All queries use {"_id": 0}
- Session user_id matches user.user_id
