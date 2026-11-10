import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeZoteroDoi, parseZoteroPublicRequest,
  zoteroPublicItemsUrl, parseZoteroPublicItems,
} from "../packages/evidence-atlas-core/src/zotero-public";

function query(search: string) { return new URLSearchParams(search); }
function entry(key: string, doi: string, title: string, itemType = "journalArticle") {
  return {
    key,
    data: {
      DOI: doi, title, itemType, date: "2025", creators: [{ firstName: "Ada", lastName: "Okoro" }],
    },
    links: { alternate: { href: "https://www.zotero.org/groups/111/items/" + key } },
  };
}
test("only allows fixed Zotero public-library routes", () => {
  const user = parseZoteroPublicRequest(query("type=users&id=475425"));
  assert.equal(zoteroPublicItemsUrl(user), "https://api.zotero.org/users/475425/items/top?format=json&limit=20&start=0");
  const group = parseZoteroPublicRequest(query("type=groups&id=123&collection=9KH9TNSJ"));
  assert.equal(new URL(zoteroPublicItemsUrl(group)).pathname, "/groups/123/collections/9KH9TNSJ/items/top");
  for (const q of [
    "type=users&id=0", "type=groups&id=../../etc/passwd", "type=anything&id=123",
    "type=users&id=123&collection=x", "type=users&id=1.5",
    "type=users&id=9999999999999999999999999",
  ]) assert.throws(() => parseZoteroPublicRequest(query(q)), /Select|numeric|Collection/);
});

test("only DOI-bearing supported items survive, duplicates and unsafe URLs are filtered", () => {
  const items = [
    entry("9KH9TNSJ", "https://doi.org/10.1000/ABC.1", "An empirical study"),
    entry("9KH9TNSK", "10.1000/abc.1", "A duplicate"),
    entry("9KH9TNSL", "", "Without DOI"),
    entry("9KH9TNSM", "10.4000/book.2", "An attachment", "attachment"),
    { ...entry("9KH9TNSN", "10.5000/report.3", "A report", "report"),
      links: { alternate: { href: "https://evil.example/steal" } } },
  ];
  const data = parseZoteroPublicItems(items);
  assert.equal(data.items.length, 2);
  assert.equal(data.skipped, 3);
  assert.equal(data.items[0].doi, "10.1000/abc.1");
  assert.equal(data.items[0].creators[0], "Ada Okoro");
  assert.ok(data.items[0].zoteroUrl.startsWith("https://www.zotero.org"));
  assert.equal(data.items[1].zoteroUrl, "");
  assert.equal(normalizeZoteroDoi("https://doi.org/10.1000/ABC.1"), "10.1000/abc.1");
  assert.equal(normalizeZoteroDoi("javascript:alert(1)"), "");
});

test("limits memory and rejects non-array provider payload", () => {
  assert.throws(() => parseZoteroPublicItems({error: "auth"}), /Unexpected/);
  const many = Array.from({ length: 50 }, (_, i) => entry(
    "9KH" + String(i).padStart(5, "0"), "10.2000/article-" + i, "Paper " + i));
  const data = parseZoteroPublicItems(many);
  assert.equal(data.items.length, 20);
});
