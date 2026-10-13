# Role workflow E2E specification

## Purpose

Define acceptance evidence for existing domain rules and this change's additive RF-711/262–264. Workflow identifiers below are test contracts, not new domain RF allocations. Old requirements and scenarios MUST remain unchanged.

## Requirements

### Requirement: WF-01 · Authentic incident handoff and independent sibling closure

The suite MUST authenticate synthetic REPORTER, ADMIN_OPERACION, ADMIN_VACACIONES and three candidate FSR accounts. REPORTER MUST report an incident for its assigned center with a real image using the UI (RF-201/217). Operations MUST link that same incident to a schedule through UI (RF-402/408), not create a substitute incident. A candidate vacation MUST be requested and approved via UI before operations sees it disabled and chooses the other two FSRs (RF-701/702/703/704/262).

Operations MUST create two distinct assignments for that incident, each with one different available FSR. Each FSR MUST independently acknowledge VISTO, start INICIADO with GPS, pause EN_PROGRESO, resume INICIADO, record activity with image, capture ODT, start/end its own vehicle trip with actual odometer photos and close with final GPS through UI (RF-252–259/357/358/365). Each trip MUST link to its own still-open assignment and end before that assignment closes. Vehicle/FSR occupancy MUST remain independent. First sibling closure MUST leave the incident nonterminal; closing the last active sibling MUST automatically close it (RF-202/257). Operations review MUST happen afterward and assert both assignments' ODT/GPS, activity/evidence and completed trips without a new approval gate.

#### Scenario: Last sibling closes the shared incident
- GIVEN the reported incident linked to a schedule, unavailable candidate and two independent assigned FSRs/vehicles
- WHEN both FSRs execute their separate phased UI workflows and the first closes before the second
- THEN the first closure leaves its sibling open and the incident nonterminal, and the last closure automatically marks the same incident CERRADO
- AND post-closure operations review shows both distinct assignments/trips and real decoded evidence.

#### Scenario: Closure preconditions remain authoritative
- GIVEN an in-progress assignment without saved ODT or active evidence
- WHEN its FSR attempts closure through UI
- THEN it remains open with an operator-facing failure and succeeds only after missing requirements are supplied.

### Requirement: WF-02 · Employee/admin vacation lifecycle and ownership

The suite MUST exercise own EMPLEADO request creation, read/balance visibility, pending edit and cancellation; administrator creation for another holder, pending edit, approval, rejection and cancellation; started-approved correction with mandatory reason; and negative cross-owner read/edit/cancel plus non-admin decision/correction access. Requests under test MUST be created and decided through UI. Cancellation MUST reuse RF-709; correction MUST retain today/past consumption, original approval and charge snapshots. Pending edit must exercise own-reservation exclusion, immutable holder, stale status and invalid range/overlap/balance rejection (RF-701/702/706/709/711).

#### Scenario: Employee and administrator complete CRUD and decisions
- GIVEN synthetic employees with valid earned grants and no consuming requests
- WHEN employee and admin create/read/edit requests, admin approves/rejects separate requests, and own/admin users cancel eligible requests
- THEN UI statuses, date/reason values, attribution and reservation/release balances match the performed operations.

#### Scenario: Started-approved correction without time travel
- GIVEN an admin-created retroactive request with explicit reason, approved through UI, whose range starts today or earlier and ends later
- WHEN cancellation is attempted and then an authorized shortening correction with separate reason is submitted
- THEN cancellation rejects, correction preserves approval and original charge dates, retains today/past charges and releases only future consumption.

#### Scenario: Ownership, status and validation negatives
- GIVEN another holder's request, a stale pending edit, an invalid replacement and a non-admin account
- WHEN cross-owner read/edit/cancel, stale-status edit, invalid date/overlap/balance replacement, or non-admin approval/correction is attempted
- THEN access/mutations reject with no unauthorized or partial changes and existing reservation/snapshots remain intact.

### Requirement: WF-03 · Dedicated isolated and truthful execution

Workflow tests MUST run only in a dedicated `workflows` project with one worker and a dedicated invocation creating a new ephemeral DB/app lifecycle. Other project matching MUST exclude them. Fixtures MAY write raw prerequisites: synthetic users/roles/memberships, centers/hierarchy, vehicles, calendar/grant configuration and cleanup. They MUST NOT directly insert/update incidents, schedules, assignments, vacations, activities, attachments, trips or statuses being tested. Read-only DB assertions MAY corroborate UI outcomes. Browser geolocation permission/coordinates MAY simulate field devices; production/server time MUST NOT be changed. Controlled test-calendar setup MUST make the actual CDMX execution day valid for field work and keep funding valid near year boundaries, without mutating business entities under test.

Every photo MUST be a valid image, and displayed uploaded photos MUST be decoded successfully with nonzero natural dimensions. Filename, MIME metadata or row counts alone MUST NOT prove image success. Suite setup/teardown MUST isolate synthetic identities and remove controlled-calendar changes, even after failure. Repeated runs/retries MUST rebuild or clean prerequisites and MUST NOT depend on previous test business records. Shared ephemeral runners MUST not overlap on the same stack.

#### Scenario: Dedicated repeatable run
- GIVEN the dedicated workflow invocation
- WHEN it prepares a fresh stack, executes UI workflows and exits successfully or fails
- THEN only workflow tests and needed setup run with one worker, all test calendar changes are contained, and lifecycle teardown runs.

#### Scenario: Evidence is decoded rather than metadata-only
- GIVEN uploaded reporter/activity/odometer photos
- WHEN their UI previews are inspected
- THEN each loads and decodes to nonzero dimensions and belongs to the corresponding persisted incident, assignment or trip.

#### Scenario: No fixture shortcut for transitions
- GIVEN the workflow fixture setup and test body
- WHEN mutations are inspected
- THEN raw writes create only prerequisites/cleanup and every business transition asserted by WF-01/WF-02 is performed through authenticated UI.
