import type {
  AutomationMap,
  DiscoveredProjectTest,
  MatchMethod,
  MatchedProjectTest,
  UatFunctionCoverage,
  CoverageGap,
  AutomationFunctionRule,
} from "./types.js";

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[\\/_-]+/g, " ").split(/\s+/).filter(Boolean));
}

function functionNumber(value: string): string | undefined {
  const match = value.match(/(?:FN|TC|TS)-STS-(\d{2})/i);
  return match ? `FN-STS-${match[1]}` : undefined;
}

function countKeywordMatches(text: Set<string>, keywords: string[]): number {
  return keywords.reduce(
    (count, keyword) => count + ([...tokens(keyword)].every((token) => text.has(token)) ? 1 : 0),
    0,
  );
}

function scoreTest(test: DiscoveredProjectTest, rule: AutomationFunctionRule, explicitFunctionId?: string) {
  const methods: MatchMethod[] = [];
  let score = 0;
  const sourceFunctionIds = test.sourceIds.map(functionNumber).filter(Boolean) as string[];
  const pathText = tokens(test.relativePath);
  const titleText = tokens(test.title);
  const sourceText = tokens(test.searchText);

  if (explicitFunctionId === rule.id) {
    score = 100;
    methods.push("explicit");
  } else if (sourceFunctionIds.includes(rule.id)) {
    score = 90;
    methods.push("source-id");
  }

  const pathMatches = countKeywordMatches(pathText, rule.keywords);
  const titleMatches = countKeywordMatches(titleText, rule.keywords);
  const sourceMatches = Math.min(countKeywordMatches(sourceText, rule.keywords), 3);
  if (pathMatches > 0) {
    score += pathMatches * 40;
    methods.push("path");
  }
  if (titleMatches > 0) {
    score += titleMatches * 25;
    methods.push("title");
  }
  if (sourceMatches > 0) {
    score += Math.min(sourceMatches * 10, 30);
    methods.push("keyword");
  }

  return { score, methods };
}

export function matchTestsToUat(
  tests: DiscoveredProjectTest[],
  map: AutomationMap,
): UatFunctionCoverage[] {
  const explicitByPath = new Map(map.explicitMappings.map((item) => [item.path.replace(/\\/g, "/"), item.functionId]));
  const functions = map.functions.map((rule) => ({
    id: rule.id,
    name: rule.name,
    tests: [] as MatchedProjectTest[],
    gaps: [] as CoverageGap[],
  }));

  for (const test of tests) {
    const candidates = map.functions
      .map((rule, order) => {
        const result = scoreTest(test, rule, explicitByPath.get(test.relativePath));
        return { rule, order, ...result };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score || a.order - b.order);

    const best = candidates[0];
    if (!best) continue;
    const functionGroup = functions.find((group) => group.id === best.rule.id);
    if (!functionGroup) continue;
    functionGroup.tests.push({
      ...test,
      functionId: best.rule.id,
      functionName: best.rule.name,
      matchedBy: best.methods,
      confidence: best.score >= 80 ? "high" : best.score >= 40 ? "medium" : "low",
      score: best.score,
    });
  }

  for (const target of map.coverageTargets) {
    const group = functions.find((item) => item.id === target.functionId);
    if (!group) continue;
    const targetCovered = group.tests.some((test) =>
      test.sourceIds.some((sourceId) => sourceId.toLowerCase() === target.id.toLowerCase()),
    );
    if (!targetCovered) {
      group.gaps.push({
        targetId: target.id,
        functionId: target.functionId,
        title: target.title,
        status: target.recipeId ? "ready-to-generate" : target.automation === "unsupported" ? "unsupported" : "missing-recipe",
        recipeId: target.recipeId,
      });
    }
  }

  return functions;
}
