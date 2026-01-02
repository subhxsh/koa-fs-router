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

type Children = {
  static?: Record<string, StaticNode>;
  dynamic?: DynamicNode;
  wildcard?: WildcardNode;
};

type AnyNode = StaticNode | DynamicNode | WildcardNode;

export class RouteTreeError extends Error {
  path: string;
  constructor(message: string, path: string) {
    super(message);
    this.name = this.constructor.name;
    this.path = path;
  }
}

const fmt = (param: string, optional: boolean, wildcard: boolean) => {
  const count = optional ? 2 : 1;
  const left = "[".repeat(count);
  const right = "]".repeat(count);
  return `${left}${wildcard ? `...${param}` : param}${right}`;
};

export class RouteTree {
  #rootNode: StaticNode = {};

  insert(relativePath: string) {
    let currentNode: AnyNode = this.#rootNode;

    const segments = path
      .join(
        path.dirname(relativePath),
        path.basename(relativePath, path.extname(relativePath)),
      )
      .split(path.sep);

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      const isLast = i === segments.length - 1;

      const notStaticNode = segment.startsWith("[") && segment.endsWith("]");
      if (notStaticNode) {
        let param = segment.slice(1, -1);

        const optional = param.startsWith("[") && param.endsWith("]");
        if (optional) param = param.slice(1, -1);

        const wildcard = param.startsWith("...");
        if (wildcard) {
          param = param.slice(3);

          if (!isLast)
            throw new RouteTreeError(
              `${fmt(param, optional, wildcard)} must be terminating`,
              relativePath,
            );

          if (!currentNode.children) currentNode.children = {};
          if (currentNode.children.dynamic)
            throw new RouteTreeError(
              `${fmt(param, optional, wildcard)} conflicts with existing ${fmt(currentNode.children.dynamic.param, currentNode.children.dynamic.optional, false)}`,
              relativePath,
            );

          if (currentNode.children.wildcard)
            throw new RouteTreeError(
              `${fmt(param, optional, wildcard)} conflicts with existing ${fmt(currentNode.children.wildcard.param, currentNode.children.wildcard.optional, true)}`,
              relativePath,
            );

          currentNode = currentNode.children.wildcard = {
            param,
            optional,
            filePath: relativePath,
          };
        } else {
          if (!currentNode.children) currentNode.children = {};
          if (currentNode.children.wildcard)
            throw new RouteTreeError(
              `${fmt(param, optional, wildcard)} conflicts with existing ${fmt(currentNode.children.wildcard.param, currentNode.children.wildcard.optional, true)}`,
              relativePath,
            );

          if (
            currentNode.children.dynamic &&
            (currentNode.children.dynamic.param !== param ||
              currentNode.children.dynamic.optional !== optional)
          )
            throw new RouteTreeError(
              `${fmt(param, optional, wildcard)} conflicts with existing ${fmt(currentNode.children.dynamic.param, currentNode.children.dynamic.optional, false)} - parameter names and optionality must match`,
              relativePath,
            );

          if (isLast && currentNode.children.dynamic?.filePath)
            throw new RouteTreeError(
              `${fmt(param, optional, wildcard)} conflicts with existing ${fmt(currentNode.children.dynamic.param, currentNode.children.dynamic.optional, false)}`,
              relativePath,
            );

          if (!currentNode.children.dynamic)
            currentNode.children.dynamic = { param, optional };

          if (isLast) currentNode.children.dynamic.filePath = relativePath;
          currentNode = currentNode.children.dynamic;
        }
      } else {
        if (isLast && segment === "index") {
          if (currentNode.filePath)
            throw new RouteTreeError(
              `Route '${segment}' already defined at '${currentNode.filePath}'`,
              relativePath,
            );
          currentNode.filePath = relativePath;
          return;
        }

        if (!currentNode.children) currentNode.children = {};
        if (!currentNode.children.static) currentNode.children.static = {};

        if (isLast && currentNode.children.static[segment]?.filePath)
          throw new RouteTreeError(
            `Route '${segment}' already defined at '${currentNode.children.static[segment].filePath}'`,
            relativePath,
          );

        if (!currentNode.children.static[segment])
          currentNode.children.static[segment] = {};

        if (isLast)
          currentNode.children.static[segment]!.filePath = relativePath;
        currentNode = currentNode.children.static[segment]!;
      }
    }
  }
}
