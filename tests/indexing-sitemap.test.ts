import test from "node:test";import assert from "node:assert/strict";
import {buildSitemap} from "../src/lib/indexing-sitemap";
test("generates valid sitemap structure",()=>assert.match(buildSitemap([{url:"https://example.org/article"}],"https://example.org"),/<urlset/));
test("blocks external URLs",()=>assert.throws(()=>buildSitemap([{url:"https://evil.org/article"}],"https://example.org")));
test("deduplicates entries",()=>{const s=buildSitemap([{url:"https://example.org/a"},{url:"https://example.org/a"}],"https://example.org");assert.equal((s.match(/<loc>/g)||[]).length,1);});
test("escapes ampersands in XML",()=>assert.match(buildSitemap([{url:"https://example.org/a?x=1&y=2"}],"https://example.org"),/&amp;/));
