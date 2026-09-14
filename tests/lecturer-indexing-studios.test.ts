import assert from "node:assert/strict";
import test from "node:test";
import {
  assessGoogleScholarReadiness,
  assessScopusLecturerReadiness,
} from "../lib/lecturer-indexing-studios";

test("Google Scholar readiness reaches 100 when all technical signals are present", () => {
  const result = assessGoogleScholarReadiness({
    publicProfile: true,
    institutionalEmailVerified: true,
    articleLandingPage: true,
    freeAbstractVisible: true,
    searchablePdf: true,
    oneArticlePerUrl: true,
    scholarMetaTags: true,
    robotsAllowed: true,
    titleAndAuthorsVisible: true,
    referencesPresent: true,
  });

  assert.equal(result.score, 100);
  assert.equal(result.band, "ready");
  assert.equal(result.priorityActions.length, 0);
});

test("Google Scholar readiness flags profile and crawlability gaps", () => {
  const result = assessGoogleScholarReadiness({
    publicProfile: false,
    institutionalEmailVerified: false,
    articleLandingPage: false,
    freeAbstractVisible: false,
    searchablePdf: true,
    oneArticlePerUrl: false,
    scholarMetaTags: false,
    robotsAllowed: false,
    titleAndAuthorsVisible: true,
    referencesPresent: true,
  });

  assert.ok(result.score < 65);
  assert.ok(result.priorityActions.some((item) => /institution/i.test(item)));
  assert.ok(result.priorityActions.some((item) => /Googlebot|landing page|abstract/i.test(item)));
});

test("Scopus readiness prioritizes covered-source verification", () => {
  const result = assessScopusLecturerReadiness({
    hasScopusProfile: true,
    profileHasCorrectName: true,
    profileHasCorrectAffiliation: true,
    duplicateProfilesResolved: true,
    missingIndexedDocumentsResolved: true,
    orcidConnected: true,
    targetJournalCurrentlyCovered: false,
    targetJournalScopeFit: true,
    manuscriptHasEnglishTitleAbstract: true,
    ethicsAndResearchIntegrityReady: true,
  });

  assert.ok(result.score < 100);
  assert.ok(result.priorityActions.some((item) => /Scopus Sources|target journal/i.test(item)));
  assert.match(result.notice, /cannot manually/i);
});

test("Scopus studio can identify a fully ready lecturer pathway", () => {
  const result = assessScopusLecturerReadiness({
    hasScopusProfile: true,
    profileHasCorrectName: true,
    profileHasCorrectAffiliation: true,
    duplicateProfilesResolved: true,
    missingIndexedDocumentsResolved: true,
    orcidConnected: true,
    targetJournalCurrentlyCovered: true,
    targetJournalScopeFit: true,
    manuscriptHasEnglishTitleAbstract: true,
    ethicsAndResearchIntegrityReady: true,
  });

  assert.equal(result.score, 100);
  assert.equal(result.band, "ready");
});
