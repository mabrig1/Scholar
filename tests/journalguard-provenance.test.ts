import test from "node:test";import assert from "node:assert/strict";
import {assessPublisherProvenance} from "../src/lib/journalguard-v3";
test("unknown publisher domain is not treated as verified",()=>{const r=assessPublisherProvenance({website:"https://example.org"});assert.ok(r.some(x=>x.code==="OWNERSHIP_UNVERIFIED"));});
test("different publisher domain triggers manual review",()=>{const r=assessPublisherProvenance({website:"https://other.example",issn:"0009-7039"},["publisher.example"]);assert.ok(r.some(x=>x.code==="DOMAIN_MISMATCH"));});
test("subdomain of trusted publisher is permitted",()=>{const r=assessPublisherProvenance({website:"https://journals.publisher.example"},["publisher.example"]);assert.ok(!r.some(x=>x.code==="DOMAIN_MISMATCH"));});
test("suffix lookalike cannot pass",()=>{const r=assessPublisherProvenance({website:"https://fakepublisher.example"},["publisher.example"]);assert.ok(r.some(x=>x.code==="DOMAIN_MISMATCH"));});
