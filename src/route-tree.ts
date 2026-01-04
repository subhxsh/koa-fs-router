import * as path from "path";

type StaticNode = {
  param?: never;
  optional?: never;
  filePath?: string;
  children?: Children;
};

type DynamicNode = {
  param: string;
  optional?: never;
  filePath?: string;
  children?: Children;
};

type CatchAllNode = {
  param: string;
  optional: boolean;
  filePath: string;
  children?: never;
};

type AnyNode = StaticNode | DynamicNode | CatchAllNode;

type Children = {
  static?: Record<string, StaticNode>;
  dynamic?: DynamicNode;
  catchAll?: CatchAllNode;
};

export const createRouteTree = () => {
  const rootNode: StaticNode = {};

  const fmtDynamic = (node: { param: string }) => `[${node.param}]`;
  const fmtCatchAll = (node: { param: string; optional: boolean }) => {
    const count = node.optional ? 2 : 1;
    return `${"[".repeat(count)}...${node.param}${"]".repeat(count)}`;
  };

  const insert = (relativePath: string) => {
    let currentNode: AnyNode = rootNode;

    const segments = path
      .join(
        path.dirname(relativePath),
        path.basename(relativePath, path.extname(relativePath)),
      )
      .split(path.sep);

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      const isLast = i === segments.length - 1;
      const hasParam = segment.startsWith("[") && segment.endsWith("]");

      if (hasParam) {
        let param = segment.slice(1, -1);

        const optional = param.startsWith("[") && param.endsWith("]");
        if (optional) param = param.slice(1, -1);

        const catchAll = param.startsWith("...");
        if (catchAll) {
          param = param.slice(3);

          if (!isLast)
            throw new Error(
              `Catch-all segment ${segment} in '${relativePath}' must be the last part of the URL`,
            );

          if (!currentNode.children) currentNode.children = {};
          if (currentNode.children.dynamic)
            throw new Error(
              `Catch-all segment ${segment} in '${relativePath}' cannot exist with a dynamic segment ${fmtDynamic(currentNode.children.dynamic)} on the same level`,
            );

          if (currentNode.children.catchAll)
            throw new Error(
              `Catch-all segment ${segment} in '${relativePath}' cannot exist with another catch-all segment ${fmtCatchAll(currentNode.children.catchAll)} on the same level`,
            );

          currentNode = currentNode.children.catchAll = {
            param,
            optional,
            filePath: relativePath,
          };
        } else {
          if (optional)
            throw new Error(
              `Dynamic segment ${segment} in '${relativePath}' cannot be optional`,
            );

          if (!currentNode.children) currentNode.children = {};
          if (currentNode.children.catchAll)
            throw new Error(
              `Dynamic segment ${segment} in '${relativePath}' cannot exist with a catch-all segment ${fmtCatchAll(currentNode.children.catchAll)} on the same level`,
            );

          if (
            currentNode.children.dynamic &&
            currentNode.children.dynamic.param !== param
          )
            throw new Error(
              `Dynamic segment ${segment} in '${relativePath}' uses a different parameter name than ${fmtDynamic(currentNode.children.dynamic)}`,
            );

          if (isLast && currentNode.children.dynamic?.filePath)
            throw new Error(
              `Dynamic segment ${segment} in '${relativePath}' cannot exist with another dynamic segment ${fmtDynamic(currentNode.children.dynamic)} on the same level`,
            );

          if (!currentNode.children.dynamic)
            currentNode.children.dynamic = { param };

          if (isLast) currentNode.children.dynamic.filePath = relativePath;
          currentNode = currentNode.children.dynamic;
        }
      } else {
        if (isLast && segment === "index") {
          if (currentNode.filePath)
            throw new Error(
              `Static segment '${segment}' in '${relativePath}' conflicts with '${currentNode.filePath}'`,
            );
          currentNode.filePath = relativePath;
          return;
        }

        if (!currentNode.children) currentNode.children = {};
        if (!currentNode.children.static) currentNode.children.static = {};

        if (isLast && currentNode.children.static[segment]?.filePath)
          throw new Error(
            `Static segment '${segment}' in '${relativePath}' conflicts with ${currentNode.children.static[segment].filePath}`,
          );

        if (!currentNode.children.static[segment])
          currentNode.children.static[segment] = {};

        if (isLast)
          currentNode.children.static[segment]!.filePath = relativePath;
        currentNode = currentNode.children.static[segment]!;
      }
    }
  };

  const match = (path: string) => {
    let currentNode: AnyNode = rootNode;

    const segments = path.split("/").filter(Boolean);
    const params: Record<string, string | string[]> = {};

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;

      if (!currentNode.children) return;

      if (currentNode.children.static?.[segment]) {
        currentNode = currentNode.children.static[segment];
        continue;
      }

      if (currentNode.children.dynamic) {
        params[currentNode.children.dynamic.param] = segment;
        currentNode = currentNode.children.dynamic;
        continue;
      }

      if (currentNode.children.catchAll) {
        params[currentNode.children.catchAll.param] = segments.slice(i);
        currentNode = currentNode.children.catchAll;
        break;
      }

      return;
    }

    if (!currentNode.filePath && currentNode.children?.catchAll?.optional) {
      params[currentNode.children.catchAll.param] = [];
      currentNode = currentNode.children.catchAll;
    }

    if (currentNode.filePath)
      return {
        params,
        filePath: currentNode.filePath,
      };

    return;
  };

  return {
    insert,
    match,
  };
};
