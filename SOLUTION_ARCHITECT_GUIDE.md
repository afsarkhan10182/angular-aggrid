# Ag-Grid Application - Guide

### What Happens When User Opens App:

1. **Sign-in modal appears** - user enters username/password (What username and password should users enter to log in?")
2. **App converts credentials** to Base64 format (like: `Y2FydGVyczpjYXJ0ZXJz`)
3. **App calls authentication API** with these credentials
4. **If valid** - app loads with data
5. **If invalid** - shows error message

## What Backend Team Needs to Build

### 1. Authentication API (Check User Login)

**URL:** `/Windchill/servlet/rest/bomCreator/getUser`
**What we send:** `Authorization: Basic Y2FydGVyczpjYXJ0ZXJz` (Base64 encoded username:password check auth.interceptor.ts)
**What backend should do:**

- Decode the Base64 string to get username and password
- Check if username/password is correct
- If correct: return user info
- If wrong: return 401 error

**Response we expect:**

```json
{
  "name": "ktest2",
  "fullName": "test",
  "id": "OR:wt.org.WTUser:15760737585"
}
```

### 2. CSRF Token API (Get Security Token)

**URL:** `/Windchill/servlet/rest/security/csrf`
**What we send:** `Authorization: Basic Y2FydGVyczpjYXJ0ZXJz` (same Base64)
**What backend should do:**

- Check if user is logged in
- Generate a CSRF token
- Return the token

**Response we expect:**

```json
{
  "items": [
    {
      "id": "csrf",
      "attributes": {
        "nonce_key": "CSRF_NONCE",
        "nonce": "sdafasdfa"
      }
    }
  ]
}
```

### 3. Data APIs (Get Grid Data)

**URLs:** `/api/parts`, `/api/products`, etc.
**What we send:** `Authorization: Basic Y2FydGVyczpjYXJ0ZXJz`
**What backend should do:** Return the data

### 4. Save/Update APIs (Write Operations)

**URLs:** `POST /Windchill/servlet/rest/bomCreator/updateBOM`, etc.
**What we send:**

- `Authorization: Basic Y2FydGVyczpjYXJ0ZXJz`
- `csrf_nonce: <token-from-csrf-endpoint>`
