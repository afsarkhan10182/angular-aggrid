# Angular PR Breakdown

This plan covers the client shared BOM Composer points, but groups matching Product and Material functionality together. This keeps the PRs broad and logical for reviewers instead of creating separate PRs for the same frontend behavior.

Afsar owns the Angular/frontend code. SriVignesh owns the Java/backend implementation and API behavior.

## Client Points Covered

1. Product BOM Composer - UI Changes - Angular code without Mock JSON
2. Product BOM Composer with Views, Export to Excel and Mass Edit
3. Product's Service BOM Composer
4. Material BOM Composer - UI Changes - Angular code without Mock JSON
5. Material BOM Composer with Views, Export to Excel and Mass Edit
6. Material's Service BOM Composer

## Final PR Grouping

The 6 points above are grouped into 3 main BOM Composer PRs, plus 1 separate COO Analysis PR.

## PR 1: Product and Material BOM Composer - Core UI Integration

### Purpose

Introduce the core Angular composer experience for Product BOM and Material BOM without relying on mock JSON.

### Client Points

- Point 1: Product BOM Composer - UI Changes - Angular code without Mock JSON
- Point 4: Material BOM Composer - UI Changes - Angular code without Mock JSON

### Scope

- Product BOM Composer core UI
- Material BOM Composer core UI
- Backend/JSP context based data loading
- Product and Material mode handling
- Shared grid setup needed by both composer types
- Basic composer actions needed for the main screen flow

### Out of Scope

- Views, export to Excel, and mass edit
- Service BOM specific workflows
- COO Analysis
- Java/backend endpoint implementation

## PR 2: Product and Material BOM Composer - Views, Export to Excel, and Mass Edit

### Purpose

Add the common advanced composer actions that apply to both Product BOM and Material BOM.

### Client Points

- Point 2: Product BOM Composer with Views, Export to Excel and Mass Edit
- Point 5: Material BOM Composer with Views, Export to Excel and Mass Edit

### Scope

- Product BOM views
- Material BOM views
- Export to Excel
- Mass edit
- Shared UI conditions and helper logic needed for these actions

### Out of Scope

- Core composer loading and base UI already covered in PR 1
- Service BOM specific workflows
- COO Analysis
- Java/backend endpoint implementation

## PR 3: Product and Material Service BOM Composer

### Purpose

Add Service BOM composer behavior for both Product and Material flows.

### Client Points

- Point 3: Product's Service BOM Composer
- Point 6: Material's Service BOM Composer

### Scope

- Product Service BOM Composer
- Material Service BOM Composer
- Service BOM specific actions
- Service BOM specific validation and UI behavior
- Shared service composer conditions used by Product and Material

### Out of Scope

- Core Product/Material composer UI already covered in PR 1
- Views, export to Excel, and mass edit already covered in PR 2
- COO Analysis
- Java/backend endpoint implementation

## PR 4: COO Analysis

### Purpose

Add the Angular COO Analysis experience as a separate business workflow. This is separate from the 6 BOM Composer points because it is a different functional area.

### Scope

- COO Analysis screen or modal
- COO filters
- COO Analysis grid
- COO export or download behavior
- COO Analysis API integration from Angular

### Out of Scope

- Product BOM Composer
- Material BOM Composer
- Service BOM Composer
- Java/backend endpoint implementation

## Reviewer Guidance

Small shared conditions, constants, and helper changes should stay inside the PR where they support that PR's functionality. They do not need separate PRs.

Each PR should explain the broad responsibility first, then list only the important functional areas changed. Avoid splitting minor `if` conditions or small shared code changes into separate PRs.

