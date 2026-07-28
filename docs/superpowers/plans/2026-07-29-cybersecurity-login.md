# cybersecurity login implementation plan

> **For agentic workers:** Execute this plan task-by-task in the current workspace. Do not run git add or git commit.

**Goal:** Redesign `/login` as a responsive dark SOC console access screen with a generated cybersecurity artwork while preserving the existing group-password authentication flow.

**Architecture:** Keep the existing client-side login component and API contract. Add the visual surface directly in `src/app/login/page.tsx`, keep page-specific visual rules in `src/app/globals.css` only when Tailwind utilities are insufficient, and add one local raster asset at `public/images/cybersecurity-network.png`. Extend the component test for copy, password visibility, and pending state.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Vitest, Testing Library, generated PNG asset.

## Global Constraints

- Preserve `POST /api/auth/login` with `{ password }` as the request body.
- Preserve the 204 success path, `TAB_SESSION_STORAGE_KEY`, `createTabSessionMarker()`, and redirect to `/monitor`.
- Do not add dependencies or modify auth routes, session logic, monitor dashboard, or `BrandLogo`.
- Do not use gradient classes or a decorative CSS grid on the login surface.
- Do not run `git add`, `git commit`, `git reset`, or checkout commands.

### Task 1: Generate and install the cybersecurity artwork

**Files:**
- Create: `public/images/cybersecurity-network.png`

**Interfaces:**
- Produces a local image consumable from `/images/cybersecurity-network.png` by the login page.

- [ ] **Step 1: Generate the artwork**

Use the built-in image generation tool with this prompt:

```text
Wide cinematic abstract cybersecurity network artwork for a dark SOC console login screen, near-black forest green background, phosphor green data paths and small glowing nodes, a restrained geometric shield structure emerging from the network, precise technical atmosphere, asymmetric composition with visual weight on the right side and clean negative space on the left for overlay text, subtle grain, premium software infrastructure aesthetic, no people, no healthcare imagery, no devices, no logos, no letters, no numbers, no UI panels, no gradients in the interface sense, landscape 4:3 composition.
```

- [ ] **Step 2: Copy the selected generated output into the project**

Place the final PNG at `public/images/cybersecurity-network.png` without overwriting an existing asset. If a generated image is saved under the Codex generated-images directory, copy it into the project using a filesystem copy command after inspecting its path.

- [ ] **Step 3: Inspect the asset dimensions and file presence**

Run:

```powershell
Get-Item public/images/cybersecurity-network.png
```

Expected: one PNG file exists under `public/images` and its size is greater than zero bytes.

### Task 2: Redesign the login component without changing auth behavior

**Files:**
- Modify: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `BrandLogo`, `createTabSessionMarker`, `TAB_SESSION_STORAGE_KEY`, and the existing login API.
- Produces: accessible `LoginPage` with status panel, generated image, password visibility toggle, and preserved submit behavior.

- [ ] **Step 1: Add password visibility state**

Add `const [showPassword, setShowPassword] = useState(false);` beside the existing state. Set the input type to `showPassword ? "text" : "password"` and add a native button with an accessible label that toggles the state.

- [ ] **Step 2: Replace the existing layout with the two-panel SOC console surface**

Keep the current `handleSubmit` function behavior. Render a full-viewport `main` with:

```tsx
<main className="min-h-screen bg-[#07110f] text-[#eef8e9] selection:bg-[#9cff57] selection:text-[#07110f]">
  <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
    <div className="grid w-full overflow-hidden rounded-xl border border-[#274236] bg-[#0c1916] lg:grid-cols-[1.1fr_0.9fr]">
      {/* status panel */}
      {/* access panel */}
    </div>
  </div>
</main>
```

The status panel must include `PROJECT MONITOR`, `SECURE CHANNEL / OPERATIONAL`, a short headline about observing change before impact, a positioned `<Image>` or `<img>` using `/images/cybersecurity-network.png`, and status values `CURRENT TAB` and `LIVE`. Keep the image decorative if the adjacent text already communicates the panel purpose.

The access panel must use heading `Workspace access`, keep label `Group password`, keep `id="group-password-help"`, keep `aria-describedby`, and change the submit button copy to `Access workspace` / `Authenticating...`.

- [ ] **Step 3: Add accessible interaction styling**

Use a `type="button"` password toggle inside the input wrapper. Give it `aria-label={showPassword ? "Hide password" : "Show password"}` and `aria-pressed={showPassword}`. Keep visible focus rings on the input, toggle, and submit button. Set `aria-invalid={Boolean(errorMsg)}` on the input and keep `role="alert"` on the error block.

- [ ] **Step 4: Keep responsive behavior and reduced-motion support**

Use the existing Tailwind responsive prefixes to stack the panels on small screens. If a subtle reveal animation is added, guard it with a CSS media query or avoid it; no motion is required for the core design and the page must remain fully usable with reduced motion enabled.

### Task 3: Extend component coverage

**Files:**
- Modify: `tests/components/LoginPage.test.tsx`

**Interfaces:**
- Verifies: new visible copy, password visibility behavior, pending state, and preserved auth error behavior.

- [ ] **Step 1: Update button queries for the new copy**

Change submit button queries from `/sign in/i` to `/access workspace/i` while retaining the existing accessible input assertions.

- [ ] **Step 2: Add a password visibility test**

Render the page, type a value, click the `Show password` button, expect the input type to become `text`, click `Hide password`, and expect the type to return to `password`.

- [ ] **Step 3: Add a pending-state test**

Mock `fetch` with a promise that remains unresolved, submit a non-empty password, then expect `Authenticating...` and a disabled submit button.

- [ ] **Step 4: Add the new status-copy assertion**

Assert that `PROJECT MONITOR` and `SECURE CHANNEL / OPERATIONAL` render. Keep the no-gradient assertion and the existing 401 error test.

### Task 4: Verify the changed surface

**Files:**
- No additional files.

- [ ] **Step 1: Run the focused component test**

Run `npm run test -- tests/components/LoginPage.test.tsx`.

Expected: all login component tests pass.

- [ ] **Step 2: Run type checking**

Run `npm run typecheck`.

Expected: TypeScript exits with code 0.

- [ ] **Step 3: Run linting**

Run `npm run lint`.

Expected: ESLint exits with code 0.

- [ ] **Step 4: Run the production build**

Run `npm run build`.

Expected: Next.js completes the production build without errors.
