import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Fill a React-controlled input and make sure the value survives.
 *
 * Every form in this app binds `value` + `onChange`. Typing before hydration
 * finishes lets the first client render wipe what Playwright typed: the field
 * ends up empty and the submit fails validation for no visible reason. It has
 * already bitten the login form (WebKit) and the schedule form (Chromium).
 *
 * Retrying the fill until the value reads back is the only condition that
 * proves the input is live.
 */
export async function fillStable(
  locator: Locator,
  value: string,
): Promise<void> {
  await expect(locator).toBeVisible();

  await expect(async () => {
    await locator.fill(value);
    await expect(locator).toHaveValue(value, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

/**
 * Fill several inputs and verify them together.
 *
 * Not the same as calling `fillStable` per field: hydration can land between
 * two fields and wipe the one already verified. Only re-filling and
 * re-checking the whole group as a unit is safe — this is exactly what the
 * login form needs, where the email used to arrive empty on WebKit.
 */
export async function fillStableAll(
  entries: Array<[Locator, string]>,
): Promise<void> {
  for (const [locator] of entries) {
    await expect(locator).toBeVisible();
  }

  await expect(async () => {
    for (const [locator, value] of entries) {
      await locator.fill(value);
    }
    for (const [locator, value] of entries) {
      await expect(locator).toHaveValue(value, { timeout: 1000 });
    }
  }).toPass({ timeout: 15_000 });
}

/** `fillStable` for a field addressed by id. */
export async function fillFieldById(
  page: Page,
  id: string,
  value: string,
): Promise<void> {
  await fillStable(page.locator(`#${id}`), value);
}

/**
 * Trigger button of a SearchableSelect / MultiSelect, addressed by its field
 * label.
 *
 * The trigger cannot be found by its placeholder: it shows the *selected*
 * label as soon as there is a value, and `AssignmentForm` pre-selects the most
 * recent incident, so the placeholder is never rendered there. `Label` and the
 * trigger `<button>` are DOM siblings (Radix `PopoverTrigger asChild` renders
 * the button in place), which makes the adjacent-sibling selector exact.
 */
export function comboboxByLabel(page: Page, label: string): Locator {
  // `.first()` because the selector can transiently match twice while React
  // hydrates: the production server streams the SSR markup before the client
  // tree takes over, and Playwright can sample the DOM inside that window.
  // The field is unique in the form, so the first match is always the real one.
  return page.locator(`label:text-is("${label}") + button`).first();
}

/**
 * Open a Popover-based combobox (SearchableSelect / MultiSelect) and pick an
 * option. Both render a trigger button, a cmdk search box, and `role=option`
 * items.
 */
export async function pickFromCombobox(
  page: Page,
  options: {
    /** Trigger button — prefer `comboboxByLabel`. */
    trigger: Locator;
    /** Placeholder of the search input inside the popover. */
    searchPlaceholder?: string;
    /** Text to type before picking. */
    search?: string;
    /**
     * Accessible name of the option; omit to take the first one. Matched
     * exactly, because the seed has names like "FSR User", "FSR User 2" and
     * "FSR User 3" — a substring match resolves to three options and fails
     * Playwright's strict mode.
     */
    option?: string | RegExp;
    /** MultiSelect stays open after picking, so it needs an explicit close. */
    closeAfter?: boolean;
  },
): Promise<void> {
  await options.trigger.click();

  if (options.search && options.searchPlaceholder) {
    await page.getByPlaceholder(options.searchPlaceholder).fill(options.search);
  }

  const item = options.option
    ? page.getByRole("option", { name: options.option, exact: true })
    : page.getByRole("option").first();

  await item.click();

  if (options.closeAfter) {
    await page.keyboard.press("Escape");
  }
}

/**
 * Fill a field of a react-hook-form + shadcn `FormField` form (parts, roles).
 *
 * Those forms render `FormLabel`/`FormControl` and wire the id themselves, so
 * there is no stable `#id` to target — the accessible label is the contract.
 */
export async function fillByLabel(
  page: Page,
  label: string | RegExp,
  value: string,
): Promise<void> {
  await fillStable(page.getByLabel(label), value);
}

/**
 * Pick an option from a Radix `<Select>` (lines, equipments, clientes,
 * vehicles).
 *
 * NOT the same component as `SearchableSelect`/`MultiSelect`: this one has no
 * search box, and its trigger is a combobox whose accessible name is the
 * current value or the placeholder.
 */
export async function pickFromSelect(
  page: Page,
  trigger: Locator,
  option?: string | RegExp,
): Promise<void> {
  await trigger.click();
  const item = option
    ? page.getByRole("option", { name: option, exact: true })
    : page.getByRole("option").first();
  await item.click();
}

/** Radix `<Select>` trigger addressed by the `htmlFor` of its label. */
export function selectByFieldId(page: Page, id: string): Locator {
  return page.locator(`label[for="${id}"] + button, #${id}`).first();
}

/** The submit button of the form on screen. Labels differ per catalog. */
export function submitButton(page: Page): Locator {
  return page.locator('button[type="submit"]').first();
}
