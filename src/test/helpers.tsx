import { type RenderOptions, render } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import type { ReactElement } from "react";

/**
 * Custom render function that wraps components with providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Mock session data for authenticated tests
 */
export function createMockSession(overrides?: {
  id?: string;
  email?: string;
  name?: string;
  roleId?: string;
  roleName?: string;
  defaultPath?: string;
}) {
  return {
    user: {
      id: overrides?.id || "test-user-id",
      email: overrides?.email || "test@test.com",
      name: overrides?.name || "Test User",
      roleId: overrides?.roleId || "test-role-id",
      roleName: overrides?.roleName || "FSR",
      defaultPath: overrides?.defaultPath || "/fsr",
    },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Mock admin session
 */
export function createAdminSession() {
  return createMockSession({
    roleName: "ADMINISTRADOR",
    defaultPath: "/admin",
    email: "admin@test.com",
    name: "Test Admin",
  });
}

/**
 * Mock FSR session
 */
export function createFSRSession() {
  return createMockSession({
    roleName: "FSR",
    defaultPath: "/fsr",
    email: "fsr@test.com",
    name: "Test FSR",
  });
}

/**
 * Mock client session
 */
export function createClientSession() {
  return createMockSession({
    roleName: "CLIENT",
    defaultPath: "/client",
    email: "client@test.com",
    name: "Test Client",
  });
}

/**
 * Wait for async operations to complete
 */
export async function waitForAsync() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Create mock FormData from object
 */
export function createFormData(data: Record<string, string | File>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }
  return formData;
}

/**
 * Mock file for upload testing
 */
export function createMockFile(
  name = "test.jpg",
  type = "image/jpeg",
  _size = 1024,
): File {
  const blob = new Blob(["test content"], { type });
  return new File([blob], name, { type, lastModified: Date.now() });
}

/**
 * Create mock base64 image data
 */
export function createMockBase64Image(): string {
  return "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBD";
}

// Re-export common testing utilities
export { fireEvent, screen, waitFor, within } from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
