import assert from "node:assert/strict";
import { buildQuoteCardSvg } from "../services/graphics.js";

const svg = buildQuoteCardSvg({
  quote: "Test quote",
  hook: "Hook",
  brand: {
    primaryColor: "#6366f1",
    secondaryColor: "#0f172a",
    accentColor: "#22c55e",
    fontHeading: "Inter",
    fontBody: "Inter",
    brandName: "ContentFlow",
  },
});

assert.ok(svg.includes("Test quote"));
assert.ok(svg.includes("ContentFlow"));

console.log("graphics.test.ts passed");
