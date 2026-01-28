# Save Material Colors API - Production Review Scenarios

This document outlines all possible scenarios and outcomes when saving material colors in the Parts Edit Modal.

## API Endpoint
**PUT** `/Windchill/servlet/rest/trek/saveMaterialColors`

## Payload Structure
```json
{
  "instances": {
    "OR:com.lcs.wc.material.LCSMaterialColor:554762": {
      "materialColorServiceDescription": "...",
      "materialColorServiceMessage": "...",
      "materialColorServiceEquivalent": "ID_OR_DISPLAY_VALUE",
      "materialColorServiceSubstituteOne": "ID_OR_DISPLAY_VALUE",
      "materialColorServiceSubstituteTwo": "ID_OR_DISPLAY_VALUE",
      "partNumber": "...",
      "materialColorManufacturersPartNumber": "...",
      "materialColorStatus": "...",
      "materialColorSixtyCharacterDescription": "...",
      "materialColorThirtyCharacterDescription": "..."
    }
  }
}
```

---

## Scenario 1: All Rows Save Successfully ✅

### Request:
- Multiple rows edited and sent in payload
- All rows have valid data

### API Response:
```json
{
  "instances": {
    "OR:com.lcs.wc.material.LCSMaterialColor:243946": { /* updated data */ }
  },
  "columns": { /* column mappings */ }
}
```
**No `errors` key present**

### What Happens:
1. ✅ Previous errors cleared (`rowErrors = {}`)
2. ✅ Row data updated with response `instances`
3. ✅ Edited rows tracking cleared (`editedRows`, `editedFields`)
4. ✅ `save` event emitted with all current row data
5. ✅ Modal stays open (user can close manually)
6. ✅ Save button becomes disabled (no edited rows)

### User Experience:
- Success: All changes saved
- Modal remains open
- User can review saved data or close manually

---

## Scenario 2: Partial Save - Some Rows Fail ❌

### Request:
- Multiple rows edited (e.g., 2 rows)
- Row 1: Valid data
- Row 2: Invalid data (e.g., invalid service ID)

### API Response:
```json
{
  "instances": {
    "OR:com.lcs.wc.material.LCSMaterialColor:243946": { /* successfully saved */ }
  },
  "errors": {
    "OR:com.lcs.wc.material.LCSMaterialColor:554762": {
      "errorMessage": "wt.util.WTRuntimeException: Object \"com.lcs.wc.foundation.LCSRevisableEntity>489386666\" is not persistent..."
    }
  },
  "columns": { /* column mappings */ }
}
```

### What Happens:
1. ✅ Previous errors cleared first
2. ❌ Error messages stored in `rowErrors` for failed rows
3. ✅ Successfully saved rows updated with response `instances`
4. ✅ Successfully saved rows removed from `editedRows` tracking
5. ❌ Failed rows remain in `editedRows` tracking
6. ✅ Grid refreshed to show:
   - Error indicators (⚠ icon) in partNumber column for failed rows
   - Error row highlighting (red background)
   - Error panel displayed above grid
7. ✅ Grid scrolls to first error row
8. ✅ Modal stays open (does NOT close)

### User Experience:
- Partial success: Some rows saved, some failed
- Error panel shows which rows failed and why
- Failed rows highlighted in red
- User can fix errors and retry save
- Modal remains open until user manually closes

---

## Scenario 3: All Rows Fail ❌

### Request:
- Multiple rows edited
- All rows have invalid data

### API Response:
```json
{
  "instances": {},
  "errors": {
    "OR:com.lcs.wc.material.LCSMaterialColor:554762": {
      "errorMessage": "Error message 1"
    },
    "OR:com.lcs.wc.material.LCSMaterialColor:243946": {
      "errorMessage": "Error message 2"
    }
  },
  "columns": { /* column mappings */ }
}
```

### What Happens:
1. ✅ Previous errors cleared first
2. ❌ All error messages stored in `rowErrors`
3. ❌ No rows updated (no successful saves)
4. ❌ All rows remain in `editedRows` tracking
5. ✅ Grid refreshed to show all error indicators
6. ✅ Error panel displays all errors
7. ✅ Grid scrolls to first error row
8. ✅ Modal stays open

### User Experience:
- All saves failed
- All failed rows highlighted
- Error panel shows all errors
- User must fix all errors before successful save
- Modal remains open

---

## Scenario 4: Network/HTTP Error 🌐

### Request:
- Valid payload sent
- Network failure or server unavailable

### API Response:
- HTTP Error (4xx, 5xx, or network error)
- No response body received

### What Happens:
1. ❌ Error caught in `error` callback
2. ❌ Error message extracted: `error?.error?.message || error?.message || 'Failed to save material colors'`
3. ❌ Alert shown to user with error message
4. ✅ Previous errors NOT cleared (preserved)
5. ✅ Edited rows tracking preserved
6. ✅ Modal stays open
7. ✅ User can retry save

### User Experience:
- Alert popup: "Error: [error message]"
- No data saved
- User can retry after fixing network/server issues
- Modal remains open

---

## Scenario 5: Empty Payload (Edge Case)

### Request:
- User clicks Save but no rows are edited
- OR: All edited rows filtered out during payload building

### What Happens:
1. ✅ Early return: `if (Object.keys(instances).length === 0) return;`
2. ✅ No API call made
3. ✅ No changes to state
4. ✅ Modal stays open

### User Experience:
- Nothing happens (no API call)
- Save button remains disabled if no edited rows
- User must make changes before saving

---

## Scenario 6: Row Not Found in Grid (Edge Case)

### Request:
- MaterialColorId exists in `editedRows` but row not found in grid

### What Happens:
1. ✅ Row skipped: `if (!currentRow) return;`
2. ✅ Row excluded from payload
3. ✅ Other rows still processed normally
4. ⚠️ Row remains in `editedRows` tracking (not cleared)

### User Experience:
- That specific row not saved
- Other rows saved normally
- May need to refresh modal to clear stale tracking

---

## Scenario 7: Invalid Response Format

### Request:
- Valid payload sent

### API Response:
```json
{
  "success": true
}
```
**No `instances` or `errors` keys**

### What Happens:
1. ✅ `hasErrors` check: `false` (no errors key)
2. ✅ Tries to update rows from `response.instances` (undefined, so no updates)
3. ✅ Edited rows cleared
4. ✅ `save` event emitted
5. ✅ Modal stays open

### User Experience:
- Treated as success (no errors)
- Edited tracking cleared
- But no data actually updated in grid
- User may need to refresh to see actual saved state

---

## Scenario 8: User Edits Row After Error

### Request:
- Previous save had errors
- User edits a failed row
- User clicks Save again

### What Happens:
1. ✅ Previous errors cleared: `this.rowErrors = {}`
2. ✅ New payload sent with updated values
3. ✅ Process continues based on new response

### User Experience:
- Error cleared when user starts editing
- Fresh save attempt with corrected data

---

## Summary Table

| Scenario | API Response | Errors? | Modal Closes? | Rows Updated? | Edited Tracking Cleared? |
|----------|-------------|---------|--------------|---------------|-------------------------|
| All Success | `{ instances: {...} }` | No | No | Yes | Yes |
| Partial Save | `{ instances: {...}, errors: {...} }` | Yes | No | Partial | Partial |
| All Fail | `{ errors: {...} }` | Yes | No | No | No |
| Network Error | HTTP Error | N/A | No | No | No |
| Empty Payload | N/A (no call) | N/A | No | N/A | N/A |
| Row Not Found | N/A | N/A | No | Partial | Partial |

---

## Key Behaviors

### ✅ Always Happens:
- Modal never auto-closes (user must close manually)
- Previous errors cleared before new save attempt
- Grid refreshed after save response

### ❌ Never Happens:
- Modal auto-closes on errors
- Modal auto-closes on successful save
- Data loss without user confirmation

### ⚠️ Edge Cases:
- Empty payload: No API call
- Row not found: Row skipped
- Invalid response: Treated as success but no updates

---

## Error Display

### Visual Indicators:
1. **Error Icon (⚠)**: Shown in `partNumber` column for failed rows
2. **Red Row Highlighting**: Failed rows have red background (`error-row` CSS class)
3. **Error Panel**: Displays above grid with:
   - Material Color ID
   - Full error message
   - Clear error button (×)

### Error Panel Behavior:
- Only shown when `hasErrors()` returns `true`
- Lists all failed rows
- User can clear individual errors by clicking ×
- Errors auto-cleared when user edits the row

---

## Production Considerations

1. **Partial Saves**: API performs partial saves - successful rows are saved even if others fail
2. **No Rollback**: Failed rows don't rollback successful saves
3. **Error Persistence**: Errors persist until user fixes them or clears them
4. **User Control**: User has full control over when to close modal
5. **Data Integrity**: All fields (editable + disabled) sent in payload for context
