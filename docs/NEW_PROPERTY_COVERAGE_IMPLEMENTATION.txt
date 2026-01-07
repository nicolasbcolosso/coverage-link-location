# Coverage Selection Implementation - Behavior Documentation

## Overview

This implementation introduces location-based Property coverage functionality while maintaining backward compatibility with the existing system. A feature toggle (`Is_New_Property__c`) controls which component is used.

---

## Component Behavior Comparison

| Aspect                 | Old Component (`lightningAddRemoveCoverage`) | New Component (`coverageSelection`)                        |
| ---------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| **Property Coverage**  | Single record, `Location__c = null`          | Multiple records, one per Location (`Location__c != null`) |
| **Other Coverages**    | All coverages with `Location__c = null`      | All coverages (same behavior)                              |
| **Location Selection** | Not available                                | User selects which Locations to include                    |
| **Feature Toggle**     | `Is_New_Property__c = false`                 | `Is_New_Property__c = true`                                |

---

## Data Filtering Rules

### Old Component (lightningAddRemoveCoverage)

```
Quote_Coverage_Link__c WHERE Location__c = null
```

- Retrieves **all coverages** without a Location reference
- Property coverage exists as a **single record** without Location
- No location-based functionality

### New Component (coverageSelection)

```
Quote_Coverage_Link__c WHERE (Name != 'Property' OR Location__c != null)
```

- Retrieves **all non-Property coverages** (regardless of Location)
- Retrieves **only Property coverages WITH a Location** (`Location__c != null`)
- Property coverage displayed as **one section per Location**

---

## User Experience

### Old Component Flow

1. User selects coverages from list
2. User configures field values for each coverage
3. One `Quote_Coverage_Link__c` record per coverage type

### New Component Flow

1. User selects coverages from list
2. For **non-Property coverages**: Same as old component
3. For **Property coverage**:
   - System checks Account's related Locations
   - If **no Locations**: Warning message displayed, Property cannot be added
   - If **Locations exist**: User sees Property section with subsections for each Location
   - User toggles which Locations should have Property coverage
   - User configures field values per Location
4. One `Quote_Coverage_Link__c` record per coverage type, **plus one per Location for Property**

---

## Component Routing

### Quote\_\_c (Embedded in quoteBaseComponent)

- `quoteBaseComponent.js` reads `Is_New_Property__c` from Quote record
- Conditionally renders `c-coverage-selection` or `c-lightning-add-remove-coverage`

### Policy\_\_c and Endorsement\_\_c (Screen Actions)

- `coverageSelectionRouter` component is used as the Quick Action
- Router checks `Is_New_Property__c` via `checkIsNewPropertyEnabled` Apex method
- Dynamically renders the appropriate component

---

## Data Model

### New Field: `Quote_Coverage_Link__c.Location__c`

- **Type**: Lookup to `Location__c`
- **Purpose**: Links Property coverage to a specific Account Location
- **Usage**: Only populated for Property coverages in new component

### New Field: `Is_New_Property__c` (on Quote**c, Policy**c, Endorsement\_\_c)

- **Type**: Checkbox
- **Default**: `false`
- **Purpose**: Feature toggle to enable location-based Property coverage

---

## Migration Considerations

| Scenario                                              | Behavior                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| Existing Property coverage (no Location) + Toggle OFF | Old component shows and edits the record normally                 |
| Existing Property coverage (no Location) + Toggle ON  | New component does NOT show this record (filtered out)            |
| New Property coverage + Toggle ON                     | Creates one record per selected Location                          |
| Toggle switched OFF → ON                              | Existing Property records without Location become invisible in UI |

---

## File Summary

| File                                 | Type         | Purpose                         |
| ------------------------------------ | ------------ | ------------------------------- |
| `Quote_Coverage_Link__c.Location__c` | Custom Field | Links Property to Location      |
| `Quote__c.Is_New_Property__c`        | Custom Field | Feature toggle                  |
| `Policy__c.Is_New_Property__c`       | Custom Field | Feature toggle                  |
| `Endorsement__c.Is_New_Property__c`  | Custom Field | Feature toggle                  |
| `CoverageSelectionController.cls`    | Apex Class   | Backend logic for new component |
| `QuoteController.cls`                | Apex Class   | Backend logic for old component |
| `coverageSelection`                  | LWC          | New coverage selection UI       |
| `coverageSelectionRouter`            | LWC          | Routes to old/new component     |
| `quoteBaseComponent`                 | LWC          | old component                   |
| `lightningAddRemoveCoverage`         | LWC          | old component                   |
| `Policy__c.Update_Coverages`         | Quick Action | Screen action for Policy        |
| `Endorsement__c.Update_Coverages`    | Quick Action | Screen action for Endorsement   |
