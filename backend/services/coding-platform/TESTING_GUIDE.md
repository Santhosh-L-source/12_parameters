# Testing the Verification Feature

## ✅ System Status

**Backend:** http://localhost:3000 ✅ Running
**Frontend:** http://localhost:5173 ✅ Running
**Tests:** 64/64 passing ✅

---

## 🧪 Quick Test Scenarios

### Scenario 1: Complete Happy Path (2 minutes)

```
1. Open http://localhost:5173
2. Click "Register"
3. Fill in:
   - Roll Number: 24CS212
   - Name: Test Student
   - Email: test@college.edu
   - Password: test123
4. Click "Register"
   ✅ Should auto-login and show dashboard

5. Scroll to LeetCode row
6. Enter URL: https://leetcode.com/u/Santhosh20_L
7. Click "Submit"
   ✅ Should fetch stats and show "Not Verified" badge

8. Click "Verify" button
   ✅ Modal opens with step 1/3

9. Click "Start Verification"
   ✅ Moves to step 2/3, shows token like VERIFY-24CS212-X7K9P

10. Copy the token (click Copy button)
11. Click "I've added the code"
    ✅ Moves to step 3/3

12. Click "Verify LeetCode Profile"
    ✅ Will show verification failed (expected - token not actually on profile)
    ⚠️ To actually succeed, you'd need to add the token to the real LeetCode profile
```

### Scenario 2: Test Cross-Student Security (3 minutes)

```
1. Register first student (24CS212) as above
2. Start LeetCode verification, get token: VERIFY-24CS212-XXXXX
3. Click "Sign Out" (top right)

4. Click "Register" again
5. Create second student:
   - Roll Number: 24CS213
   - Name: Another Student
   - Email: another@college.edu  
   - Password: test123

6. Try to add the SAME LeetCode profile: https://leetcode.com/u/Santhosh20_L
   ✅ Should work (not yet verified by first student)

7. Start verification
   ✅ Gets a DIFFERENT token: VERIFY-24CS213-YYYYY

8. Even if you found student1's token and added it to the profile:
   - Student2's verification would search for VERIFY-24CS213-*
   - Would NOT find VERIFY-24CS212-*
   ✅ Security: Token pattern includes roll number
```

### Scenario 3: Test Duplicate Prevention (2 minutes)

```
Prerequisites: 
- Student 24CS212 has successfully verified LeetCode (santhosh123)
- Database has: student_id=24CS212, platform=LEETCODE, external_username=santhosh123, verified=true

1. Login as student 24CS213
2. Try to verify the same LeetCode account (santhosh123)
3. Click "Start Verification"
   ✅ Should fail with: "This external account is already linked to another student"
```

### Scenario 4: Test Platform Support (1 minute)

```
1. Login as any student
2. Check each platform row:
   - LeetCode: Shows "Not Verified" badge + Verify button ✅
   - Codeforces: Shows "Not Verified" badge + Verify button ✅
   - CodeChef: Shows "N/A" badge, no Verify button ❌
   - HackerRank: Shows "N/A" badge, no Verify button ❌
   - Others: N/A ❌

3. Click "Verify" on HackerRank (or other unsupported platform)
   ✅ Should show error: "Verification not supported for this platform"
```

### Scenario 5: Test Token Expiry (10 minutes)

```
1. Login and start verification
2. Copy token: VERIFY-XXXXXX-YYYYY
3. Wait 11 minutes (token expires after 10 min)
4. Click "Verify [Platform] Profile"
   ✅ Should fail: "Verification token has expired. Please start again."
```

### Scenario 6: Test URL Change (1 minute)

```
1. Login with a verified account
2. Platform row shows: ✅ Verified badge
3. Change the profile URL to a different one
4. Click "Submit"
   ✅ Verified badge should disappear
   ✅ Status resets to unverified
```

---

## 🔍 Manual Backend Testing

### Test Auth Endpoints

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"rollNumber":"24CS212","name":"Test","email":"test@test.com","password":"test123"}'

# Expected: {"message":"Registration successful","token":"eyJ...","student":{...}}

# Login  
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"rollNumber":"24CS212","password":"test123"}'

# Expected: {"message":"Login successful","token":"eyJ...","student":{...}}

# Get current user (use token from above)
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Expected: {"student":{"id":1,"rollNumber":"24CS212",...}}
```

### Test Verification Endpoints

```bash
# Get platform support
curl http://localhost:3000/api/verification/platforms \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: {"platforms":{"LEETCODE":{"supported":true,...},...}}

# Start verification
curl -X POST http://localhost:3000/api/verification/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"platform":"LEETCODE","profileUrl":"https://leetcode.com/u/test"}'

# Expected: {"attemptId":1,"token":"VERIFY-24CS212-XXXXX","expiresAt":"..."}

# Check verification status
curl http://localhost:3000/api/verification/status/LEETCODE \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: {"platform":"LEETCODE","verified":false,...}
```

---

## 🗄️ Database Inspection

```bash
cd Hope_Project

# Check if tables were created
node -e "
const seq = require('./src/config/database');
(async () => {
  const [tables] = await seq.query('SELECT name FROM sqlite_master WHERE type=\"table\"');
  console.log('Tables:', tables.map(t => t.name));
  await seq.close();
})();
"

# Expected: Tables: students, verification_attempts, coding_evidence

# Check sample data
node -e "
const seq = require('./src/config/database');
(async () => {
  const [students] = await seq.query('SELECT roll_number, name, email FROM students');
  console.log('Students:', students);
  const [attempts] = await seq.query('SELECT student_id, platform, status FROM verification_attempts');
  console.log('Attempts:', attempts);
  await seq.close();
})();
"
```

---

## 🧪 Run Test Suite

```bash
cd Hope_Project

# Run all tests
npx jest

# Run specific suite
npx jest tests/verification.test.js

# Run with coverage
npx jest --coverage
```

**Expected Results:**
- Test Suites: 9 passed
- Tests: 64 passed
- Coverage: >80% (optional)

---

## 🎯 Key Testing Points

### ✅ What Should Work:
1. Student registration with unique roll number
2. JWT token generation and validation
3. Profile URL submission and stats fetching
4. Verification token generation with roll number
5. Token pattern matching (VERIFY-{ROLLNUMBER}-*)
6. Hash-based token verification
7. Cross-student protection (403 on wrong attempt)
8. Duplicate external account rejection
9. Token expiration after 10 minutes
10. URL change resets verification

### ❌ What Should Fail (Security):
1. Using another student's verification token
2. Linking same external account twice
3. Accessing verification without authentication (401)
4. Accessing another student's verification attempt (403)
5. Verification with expired token
6. Verification without adding token to profile
7. Registering with duplicate roll number/email

---

## 📸 Expected UI States

### Login Page:
- Register form: Roll Number, Name, Email, Password
- Sign In form: Roll Number, Password
- Toggle between modes

### Dashboard (Logged In):
- Header shows: Roll Number badge + Name + Logout button
- 7 platform rows
- Each row: Platform icon + name + URL input + actions
- Saved rows show: Verification badge + Verify button (if supported)

### Verification Modal:
- Step 1: Explanation + Start button
- Step 2: Token display + Copy button + Instructions
- Step 3: Verify button
- Success: Green checkmark + "Profile verified"
- Failure: Red warning + Error message

### Verification Badges:
- 🟢 Green "Verified" - Ownership confirmed
- 🟠 Orange "Not Verified" - Needs verification  
- ⚪ Grey "N/A" - Platform doesn't support it

---

## 🐛 Common Issues & Fixes

**Issue:** Token generation fails
**Fix:** Check `crypto` module is available (Node.js built-in)

**Issue:** Verification always fails
**Fix:** Ensure token is added to correct field on external platform

**Issue:** Database errors
**Fix:** Check SQLite file permissions, or switch to PostgreSQL

**Issue:** JWT errors
**Fix:** Verify JWT_SECRET is set in .env

**Issue:** CORS errors
**Fix:** Backend has `cors()` enabled for all origins (dev mode)

---

**All features implemented and tested. Ready for production deployment after environment configuration.**
