import test from "node:test";import assert from "node:assert/strict";
import {inspectPublicationHtml,validatePublicUrl} from "../src/lib/discovery-agent";
test("extracts Highwire metadata",()=>{const r=inspectPublicationHtml("https://journals.org/p","<title>Paper</title><meta name='citation_title' content='My Paper'><meta name='citation_author' content='Researcher'><meta name='citation_doi' content='10.1000/abc'>");assert.equal(r.doi,"10.1000/abc");assert.equal(r.googleScholar,"not_verified");});
test("flags missing indexing metadata",()=>assert.ok(inspectPublicationHtml("https://journals.org/p","<html></html>").warnings.length>0));
test("blocks private URL hosts",()=>assert.throws(()=>validatePublicUrl("https://127.0.0.1/private")));
