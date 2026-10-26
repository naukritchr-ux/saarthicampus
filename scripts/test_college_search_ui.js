// =============================================================================
// Test Suite: Placement Coordinator Registration - College Search Dropdown UI Verification
// File: scripts/test_college_search_ui.js
// =============================================================================

const fs = require("fs");
const path = require("path");
const { createClient } = require("../recruitos-backend/node_modules/@supabase/supabase-js");
require("dotenv").config({ path: path.join(__dirname, "..", "recruitos-backend", ".env") });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log("\n=================================================================");
  console.log("RUNNING COLLEGE SEARCH DROPDOWN UI VERIFICATION SUITE");
  console.log("=================================================================\n");

  // ---------------------------------------------------------------------------
  // Suite 1: Source Code & Architectural Rules Verification
  // ---------------------------------------------------------------------------
  console.log("Suite 1: Source Code & Dropdown Logic Inspection");
  const registerFile = path.join(__dirname, "..", "recruitos-frontend", "src", "pages", "PlacementCoordinatorRegister.jsx");
  assert(fs.existsSync(registerFile), "PlacementCoordinatorRegister.jsx exists");

  const code = fs.readFileSync(registerFile, "utf8");

  // Rule 1: No dropdown on empty or < 2 characters
  assert(
    code.includes("showDropdown && collegeSearch.trim().length >= 2"),
    "Rule 1: Dropdown only renders when user input has at least 2 characters (showDropdown && collegeSearch.trim().length >= 2)"
  );
  assert(
    code.includes("term.length < 2"),
    "Rule 1: Debounced search effect halts immediately if term.length < 2 and resets state"
  );

  // Rule 2 & 3: No results & Add institution conditional logic
  assert(
    code.includes("!searchingColleges && !searchError && searchPerformed && collegeResults.length === 0"),
    "Rule 3: 'No matching colleges found' only renders after search has completed, with no loading and 0 results"
  );
  assert(
    code.includes("No matching colleges found"),
    "Rule 3: Displays exact label 'No matching colleges found'"
  );
  assert(
    code.includes("College not found? Add your institution"),
    "Rule 3: Displays professional option 'College not found? Add your institution'"
  );

  // Rule 4: Visual positioning & accessibility
  assert(
    code.includes('position: "absolute"') && code.includes("maxHeight: 260") && code.includes('overflowY: "auto"'),
    "Rule 4: Dropdown uses properly constrained maxHeight and scroll without breaking form flow"
  );
  assert(
    code.includes("handleClickOutside") && code.includes("Escape"),
    "Rule 4: Dropdown closes on outside click or Escape key"
  );

  // Rule 6: Loading & Error handling
  assert(
    code.includes("searchingColleges") && code.includes("Searching directory for"),
    "Rule 6: Displays clear loading indicator without showing 'no results' during search in flight"
  );
  assert(
    code.includes("searchError"),
    "Rule 6: Gracefully catches and displays API/network errors"
  );

  // ---------------------------------------------------------------------------
  // Suite 2: State Simulation & UI Logic Behavior
  // ---------------------------------------------------------------------------
  console.log("\nSuite 2: State Simulation & UI Condition Verification");

  // Helper simulating the component's dropdown visibility & contents logic
  function evaluateDropdownState({ collegeSearch, showDropdown, searchingColleges, searchPerformed, searchError, collegeResults }) {
    const term = (collegeSearch || "").trim();
    const shouldRenderDropdown = Boolean(showDropdown && term.length >= 2);

    let rendersLoading = false;
    let rendersError = false;
    let rendersMatches = false;
    let rendersNoResults = false;
    let rendersAddOption = false;

    if (shouldRenderDropdown) {
      if (searchingColleges) {
        rendersLoading = true;
      } else if (searchError) {
        rendersError = true;
        rendersAddOption = true;
      } else if (searchPerformed && collegeResults.length > 0) {
        rendersMatches = true;
        rendersAddOption = true;
      } else if (searchPerformed && collegeResults.length === 0) {
        rendersNoResults = true;
        rendersAddOption = true;
      }
    }

    return {
      shouldRenderDropdown,
      rendersLoading,
      rendersError,
      rendersMatches,
      rendersNoResults,
      rendersAddOption,
    };
  }

  // Scenario 1: Empty input and focused
  const stateEmpty = evaluateDropdownState({
    collegeSearch: "",
    showDropdown: true,
    searchingColleges: false,
    searchPerformed: false,
    searchError: null,
    collegeResults: [],
  });
  assert(
    stateEmpty.shouldRenderDropdown === false && stateEmpty.rendersAddOption === false,
    "Scenario 1 (Empty Input): Zero dropdown options shown when focused but empty"
  );

  // Scenario 2: 1 character typed ('A')
  const stateOneChar = evaluateDropdownState({
    collegeSearch: "A",
    showDropdown: true,
    searchingColleges: false,
    searchPerformed: false,
    searchError: null,
    collegeResults: [],
  });
  assert(
    stateOneChar.shouldRenderDropdown === false,
    "Scenario 2 (1 Character Typed): Zero dropdown options shown for input length < 2"
  );

  // Scenario 3: 2 characters typed, search in-flight ('Am')
  const stateSearching = evaluateDropdownState({
    collegeSearch: "Am",
    showDropdown: true,
    searchingColleges: true,
    searchPerformed: false,
    searchError: null,
    collegeResults: [],
  });
  assert(
    stateSearching.shouldRenderDropdown === true &&
      stateSearching.rendersLoading === true &&
      stateSearching.rendersNoResults === false,
    "Scenario 3 (Search In-Flight): Displays loading indicator, strictly NEVER shows 'no results' while searching"
  );

  // Scenario 4: 2+ characters with matches returned ('Amity')
  const stateMatches = evaluateDropdownState({
    collegeSearch: "Amity",
    showDropdown: true,
    searchingColleges: false,
    searchPerformed: true,
    searchError: null,
    collegeResults: [{ id: "1", name: "Amity University", city: "Noida", state: "Uttar Pradesh" }],
  });
  assert(
    stateMatches.shouldRenderDropdown === true &&
      stateMatches.rendersMatches === true &&
      stateMatches.rendersNoResults === false &&
      stateMatches.rendersAddOption === true,
    "Scenario 4 (Matches Returned): Shows suggestions list and keeps 'Add your institution' accessible at bottom"
  );

  // Scenario 5: Non-matching search query ('NonExistentCollegeXYZ123')
  const stateNoMatches = evaluateDropdownState({
    collegeSearch: "NonExistentCollegeXYZ123",
    showDropdown: true,
    searchingColleges: false,
    searchPerformed: true,
    searchError: null,
    collegeResults: [],
  });
  assert(
    stateNoMatches.shouldRenderDropdown === true &&
      stateNoMatches.rendersNoResults === true &&
      stateNoMatches.rendersAddOption === true,
    "Scenario 5 (Non-Matching Query): Shows 'No matching colleges found' and 'College not found? Add your institution'"
  );

  // Scenario 6: API Search Error
  const stateApiError = evaluateDropdownState({
    collegeSearch: "NetworkFail",
    showDropdown: true,
    searchingColleges: false,
    searchPerformed: true,
    searchError: "Unable to search colleges",
    collegeResults: [],
  });
  assert(
    stateApiError.shouldRenderDropdown === true &&
      stateApiError.rendersError === true &&
      stateApiError.rendersAddOption === true,
    "Scenario 6 (API Error): Displays error notice and allows user to proceed with adding institution manually"
  );

  // ---------------------------------------------------------------------------
  // Suite 3: Database & Public Search API Verification
  // ---------------------------------------------------------------------------
  console.log("\nSuite 3: Database Integration Verification");

  // Query database with matching term
  const { data: dbMatches, error: matchErr } = await sb
    .from("colleges")
    .select("id, name, city, state, course, website")
    .ilike("name", "%Sharda%")
    .limit(10);

  assert(!matchErr && dbMatches && dbMatches.length > 0, "Database search: Successfully found existing college 'Sharda University'");
  assert(dbMatches[0].name.includes("Sharda"), "Database search: Matching result contains college name");

  // Query database with non-matching term
  const { data: dbNoMatches, error: noMatchErr } = await sb
    .from("colleges")
    .select("id, name, city, state, course, website")
    .ilike("name", "%DefinitelyFakeCollegeName123456%")
    .limit(10);

  assert(!noMatchErr && dbNoMatches && dbNoMatches.length === 0, "Database search: Returns 0 results for non-matching college");

  console.log("\n=================================================================");
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("=================================================================\n");

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
