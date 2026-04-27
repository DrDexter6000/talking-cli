/**
 * MCP-Atlas adapted benchmark checkers.
 *
 * Each checker receives (finalTurn, _fs) and returns {pass, reason}.
 * Tasks adapted from MCP-Atlas (https://github.com/scaleapi/mcp-atlas).
 * Checkers analyze the LLM's final text response for expected patterns.
 * All checkers are deterministic — no LLM-as-judge.
 *
 * GTFA claims sourced from sample_tasks.csv in the MCP-Atlas repository.
 * Licensed under CC-BY-4.0 per the MCP-Atlas project.
 */

/**
 * Helper: normalize finalTurn to a string for pattern matching.
 */
function textOf(finalTurn) {
  return typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
}

// ─── Easy (4 tasks) ──────────────────────────────────────────────────────────

/**
 * task-atlas-movie-genre-ranking: Rank genres by count in Top Movies file.
 * GTFA: Action=12, Drama=11, Adventure=8, Crime=7, Biography=5
 */
function checkAtlasMovieGenreRanking(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasAction = text.includes("action") && text.includes("12");
  const hasDrama = text.includes("drama") && text.includes("11");
  const hasAdventure = text.includes("adventure") && text.includes("8");
  const hasCrime = text.includes("crime") && text.includes("7");
  const hasBiography = text.includes("biography") && text.includes("5");

  const correctGenres = [hasAction, hasDrama, hasAdventure, hasCrime, hasBiography];
  const passCount = correctGenres.filter(Boolean).length;

  if (passCount === 0) {
    return { pass: false, reason: "movie-genre-ranking: no correct genre-count pairs found" };
  }
  if (passCount < 3) {
    return { pass: false, reason: `movie-genre-ranking: only ${passCount}/5 genres with correct counts` };
  }
  return {
    pass: true,
    reason: `movie-genre-ranking: ${passCount}/5 genres correctly ranked (Action=12, Drama=11, Adventure=8, Crime=7, Biography=5)`,
  };
}

/**
 * task-atlas-barber-rating-age: Average haircut rating and client age.
 * GTFA: Rating=4.25625, Age=32.5
 */
function checkAtlasBarberRatingAge(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasRating =
    text.includes("4.25") || text.includes("4.26") || text.includes("4.256");
  const hasAge = text.includes("32.5") || text.includes("32 years");
  const mentionsRating = text.includes("rating") || text.includes("average");
  const mentionsAge = text.includes("age");

  if (!hasRating && !hasAge) {
    return { pass: false, reason: "barber-rating-age: neither correct rating (4.25) nor age (32.5) found" };
  }
  if (!hasRating) {
    return { pass: false, reason: "barber-rating-age: correct age found but rating (4.25) is missing or incorrect" };
  }
  if (!hasAge) {
    return { pass: false, reason: "barber-rating-age: correct rating found but age (32.5) is missing or incorrect" };
  }
  return { pass: true, reason: "barber-rating-age: correctly reported avg rating ~4.256 and avg age 32.5" };
}

/**
 * task-atlas-tomorrowland-charging: Walking distance from Tomorrowland venue to nearest charging station.
 * GTFA: De Schorre, Boom Belgium, 1626.4 meters
 */
function checkAtlasTomorrowlandCharging(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasVenue = text.includes("de schorre") || (text.includes("boom") && text.includes("belgium"));
  const hasDistance = text.includes("1626") || text.includes("1,626") || text.includes("1.626");
  const mentionsWalking = text.includes("walking") || text.includes("meter") || text.includes("distance");

  if (!hasVenue && !hasDistance) {
    return { pass: false, reason: "tomorrowland-charging: neither venue nor distance found" };
  }
  if (!hasVenue) {
    return { pass: false, reason: "tomorrowland-charging: distance found but venue (De Schorre/Boom) not identified" };
  }
  if (!hasDistance) {
    return { pass: false, reason: "tomorrowland-charging: venue identified but distance (~1626m) not reported" };
  }
  return { pass: true, reason: "tomorrowland-charging: correctly found De Schorre, Boom with ~1626m to nearest charging station" };
}

/**
 * task-atlas-barber-female-stats: Percentage of female clients and their average age.
 * GTFA: 48.39%, 31.33 years
 */
function checkAtlasBarberFemaleStats(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasPercentage = text.includes("48.39") || text.includes("48.4");
  const hasAvgAge = text.includes("31.33") || text.includes("31.3");
  const mentionsFemale = text.includes("female") || text.includes("women");

  if (!hasPercentage && !hasAvgAge) {
    return { pass: false, reason: "barber-female-stats: neither correct percentage (48.39%) nor age (31.33) found" };
  }
  if (!hasPercentage) {
    return { pass: false, reason: "barber-female-stats: age found but percentage (48.39%) is missing or incorrect" };
  }
  if (!hasAvgAge) {
    return { pass: false, reason: "barber-female-stats: percentage found but average age (31.33) is missing or incorrect" };
  }
  return { pass: true, reason: "barber-female-stats: correctly reported 48.39% female with avg age 31.33" };
}

// ─── Medium (4 tasks) ────────────────────────────────────────────────────────

/**
 * task-atlas-git-merge-detective: Find specific merge commit after README link fix.
 * GTFA: hash=0865ef4..., date=April 3 2024, message="Merge pull request #1 from pH-7/patch-1\n\nUpdate incorrect filename link"
 */
function checkAtlasGitMergeDetective(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasHash = text.includes("0865ef4");
  const hasDate = (text.includes("april 3") || text.includes("2024-04-03")) && text.includes("2024");
  const hasMergeMsg = text.includes("merge pull request") || text.includes("merge pr");
  const hasBranch = text.includes("patch-1") || text.includes("ph-7");

  const dimensions = [
    { name: "commit_hash", passed: hasHash },
    { name: "date", passed: hasDate },
    { name: "merge_msg", passed: hasMergeMsg },
    { name: "branch_ref", passed: hasBranch },
  ];

  const passCount = dimensions.filter((d) => d.passed).length;
  const passedNames = dimensions.filter((d) => d.passed).map((d) => d.name);
  const failedNames = dimensions.filter((d) => !d.passed).map((d) => d.name);

  if (passCount < 2) {
    return { pass: false, reason: `git-merge-detective: only ${passCount}/4 clues found. Missing: [${failedNames.join(", ")}]` };
  }
  return {
    pass: true,
    reason: `git-merge-detective: ${passCount}/4 clues matched [${passedNames.join(", ")}]`,
  };
}

/**
 * task-atlas-equestrian-statues: Named equestrian statues within 10km of Eiffel Tower.
 * GTFA: 2 statues: La Renommée montée sur Pégase, Mercure monté sur Pégase
 */
function checkAtlasEquestrianStatues(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasEiffel = text.includes("eiffel tower") || text.includes("tour eiffel");
  const hasRenommee = text.includes("renomm") || text.includes("renommee");
  const hasMercure = text.includes("mercure");
  const hasPegase = text.includes("pégase") || text.includes("pegase") || text.includes("pegasus");
  const hasCount = text.includes("2") && (text.includes("statue") || text.includes("equestrian"));

  if (!hasEiffel && !hasCount) {
    return { pass: false, reason: "equestrian-statues: response does not identify Eiffel Tower or statue count" };
  }
  if (!hasRenommee && !hasMercure) {
    return { pass: false, reason: "equestrian-statues: neither of the two named statues found (La Renommée, Mercure)" };
  }
  if (!hasRenommee) {
    return { pass: true, reason: "equestrian-statues: found Mercure statue but not La Renommée" };
  }
  if (!hasMercure) {
    return { pass: true, reason: "equestrian-statues: found La Renommée but not Mercure" };
  }
  return { pass: true, reason: "equestrian-statues: correctly identified both equestrian statues near Eiffel Tower" };
}

/**
 * task-atlas-doordash-fast-food: Identify fast food category from DoorDash article + count in CSV.
 * GTFA: Fast food = 6-9% margin, bulk orders, 12 entries in CSV
 */
function checkAtlasDoordashFastFood(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasFastFood = text.includes("fast food") || text.includes("quick service") || text.includes("fast-food");
  const hasMargin = text.includes("6") && text.includes("9") && (text.includes("%") || text.includes("percent"));
  const hasBulkOrders = text.includes("bulk") || text.includes("volume");
  const hasCount = text.includes("12") && (text.includes("record") || text.includes("entry") || text.includes("fast food"));

  if (!hasFastFood) {
    return { pass: false, reason: "doordash-fast-food: response does not identify the fast food category" };
  }
  if (!hasCount) {
    return { pass: false, reason: "doordash-fast-food: identified category but did not report 12 entries in CSV" };
  }
  if (!hasMargin) {
    return { pass: true, reason: "doordash-fast-food: identified fast food and count but didn't mention 6-9% margin" };
  }
  return { pass: true, reason: "doordash-fast-food: correctly identified fast food (6-9% margin, bulk orders) with 12 CSV entries" };
}

/**
 * task-atlas-met-museum-rooster: Find rooster+flowers object in Asian Art, report title/artist/medium.
 * GTFA: Rooster and coxcomb by Qi Baishi, medium=hanging scroll
 */
function checkAtlasMetMuseumRooster(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasTitle = text.includes("rooster") && (text.includes("coxcomb") || text.includes("flower"));
  const hasArtist = text.includes("qi baishi") || text.includes("baishi");
  const hasMedium = text.includes("hanging scroll") || text.includes("scroll");
  const hasMediumExplanation =
    text.includes("ink") || text.includes("paper") || text.includes("silk") || text.includes("chinese painting");

  if (!hasTitle) {
    return { pass: false, reason: "met-museum-rooster: response does not identify the rooster artwork title" };
  }
  if (!hasArtist) {
    return { pass: false, reason: "met-museum-rooster: title found but artist (Qi Baishi) not identified" };
  }
  if (!hasMedium) {
    return { pass: true, reason: "met-museum-rooster: found artwork and artist but didn't identify hanging scroll medium" };
  }
  if (!hasMediumExplanation) {
    return { pass: true, reason: "met-museum-rooster: identified artwork, artist, and medium but didn't explain the medium" };
  }
  return { pass: true, reason: "met-museum-rooster: correctly identified Qi Baishi's Rooster and coxcomb as hanging scroll" };
}

// ─── Hard (2 tasks) ──────────────────────────────────────────────────────────

/**
 * task-atlas-guggenheim-architect: Multi-hop: Guggenheim Bilbao → Gehry → Toronto → library → subway.
 * GTFA: Frank Gehry, Toronto, Toronto Reference Library, ~43.67°N 79.39°W, Bloor-Yonge Station
 */
function checkAtlasGuggenheimArchitect(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasArchitect = text.includes("frank gehry") || text.includes("gehry");
  const hasBirthCity = text.includes("toronto");
  const hasLibrary = text.includes("toronto reference library") || text.includes("reference library");
  const hasStation = text.includes("bloor") && (text.includes("yonge") || text.includes("young"));
  const hasCoordinates = text.includes("43.6") || text.includes("79.3") || text.includes("79.4");

  const dimensions = [
    { name: "architect_gehry", passed: hasArchitect },
    { name: "birth_toronto", passed: hasBirthCity },
    { name: "library", passed: hasLibrary },
    { name: "subway_bloor_yonge", passed: hasStation },
    { name: "coordinates", passed: hasCoordinates },
  ];

  const passCount = dimensions.filter((d) => d.passed).length;
  const passedNames = dimensions.filter((d) => d.passed).map((d) => d.name);
  const failedNames = dimensions.filter((d) => !d.passed).map((d) => d.name);

  if (passCount < 3) {
    return { pass: false, reason: `guggenheim-architect: only ${passCount}/5 hops completed. Missing: [${failedNames.join(", ")}]` };
  }
  return {
    pass: true,
    reason: `guggenheim-architect: ${passCount}/5 hops completed [${passedNames.join(", ")}]`,
  };
}

/**
 * task-atlas-beer-wednesday-saturday: Beer orders Wed vs Sat with gender breakdown.
 * GTFA: Sat=$41.62, Wed=$51.00, -18.4%, women=-7.4%, men=-29.4%, men larger gap
 */
function checkAtlasBeerWednesdaySaturday(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasSatAvg = text.includes("41.62") || text.includes("41.6");
  const hasWedAvg = text.includes("51.00") || text.includes("51.0") || text.includes("51");
  const hasOverallChange = text.includes("18.4") || text.includes("18%");
  const hasWomenChange = text.includes("7.4") || text.includes("-7.4");
  const hasMenChange = text.includes("29.4") || text.includes("-29.4");
  const hasGenderConclusion =
    text.includes("men") && (text.includes("larger") || text.includes("greater") || text.includes("bigger"));

  const dimensions = [
    { name: "sat_avg", passed: hasSatAvg },
    { name: "wed_avg", passed: hasWedAvg },
    { name: "overall_change", passed: hasOverallChange },
    { name: "women_change", passed: hasWomenChange },
    { name: "men_change", passed: hasMenChange },
    { name: "gender_conclusion", passed: hasGenderConclusion },
  ];

  const passCount = dimensions.filter((d) => d.passed).length;
  const passedNames = dimensions.filter((d) => d.passed).map((d) => d.name);
  const failedNames = dimensions.filter((d) => !d.passed).map((d) => d.name);

  if (passCount < 3) {
    return { pass: false, reason: `beer-wed-sat: only ${passCount}/6 data points found. Missing: [${failedNames.join(", ")}]` };
  }
  return {
    pass: true,
    reason: `beer-wed-sat: ${passCount}/6 data points matched [${passedNames.join(", ")}]`,
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  checkAtlasMovieGenreRanking,
  checkAtlasBarberRatingAge,
  checkAtlasTomorrowlandCharging,
  checkAtlasBarberFemaleStats,
  checkAtlasGitMergeDetective,
  checkAtlasEquestrianStatues,
  checkAtlasDoordashFastFood,
  checkAtlasMetMuseumRooster,
  checkAtlasGuggenheimArchitect,
  checkAtlasBeerWednesdaySaturday,
};
