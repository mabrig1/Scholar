import test from "node:test";import assert from "node:assert/strict";
import {readiness,canTransition,type SubmissionChecklist} from "../src/lib/submission-workspace";
test("incomplete submission is not ready",()=>{const x={} as SubmissionChecklist;assert.equal(readiness(x).ready,false);});
test("submission requires all checklist entries",()=>{const x={originalityConfirmed:true,allAuthorsApproved:true,ethicsStatement:true,conflictsDeclared:true,fundingDeclared:true,guidelinesReviewed:true,indexingVerified:true,feesConfirmed:true};assert.equal(readiness(x).ready,true);});
test("cannot publish directly from draft",()=>assert.equal(canTransition("draft","published"),false));
test("revision may be resubmitted",()=>assert.equal(canTransition("revision_requested","submitted"),true));
