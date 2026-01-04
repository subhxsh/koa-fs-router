import { METHODS } from "http";

export const getFunctionName = (method: string) => {
  switch (method) {
    case "DELETE":
      return "del";
    case "M-SEARCH":
      return "mSearch";
    case "MK-ACTIVITY":
      return "mkActivity";
    case "MK-CALENDAR":
      return "mkCalendar";
    case "MK-COL":
      return "mkCol";
    case "PROPFIND":
      return "propFind";
    case "PROPPATCH":
      return "propPatch";
    default:
      return method.toLowerCase();
  }
};

export const getAvailableMethods = (module: Record<string | symbol, unknown>) =>
  METHODS.filter(
    (method) => typeof module[getFunctionName(method)] === "function",
  );
