import test from "node:test";import assert from "node:assert/strict";
import {submitSitemap} from "../src/lib/search-console";
test("rejects non-HTTPS sitemap without network request",async()=>{await assert.rejects(submitSitemap("token","https://example.org","http://example.org/sitemap.xml"));});
test("rejects unrelated sitemap host",async()=>{await assert.rejects(submitSitemap("token","https://example.org","https://evil.org/sitemap.xml"));});
