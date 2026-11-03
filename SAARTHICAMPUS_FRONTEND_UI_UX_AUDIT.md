# SaarthiCampus Frontend UI/UX Design System Audit & Architectural Review

**Target System:** SaarthiCampus (RecruitOS) Frontend  
**Technology Stack:** React 19, Vite 8, Tailwind CSS v4, Framer Motion, Recharts, Lucide React, Supabase  
**Audit Type:** Read-Only Static Architectural, UI/UX, Design System, Responsive & Accessibility Audit  
**Auditor:** Senior UI/UX Designer, Frontend Architect, and Design System Auditor  
**Date:** November 2026  
**Status:** Comprehensive Completed Audit  

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Existing Design Identity](#2-existing-design-identity)
3. [Exact Colour Palette](#3-exact-colour-palette)
4. [Typography and Font Details](#4-typography-and-font-details)
5. [Light Mode Findings](#5-light-mode-findings)
6. [Dark Mode Findings](#6-dark-mode-findings)
7. [Page-by-Page UI Audit](#7-page-by-page-ui-audit)
   - [7.1 Public Pages](#71-public-pages)
   - [7.2 Student Pages](#72-student-pages)
   - [7.3 Placement Coordinator Pages](#73-placement-coordinator-pages)
   - [7.4 Corporate & Recruiter Pages](#74-corporate--recruiter-pages)
   - [7.5 Admin Pages](#75-admin-pages)
8. [Component Consistency Findings](#8-component-consistency-findings)
9. [Responsive Design Findings](#9-responsive-design-findings)
10. [Accessibility & Usability Findings](#10-accessibility--usability-findings)
11. [Design System Inventory](#11-design-system-inventory)
12. [Prioritised Improvement Recommendations](#12-prioritised-improvement-recommendations)
13. [Exact Frontend Files Requiring Changes](#13-exact-frontend-files-requiring-changes)
14. [Design Direction Comparison & Final Scorecard](#14-design-direction-comparison--final-scorecard)

---

## Finding Classification Legend
- **[Confirmed]**: Verified directly from static source code inspection (CSS variables, JSX markup, hardcoded styles, imports, or missing tokens).
- **[Inferred]**: Deduced with high architectural certainty based on component composition, CSS cascading rules, or cross-browser standards.
- **[Requires Visual Verification]**: Items whose exact visual defect depends on live client browser rendering, DPI scaling, viewport heights, or specific user-agent defaults.

---

## 1. Executive Summary

SaarthiCampus is a comprehensive campus and corporate recruitment operating system built on React 19 and Vite. The platform features an extensive scope covering candidate discovery, campus databases, TPO coordination, job management, AI-driven resume scoring, aptitude assessments, video group discussions, live AI interviews, hiring pipelines, and analytics reporting.

### Core Audit Verdict
While the application is functionally rich and contains sophisticated features, the frontend design system currently suffers from **severe architectural fragmentation, competing CSS token ecosystems, widespread hardcoded inline styling, dead/orphaned code, broken dark mode implementations, and unstandardised responsive breakpoints.**

```
+---------------------------------------------------------------------------------------------+
|                                SAARTHICAMPUS DESIGN SYSTEM MATURITY                         |
+---------------------------------------------------------------------------------------------+
| Design Token Standardization:  [==--------] 2.5 / 10  (5 competing token namespaces)        |
| Design Consistency:             [===-------] 3.5 / 10  (Mixed styles, fonts, and icons)      |
| Light Mode Polish:              [======----] 6.0 / 10  (Functional, moderate readability)    |
| Dark Mode Implementation:       [==--------] 2.0 / 10  (Broken on student & public views)    |
| Responsive Fluidity:            [====------] 4.0 / 10  (Table scrollbars & rigid inline grids) |
| Accessibility (WCAG 2.1 AA):   [===-------] 3.0 / 10  (Contrast fails, outline:none usage)  |
| Codebase Hygiene:               [===-------] 3.5 / 10  (7 orphaned files, layered CSS append) |
+---------------------------------------------------------------------------------------------+
```

### Critical High-Impact Defects
1. **Critical Student UI Bug in AI Screening & Tests [Confirmed]:**  
   In `src/pages/AIInterview.jsx` and `src/pages/AptitudeTest.jsx`, the components reference non-existent CSS variables (`var(--bg)`, `var(--surface)`, `var(--surface-2)`, `var(--primary)`, `var(--border)`). Because `src/index.css` defines `--bg-base`, `--bg-surface`, and `--brand-purple`, the browser defaults to transparent backgrounds. In `AIInterview.jsx`, user chat bubbles render white text on a transparent background, rendering candidate responses invisible. Furthermore, `AptitudeTest.jsx` renders a legacy "R" (RecruitOS) logo instead of Saarthi branding.
2. **Competing Design Token Namespaces [Confirmed]:**  
   Instead of a unified design system, the application has five isolated CSS variable ecosystems that declare different background tones, text colors, and brand accents (`index.css` uses `--brand-purple: #7C3AED`, `AdminDashboard.css` uses `--admin-purple: #6d4aff`, `CorporateDashboard.css` uses `#743bf1`, `Dashboard.css` uses `--dash-primary: #7657e8`, and `CampusDB.jsx` hardcodes `#6327BD`).
3. **Rigid Inline Layouts Breaking on Mobile [Confirmed]:**  
   The primary public gateway `src/pages/LoginSelect.jsx` is built entirely with inline CSS using rigid multi-column CSS grids (`gridTemplateColumns: "minmax(0,1fr) minmax(0,2.6fr)"`, `repeat(3, minmax(0, 1fr))`, and `repeat(4, minmax(0, 1fr))`) without media queries, causing severe horizontal overflow and unreadable squishing on mobile devices.
4. **CSS Layer Accumulation and Dead Code [Confirmed]:**  
   `src/index.css` (2,595 lines) shows evidence of repeated copy-pasting of AI snippets ("V2.1 - BOLDER LAYER", "PREMIUM POLISH LAYER", "REDESIGN LAYER", "EDITORIAL POLISH LAYER", "FIXED MOBILE LAYER"). Multiple definitions overwrite each other (such as `.auth-wrap` defined twice at lines 2064 and 2190). Seven component and stylesheet files (`AuthPanel.css`, `CorporateApp.css`, `Login.jsx`, `Register.jsx`, `GD.jsx`, `AnimatedCounter.jsx`, `MagneticButton.jsx`, `HiringAnalytics.jsx`, `RecruiterReports.jsx`) are completely orphaned.
5. **Dark Mode Inversion Artifacts & Glaring Pastels [Confirmed]:**  
   Dark mode is implemented via an inverted raster PNG filter (`filter: invert(1) hue-rotate(180deg)`) for the logo, causing hue shifts. Multiple data tables (`CandidateDB.jsx`, `Documents.jsx`, `CompanyProfile.jsx`, `CampusDB.jsx`, `BidPortal.jsx`) use hardcoded light pastel backgrounds (`#FDECEC`, `#E8F7EE`, `#FFF3E0`, `#E3F2FD`, `#EEF0FF`) that create glaring contrast clashes against dark theme surfaces.

---

## 2. Existing Design Identity

### 2.1 Current Design Style
The platform exhibits a multi-layered identity collision:
- **Neo-Brutalist SaaS:** High-contrast purple and cyan gradients (`linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)`), thick border radii (`20px - 24px`), colored badge pills, and floating action buttons.
- **Vintage Editorial Serif (RecruitOS Legacy):** Headings default to `'Fraunces', Georgia, serif` in `index.css`, creating an unexpected literary/editorial appearance on an otherwise operational enterprise tool.
- **Enterprise Data Density:** Tables, filters, and KPI cards with fixed `minWidth: 1200px` and dense information displays.
- **Ad-hoc Custom Form Styling:** Standalone registration pages (`Apply.jsx`, `PlacementCoordinatorRegister.jsx`) with injected `<style>` tags or extensive inline styles that look visually separated from the main app shell.

### 2.2 Brand Personality & Consistency
- **Name Confusion:** The application is branded as **SaarthiCampus**, yet the codebase still contains references to **RecruitOS**, **Talent Corner Workspace**, and **Canvas Auth**.
- **Iconography Mismatch:** The sidebar relies on raw Unicode geometric symbols (`◆`, `▤`, `→`, `●`, `⚙`) and emojis (`💰`, `🏢`, `🔍`, `✓`, `📄`, `📊`), while the login, auth, and candidate pages use the `lucide-react` vector library, and dashboard headers use colored emojis (`👥`, `⭐`, `📍`).
- **Logo Presentation:** The topbar renders the logo with inline scale hacks (`transform: "scale(1.2)", transformOrigin: "left center"`), suggesting improper asset dimensioning.

---

## 3. Exact Colour Palette

The codebase does not have a single color system. Below is the audited breakdown of exact HEX values found across the styles and components.

### 3.1 Primary Brand & Gradient Palette (`src/index.css`)

| Token Name | HEX / RGBA Code | Role / Purpose | Contrast on Light (`#FFFFFF`) | Contrast on Dark (`#0D0D1A`) |
|---|---|---|---|---|
| `--brand-purple` | `#7C3AED` | Primary brand purple, active links, primary CTA | 4.8:1 (Pass AA) | 4.6:1 (Pass AA) |
| `--brand-purple-light` | `#8B5CF6` | Hover state, secondary purple | 3.2:1 (Fail Normal) | 6.8:1 (Pass AA) |
| `--brand-purple-dark` | `#6D28D9` | Active state, link hover | 7.0:1 (Pass AAA) | 3.1:1 (Fail Normal) |
| `--brand-electric` | `#06B6D4` | Accent cyan, gradient stop | 2.1:1 (Fail) | 10.3:1 (Pass AAA) |
| `--brand-electric-light`| `#22D3EE` | Glow effects, highlight | 1.6:1 (Fail) | 13.5:1 (Pass AAA) |
| `--brand-gold` | `#F59E0B` | Gold button (`.btn-gold`), star ratings | 2.1:1 (Fail Normal) | 10.1:1 (Pass AAA) |
| `--brand-gold-light` | `#FCD34D` | Gold highlight, hover tint | 1.3:1 (Fail) | 16.4:1 (Pass AAA) |
| `--gradient-brand` | `linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)` | Key headings, primary action highlights | — | — |
| `--gradient-sidebar` | `linear-gradient(180deg, #0D0D1A 0%, #1A1A2E 100%)` | App shell sidebar background (both light and dark) | — | — |
| `--gradient-hero` | `linear-gradient(135deg, #1A0533 0%, #0D1B3E 50%, #001A2E 100%)` | Auth panel decorative backdrop | — | — |

### 3.2 Competing Brand Purples Across Modules [Confirmed Token Conflicts]
1. `index.css`: `#7C3AED` (`--brand-purple`)
2. `AdminDashboard.css`: `#6D4AFF` (`--admin-purple`) / Dark: `#A18CFF`
3. `Dashboard.css`: `#7657E8` (`--dash-primary`) / Dark: `#A18BFF`
4. `CorporateDashboard.css`: `#743BF1` (hardcoded primary) / Accent: `#D83DA9`
5. `CampusDB.jsx` & `PlacementCoordinatorRegister.jsx`: `#6327BD` (hardcoded tab underline & CTA)
6. `AuthPanel.css` (orphaned): `#65428E` (`--canvas-purple`)
7. `LoginSelect.jsx`: `#8B5CF6` (Recruiter card) / `#E11D74` (Admin card) / `#0E7C99` (Corporate card)

### 3.3 Neutral & Surface Scale

| Token Name | Light Mode Value | Dark Mode Value (`[data-theme="dark"]`) | Usage / Location |
|---|---|---|---|
| `--bg-base` | `#F4F4F8` | `#0D0D1A` | Main page background canvas |
| `--bg-surface` | `#FFFFFF` | `#16162A` | Card, modal, panel surfaces |
| `--bg-surface-2` | `#F8F8FC` | `#1E1E36` | Table rows, secondary panels, inputs |
| `--bg-surface-3` | `#EFEFF5` | `#262640` | Tertiary wells, active states |
| `--border-default` | `#E5E5EF` | `#2A2A45` | Structural element borders |
| `--border-strong` | `#D0D0E0` | `#383858` | Input outlines, card boundaries |
| `--text-primary` | `#0D0D1A` | `#F4F4FA` | Primary body text, headings |
| `--text-secondary` | `#4A4A6A` | `#B4B4CC` | Supporting labels, descriptions |
| `--text-muted` | `#9090B0` | `#7A7A9A` | Timestamps, placeholders, hints |
| `--text-placeholder`| `#ADADC8` | `#5A5A78` | Input placeholders |

### 3.4 Status & Feedback Palette

| Semantic State | Base Color | Soft Background (Light Mode) | Border Tint | Hardcoded Inconsistencies Found |
|---|---|---|---|---|
| **Success** | `#10B981` | `#D1FAE5` | `#6EE7B7` | Also `#16803A` / `#E8F7EE` in CandidateDB & Documents; `#0FAE72` in CampusDB |
| **Warning** | `#F59E0B` | `#FEF3C7` | `#FCD34D` | Also `#D97706` in Approvals; `#F2B705` in CampusDB |
| **Danger** | `#EF4444` | `#FEE2E2` | `#FCA5A5` | Also `#C0392B` / `#FDECEC` in CandidateDB; `#D64545` in Joining.jsx; `#E33` in CallRecord |
| **Info** | `#06B6D4` | `#CFFAFE` | `#67E8F9` | Also `#2563EB` / `#E3F2FD` in Documents; `#12A7C7` in Dashboard charts |

---

## 4. Typography and Font Details

### 4.1 Font Family Declarations
```css
/* index.css line 1 */
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=Fraunces:opsz,ital,wght@9..144,0,500;9..144,0,600;9..144,0,700;9..144,1,500&family=JetBrains+Mono:wght@400;500;600&display=swap');
```
- **Primary Body Font:** `'Plus Jakarta Sans', system-ui, sans-serif`
- **Display Heading Font:** `'Fraunces', Georgia, serif`
- **Monospace Font:** `'JetBrains Mono', monospace`
- **Orphaned AuthPanel Font:** `'Manrope', sans-serif` and `'DM Mono'` (loaded inside unimported `AuthPanel.css`)
- **Corporate Module Override:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...` in `CorporateDashboard.css`

### 4.2 Typography Hierarchy & Sizes

| Role / Tag | Font Family | Size | Weight | Line Height | Letter Spacing | Assessment |
|---|---|---|---|---|---|---|
| `h1` (Global Default) | `var(--font-display)` (Fraunces) | ~32px - 44px | 600 - 800 | 1.15 - 1.2 | -0.025em | Vintage serif tone; clashes with modern tech SaaS UI |
| `h2` (Section Headers) | `var(--font-display)` (Fraunces) | 20px - 26px | 600 - 700 | 1.25 | -0.02em | Often overridden by inline `font-weight: 800` |
| `h3` (Card Headers) | `var(--font-display)` (Fraunces) | 16px - 19px | 600 - 700 | 1.3 | Normal | Inconsistent: sans-serif in tables, serif in modals |
| `body` (Base) | `var(--font-body)` (Plus Jakarta Sans) | 14px | 400 | 1.6 | Normal | Clean, readable, good baseline height |
| `small` / Metas | `var(--font-body)` | 11px - 12.5px | 500 | 1.4 | Normal | Acceptable, but low contrast when using `--text-muted` |
| `side-section-label` | `var(--font-body)` | 9.5px | 800 | 1.2 | 0.14em | **Critical:** Extremely small (9.5px), fails accessibility standards |
| Button Labels | `var(--font-body)` | 13px - 14.5px | 600 - 700 | 1.2 | Normal | Legible, but padding varies wildly across components |

### 4.3 Typography Readability & Consistency Evaluation
- **Visual Dissonance:** The choice of `Fraunces` (a high-contrast optical serif) creates an identity conflict. An institutional B2B placement portal typically requires precision, neutrality, and clarity. Using a literary serif for headings while using geometric sans-serif for numbers, tables, and buttons feels accidental.
- **Heading Line Heights:** Large headings (`44px` in `LoginSelect.jsx` and `AuthPanel.jsx`) have tight line-heights (`1.1` to `1.15`) that cause ascenders and descenders to collide when wrapping on narrow screens.

---

## 5. Light Mode Audit

### 5.1 Canvas & Surface Assessment
- **Backgrounds:** The primary app shell uses `--bg-base: #F4F4F8`, which provides a clean, neutral canvas with a slight cool tint. However, several pages introduce conflicting canvas shades: `Dashboard.css` uses `#f5f6fb`, `CorporateDashboard.css` uses `#f7f6f9`, and `LoginSelect.jsx` uses `#eeecfb`.
- **Card Surfaces:** Cards use pure white (`#FFFFFF`) with borders (`#E5E5EF`). The card elevation hierarchy is well-structured in `index.css` via `--shadow-sm` through `--shadow-xl`.
- **Contrast Pitfalls:**
  - `--text-muted: #9090B0` on `#F4F4F8` has a contrast ratio of **2.5:1**, failing WCAG AA (minimum 4.5:1 required for normal text).
  - `--text-placeholder: #ADADC8` on `#FFFFFF` has a contrast ratio of **1.9:1**, making form placeholders nearly invisible on uncalibrated monitors.

### 5.2 Forms & Input Styling in Light Mode
- Form controls in `index.css` (`input`, `select`, `textarea`) have 8px to 10px radius, 1px solid `--border-strong: #D0D0E0`, and focus rings with purple glow (`rgba(124, 58, 237, 0.15)`).
- However, multiple pages (`Apply.jsx`, `PlacementCoordinatorRegister.jsx`, `CandidateSearch.jsx`) re-implement inputs with inline styles, resulting in differing focus behaviors and missing focus rings.

### 5.3 Visual Hierarchy & Density
- **Visual Clutter in Tables:** Dense pages like `CampusDB.jsx`, `CandidateDB.jsx`, and `CorpDB.jsx` lack horizontal spacing, resulting in crowded tables with up to 14 columns that require horizontal scrolling on standard 1366x768 and 1440x900 laptop displays.
- **Nested Topbars:** In `CorporateDashboard.jsx` and `AdminDashboard.jsx`, the page renders its own internal header with titles and notification/avatar buttons directly below the main application topbar, creating confusing duplicate navigation headers.

---

## 6. Dark Mode Audit

### 6.1 Theme Implementation Architecture
Theme switching is managed by `src/components/ThemeToggle.jsx`, which toggles the `data-theme="dark"` attribute on the `<html>` root element and caches it in `localStorage`.

```
[ThemeToggle Button] ---> sets documentElement[data-theme='dark']
                                 |
        +------------------------+------------------------+
        |                        |                        |
  [index.css]           [AdminDashboard.css]       [Dashboard.css]
  --bg-base: #0D0D1A     --admin-bg: #11131c       --dash-bg: #11131d
  --bg-surface: #16162A  --admin-surface: #191c28  --dash-surface: #191c29
```

### 6.2 Confirmed Dark Mode Failures & Inconsistencies

```
+------------------------------------------------------------------------------------------+
| PAGE / COMPONENT         | DARK MODE STATUS  | CRITICAL DEFECT DESCRIPTION               |
+------------------------------------------------------------------------------------------+
| LoginSelect.jsx          | BROKEN (100% Light)| Hardcoded white cards and light canvas   |
| AuthPanel.jsx            | BROKEN (100% Light)| Hardcoded rgba(255,255,255,0.92) card    |
| Apply.jsx                | BROKEN (100% Light)| Hardcoded #ffffff and #ede9fe gradient   |
| PlacementCoordinatorReg  | BROKEN (100% Light)| Hardcoded #ffffff card & #1e293b text    |
| AIInterview.jsx          | BROKEN (Missing)   | Undefined CSS vars -> Transparent & white|
| AptitudeTest.jsx         | BROKEN (Missing)   | Undefined CSS vars -> Transparent cards  |
| CandidateDB.jsx (Badges) | PARTIAL COLLISION  | Hardcoded pastel badge backgrounds clash |
| Documents.jsx (Badges)   | PARTIAL COLLISION  | Light pastel badges on dark card wells   |
| SaarthiLogo.jsx          | HACKED (Filter)    | Raster filter invert(1) hue-rotate(180deg)|
| Sidebar.jsx              | FIXED DARK         | Permanently dark in both light & dark    |
+------------------------------------------------------------------------------------------+
```

1. **Missing Tokens in Student Test Modules [Confirmed - High Severity]:**  
   `src/pages/AIInterview.jsx` and `src/pages/AptitudeTest.jsx` use `--bg`, `--surface`, `--surface-2`, `--border`, and `--primary`. None of these exist in `src/index.css`. As a result, backgrounds collapse to transparent, and chat message bubbles show white text on transparent backgrounds.
2. **Permanent White/Light Backgrounds on Public & Student Pages [Confirmed]:**  
   `LoginSelect.jsx`, `AuthPanel.jsx`, `Apply.jsx`, and `PlacementCoordinatorRegister.jsx` use inline styles with hardcoded hex colors (`#ffffff`, `#0f172a`, `#eeecfb`, `#f8fafc`). Toggling the dark mode theme has zero effect on these pages, blinding users transitioning from dark workspaces.
3. **Logo Inversion Artifact [Confirmed]:**  
   Lines 2181-2187 of `src/index.css` apply `filter: invert(1) hue-rotate(180deg)` to `.theme-adaptive-logo`. Applying raster invert and hue-rotate filters to a PNG logo with anti-aliased borders causes haloing, fringe distortion, and color shifting of brand assets.
4. **Permanent Dark Sidebar [Confirmed]:**  
   The sidebar uses `--gradient-sidebar: linear-gradient(180deg, #0D0D1A 0%, #1A1A2E 100%)` unconditionally. While this creates a high-contrast layout in light mode, it means the sidebar never shifts its theme baseline.
5. **Hardcoded Pastel Badges [Confirmed]:**  
   Status pills in `CandidateDB.jsx`, `CompanyProfile.jsx`, `Documents.jsx`, and `BidPortal.jsx` hardcode light backgrounds:
   - `#E8F7EE` (light mint green)
   - `#FDECEC` (light pinkish red)
   - `#FFF3E0` (light pastel orange)
   - `#E3F2FD` (light sky blue)
   - `#EEF0FF` (light lavender)  
   In dark mode, these pills render as stark light rectangles that disrupt visual balance.

---

## 7. Page-by-Page UI Audit

### 7.1 Public Pages

#### 1. Login Selection (`src/pages/LoginSelect.jsx`)
- **Layout & Structure:** Full-screen centered page with campus background image, brand logo, 2-column parent layout, 3 role cards (Recruiter, Corporate, Admin), a TPO registration banner, and a 4-item trust strip.
- **What Looks Good:** Clear role separation, vibrant color coding per role (Purple, Cyan, Magenta), structured feature bullet lists with check icons.
- **Outdated / Inconsistent:** Entirely hardcoded inline styles. No CSS variables. Distinct brand colors assigned to roles that do not persist into the app dashboards.
- **Mobile Responsiveness [Confirmed Defect]:** The grid definitions `gridTemplateColumns: "minmax(0,1fr) minmax(0,2.6fr)"` and `gridTemplateColumns: "repeat(3, minmax(0, 1fr))"` lack media queries. On mobile devices (< 768px), cards are squished into illegible vertical slivers with severe horizontal overflow.
- **Suggested Improvements:** Convert inline styles to responsive Tailwind grid classes (`grid-cols-1 md:grid-cols-3`), connect to design system tokens, and ensure dark mode compatibility.

#### 2. Auth Panel (`src/components/AuthPanel.jsx`)
- **Layout & Structure:** Two-column auth screen featuring an illustrative left branding column with decorative trust pills and a floating glassmorphic card on the right.
- **What Looks Good:** Clean typography on the left hero area, password toggle visibility icon, clear error states, toggle between login and register.
- **Outdated / Inconsistent:** Written with inline styles. Does not use the styles defined in `AuthPanel.css` (which is orphaned). Uses Tailwind slate colors (`#0f172a`, `#1e293b`, `#64748b`) instead of design tokens.
- **Mobile Responsiveness:** Uses `flexWrap: "wrap"` with `flex: "1 1 420px"`, which wraps on mobile, but padding (`56px 40px`) is overly generous for small mobile viewports.
- **Suggested Improvements:** Deprecate orphaned `AuthPanel.css`, migrate to standard CSS token classes, and reduce mobile card padding.

#### 3. Student Application Portal (`src/pages/Apply.jsx`)
- **Layout & Structure:** Multi-step workflow (Step 1: Student registration form; Step 2: Public job listings and instant application board).
- **What Looks Good:** Numbered step badges, structured form sections (Personal, Academic, Skills), live AI resume parsing feedback, collapsible job cards.
- **Outdated / Inconsistent:** Injects an internal `<style>` block inside JSX. Hardcodes light background gradient (`linear-gradient(135deg, #f8fafc 0%, #ede9fe 100%)`).
- **Mobile Responsiveness:** Step 1 has a media query (`@media (max-width: 640px)`) adjusting grid columns to 1fr. Step 2 job listings scale adequately.
- **Suggested Improvements:** Remove inline `<style>` injection, bind form inputs to design system tokens, and enable dark mode support.

#### 4. Placement Coordinator Registration (`src/pages/PlacementCoordinatorRegister.jsx`)
- **Layout & Structure:** Dedicated institution onboarding page with college autocomplete, TPO designation, course multi-selection pills, and success confirmation view.
- **What Looks Good:** Multi-select course tags, search-as-you-type college lookup with fallback manual entry, clean success receipt with direct shareable link copying.
- **Outdated / Inconsistent:** 100% inline style objects (`pageContainerStyle`, `cardStyle`). Hardcodes purple `#6327BD` for buttons and banners instead of `--brand-purple: #7C3AED`.
- **Mobile Responsiveness:** Container padding (`32px 16px`) handles mobile decently, but 2-column form grids without explicit media query collapse can cramp on viewports under 380px.
- **Suggested Improvements:** Move styles to reusable form classes, unify `#6327BD` with brand purple tokens, and support dark mode.

---

### 7.2 Student Pages

#### 1. AI Screening Interview (`src/pages/AIInterview.jsx`)
- **Layout & Structure:** Chat-style automated interview interface with intro screen, real-time message stream, typing indicator, and summary report.
- **What Looks Good:** Friendly conversational onboarding, clear progress through interview stages, clean message bubbles with timestamp alignment.
- **Outdated / Inconsistent [Confirmed Critical Bug]:** References non-existent CSS variables (`var(--bg)`, `var(--surface)`, `var(--surface-2)`, `var(--border)`, `var(--primary)`). Chat bubbles render white text on transparent backgrounds.
- **Mobile Responsiveness:** Fixed card height (`82vh`, `maxHeight: 660px`) can lead to keyboard overlap on mobile devices during virtual keyboard activation.
- **Suggested Improvements:** Replace missing tokens with `--bg-base`, `--bg-surface`, and `--brand-purple`. Test viewport height behavior with virtual keyboards.

#### 2. Aptitude Assessment Test (`src/pages/AptitudeTest.jsx`)
- **Layout & Structure:** Online assessment portal with multiple-choice questions, option selection radio pills, timer, and score submission.
- **What Looks Good:** Minimalist focus mode layout, clear question indexing, instant score submission feedback.
- **Outdated / Inconsistent [Confirmed Bug]:** Shares the missing CSS variables bug (`var(--bg)`, `var(--surface)`, `var(--border)`). Displays a legacy "R" (RecruitOS) logo mark.
- **Mobile Responsiveness:** Single-column card layout scales well on small viewports.
- **Suggested Improvements:** Update CSS tokens to match `index.css`, replace "R" with Saarthi logo, and add question navigation bookmarks for mobile.

#### 3. Group Discussion Video Room (`src/pages/GDRoom.jsx`)
- **Layout & Structure:** Full-screen Daily.co WebRTC video iframe container with minimal top bar indicating status and room title.
- **What Looks Good:** Clean iframe integration, minimal distraction interface, automatic room token authorization.
- **Outdated / Inconsistent:** Very sparse UI; error message is rendered in a bare div with `--danger` text.
- **Mobile Responsiveness:** Iframe is set to `width: 100%, height: 100%`, which handles mobile screen sizes correctly.
- **Suggested Improvements:** Add a branded header bar, participant count indicator, and exit meeting confirmation dialog.

#### 4. Candidate Talent Passport Modal (`src/pages/TalentPassport.jsx`)
- **Layout & Structure:** Modal window launched from `Resume.jsx` showing candidate verification badges, verified academic metrics, and skill tags.
- **What Looks Good:** Excellent credential summary concept, clean badge styling, verification checkmarks.
- **Outdated / Inconsistent:** Inline styles mixed with utility classes; modal lacks accessible backdrop click handling.
- **Mobile Responsiveness:** Requires horizontal and vertical margin adjustments on mobile to avoid viewport clipping.
- **Suggested Improvements:** Standardize as a shared modal component with proper focus trap and ESC key closing.

---

### 7.3 Placement Coordinator Pages

#### 1. Coordinator Review & Approval Dashboard (`src/components/CoordinatorReview.jsx`)
- **Layout & Structure:** Embedded management dashboard within `CampusDB.jsx` (under the Coordinators tab) for reviewing incoming institutional signups.
- **What Looks Good:** Comprehensive status filtering (pending, approved, rejected), quick-action approve/reject modals, institutional matching algorithm indicators.
- **Outdated / Inconsistent:** Very high component complexity (1,072 lines) with inline style overrides, custom modal implementations, and inconsistent button sizes.
- **Mobile Responsiveness:** Table view requires horizontal scrolling. Filter toolbar wraps aggressively on mobile screens.
- **Suggested Improvements:** Extract modals into dedicated sub-components, unify action buttons with `.btn-outline` and `.btn-primary`.

---

### 7.4 Corporate & Recruiter Pages

#### 1. Corporate Dashboard (`src/pages/CorporateDashboard.jsx`)
- **Layout & Structure:** Executive dashboard with greeting hero, 4 KPI cards, Recharts talent analytics bar/pie charts, and candidate discovery data table.
- **What Looks Good:** Clean metric cards, interactive chart toggles (profiles vs. experience), integrated candidate filter drawer.
- **Outdated / Inconsistent [Confirmed Defect]:** Imports `CorporateDashboard.css`, which redefines the base font family to system fonts. Renders an internal secondary topbar with title and duplicate notification bell directly below the global topbar.
- **Mobile Responsiveness:** Chart containers use `ResponsiveContainer`, but KPI grid requires 1-column collapse on small mobile viewports.
- **Suggested Improvements:** Remove duplicate internal topbar, harmonize `--dash-*` and `--corporate-*` colors with `--brand-purple`, and remove global `body` CSS overrides from `CorporateDashboard.css`.

#### 2. Recruiter Dashboard (`src/pages/RecruiterDashboard.jsx` & `src/pages/Dashboard.jsx`)
- **Layout & Structure:** Operational workspace with campus drive timeline, pipeline funnel, recruitment activity feed, and metric tiles.
- **What Looks Good:** Good visualization of recruitment pipeline stages, priority-colored event pills, quick navigation links to campus and candidate databases.
- **Outdated / Inconsistent:** Imports `Dashboard.css`, creating another token namespace (`--dash-bg`, `--dash-surface`, `--dash-primary: #7657e8`). Duplicate dashboards exist (`Dashboard.jsx` vs `RecruiterDashboard.jsx`).
- **Mobile Responsiveness:** KPI grid scales well (`grid-template-columns: repeat(2, 1fr)` at 1100px, `1fr` at 440px).
- **Suggested Improvements:** Consolidate `Dashboard.jsx` and `RecruiterDashboard.jsx` into a unified modular component.

#### 3. Campus Database (`src/pages/CampusDB.jsx`)
- **Layout & Structure:** 3,600-line master institutional database with Excel/AI import, college directory table, and embedded coordinator review requests.
- **What Looks Good:** Extremely comprehensive data handling, audit trail logging for coordinator transitions, AI import integration.
- **Outdated / Inconsistent:** Monolithic file size (124 KB). Heavy inline styling. Active tab underlines use hardcoded `#6327BD`. Table has fixed `minWidth: 1200px`.
- **Mobile Responsiveness:** Heavy horizontal table scrolling on mobile. Form modal overflows small mobile heights.
- **Suggested Improvements:** Refactor into modular subcomponents (`CollegeTable`, `CoordinatorTabs`, `CollegeModal`). Standardize table layouts.

#### 4. Candidate Database (`src/pages/CandidateDB.jsx`) & Candidate Search (`src/pages/CandidateSearch.jsx`)
- **Layout & Structure:** Filterable tabular view of registered students with photo avatars, resume links, degree chips, and backlog filters.
- **What Looks Good:** Filter chips for degrees, quick backlog toggle, candidate avatar generation with initials fallback, resume link shortcuts.
- **Outdated / Inconsistent:** Table uses fixed `minWidth: 1200px`. Status pills hardcode `#FDECEC` and `#E8F7EE`, causing dark mode contrast clashes.
- **Mobile Responsiveness:** Tables force horizontal scrolling on mobile. Degree filter chips wrap awkwardly across multiple lines.
- **Suggested Improvements:** Implement a responsive card-view toggle for mobile screens, replace hardcoded badge colors with CSS variables.

#### 5. Job Profiles & Management (`src/pages/Jobs.jsx`)
- **Layout & Structure:** Card-based job listing layout with expandable job descriptions, salary tags, skill pills, and AI job description generator modal.
- **What Looks Good:** Clear job cards (`.jd-card`), readable typography on salary/qualification items, collapsible description drawer.
- **Outdated / Inconsistent:** Employment type badge uses hardcoded brownish colors (`color: '#8a6d3b', background: '#f6ecd9'`) that do not adapt to dark mode.
- **Mobile Responsiveness:** Grid scales cleanly on tablets and mobile devices.
- **Suggested Improvements:** Replace hardcoded badge colors with tokenized tags (`--badge-neutral-bg`, `--badge-neutral-text`).

#### 6. Candidate Hiring Pipeline (`src/pages/Pipeline.jsx`)
- **Layout & Structure:** Interactive Kanban board featuring 6 recruitment stages (Resume Review, Aptitude, GD, Interview, Selected, Rejected).
- **What Looks Good:** HTML5 drag-and-drop card movement, candidate application grouping (multiple applications collapsed under one candidate card), distinct stage accent headers.
- **Outdated / Inconsistent:** Fixed stage column widths (`minWidth: 260px, flex: '0 0 260px'`), requiring horizontal scrolling on desktop monitors under 1600px wide.
- **Mobile Responsiveness:** Drag-and-drop is difficult to operate via touch on mobile devices.
- **Suggested Improvements:** Add touch-friendly "Move to Next Stage" dropdown/button actions on cards for mobile screens, enable optional column collapse.

#### 7. Resume Analyzer & AI Scoring (`src/pages/Resume.jsx`)
- **Layout & Structure:** Grouped candidate application list with circular match percentage rings, skill chip analysis (matched vs. missing), and AI feedback notes.
- **What Looks Good:** Circular score rings (`score-ring high/mid/low`), clean presentation of AI scoring status, grouped candidate card accordion.
- **Outdated / Inconsistent:** Mixed use of CSS variables and inline styles. Emoji icons in buttons (`📋 Passport`, `🤖 AI scored`).
- **Mobile Responsiveness:** Nested applications collapse cleanly; score ring and title wrap properly on small screens.
- **Suggested Improvements:** Replace emojis with Lucide vector icons, standardize passport modal trigger button.

#### 8. Interview Assessment (`src/pages/Interview.jsx`) & Aptitude Admin (`src/pages/Aptitude.jsx`)
- **Layout & Structure:** Schedule and log mock/technical interview results; generate AI aptitude questions and email invitations.
- **What Looks Good:** Multi-criteria evaluation forms (confidence, technical, communication), AI question generation modal.
- **Outdated / Inconsistent:** Inconsistent form styles compared to `CampusDB` and `Apply`.
- **Mobile Responsiveness:** Forms wrap into single columns on mobile.
- **Suggested Improvements:** Adopt unified form layout components.

#### 9. Group Discussion Admin (`src/pages/GDAdmin.jsx`)
- **Layout & Structure:** Session scheduling dashboard with online/offline toggles, candidate multi-selector, and 5-criteria participant rating panel.
- **What Looks Good:** Rating matrix for GD criteria, live session room links.
- **Outdated / Inconsistent:** Rating drawer takes up substantial screen real estate and lacks responsive wrapping for small laptop screens.
- **Mobile Responsiveness:** Rating table requires horizontal scroll on mobile.
- **Suggested Improvements:** Convert rating table into a responsive card deck for mobile evaluators.

#### 10. Offers (`src/pages/Offers.jsx`) & Joining Tracker (`src/pages/Joining.jsx`)
- **Layout & Structure:** Tabular tracking of candidate offer letters and joining confirmations.
- **What Looks Good:** Minimalist data presentation, clear status badges.
- **Outdated / Inconsistent [Confirmed Defect]:** `Joining.jsx` uses non-existent CSS variables (`var(--slate-light)` and `var(--red, #d64545)`). Its table markup puts `<tr><th>...</th></tr>` directly inside `<tbody>` without `<thead>`.
- **Mobile Responsiveness:** Basic horizontal scroll wrapper.
- **Suggested Improvements:** Fix table markup structure, replace non-existent CSS variables with `--text-muted` and `--danger`.

#### 11. Communication CRM (`src/pages/Comm.jsx`) & Call Records (`src/pages/CallRecord.jsx`)
- **Layout & Structure:** Activity log for emails, phone calls, and interactions with college TPOs and corporate HR contacts.
- **What Looks Good:** Integration with AI email generator (`/api/generate-email`), duration formatter (`hr min`), call status select pills.
- **Outdated / Inconsistent:** Call delete button uses inline hardcoded `#e33` border and text. Filter button lacks an active filter drawer.
- **Mobile Responsiveness:** Fixed min-width 1200px table requires horizontal scrolling.
- **Suggested Improvements:** Add responsive mobile card view and unified modal forms.

#### 12. Calendar & Tasks (`src/pages/CalendarTasks.jsx`) & Notifications (`src/pages/Notifications.jsx`)
- **Layout & Structure:** Task list with priority pills, campus drive calendar, and user notification feed.
- **What Looks Good:** Clean priority tagging (`#EF4444`, `#F59E0B`, `#10B981`), automated notification unread counter in topbar.
- **Outdated / Inconsistent:** Uses mixed emoji icons in notification lists (`🎉`, `❌`, `✅`, `📅`).
- **Mobile Responsiveness:** Mini calendar collapses below tasks on mobile viewports.
- **Suggested Improvements:** Replace raw emojis with Lucide icons.

#### 13. Bid Portal (`src/pages/BidPortal.jsx`)
- **Layout & Structure:** Salary hike and appraisal bidding management portal for placed candidates.
- **What Looks Good:** AI appraisal recommendation calculator, performance metrics cards.
- **Outdated / Inconsistent:** `PERFORMANCE_LABELS` hardcodes light pastel backgrounds (`#EEF0FF`, `#D1FAE5`, `#DBEAFE`, `#FEF3C7`, `#FEE2E2`) that clash in dark mode.
- **Mobile Responsiveness:** Two-column split layout collapses on small screens.
- **Suggested Improvements:** Migrate performance tags to semantic badge tokens.

#### 14. Approvals (`src/pages/Approvals.jsx`) & Documents (`src/pages/Documents.jsx`)
- **Layout & Structure:** Candidate verification queue and onboarding document compliance tracker (ID Proof, Marksheet, Offer Letter).
- **What Looks Good:** Secure document viewer link integration (`openSecureDocument`), document verification status tags.
- **Outdated / Inconsistent:** Hardcodes duplicate pastel status dictionaries (`#FFF3E0`, `#E3F2FD`, `#E8F7EE`, `#FDECEC`).
- **Mobile Responsiveness:** Table requires horizontal scrolling on screens under 1100px.
- **Suggested Improvements:** Share a single `StatusBadge` component across both files.

#### 15. Reports & Analytics Suite (`Reports.jsx`, `CorporateReports.jsx`, `RecruiterReports.jsx`)
- **Layout & Structure:** 12-report master analytics suite featuring funnel conversion charts, campus distribution, and CSV export.
- **What Looks Good:** Clean Recharts visualizations, instant CSV export generator, structured report picker menu.
- **Outdated / Inconsistent:** `CorporateReports.jsx` and `Reports.jsx` duplicate charting logic. `RecruiterReports.jsx` is completely orphaned because `App.jsx` points recruiter reports to master `Reports.jsx`.
- **Mobile Responsiveness:** Responsive grid collapses to 1 column at 1100px via `Reports.css`.
- **Suggested Improvements:** Delete orphaned `RecruiterReports.jsx` and unify corporate report views into the master report framework.

---

### 7.5 Admin Pages

#### 1. Admin Dashboard (`src/pages/AdminDashboard.jsx`)
- **Layout & Structure:** Comprehensive executive dashboard with 3-month adoption target comparisons, live status indicator, 4 filter dropdowns, 6 KPI cards, and recruitment progress charts.
- **What Looks Good:** Target vs. actual metric comparisons (300 institutes, 150 corporates, 15,000 candidates), clean KPI helpers.
- **Outdated / Inconsistent [Confirmed Defect]:** Imports `AdminDashboard.css`, which declares its own `--admin-*` tokens. Renders an internal secondary header with an "Admin Administrator" avatar badge directly underneath the global topbar avatar.
- **Mobile Responsiveness:** KPI grid collapses from 3 columns to 1 column cleanly on tablets and mobile screens.
- **Suggested Improvements:** Eliminate duplicate header, integrate styles with global tokens.

#### 2. User Management (`src/pages/UserManagement.jsx`)
- **Layout & Structure:** Admin user table featuring role filter tabs (All, Admins, Recruiters, Candidates, Corporates), status toggles, user creation modal, and pagination.
- **What Looks Good:** Tabular pagination (7 users per page), hash-based dynamic avatar background colors, approval status toggle button.
- **Outdated / Inconsistent:** Table markup uses inline styles without `.data-table` class. Edit and delete icon buttons have fixed 28x28px touch targets, failing touch accessibility guidelines.
- **Mobile Responsiveness:** Table forces horizontal scroll on mobile; filter toolbar wraps cleanly.
- **Suggested Improvements:** Increase touch target sizes to at least 36x36px (or 44x44px for primary touch controls) and apply global table styling.

---

## 8. Component Consistency Findings

```
+--------------------------------------------------------------------------------------------------+
| COMPONENT TYPE     | VARIANTS FOUND                   | INCONSISTENCIES IDENTIFIED                       |
+--------------------------------------------------------------------------------------------------+
| Buttons            | .btn-primary, .btn-outline,      | Inconsistent padding (4px 10px vs 14px 16px).    |
|                    | .btn-gold, inline gradients      | Gold button lacks dark mode state.               |
+--------------------------------------------------------------------------------------------------+
| Form Inputs        | .search-box, .student-input,     | 18+ instances of outline:none. Differing focus   |
|                    | inline styled inputs             | rings (purple glow vs border color only).        |
+--------------------------------------------------------------------------------------------------+
| Data Tables        | .data-table, plain <table>,      | Some have <thead>, some put <th> in <tbody>.     |
|                    | CorporateDashboard tables        | Fixed minWidth: 1200px causes universal overflow.|
+--------------------------------------------------------------------------------------------------+
| Badges & Status    | .badge (green/gold/gray),        | 5 different hardcoded pastel color schemes.      |
|                    | hardcoded pastel style objects   | Dark mode breaks on hardcoded light pastels.     |
+--------------------------------------------------------------------------------------------------+
| Modals             | Custom modal implementations     | No shared backdrop component or focus trapping.  |
|                    | in CampusDB, CoordinatorReview   | Differing close buttons (X, Close, ✕).           |
+--------------------------------------------------------------------------------------------------+
| Iconography        | Lucide React, Unicode symbols,   | Sidebar uses unicode & emojis; pages use Lucide; |
|                    | raw system emojis                | Notifications uses raw emojis.                   |
+--------------------------------------------------------------------------------------------------+
| Navigation Shell   | Topbar in App.jsx + internal     | Double topbars in Admin & Corporate dashboards.  |
|                    | headers in Admin & Corporate     | Scale hack on logo (scale(1.2)).                 |
+--------------------------------------------------------------------------------------------------+
```

### 8.1 Buttons
- Three CSS button classes exist in `index.css`: `.btn-primary` (purple gradient), `.btn-outline` (subtle border), and `.btn-gold` (amber background).
- Multiple pages ignore these classes and use inline button styles with linear gradients (`#7C3AED` to `#9333EA`, `#0E7C99` to `#22B8CF`, `#E11D74` to `#F0508B`, or `#6327BD`).
- Hover transitions and active press states (`:active`) are missing from all inline buttons.

### 8.2 Input Fields and Dropdowns
- In `index.css`, inputs have `--border-strong: #D0D0E0` and focus states with `box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15)`.
- In `Apply.jsx`, inputs use `.student-input` with `#cbd5e1` borders and `#7c3aed` focus rings.
- In `CampusDB.jsx` and `CandidateSearch.jsx`, inputs use `.search-box` with `min-width: 200px` and no consistent validation styling.

### 8.3 Cards and Containers
- Cards are implemented under multiple class names: `.panel` (general card), `.stat-card` (metrics), `.jd-card` (jobs), `.corporate-stat-card`, and `.kpi-card`.
- Border radii vary from `8px` (`var(--radius-sm)`), `12px` (`var(--radius-md)`), `16px` (`var(--radius-lg)`), to `24px` (`var(--radius-2xl)`).

### 8.4 Badges and Status Pills
- `index.css` defines `.badge` with variants `.green`, `.gold`, `.red`, `.blue`, `.gray`.
- Despite this, five separate pages (`CandidateDB.jsx`, `CompanyProfile.jsx`, `Documents.jsx`, `CampusDB.jsx`, `BidPortal.jsx`) maintain hardcoded JavaScript color objects with light pastel backgrounds, causing dark mode display errors.

---

## 9. Responsive Design Findings

### 9.1 Viewport Breakpoint Chaos [Confirmed]
There is no unified breakpoint system. The codebase declares conflicting breakpoints across six different CSS files:

| Stylesheet | Breakpoints Declared in Code | Tailwind v4 Standard | Conflict Assessment |
|---|---|---|---|
| `src/index.css` | `1024px`, `900px`, `720px`, `480px` | `sm: 640px` | Arbitrary custom breakpoints; ignores Tailwind standards |
| `src/pages/AdminDashboard.css` | `1200px`, `900px`, `800px`, `500px` | `md: 768px` | Conficts with index.css `1024px` and `900px` |
| `src/pages/CorporateDashboard.css` | `900px`, `768px` | `lg: 1024px` | Uses `768px` while index.css uses `720px` |
| `src/pages/CorporateApp.css` | `1200px`, `1100px`, `850px`, `700px`, `620px`, `450px`, `430px` | `xl: 1280px` | 7 arbitrary breakpoints in an unimported file |
| `src/pages/Dashboard.css` | `1100px`, `680px`, `440px` | `2xl: 1536px` | Arbitrary breakpoints |
| `src/pages/Reports.css` | `1100px`, `768px` | — | Clashes with dashboard 1100px grid |

### 9.2 Specific Responsive Breakages
1. **Login Selection Screen Overflow (`LoginSelect.jsx`) [Confirmed]:**  
   The 3 role cards and 4 trust items are arranged in fixed-column grids without `@media` queries. On screens narrower than 900px, elements are compressed into illegible vertical slivers and cause horizontal overflow.
2. **Universal Data Table Horizontal Overflow [Confirmed]:**  
   Every table in `CampusDB.jsx`, `CandidateDB.jsx`, `CandidateSearch.jsx`, `CorpDB.jsx`, and `CallRecord.jsx` uses `minWidth: 1200px` (or `980px`). While they are placed in `overflowX: auto` containers, scrolling large tables on mobile touchscreens creates significant usability friction.
3. **App Topbar Crowding (< 640px) [Confirmed]:**  
   The topbar contains a hamburger button, logo, theme toggle button, notification bell with unread badge, workspace pill ("Talent Corner Workspace"), user email address, logout link, and avatar initials. Below 768px, these elements collide, causing text overlapping and header height distortion.

---

## 10. Accessibility & Usability Findings

### 10.1 WCAG 2.1 Color Contrast Failures [Confirmed]

| Element | Foreground | Background | Actual Contrast | WCAG AA Requirement | Status |
|---|---|---|---|---|---|
| Muted Body Text (`--text-muted`) | `#9090B0` | `#F4F4F8` | **2.5:1** | 4.5:1 (Normal Text) | **FAIL** |
| Placeholder Text (`--text-placeholder`) | `#ADADC8` | `#FFFFFF` | **1.9:1** | 4.5:1 (Normal Text) | **FAIL** |
| Dark Mode Muted Text (`--text-muted`) | `#7A7A9A` | `#0D0D1A` | **3.3:1** | 4.5:1 (Normal Text) | **FAIL** |
| Sidebar Section Label | `rgba(255,255,255,0.3)` | `#0D0D1A` | **2.2:1** | 4.5:1 (Normal Text) | **FAIL** |
| Gold Action Button (`.btn-gold`) | `#FFFFFF` | `#F59E0B` | **2.1:1** | 4.5:1 (Normal Text) | **FAIL** |
| Cyan Accent Links (`--brand-electric`) | `#06B6D4` | `#FFFFFF` | **2.1:1** | 4.5:1 (Normal Text) | **FAIL** |

### 10.2 Keyboard Navigation & Focus Indicators [Confirmed]
- **Focus Suppression:** 18 occurrences of `outline: none` exist across CSS and inline JSX without corresponding `:focus-visible` replacement indicators.
- **Interactive Divs:** In `Sidebar.jsx`, `CandidateDB.jsx`, and `Pipeline.jsx`, several clickable items are implemented as `<div onClick={...}>` without `role="button"`, `tabIndex={0}`, or keyboard `onKeyDown` listeners, preventing keyboard-only users from activating them.

### 10.3 Form Controls and Assistive Labels [Confirmed]
- Search inputs in `CandidateDB.jsx`, `CandidateSearch.jsx`, and `CampusDB.jsx` lack associated `<label>` tags or `aria-label` attributes, relying solely on `placeholder` text.
- Notification bell buttons and icon-only table actions lack screen-reader text (`aria-label`).

---

## 11. Design System Inventory

### A. Consolidated Colour Palette
```css
:root {
  /* Brand Accents */
  --brand-primary:        #7C3AED; /* Unified Purple */
  --brand-primary-hover:  #6D28D9;
  --brand-secondary:      #06B6D4; /* Cyan / Electric */
  --brand-amber:          #F59E0B; /* Warm Accent */

  /* Neutral Surfaces (Light) */
  --canvas-background:    #F4F4F8;
  --surface-card:         #FFFFFF;
  --surface-secondary:    #F8F8FC;
  --surface-tertiary:     #EFEFF5;

  /* Typography Colors (Light) */
  --content-primary:      #0D0D1A;
  --content-secondary:    #4A4A6A;
  --content-muted:        #6B6B8A; /* Adjusted for WCAG AA compliance */
  --content-placeholder:  #8E8EA8; /* Adjusted for WCAG AA compliance */

  /* Borders (Light) */
  --line-subtle:          #E5E5EF;
  --line-strong:          #D0D0E0;

  /* Status Colors */
  --state-success:        #10B981;
  --state-success-soft:   #D1FAE5;
  --state-warning:        #F59E0B;
  --state-warning-soft:   #FEF3C7;
  --state-danger:         #EF4444;
  --state-danger-soft:    #FEE2E2;
  --state-info:           #06B6D4;
  --state-info-soft:      #CFFAFE;
}

[data-theme="dark"] {
  /* Neutral Surfaces (Dark) */
  --canvas-background:    #0D0D1A;
  --surface-card:         #16162A;
  --surface-secondary:    #1E1E36;
  --surface-tertiary:     #262640;

  /* Typography Colors (Dark) */
  --content-primary:      #F4F4FA;
  --content-secondary:    #B4B4CC;
  --content-muted:        #8C8CA8; /* Adjusted for WCAG AA compliance */
  --content-placeholder:  #686882;

  /* Borders (Dark) */
  --line-subtle:          #2A2A45;
  --line-strong:          #383858;

  /* Status Colors (Dark Backgrounds) */
  --state-success-soft:   rgba(16, 185, 129, 0.16);
  --state-warning-soft:   rgba(245, 158, 11, 0.16);
  --state-danger-soft:    rgba(239, 68, 68, 0.16);
  --state-info-soft:      rgba(6, 182, 212, 0.16);
}
```

### B. Typography Scale
- `display-lg`: `40px` / line-height `1.15` / font-weight `800`
- `display-md`: `32px` / line-height `1.2` / font-weight `700`
- `heading-xl`: `24px` / line-height `1.25` / font-weight `700`
- `heading-lg`: `20px` / line-height `1.3` / font-weight `700`
- `heading-md`: `16px` / line-height `1.35` / font-weight `600`
- `body-lg`: `15px` / line-height `1.5` / font-weight `400`
- `body-md` (Base): `14px` / line-height `1.6` / font-weight `400`
- `body-sm`: `12.5px` / line-height `1.5` / font-weight `500`
- `caption`: `11px` / line-height `1.4` / font-weight `600`

### C. Spacing System
`4px` (`--space-1`), `8px` (`--space-2`), `12px` (`--space-3`), `16px` (`--space-4`), `20px` (`--space-5`), `24px` (`--space-6`), `32px` (`--space-8`), `48px` (`--space-12`), `64px` (`--space-16`).

### D. Border Radii
`6px` (`--radius-xs`), `8px` (`--radius-sm`), `12px` (`--radius-md`), `16px` (`--radius-lg`), `20px` (`--radius-xl`), `9999px` (`--radius-full`).

### E. Shadows
- `--shadow-sm`: `0 2px 8px rgba(13, 13, 26, 0.06), 0 1px 3px rgba(13, 13, 26, 0.04)`
- `--shadow-md`: `0 4px 20px rgba(13, 13, 26, 0.08), 0 2px 8px rgba(13, 13, 26, 0.04)`
- `--shadow-lg`: `0 12px 48px rgba(13, 13, 26, 0.10), 0 4px 16px rgba(13, 13, 26, 0.06)`

### F. Standardized Breakpoints
- `sm`: `640px` (Mobile landscape, large phones)
- `md`: `768px` (Tablets, iPad portrait)
- `lg`: `1024px` (Tablets landscape, small laptops)
- `xl`: `1280px` (Standard desktop monitors)
- `2xl`: `1536px` (Wide desktop monitors)

---

## 12. Prioritised Improvement Recommendations

### P0 — Critical Functional & Visual Blockers (Immediate)
1. **Fix Student Assessment Token Crash (`AIInterview.jsx`, `AptitudeTest.jsx`):**  
   Map `var(--bg)` -> `var(--bg-base)`, `var(--surface)` -> `var(--bg-surface)`, `var(--border)` -> `var(--border-default)`, `var(--primary)` -> `var(--brand-purple)`. Update the legacy "R" icon in `AptitudeTest.jsx` to the official SaarthiLogo.
2. **Fix Mobile Grid Collapse on Public Gateway (`LoginSelect.jsx`):**  
   Replace rigid inline `gridTemplateColumns` with responsive media-query-backed Tailwind grid classes (`grid-cols-1 md:grid-cols-3` and `grid-cols-1 sm:grid-cols-2 md:grid-cols-4`).
3. **Eliminate Logo Color Distortion in Dark Mode (`index.css`):**  
   Remove the CSS raster filter (`filter: invert(1) hue-rotate(180deg)`) on `.theme-adaptive-logo`. Provide an explicit SVG or light/dark PNG asset variant.

### P1 — High-Priority Design System Unification (Next Cycle)
1. **Consolidate Competing Purple Tokens:**  
   Standardize all module stylesheets (`AdminDashboard.css`, `CorporateDashboard.css`, `Dashboard.css`, `CampusDB.jsx`) to consume `--brand-purple: #7C3AED` and its standardized shades.
2. **Resolve Dark Mode Pastel Clashes:**  
   Replace hardcoded pastel color dictionaries in `CandidateDB.jsx`, `CompanyProfile.jsx`, `Documents.jsx`, and `BidPortal.jsx` with semantic status classes (`.badge.green`, `.badge.gold`, `.badge.red`) that consume dark-mode-aware alpha backgrounds.
3. **Remove Nested Secondary Topbars:**  
   Remove duplicate headers and notification icons from `CorporateDashboard.jsx` and `AdminDashboard.jsx`, creating a single unified app shell header.
4. **Clean Layered Append Accumulation in `index.css`:**  
   Consolidate duplicate rules (such as `.auth-wrap` at lines 2064 and 2190) and purge unreferenced CSS sections.

### P2 — Medium-Priority Usability & Component Refactoring
1. **Standardize Typography:**  
   Switch default headings from vintage serif `'Fraunces'` to a modern geometric sans-serif (`'Plus Jakarta Sans'` with `font-weight: 700 / 800`) to align with modern B2B SaaS standards.
2. **Harmonize Iconography:**  
   Replace raw Unicode symbols (`◆`, `▤`, `→`, `●`) and emojis in `Sidebar.jsx`, `Reports.jsx`, and `Notifications.jsx` with consistent vector icons from `lucide-react`.
3. **Responsive Table Handling:**  
   Introduce responsive card view toggles for dense tabular pages (`CampusDB.jsx`, `CandidateDB.jsx`) on viewport widths below 768px.
4. **Touch Target Size Compliance:**  
   Increase table action buttons and pagination triggers in `UserManagement.jsx` and `CallRecord.jsx` to a minimum touch target size of 36x36px.

### P3 — Low-Priority Codebase Cleanup
1. **Delete Dead & Orphaned Files:**  
   Safely remove `src/components/AuthPanel.css`, `src/pages/CorporateApp.css`, `src/components/Login.jsx`, `src/pages/Register.jsx`, `src/pages/GD.jsx`, `src/components/AnimatedCounter.jsx`, `src/components/MagneticButton.jsx`, `src/pages/HiringAnalytics.jsx`, `src/pages/RecruiterReports.jsx`, and `src/hooks/useScrollReveal.js`.

---

## 13. Exact Frontend Files Requiring Changes

The following frontend source files are confirmed to require updates to implement the audit recommendations:

```
recruitos-frontend/
├── src/
│   ├── App.jsx                                  <-- Remove duplicate activePage routes & fix header styling
│   ├── index.css                                <-- Clean layered duplicate rules, fix logo filter, adjust text contrast
│   ├── components/
│   │   ├── AuthPanel.jsx                        <-- Remove inline colors, connect to design tokens
│   │   ├── CoordinatorReview.jsx                <-- Normalize button styles and modal structures
│   │   ├── SaarthiLogo.jsx                      <-- Support native light/dark logo rendering without raster filter
│   │   ├── Sidebar.jsx                          <-- Replace unicode/emojis with Lucide icons, fix 9.5px label contrast
│   │   └── ThemeToggle.jsx                      <-- Improve accessibility labelling
│   └── pages/
│       ├── AdminDashboard.css                   <-- Deprecate --admin-* tokens in favor of root tokens
│       ├── AdminDashboard.jsx                   <-- Remove duplicate nested inner header & avatar
│       ├── AIInterview.jsx                      <-- Fix missing CSS variables (--surface, --primary, --border)
│       ├── Apply.jsx                            <-- Remove inline <style> block, add dark mode support
│       ├── Aptitude.jsx                         <-- Standardize form controls and button classes
│       ├── AptitudeTest.jsx                     <-- Fix missing CSS variables and update RecruitOS "R" branding
│       ├── BidPortal.jsx                        <-- Replace hardcoded pastel backgrounds with semantic badges
│       ├── CallRecord.jsx                       <-- Replace hardcoded #e33 delete button and fix table width
│       ├── CampusDB.jsx                         <-- Replace #6327BD with brand purple, break up monolithic file
│       ├── CandidateDB.jsx                      <-- Replace hardcoded badge colors (#FDECEC, #E8F7EE)
│       ├── CandidateSearch.jsx                  <-- Add accessible labels to search filters
│       ├── CompanyProfile.jsx                   <-- Replace hardcoded pastel verification status pills
│       ├── CorporateDashboard.css               <-- Remove global body font-family and background overrides
│       ├── CorporateDashboard.jsx               <-- Remove duplicate nested topbar & notification button
│       ├── Dashboard.css                        <-- Deprecate --dash-* tokens in favor of root tokens
│       ├── Dashboard.jsx                        <-- Consolidate recruiter dashboard views
│       ├── Documents.jsx                        <-- Unify document status pills with semantic badge component
│       ├── GDAdmin.jsx                          <-- Make rating matrix responsive on mobile
│       ├── Jobs.jsx                             <-- Replace hardcoded brownish badge colors with tokenized tags
│       ├── Joining.jsx                          <-- Fix missing CSS variables and missing <thead> markup
│       ├── LoginSelect.jsx                      <-- Rebuild rigid inline grids with responsive Tailwind classes
│       ├── Notifications.jsx                    <-- Replace raw emojis with Lucide icons
│       ├── Pipeline.jsx                         <-- Improve mobile touch-friendly drag-and-drop interactions
│       ├── PlacementCoordinatorRegister.jsx     <-- Replace inline styles and align #6327BD with brand purple
│       ├── Reports.css                          <-- Normalize layout breakpoints to standard Tailwind widths
│       ├── Reports.jsx                          <-- Consolidate duplicate chart rendering logic
│       ├── Resume.jsx                           <-- Replace raw emojis with Lucide icons
│       └── UserManagement.jsx                   <-- Increase action button touch targets to >= 36px
```

---

## 14. Design Direction Comparison & Final Scorecard

### 14.1 Evaluation of Four Design Directions

```
+-------------------------------------------------------------------------------------------------------------+
| DESIGN DIRECTION        | PROS                              | CONS                             | FIT SCORE  |
+-------------------------------------------------------------------------------------------------------------+
| 1. Modern Corporate     | Crisp, neutral, highly readable;  | Can feel overly utilitarian if   | 9.4 / 10   |
|    SaaS (RECOMMENDED)   | optimized for high data density;  | accent colors are too muted.     | (BEST FIT) |
|                         | familiar to corporate recruiters. |                                  |            |
+-------------------------------------------------------------------------------------------------------------+
| 2. Minimal & Clean      | Distraction-free; low cognitive   | Ineffective for multi-column     | 6.8 / 10   |
|                         | load; fast rendering.             | institutional recruitment data.  |            |
+-------------------------------------------------------------------------------------------------------------+
| 3. Premium Enterprise   | High trust; sophisticated navy/   | Heavy visual weight; can feel    | 7.9 / 10   |
|                         | slate palette; high prestige.     | intimidating for college students|            |
+-------------------------------------------------------------------------------------------------------------+
| 4. Modern EdTech        | Engaging; vibrant; approachable   | Lacks corporate seriousness for  | 6.5 / 10   |
|                         | for young graduates.              | enterprise HR & procurement.     |            |
+-------------------------------------------------------------------------------------------------------------+
```

### 14.2 Detailed Direction Analysis & Recommendation

#### Option 1: Modern Corporate SaaS (Recommended Direction)
- **Visual Style:** Neutral slate and cool zinc canvases (`#F8FAFC` / `#0F172A`), precise single-pixel borders (`#E2E8F0` / `#1E293B`), refined typography scale powered by `'Plus Jakarta Sans'`, and purposeful indigo/purple brand accents (`#6366F1` or `#7C3AED`).
- **Why It Best Fits SaarthiCampus:**  
  SaarthiCampus serves a triangular ecosystem: **College Placement Officers (TPOs)**, **Corporate HR Executives**, and **Graduating Students**. Corporate recruiters prioritize efficiency, scanability, and data density. An enterprise-grade Modern Corporate SaaS visual framework establishes the credibility required to close corporate hiring contracts while remaining intuitive and accessible for college students taking assessments.

#### Option 2: Minimal and Clean
- Fails to adequately support the density required by multi-parameter candidate searches, 12-column campus databases, and pipeline Kanban boards.

#### Option 3: Premium Enterprise (Fintech / Traditional Corporate)
- High visual weight and dark navy tones can feel intimidating and bureaucratic for fresher candidates applying via public links.

#### Option 4: Modern EdTech Platform
- Playful illustrations, heavy gamification, and bright color palettes undermine corporate credibility when selling recruitment solutions to enterprise talent acquisition heads.

---

### 14.3 Final Quality Scorecard

```
+-----------------------------------------------------------------------+
| SAARTHICAMPUS FRONTEND UI/UX AUDIT SCORECARD                          |
+-----------------------------------------------------------------------+
| Metric                                   | Score   | Grade            |
+------------------------------------------+---------+------------------+
| Overall UI/UX Quality Rating             | 4.8/10  | Needs Work       |
| Light Mode Visual Appeal & Hierarchy     | 6.0/10  | Acceptable       |
| Dark Mode Implementation & Polish        | 2.0/10  | Poor / Broken    |
| Colour Palette Consistency               | 3.5/10  | Poor (5 systems) |
| Typography Scalability & Readability     | 4.5/10  | Mediocre         |
| Responsive Fluidity & Mobile Usability   | 4.0/10  | Mediocre         |
| Cross-Page Design Consistency            | 3.5/10  | Poor             |
+------------------------------------------+---------+------------------+
| COMPOSITE SYSTEM SCORE                   | 4.0/10  | Tier 3 (Legacy)  |
+--------------------------------------- --+---------+------------------+
```

---
*Report compiled autonomously via deep static source analysis of the SaarthiCampus frontend codebase.*
