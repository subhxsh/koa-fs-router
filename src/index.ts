import type { Middleware } from "koa";
import { readdirSync } from "node:fs";
import * as path from "path";
import { allowedExtensions, ignoredExtensions } from "./config.ts";
import { createRouteTree } from "./route-tree.ts";
import { getAvailableMethods, getFunctionName } from "./utils.ts";

export const fsRouter = (root: string): Middleware => {
  const dirents = readdirSync(root, {
    withFileTypes: true,
    recursive: true,
  });

  const tree = createRouteTree();

  for (const dirent of dirents) {
    if (
      dirent.isFile() &&
      !ignoredExtensions.some((ext) => dirent.name.endsWith(ext)) &&
      allowedExtensions.some((ext) => dirent.name.endsWith(ext))
    )
      tree.insert(
        path.relative(root, path.join(dirent.parentPath, dirent.name)),
      );
  }

  return async (ctx, next) => {
    const match = tree.match(ctx.path);
    if (!match) return next();

    const module: Record<string | symbol, unknown> = await import(
      path.resolve(root, match.filePath)
    );

    const fnName = getFunctionName(ctx.method);
    const fn = module[fnName];

    if (fn && typeof fn === "function")
      return fn(Object.assign(ctx, { params: match.params }), next);

    ctx.status = 405;
    ctx.set("Allow", getAvailableMethods(module));
  };
};
