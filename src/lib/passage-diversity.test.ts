import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateJaccardSimilarity,
  createScenarioFingerprint,
  findDuplicatePassages,
  isVocabularyDerivedScenario,
  normalizeForSimilarity,
  validatePassageAgainstSet,
  validatePassageDiversity,
  type PassageDiversityInput,
} from "./passage-diversity";

function passage(
  overrides: Partial<PassageDiversityInput> & Pick<PassageDiversityInput, "title" | "passageText">,
): PassageDiversityInput {
  return {
    scenarioCategory: "generic event",
    scenarioSummary: "A unique educational situation occurs.",
    centralEvent: "An unexpected problem appears during a task.",
    mainProblem: "A critical step was skipped.",
    consequence: "Someone could be harmed or the result is wrong.",
    requiredResponse: "Pause and apply the correct procedure.",
    perspective: "student learner",
    setting: "classroom workspace",
    vocabularyTermsUsed: [],
    ...overrides,
  };
}

describe("normalizeForSimilarity", () => {
  it("lowercases, strips punctuation, and removes stop words/names", () => {
    const tokens = normalizeForSimilarity(
      "Kai notices an oil spill beside the service bay!",
    );
    assert.ok(!tokens.includes("kai"));
    assert.ok(!tokens.includes("the"));
    assert.ok(tokens.includes("oil"));
    assert.ok(tokens.includes("spill"));
  });
});

describe("calculateJaccardSimilarity", () => {
  it("returns 1 for identical token sets", () => {
    assert.equal(
      calculateJaccardSimilarity(["oil", "spill"], ["oil", "spill"]),
      1,
    );
  });

  it("returns 0 for disjoint sets", () => {
    assert.equal(calculateJaccardSimilarity(["budget"], ["ecosystem"]), 0);
  });
});

describe("isVocabularyDerivedScenario", () => {
  const vocab = ["Hazard", "PPE", "Risk Assessment", "OSH"];

  it("rejects vocabulary-title clones", () => {
    assert.equal(
      isVocabularyDerivedScenario({ title: "Hazard in Practice", scenarioCategory: "Hazard" }, vocab),
      true,
    );
    assert.equal(
      isVocabularyDerivedScenario(
        { title: "PPE in Practice", scenarioCategory: "Understanding PPE" },
        vocab,
      ),
      true,
    );
    assert.equal(
      isVocabularyDerivedScenario(
        { title: "Risk Assessment at Work", scenarioCategory: "Risk Assessment" },
        vocab,
      ),
      true,
    );
    assert.equal(
      isVocabularyDerivedScenario(
        { title: "Understanding OSH", scenarioCategory: "OSH" },
        vocab,
      ),
      true,
    );
  });

  it("accepts event/context categories", () => {
    assert.equal(
      isVocabularyDerivedScenario(
        { title: "Oil on the Walkway", scenarioCategory: "workshop spill" },
        vocab,
      ),
      false,
    );
    assert.equal(
      isVocabularyDerivedScenario(
        { title: "Compare Bus Fares", scenarioCategory: "budget planning" },
        ["percentage", "total", "discount"],
      ),
      false,
    );
  });
});

describe("createScenarioFingerprint", () => {
  it("builds comparable tokens from metadata fields", () => {
    const tokens = createScenarioFingerprint({
      scenarioCategory: "workshop spill",
      centralEvent: "oil leaks onto walkway",
      mainProblem: "slip hazard ignored",
      consequence: "classmate nearly falls",
      requiredResponse: "isolate spill and clean",
      perspective: "bay worker",
      setting: "service bay three",
    });
    assert.ok(tokens.includes("spill") || tokens.includes("oil"));
    assert.ok(tokens.length > 3);
  });
});

describe("findDuplicatePassages / validatePassageAgainstSet", () => {
  it("rejects same instructor-stops-student storyline with different names", () => {
    const a = passage({
      title: "Hazard in Practice",
      scenarioCategory: "workshop safety stop",
      scenarioSummary: "Instructor stops Kai after a near miss.",
      centralEvent: "Student starts task and ignores a safety rule",
      mainProblem: "Ignores PPE rule during bay work",
      consequence: "Near miss in the walkway",
      requiredResponse: "Instructor stops student and explains the rule",
      perspective: "student",
      setting: "auto workshop",
      passageText:
        "Kai starts a task, ignores a safety rule, and the instructor stops Kai after a near miss. The instructor explains the safety rule to the class.",
      vocabularyTermsUsed: ["hazard", "ppe"],
    });
    const b = passage({
      title: "PPE in Practice",
      scenarioCategory: "workshop safety stop",
      scenarioSummary: "Instructor stops Marissa after a near miss.",
      centralEvent: "Student begins work and ignores a safety rule",
      mainProblem: "Ignores eye protection during bay work",
      consequence: "Near miss beside the bay",
      requiredResponse: "Instructor stops student and explains the safety rule",
      perspective: "student",
      setting: "auto workshop",
      passageText:
        "Marissa starts a task, ignores a safety rule, and the instructor stops Marissa after a near miss. The instructor explains the safety rule to the class.",
      vocabularyTermsUsed: ["hazard", "ppe"],
    });
    const result = validatePassageAgainstSet(b, [a], ["hazard", "ppe", "osh"]);
    assert.equal(result.valid, false);
  });

  it("rejects same safety incident with different vocabulary", () => {
    const a = passage({
      title: "Walkway Oil",
      scenarioCategory: "workplace spill",
      scenarioSummary: "Oil spreads across a walkway.",
      centralEvent: "Leaking oil container on walkway",
      mainProblem: "Spill left unattended",
      consequence: "Slip risk increases",
      requiredResponse: "Isolate and clean the spill",
      setting: "service bay",
      passageText: "Oil spreads across the walkway beside bay three.",
      vocabularyTermsUsed: ["hazard"],
    });
    const b = passage({
      title: "Walkway Fluid",
      scenarioCategory: "workplace spill",
      scenarioSummary: "Fluid spreads across a walkway.",
      centralEvent: "Leaking fluid container on walkway",
      mainProblem: "Spill left unattended",
      consequence: "Slip risk increases",
      requiredResponse: "Isolate and clean the spill",
      setting: "service bay",
      passageText: "Fluid spreads across the walkway beside bay three.",
      vocabularyTermsUsed: ["ppe", "osh"],
    });
    assert.equal(validatePassageAgainstSet(b, [a], ["hazard", "ppe", "osh"]).valid, false);
  });

  it("rejects same scenarioCategory with paraphrased summary", () => {
    const a = passage({
      title: "A",
      scenarioCategory: "budget planning",
      scenarioSummary: "Students compare two transport plans using percentages.",
      centralEvent: "Compare two bus fare options",
      mainProblem: "Choosing without calculating discount",
      consequence: "Overpaying for travel",
      requiredResponse: "Calculate percentage savings",
      setting: "school trip planning room",
      passageText: "Two bus plans are compared using percentages and totals.",
    });
    const b = passage({
      title: "B",
      scenarioCategory: "budget planning",
      scenarioSummary: "Learners compare a pair of transport options with percent savings.",
      centralEvent: "Compare a pair of bus fare options",
      mainProblem: "Selecting without working the discount",
      consequence: "Paying more for travel",
      requiredResponse: "Work out the percentage savings",
      setting: "classroom trip planning area",
      passageText: "A pair of bus options is compared with percentages and totals.",
    });
    assert.equal(validatePassageAgainstSet(b, [a], ["percentage", "total"]).valid, false);
  });

  it("rejects same event with a different location", () => {
    const a = passage({
      title: "Blocked Exit North",
      scenarioCategory: "blocked emergency exit",
      scenarioSummary: "Parts block the north exit.",
      centralEvent: "Parts stacked in front of emergency exit",
      mainProblem: "Exit path obstructed",
      consequence: "Evacuation would be delayed",
      requiredResponse: "Clear the exit immediately",
      setting: "north workshop exit",
      passageText: "Heavy parts are stacked in front of the emergency exit door.",
    });
    const b = passage({
      title: "Blocked Exit South",
      scenarioCategory: "blocked emergency exit",
      scenarioSummary: "Parts block the south exit.",
      centralEvent: "Parts stacked in front of emergency exit",
      mainProblem: "Exit path obstructed",
      consequence: "Evacuation would be delayed",
      requiredResponse: "Clear the exit immediately",
      setting: "south workshop exit",
      passageText: "Heavy parts are stacked in front of the emergency exit door.",
    });
    assert.equal(validatePassageAgainstSet(b, [a], []).valid, false);
  });

  it("rejects same mathematical shopping problem with different prices and names", () => {
    const a = passage({
      title: "Kai's Discount",
      scenarioCategory: "shopping discount",
      scenarioSummary: "Kai compares an original price and a percent discount.",
      centralEvent: "Shopper calculates sale price from original price",
      mainProblem: "Confusing discount percent with final total",
      consequence: "Wrong amount paid at checkout",
      requiredResponse: "Compute discount then subtract from original",
      perspective: "shopper",
      setting: "supermarket",
      passageText:
        "Kai sees a shirt priced at $40 with a 25 percent discount and must find the sale total.",
      vocabularyTermsUsed: ["percentage", "discount", "original price", "total"],
    });
    const b = passage({
      title: "Marissa's Discount",
      scenarioCategory: "shopping discount",
      scenarioSummary: "Marissa compares an original price and a percent discount.",
      centralEvent: "Shopper calculates sale price from original price",
      mainProblem: "Confusing discount percent with final total",
      consequence: "Wrong amount paid at checkout",
      requiredResponse: "Compute discount then subtract from original",
      perspective: "shopper",
      setting: "clothing store",
      passageText:
        "Marissa sees a jacket priced at $80 with a 30 percent discount and must find the sale total.",
      vocabularyTermsUsed: ["percentage", "discount", "original price", "total"],
    });
    assert.equal(
      validatePassageAgainstSet(b, [a], ["percentage", "discount", "original price", "total"])
        .valid,
      false,
    );
  });

  it("accepts oil spill versus vehicle lifting", () => {
    const a = passage({
      title: "Oil on the Walkway",
      scenarioCategory: "workshop spill",
      scenarioSummary: "A leaking container creates a slip hazard.",
      centralEvent: "Oil leaks onto walkway",
      mainProblem: "Spill left across walking path",
      consequence: "Someone could slip",
      requiredResponse: "Isolate spill and clean",
      setting: "service bay walkway",
      passageText: "A leaking oil container spreads across the walkway beside bay three.",
    });
    const b = passage({
      title: "Unsupported Lift",
      scenarioCategory: "vehicle lifting",
      scenarioSummary: "A vehicle is raised without jack stands.",
      centralEvent: "Vehicle raised on jack only",
      mainProblem: "Missing jack stands under vehicle",
      consequence: "Crush risk if jack fails",
      requiredResponse: "Install jack stands before working underneath",
      setting: "lift bay",
      passageText:
        "A vehicle is supported only by a jack while a learner removes a wheel.",
    });
    assert.equal(validatePassageAgainstSet(b, [a], ["hazard", "ppe"]).valid, true);
  });

  it("accepts battery servicing versus blocked walkway", () => {
    const a = passage({
      title: "Battery Service",
      scenarioCategory: "battery servicing",
      scenarioSummary: "A learner handles a battery without eye protection.",
      centralEvent: "Battery acid risk during removal",
      mainProblem: "Missing eye protection near battery",
      consequence: "Chemical splash risk",
      requiredResponse: "Wear PPE and stabilize battery",
      setting: "battery bench",
      passageText: "During battery removal, acid splash risk appears near the bench.",
    });
    const b = passage({
      title: "Hose Across Path",
      scenarioCategory: "blocked walkway",
      scenarioSummary: "An air hose is left across a walkway.",
      centralEvent: "Air hose stretched across aisle",
      mainProblem: "Trip hazard from hose",
      consequence: "Someone could fall",
      requiredResponse: "Coil hose and clear aisle",
      setting: "main aisle",
      passageText: "An air hose is stretched across the main aisle between bays.",
    });
    assert.equal(validatePassageAgainstSet(b, [a], []).valid, true);
  });

  it("accepts budgeting versus survey interpretation", () => {
    const a = passage({
      title: "Trip Budget",
      scenarioCategory: "budget planning",
      scenarioSummary: "Two transport plans are compared with percentages.",
      centralEvent: "Compare bus plan costs",
      mainProblem: "Ignoring percentage discount",
      consequence: "Choosing more expensive plan",
      requiredResponse: "Calculate totals with percent discount",
      setting: "school office",
      passageText: "Two transport plans show different percentage discounts.",
    });
    const b = passage({
      title: "Class Survey",
      scenarioCategory: "survey interpretation",
      scenarioSummary: "Survey votes are converted to percentages.",
      centralEvent: "Convert survey votes to percents",
      mainProblem: "Misreading total responses",
      consequence: "Wrong claim about majority",
      requiredResponse: "Divide votes by total responses",
      setting: "classroom",
      passageText: "After surveying classmates, the group converts votes into percentages.",
    });
    assert.equal(validatePassageAgainstSet(b, [a], ["percentage", "total"]).valid, true);
  });

  it("accepts science experiment versus field observation", () => {
    const a = passage({
      title: "Tank Experiment",
      scenarioCategory: "lab experiment",
      scenarioSummary: "Students measure producer growth under two light levels.",
      centralEvent: "Controlled light experiment on producers",
      mainProblem: "Unequal water volume between tanks",
      consequence: "Unfair comparison of growth",
      requiredResponse: "Control variables before concluding",
      setting: "school laboratory",
      passageText: "Two tanks of producers are grown under different light levels.",
    });
    const b = passage({
      title: "Pond Observation",
      scenarioCategory: "field observation",
      scenarioSummary: "Students observe consumers near a pond ecosystem.",
      centralEvent: "Observe feeding links at a pond",
      mainProblem: "Assuming every large animal is a producer",
      consequence: "Incorrect food-chain diagram",
      requiredResponse: "Record evidence of who eats whom",
      setting: "community pond",
      passageText: "At the pond, students watch consumers hunting near reeds.",
    });
    assert.equal(
      validatePassageAgainstSet(b, [a], ["producer", "consumer", "ecosystem"]).valid,
      true,
    );
  });

  it("accepts historical diary versus newspaper report", () => {
    const a = passage({
      title: "Diary Crossing",
      scenarioCategory: "historical diary",
      scenarioSummary: "A migrant records leaving home in a private diary.",
      centralEvent: "Diary entry on departure day",
      mainProblem: "Fear of unknown destination",
      consequence: "Family delays packing",
      requiredResponse: "Weigh push factors against hopes",
      perspective: "first-person diarist",
      setting: "family home 1955",
      passageText: "In my diary I wrote about leaving for the ship tomorrow.",
    });
    const b = passage({
      title: "Harbor News",
      scenarioCategory: "newspaper report",
      scenarioSummary: "A newspaper reports arrivals at the harbor.",
      centralEvent: "Press report of migrant arrivals",
      mainProblem: "Headline overstates conflict on the dock",
      consequence: "Readers misunderstand the event",
      requiredResponse: "Compare headline claims with quoted facts",
      perspective: "reporter",
      setting: "harbor press desk",
      passageText: "The evening paper reported hundreds arriving at the harbor.",
    });
    assert.equal(validatePassageAgainstSet(b, [a], ["migration"]).valid, true);
  });

  it("flags vocabulary-derived candidates against an empty accepted set", () => {
    const candidate = passage({
      title: "Hazard in Practice",
      scenarioCategory: "Hazard",
      passageText: "Students discuss the meaning of hazard.",
    });
    const result = validatePassageAgainstSet(candidate, [], ["Hazard", "PPE"]);
    assert.equal(result.valid, false);
    assert.ok(result.reasons.some((reason) => /vocabulary-derived/i.test(reason)));
  });

  it("validatePassageDiversity returns ok for empty/single sets", () => {
    assert.equal(validatePassageDiversity([]).ok, true);
    assert.equal(
      validatePassageDiversity([
        passage({ title: "Only", passageText: "One passage only." }),
      ]).ok,
      true,
    );
  });

  it("findDuplicatePassages returns fingerprint similarity field", () => {
    const duplicates = findDuplicatePassages([
      passage({
        title: "A",
        scenarioCategory: "x",
        centralEvent: "same event details here",
        mainProblem: "same problem details here",
        consequence: "same consequence details",
        requiredResponse: "same response details",
        perspective: "same view",
        setting: "same place",
        scenarioSummary: "same summary text",
        passageText: "same passage body with enough shared tokens for a match",
      }),
      passage({
        title: "B",
        scenarioCategory: "x",
        centralEvent: "same event details here",
        mainProblem: "same problem details here",
        consequence: "same consequence details",
        requiredResponse: "same response details",
        perspective: "same view",
        setting: "same place",
        scenarioSummary: "same summary text",
        passageText: "same passage body with enough shared tokens for a match",
      }),
    ]);
    assert.ok(duplicates.length >= 1);
    assert.ok(typeof duplicates[0]?.fingerprintSimilarity === "number");
  });
});
