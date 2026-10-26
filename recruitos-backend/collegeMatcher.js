/**
 * College Matching & Data Normalization Engine for Saarthi Campus
 * Matches submitted coordinator college details against existing college directory records.
 */

function normalizeText(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COMMON_STOP_WORDS = new Set([
  "of",
  "and",
  "the",
  "in",
  "for",
  "at",
  "o",
  "s",
  "deemed",
  "to",
  "be",
]);

function getTokens(str) {
  return normalizeText(str)
    .split(" ")
    .filter((w) => w.length > 1 && !COMMON_STOP_WORDS.has(w));
}

const INSTITUTION_EXPANSIONS = {
  iim: "indian institute of management",
  iit: "indian institute of technology",
  nit: "national institute of technology",
  iiit: "indian institute of information technology",
  bhu: "banaras hindu university",
  vjti: "veermata jijabai technological institute",
  spit: "sardar patel institute of technology",
  jbims: "jamnalal bajaj institute of management studies",
  simsree: "sydenham institute of management studies",
  imis: "institute of management and information science",
  outr: "odisha university of technology and research",
  soa: "siksha o anusandhan",
  kiit: "kalinga institute of industrial technology kiit",
  nmims: "narsee monjee institute of management studies nmims",
  tsec: "thadomal shahani engineering college",
};

/**
 * Finds matching existing colleges for a submitted registration.
 *
 * @param {string} submittedName
 * @param {string} submittedCity
 * @param {string} submittedState
 * @param {Array} allColleges
 * @returns {{ suggested_college: Object|null, potential_matches: Array }}
 */
function findCollegeMatches(submittedName, submittedCity, submittedState, allColleges) {
  if (!submittedName || !Array.isArray(allColleges) || allColleges.length === 0) {
    return { suggested_college: null, potential_matches: [] };
  }

  const rawSubName = submittedName.trim();
  const normSubName = normalizeText(rawSubName);
  const subTokens = getTokens(rawSubName);
  const normSubCity = normalizeText(submittedCity || "");
  const normSubState = normalizeText(submittedState || "");

  // Expand acronym in submitted name if present (e.g. "IIM Lucknow" -> "indian institute of management lucknow")
  let expandedSubName = normSubName;
  for (const [acronym, expansion] of Object.entries(INSTITUTION_EXPANSIONS)) {
    const regex = new RegExp(`\\b${acronym}\\b`, "g");
    if (regex.test(expandedSubName)) {
      expandedSubName = expandedSubName.replace(regex, expansion);
    }
  }
  const expandedSubTokens = getTokens(expandedSubName);

  const scoredColleges = allColleges.map((c) => {
    if (!c || !c.name) return { id: c?.id, score: 0 };

    const rawColName = c.name.trim();
    const normColName = normalizeText(rawColName);
    const colTokens = getTokens(rawColName);
    const normColCity = normalizeText(c.city || "");
    const normColState = normalizeText(c.state || "");

    let score = 0;
    let matchType = "None";
    let matchReason = "";

    // 1. Direct exact name match
    if (normColName === normSubName || normColName === expandedSubName) {
      score = 100;
      matchType = "Exact Name Match";
      matchReason = "Exact institution name match";
    }

    // 2. Acronym check inside parentheses e.g. (VJTI), (JBIMS), (SPIT)
    if (score === 0) {
      const parenMatch = rawColName.match(/\(([^)]+)\)/);
      if (parenMatch) {
        const acronym = normalizeText(parenMatch[1]);
        if (
          normSubName === acronym ||
          normSubName.startsWith(acronym + " ") ||
          normSubName.endsWith(" " + acronym)
        ) {
          score = 95;
          matchType = "Acronym Match";
          matchReason = `Acronym match (${parenMatch[1]})`;
        }
      }
    }

    // 3. Substring / Containment match
    if (score === 0) {
      if (
        normColName.includes(normSubName) ||
        normSubName.includes(normColName) ||
        normColName.includes(expandedSubName) ||
        expandedSubName.includes(normColName)
      ) {
        score = 80;
        matchType = "Partial Name Match";
        matchReason = "Institution name overlap";
      }
    }

    // 4. Token overlap (Jaccard similarity on meaningful words)
    if (score === 0) {
      const tokensToCompare = expandedSubTokens.length > subTokens.length ? expandedSubTokens : subTokens;
      const common = tokensToCompare.filter((t) => colTokens.includes(t));
      if (common.length >= 2) {
        const overlap = (2 * common.length) / (tokensToCompare.length + colTokens.length);
        if (overlap >= 0.45) {
          score = Math.round(overlap * 80);
          matchType = "Keyword Match";
          matchReason = `Matched keywords: ${common.slice(0, 3).join(", ")}`;
        }
      }
    }

    // 5. Location alignment adjustments
    if (score > 0) {
      // Check City
      if (normSubCity && (normColCity || normColName)) {
        if (normSubCity === normColCity || normColName.includes(normSubCity)) {
          score = Math.min(100, score + 15);
          matchReason += ` • Confirmed city (${c.city || submittedCity})`;
        } else if (normColCity && normColCity !== normSubCity && !normColName.includes(normSubCity)) {
          // Both have city but they conflict
          score = Math.max(30, score - 20);
          matchReason += ` • City difference (${c.city} vs ${submittedCity})`;
        }
      }

      // Check State
      if (normSubState && normColState && normSubState === normColState) {
        score = Math.min(100, score + 5);
      }
    }

    return {
      id: c.id,
      name: c.name,
      city: c.city,
      state: c.state,
      course: c.course,
      courses_available: c.courses_available,
      website: c.website,
      tpo: c.tpo,
      score,
      match_type: matchType,
      match_reason: matchReason,
    };
  });

  const potentialMatches = scoredColleges
    .filter((m) => m.score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const topMatch = potentialMatches.length > 0 && potentialMatches[0].score >= 70
    ? potentialMatches[0]
    : null;

  return {
    suggested_college: topMatch,
    potential_matches: potentialMatches,
  };
}

/**
 * Merges incoming courses into existing courses string without deleting existing
 * courses or creating duplicate entries.
 *
 * @param {string|null} existingCourses e.g. "School of Law; MBA"
 * @param {string|null} incomingCourses e.g. "B.Tech, MBA, MCA, LLB"
 * @returns {string|null} e.g. "School of Law; MBA; B.Tech; MCA; LLB"
 */
function mergeCourses(existingCourses, incomingCourses) {
  if (!incomingCourses || typeof incomingCourses !== "string" || !incomingCourses.trim()) {
    return existingCourses || null;
  }
  if (!existingCourses || typeof existingCourses !== "string" || !existingCourses.trim()) {
    return incomingCourses.trim();
  }

  const splitCourses = (str) =>
    str
      .split(/[;,]/)
      .map((c) => c.trim())
      .filter(Boolean);

  const existingList = splitCourses(existingCourses);
  const incomingList = splitCourses(incomingCourses);

  const seen = new Set(existingList.map((c) => c.toLowerCase()));
  const merged = [...existingList];

  for (const c of incomingList) {
    if (!seen.has(c.toLowerCase())) {
      seen.add(c.toLowerCase());
      merged.push(c);
    }
  }

  return merged.join("; ");
}

module.exports = {
  findCollegeMatches,
  normalizeText,
  mergeCourses,
};
