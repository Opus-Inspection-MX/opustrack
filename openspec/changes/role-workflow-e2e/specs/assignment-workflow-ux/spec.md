# Assignment workflow UX specification

## Purpose

Add RF-262–264, after RF-261 already assigned to trip retries in `spec/06`. Preserve every existing assignment, incident, availability and tracking requirement/scenario unchanged.

## Requirements

### Requirement: RF-262 · Date-aware FSR selection across assignment surfaces

Assignment create, full edit and tracking composition controls MUST evaluate candidate availability against the effective assignment `scheduledDate` in CDMX. Unavailable candidates MUST remain visible with an operational explanation and MUST be disabled for new selection. Private vacation reason text MUST NOT be disclosed to operations users or included in their response payloads. Existing selected unavailable FSRs MUST remain visible and removable, including overflow selections; removing them MUST NOT silently remove other people. Null scheduled dates MUST preserve existing deferred-check semantics. Late responses for a previous date, incident or closed editor MUST NOT overwrite current availability. Failed or pending lookups MUST be visible and MUST NOT be represented as a confirmed available result.

Server mutations MUST remain authoritative under RF-704 and the existing composition rules: validate the effective date and final retained/new set according to the existing guards, so removing an unavailable FSR and retaining only available replacements succeeds, while a prohibited retained/additional FSR rejects atomically. Client hints MUST NOT trigger automatic reassignment.

#### Scenario: Approved absence disables a candidate everywhere
- GIVEN three enabled FSR candidates and an approved vacation for one on the effective date
- WHEN operations opens create, edit or tracking composition selection
- THEN that FSR is visible but cannot be newly selected, the two replacements remain selectable, and only an operational absence explanation is exposed.

#### Scenario: Replace an unavailable selected FSR
- GIVEN a selected FSR who became unavailable, including one beyond the visible chip limit
- WHEN operations removes that selection and chooses an available replacement
- THEN the removed FSR does not block a valid final composition and unrelated selections remain unchanged.

#### Scenario: Stale responses and authoritative rejection
- GIVEN a date change with out-of-order availability responses, or approval after a successful lookup
- WHEN the old response arrives or operations saves a now-invalid selection
- THEN the old response is ignored and the server rejects any prohibited final composition without partial writes.

#### Scenario: No date and lookup failure
- GIVEN an assignment with no scheduled date, or a failed lookup for a specified date
- WHEN the editor renders
- THEN the null-date case preserves deferred availability checks, while the failed lookup shows its error/retry state rather than asserting availability.

### Requirement: RF-263 · Accessible ODT and truthful activity upload retries

ODT capture MUST expose a labeled input and keyboard-accessible, distinctly named save/cancel controls. Cancel MUST restore the saved folio without mutation; business-rule rejection MUST preserve the draft. RF-010 and closure preconditions remain unchanged.

Activity submission MUST treat both rejected promises and fulfilled unsuccessful upload ActionResults as failures. After activity creation commits, partial attachment failure MUST retain that activity identity and failed file drafts, report failures by file, and offer attachment-only retry. Retrying MUST NOT create a second activity or re-upload already successful attachments. Submission MUST unlock on every outcome; completion/reset MUST occur only when the requested uploads have succeeded or the user explicitly leaves the partial result. This does not promise full offline or cross-reload idempotency for activity creation.

#### Scenario: Keyboard ODT save and cancel
- GIVEN an editable assignment ODT field
- WHEN the FSR uses its labeled field and named save/cancel controls
- THEN save persists the entered folio, cancel restores the saved value, and a rejected save preserves the editable draft.

#### Scenario: Fulfilled business failure is not upload success
- GIVEN a committed activity and two file uploads, one successful and one fulfilled with an unsuccessful ActionResult
- WHEN the upload batch completes
- THEN the form reports the failed file, retains the activity identity and failed draft, and does not report complete success.

#### Scenario: Attachment-only retry
- GIVEN the preceding partial result, including a transport-rejected file
- WHEN the FSR retries failed attachments and they succeed
- THEN exactly one activity exists, previously successful files are not uploaded again, the failed files become evidence and the form can complete.

### Requirement: RF-264 · Administrative review of field evidence

Authorized admin assignment detail MUST show the persisted external ODT folio and start/end GPS coordinates with capture timestamps when present, distinguish missing observations from zero coordinates, and expose existing activity/attachment evidence. It MUST follow current access scoping and MUST NOT create a review gate or mutate closure state.

#### Scenario: Review two independently completed assignments
- GIVEN two completed sibling assignments with distinct FSRs, ODTs and GPS observations
- WHEN operations reviews each detail after automatic incident closure
- THEN each shows its own persisted evidence and the incident remains closed without a review mutation.

#### Scenario: Missing and zero coordinates
- GIVEN one absent coordinate pair and another valid pair containing zero
- WHEN authorized detail is rendered
- THEN missing data is identified as absent and zero is displayed as a recorded value.
