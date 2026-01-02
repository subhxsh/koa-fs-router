import type { Middleware } from "koa";
import { readdirSync } from "node:fs";
import * as path from "path";
import { allowedExtensions, ignoredExtensions } from "./config.ts";
import { RouteTree } from "./route-tree.ts";

export const fsRouter = (root: string): Middleware => {
  const dirents = readdirSync(root, {
    withFileTypes: true,
    recursive: true,
  });

  const tree = new RouteTree();

  for (const dirent of dirents) {
    if (
      dirent.isFile() &&
      !ignoredExtensions.some((ext) => dirent.name.endsWith(ext)) &&
      allowedExtensions.some((ext) => dirent.name.endsWith(ext))
    ) {
      tree.insert(
        path.relative(root, path.join(dirent.parentPath, dirent.name)),
      );
    }
  }

  // TODO: Complete this
  // @ts-ignore
  return async (ctx, next) => {};
};
