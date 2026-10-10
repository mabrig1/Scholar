import test from "node:test";import assert from "node:assert/strict";
import {isISSN} from "../src/lib/journalguard";
test("CINEFORUM ISSN checksum",()=>assert.equal(isISSN("0009-7039"),true));
test("reject invalid ISSN",()=>assert.equal(isISSN("0009-7038"),false));
test("reject malformed ISSN",()=>assert.equal(isISSN("abcd"),false));
