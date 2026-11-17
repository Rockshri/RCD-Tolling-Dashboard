# Task: Implement Enhancements in the Toll Plaza Dashboard

You are working on the existing Toll Plaza Dashboard. Implement the following enhancements in the current application while maintaining the existing architecture, UI/UX, coding standards, and functionality.

## 1. Normalize Plaza Mix Type

Currently, the following two Plaza Mix Type values are treated as separate options:

- `1+1=2 LANE TOLL PLAZA`
- `(1+1)=2 LANE TOLL PLAZA`

Both represent the same Plaza Mix Type.

**Required Changes:**
- Treat both values as one standardized Plaza Mix Type.
- Display only one canonical option in the Plaza Mix Type dropdown.
- Ensure the same normalization is applied wherever Plaza Mix Type is displayed, filtered, searched, or counted.
- Check existing records to ensure legacy values do not appear as separate categories.
- Avoid duplicate entries in the dropdown or filter options.
- Preserve existing records and relationships while implementing the normalization.

## 2. Add "Location Finalized" Field

Add a new field named **Location Finalized** to the Toll Plaza module.

### A. Table Changes
- Add a new column named `Location Finalized` in the Toll Plaza listing table.
- The column must appear immediately after `Type of Plaza` and before `Status of Civil Work`.
- Display the saved value for each Toll Plaza record.

### B. Filter Functionality
Add a filter for the `Location Finalized` column.

The filter must contain the following dropdown options:

1. Yes
2. Yet to be Finalized
3. Not-Feasible
4. No

The filter must correctly display records based on the selected value and should work in combination with all existing filters.

### C. Add Toll Plaza Sheet
- Add the `Location Finalized` field to the Add Toll Plaza sheet.
- Use a dropdown containing the same four options specified above.
- Ensure the selected value is saved correctly and is available when editing or viewing the Toll Plaza record.
- Follow the existing form validation and data-saving patterns.

### D. Table Details View
When a user opens the details view of any Toll Plaza record, include the `Location Finalized` field and display its saved value.

Ensure that this field is visible in the details view as well as the listing table.

## 3. Add Location Finalized KPI Card

Add a new KPI card to the existing dashboard.

**Card Title:** Location Finalized

**Calculation:**
- Count only those Toll Plaza records where `Location Finalized = Yes`.
- Display the total count on the KPI card.
- Ensure the count updates automatically when records are added, edited, or their Location Finalized status changes.
- Apply the existing dashboard filters and role-based data visibility wherever applicable.

## 4. Add BSRDC and BRPNNL KPI Cards

All SH-# (State Highway) entries come under **BSRDC**, and all Bridges come under **BRPNNL**.

Add the following two KPI cards to the dashboard:

### A. BSRDC Card
- **Card Title:** BSRDC
- Display the total count of SH-# entries.
- Count only records classified as State Highway (SH-#).

### B. BRPNNL Card
- **Card Title:** BRPNNL
- Display the total count of Bridge entries.
- Count only records classified as Bridges.

**Important:**
- Use the existing data fields and classification logic to identify SH-# and Bridge records.
- Ensure each applicable record is counted only once.
- Do not introduce hardcoded counts.
- Ensure both cards respond correctly to applicable dashboard filters and role-based visibility.
- Maintain consistency with the existing KPI card design and calculation approach.

## 5. Rename "SH Name" to "SH/Bridges Name"

Update the field label from `SH Name` to `SH/Bridges Name` in the following locations:

1. Toll Plaza listing table.
2. Add Toll Plaza sheet.

Ensure that the updated label is consistent wherever the same field is presented within these screens.

**Important:** This is primarily a label change. Do not unnecessarily rename database columns, API properties, or existing identifiers if doing so could affect current functionality.

## 6. Preserve Filter States During Sheet Navigation

Currently, filter selections may change or reset when navigating between different sheets or sections.

**Required Behaviour:**
- Preserve the selected filter values when navigating from one sheet to another.
- Do not automatically reset or modify existing filter selections during navigation.
- Retain the selected filters when the user returns to a previously visited sheet.
- Apply this behaviour to both existing filters and the newly introduced `Location Finalized` filter.
- Filter selections should remain intact during normal component re-rendering and data refreshes.
- Filters should only be cleared when the user explicitly clicks the Clear/Reset Filters option, wherever such functionality exists.

Use the existing state-management architecture where possible. Do not introduce unnecessary global state or additional dependencies.

---

# Implementation Guidelines (Mandatory)

Before making any changes:

1. Inspect the existing project structure and identify the relevant pages, components, forms, tables, KPI cards, APIs, state management, and database schema.
2. Understand the existing data flow for adding, editing, displaying, filtering, and calculating Toll Plaza records.
3. Identify how the application currently manages filters and sheet navigation.
4. Reuse existing components, utilities, hooks, API endpoints, and design patterns wherever possible.

### Development Rules

- Do not rewrite existing functionality unnecessarily.
- Do not modify unrelated modules, pages, or components.
- Do not make assumptions about existing database fields or business logic. Verify them in the codebase first.
- Maintain existing authentication, authorization, and role-based access controls.
- Maintain the current UI design, responsiveness, spacing, typography, and theme.
- Ensure all new fields are properly integrated into the frontend, backend, API, and database wherever required.
- Handle existing records that may not have a value for the newly introduced field without breaking the application.
- Avoid hardcoded KPI values or duplicate business logic.
- Ensure existing filters continue to work correctly after the changes.
- Do not introduce breaking changes to existing APIs or data structures.
- Do not remove or overwrite existing records.
- Use proper validation and error handling.

# Acceptance Criteria / Final Verification

Consider the task complete only after verifying the following:

- [ ] Both Plaza Mix Type variations are treated as one option.
- [ ] `Location Finalized` appears in the correct table-column position.
- [ ] The four specified options are available in the Location Finalized filter.
- [ ] The Location Finalized field is available in the Add Toll Plaza sheet.
- [ ] The saved Location Finalized value appears in the record details view.
- [ ] The Location Finalized KPI displays the correct count for `Yes`.
- [ ] The BSRDC KPI displays the correct count of SH-# entries.
- [ ] The BRPNNL KPI displays the correct count of Bridges.
- [ ] `SH Name` is renamed to `SH/Bridges Name` in the specified locations.
- [ ] Existing filter selections remain unchanged when navigating between sheets.
- [ ] The new filter works in combination with existing filters.
- [ ] Add, Edit, View, Search, Filter, and other existing functionalities continue working correctly.
- [ ] No unrelated functionality or UI has been affected.

## Final Instructions

Implement these changes in the existing codebase rather than providing only suggestions or sample code.

After implementation:
1. Summarize all files and components modified.
2. Explain any database schema changes or migrations introduced.
3. Mention how the BSRDC and BRPNNL counts are calculated.
4. Report the testing and verification performed.
5. Clearly identify any requirement that could not be implemented because of an existing codebase limitation.

**Work carefully, preserve existing functionality, and ensure the implementation is consistent with the current application architecture.**