import { expect, test } from "@playwright/test";

test("login page exposes labeled credential fields", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("link", { name: "Create a workspace" })).toHaveAttribute(
    "href",
    "/register",
  );
});

test("workspace registration form is available without an existing account", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Create your workspace" })).toBeVisible();
  await expect(page.getByLabel("Workspace name")).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveAttribute("minlength", "12");
  await expect(page.getByRole("button", { name: "Create workspace" })).toBeVisible();
});

test("dashboard redirects unauthenticated visitors to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});
