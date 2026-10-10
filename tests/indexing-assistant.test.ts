import test from "node:test";import assert from "node:assert/strict";
import {citationMetaTags,metadataIssues} from "../src/lib/indexing-assistant";
const record={title:'Research "Article"',authors:["A & B"],publicationDate:"2026-10-10",journal:"Example Journal",landingUrl:"https://example.org/article"};
test("escapes user content in citation tags",()=>assert.match(citationMetaTags(record),/Research &quot;Article&quot;/));
test("requires valid public URL shape",()=>assert.ok(metadataIssues({...record,landingUrl:"http://localhost"}).length>0));
test("outputs citation author metadata",()=>assert.match(citationMetaTags(record),/citation_author/));
