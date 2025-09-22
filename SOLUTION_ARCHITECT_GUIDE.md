# Ag-Grid Application - Guide

### What Happens When User Opens App:

1. **App tries CSRF API first** with existing credentials (if any)
2. **If CSRF succeeds** → User already logged in, load data directly
3. **If CSRF fails** → Show sign-in modal for user to enter credentials
4. **User enters credentials** → App calls CSRF API with new credentials
5. **If valid** → App loads with data
6. **If invalid** → Shows error message

**Note:** In production, users enter their own credentials. No hardcoded credentials needed.

## What Backend Team Needs to Build

### 1. Authentication API (CSRF API with Authentication)

**URL:** `http://plmctmig.plmtestlab.com:80/Windchill/servlet/rest/security/csrf`
**What we send:** `Authorization: Basic Y2FydGVyczpjYXJ0ZXJz` (Base64 encoded username:password)
**What backend should do:**

- Decode the Base64 string to get username and password
- Check if username/password is correct
- If correct: return CSRF token (this proves user is authenticated)
- If wrong: return 401 error

**Response we expect:**

```json
{
  "items": [
    {
      "id": "csrf",
      "attributes": {
        "nonce_key": "CSRF NONCE",
        "nonce": "G0OobsCrkv2A6jK...etc..."
      }
    }
  ]
}
```

**Note:** The CSRF API only returns the nonce token, not user details. If the API call succeeds, we know the user is authenticated.

### 2. Data APIs (Get Grid Data)

**URLs:** `/api/parts`, `/api/products`, etc.
**What we send:** `Authorization: Basic Y2FydGVyczpjYXJ0ZXJz`
**What backend should do:** Return the data

### 3. Save/Update APIs (Write Operations)

**URLs:** `POST /Windchill/servlet/rest/bomCreator/updateBOM`, etc.
**What we send:**

- `Authorization: Basic Y2FydGVyczpjYXJ0ZXJz`
- `CSRF NONCE: <token-from-csrf-endpoint>`

**What backend should do:**

- Check if user is logged in
- Check if CSRF token is valid
- If both valid: save the data
- If not valid: return error
