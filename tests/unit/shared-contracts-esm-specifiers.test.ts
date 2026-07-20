import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const sharedContractsSource = join(repositoryRoot, "packages/shared-contracts/src");
const sharedContractsDist = join(repositoryRoot, "packages/shared-contracts/dist");
const explicitRuntimeExtension = /\.(?:cjs|js|json|mjs|node)$/;

function listModuleFiles(directory: string, include: (name: string) => boolean): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listModuleFiles(path, include) : include(entry.name) ? [path] : [];
  });
}

function findExtensionlessRelativeSpecifiersInSource(file: string, contents: string): string[] {
  const offenders: string[] = [];
  const source = ts.createSourceFile(file, contents, ts.ScriptTarget.Latest, true);

  const inspect = (node: ts.Node): void => {
    const literal =
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
        ? node.moduleSpecifier
        : ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments[0] &&
            ts.isStringLiteral(node.arguments[0])
          ? node.arguments[0]
          : undefined;

    if (literal?.text.startsWith(".") && !explicitRuntimeExtension.test(literal.text)) {
      const line = source.getLineAndCharacterOfPosition(literal.getStart(source)).line + 1;
      offenders.push(
        `${relative(repositoryRoot, file).replaceAll("\\", "/")}:${line} -> ${literal.text}`
      );
    }

    ts.forEachChild(node, inspect);
  };

  inspect(source);
  return offenders;
}

function findExtensionlessRelativeSpecifiers(
  directory: string,
  include: (name: string) => boolean
): string[] {
  return listModuleFiles(directory, include).flatMap((file) =>
    findExtensionlessRelativeSpecifiersInSource(file, readFileSync(file, "utf8"))
  );
}

describe("shared-contracts Node ESM specifiers", () => {
  it("detects extensionless static, dynamic, and directory specifiers", () => {
    const fixture = [
      'export * from "./exported";',
      'import value from "./imported";',
      'void import("./directory");',
      'export * from "./valid.js";'
    ].join("\n");

    expect(
      findExtensionlessRelativeSpecifiersInSource(join(repositoryRoot, "fixture.ts"), fixture)
    ).toEqual([
      "fixture.ts:1 -> ./exported",
      "fixture.ts:2 -> ./imported",
      "fixture.ts:3 -> ./directory"
    ]);
  });

  it("uses explicit runtime extensions in source and emitted module graphs", () => {
    expect([
      ...findExtensionlessRelativeSpecifiers(sharedContractsSource, (name) => name.endsWith(".ts")),
      ...findExtensionlessRelativeSpecifiers(
        sharedContractsDist,
        (name) => name.endsWith(".js") || name.endsWith(".d.ts")
      )
    ]).toEqual([]);
  });
});
