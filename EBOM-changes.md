Alright — here’s your **complete, consolidated EBOM specification with all clarifications included**.
This is now your **single source of truth** for EBOM behavior, scope, and constraints.

I organized it like an implementation doc so you (or any dev) can directly build from it.

---

# ✅ EBOM – Final Functional Rules (with Clarifications)

---

## 1. Screen behavior

* No SKU view
* No SKU selection UI
* Only **Mass Edit mode**
* ❌ No Service Data Manager screen

---

## 2. Columns / fields source (API-driven)

* All fields depend strictly on **BOM API / mock JSON response**
* Only columns returned by API should be rendered
* If column not present → do not show it
* ❌ No hardcoded EBOM-only fields in frontend

Rule:

```
API drives UI completely
```

---

## 3. Editable fields - Existing rows

### Core fields (validated) all are required field in all bom types it means no empty value in terms of dates also no dd mm yyyy it should give error cant be empty if all the values are editable when save is click we are checking validation just reference

* Part # (if part is cleared then call the autopopulate method because if part is empty then autopopulate field should  also be empty think logical i am not saying call autopopulate point is if part is selected we are populating other fields so what the part is removed then we should remove also selected values which auto populate for all bomtype not just EBOM)
* Start Date
* End Date
* Quantity

### Service Data fields (no validation) - make it editable only this fiels only for now 

* materialColorThirtyCharacterDescription
* materialColorSixtyCharacterDescription
* materialColorServiceSubstituteOne  - autocompletefield check how we are handling in parts edit modal do the working like that only
* materialColorServiceSubstituteTwo - autocompletefield check how we are handling in parts edit modal do the working like that only
* materialColorServiceEquivalent - autocompletefield check how we are handling in parts edit modal do the working like that only
* materialColorServiceDescription
* materialColorServiceMessage

## 4. Validation rules in the existing rows for all bomtype not just EBOM

### Required

* Part #
* Start Date
* End Date
* Quantity

### * All service fields  Not required means this is are not mandatory fields to shown validation for 

If invalid when we click on save then :

* block save
* highlight row

---

## 5. Duplicate validation

Same logic as MBOM.

* duplicate Part OR/AND Feature combination not allowed whatever is there in the MBOM
* reuse existing MBOM duplicate validation
* do not create new logic in context of validation 


Do NOT use:

* ptcBomPartMarkUp
* enumMBOM001
* any MBOM-specific enums or markup logic

These concepts do not exist in EBOM.
---

## 6. Save flow (STRICT ORDER – critical) - for the existing rows

### Step 1 — Material Color Save API (FIRST)

Send:

* all service material color fields only

Trigger ONLY if:

* any service field value actually changed (“touched”) then pass that service field only

If:

* ❌ even one error
  → STOP
  → highlight rows with errors
  → DO NOT call BOM API

If:

* ✅ 100% success
  → continue to Step 2

---

### Step 2 — BOM Save API (SECOND)

Send ONLY:

* Part
* Start Date
* End Date
* Quantity

Do NOT send:

* any service data (already saved in Step 1)

Rules:

* dates & quantity → old/new how we used to send already in the payload
* part → existing colorId/childId flow for the part we will follow (how we are follwing in add new row in the existing for this part values)

---

for the new also same thing but first check what we are doing currently because in the new row we are not passing old/new for any field that logic is same but if the service fields touch then same existing concept call step1 and step2

if the data is mixed of existing and new row then also first it will call the service material api then save bom


## 7. What counts as “touched” (important)

### Service API should trigger ONLY when:

Any of these changed:

Service Data fields

* materialColorThirtyCharacterDescription
* materialColorSixtyCharacterDescription
* materialColorServiceSubstituteOne  - autocompletefield check how we are handling in parts edit modal
* materialColorServiceSubstituteTwo - autocompletefield check how we are handling in parts edit modal
* materialColorServiceEquivalent - autocompletefield check how we are handling in parts edit modal
* materialColorServiceDescription
* materialColorServiceMessage

Not triggered by:

* focus only
* unchanged values

---

## 8. SKU behavior (EBOM specific)

### when we are adding new row 

* All rows apply to ALL SKUs - when the part dropdown is selected 
* No manual SKU selection anywhere

---

### New Row behavior (auto SKU population) (EBOM specific)

When adding a new row:

Selecting/changing **Part #**
→ automatically assign ALL SKU IDs

* No paste part option
* No SKU picker
* No manual selection

Flow:

```
Add row
→ select part
→ system auto-fills all SKUs
```

---

## 9. Grid capability

EBOM supports same mechanics as MBOM:

* same grid
* same editing
* same mass edit
* same UX

Only business logic differs.

---

## 10. Scope isolation

EBOM must not affect other BOM types.

* ❌ No impact to SBOM
* ❌ No impact to MBOM
* ❌ No shared behavior breakage

All logic must be gated:

## 11. Not applicable in EBOM (explicit exclusions)

Do NOT use:

* ptcBomPartMarkUp
* enumMBOM001
* any MBOM-specific enums or markup logic

These concepts do not exist in EBOM.
