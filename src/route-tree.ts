import * as path from "path";

type StaticNode = {
  param?: never;
  optional?: never;
  filePath?: string;
  children?: Children;
};

type DynamicNode = {
  param: string;
  optional: boolean;
  filePath?: string;
  children?: Children;
};

type WildcardNode = {
  param: string;
  optional: boolean;
  filePath: string;
  children?: never;
};

type AnyNode = StaticNode | DynamicNode | WildcardNode;

type Children = {
  static?: Record<string, StaticNode>;
  dynamic?: DynamicNode;
  wildcard?: WildcardNode;
};

export const createRouteTree = () => {
  const rootNode: StaticNode = {};

  const fmt = (
    node: { param: string; optional: boolean },
    wildcard = false,
  ) => {
    const count = node.optional ? 2 : 1;
    return `${"[".repeat(count)}${wildcard ? `...${node.param}` : node.param}${"]".repeat(count)}`;
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

        const wildcard = param.startsWith("...");
        if (wildcard) {
          param = param.slice(3);

          if (!isLast)
            throw new Error(
              `${segment} in '${relativePath}' must be the last part of the URL`,
            );

          if (!currentNode.children) currentNode.children = {};
          if (currentNode.children.dynamic)
            throw new Error(
              `${segment} in '${relativePath}' conflicts with ${fmt(currentNode.children.dynamic)}`,
            );

          if (currentNode.children.wildcard)
            throw new Error(
              `${segment} in '${relativePath}' conflicts with ${fmt(currentNode.children.wildcard, true)}`,
            );

          currentNode = currentNode.children.wildcard = {
            param,
            optional,
            filePath: relativePath,
          };
        } else {
          if (!currentNode.children) currentNode.children = {};
          if (currentNode.children.wildcard)
            throw new Error(
              `${segment} in '${relativePath}' conflicts with ${fmt(currentNode.children.wildcard, true)}`,
            );

          if (
            currentNode.children.dynamic &&
            (currentNode.children.dynamic.param !== param ||
              currentNode.children.dynamic.optional !== optional)
          )
            throw new Error(
              `${segment} in '${relativePath}' has different specificity than ${fmt(currentNode.children.dynamic)}`,
            );

          if (isLast && currentNode.children.dynamic?.filePath)
            throw new Error(
              `${segment} in '${relativePath}' conflicts with ${fmt(currentNode.children.dynamic)}`,
            );

          if (!currentNode.children.dynamic)
            currentNode.children.dynamic = { param, optional };

          if (isLast) currentNode.children.dynamic.filePath = relativePath;
          currentNode = currentNode.children.dynamic;
        }
      } else {
        if (isLast && segment === "index") {
          if (currentNode.filePath)
            throw new Error(
              `'${segment}' in '${relativePath}' conflicts with '${currentNode.filePath}'`,
            );
          currentNode.filePath = relativePath;
          return;
        }

        if (!currentNode.children) currentNode.children = {};
        if (!currentNode.children.static) currentNode.children.static = {};

        if (isLast && currentNode.children.static[segment]?.filePath)
          throw new Error(
            `'${segment}' in '${relativePath}' conflicts with '${currentNode.children.static[segment].filePath}'`,
          );

        if (!currentNode.children.static[segment])
          currentNode.children.static[segment] = {};

        if (isLast)
          currentNode.children.static[segment]!.filePath = relativePath;
        currentNode = currentNode.children.static[segment]!;
      }
    }
  };

  return { insert };
};
