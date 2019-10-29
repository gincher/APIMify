import { Express, Router } from "express";
import { OperationContract } from "@azure/arm-apimanagement/esm/models";

/**
 * Converts Express app or router to AMS
 */
export class ExpressToAMS {
  private operationIdCount = 0;
  private endpoints: Endpoints = {};

  constructor(private express: Express | Router) {}

  private loopLayers(
    express: Express | Router,
    basePath: string = "",
    endpoints: Endpoint[] = []
  ) {
    const stack: Layer[] =
      "_router" in express ? express._router.stack : express.stack;

    stack.forEach(stackItem => {
      if (stackItem.route) {
        const endpoint = parseExpressRoute(stackItem.route, basePath);

        endpoints = this.addEndpoint(endpoints, endpoint);
      } else if (
        stackItem.name === "router" ||
        stackItem.name === "bound dispatch"
      ) {
        const parsedPath = parseExpressPath(stackItem.regexp, stackItem.keys);

        this.loopLayers(
          stackItem.handle as Router,
          basePath + "/" + parsedPath,
          endpoints
        );
      }
    });

    return endpoints;
  }

  /**
   * Ensures the path of the new endpoint isn't yet in the object.
   * If the path is already in the object merges the endpoint with the existing
   * one, if not, it adds it to the object. It generates operationId and displayName.
   * @param path - Full path for the endpoint
   * @param method - HTTP verb
   * @param endpoint - endpoint information
   */
  private addEndpoint(path: string, method: Methods, endpoint?: Endpoint) {
    if (!this.endpoints[path]) this.endpoints[path] = {};

    const { urlTemplate, templateParameters } = this.getParams(path);
    const operationId = this.generateOperationId(path, method);
    const displayName = this.generateOperationName(path, method);

    this.endpoints[path][method] = {
      operationId,
      displayName,
      method,
      urlTemplate,
      templateParameters,
      ...(this.endpoints[path][method] || {}),
      ...(endpoint || {})
    };
  }

  /**
   * Looks for params, changes it to match the way AMS stores params in URL
   * and generates templateParameters object
   * @param path - full path to look for params
   */
  private getParams(path: string) {
    const templateParameters: Endpoint["templateParameters"] = [];

    const urlTemplate = this.trimSlash(path)
      .split("/")
      // What's going on?
      .map(subPath =>
        subPath
          .split("-")
          // Can it go even deeper?
          .map(subSubPath =>
            subSubPath
              .split(".")
              // You bet it can!
              .map(pathPart => {
                // if has regex or starts with :
                // I'll consider it as a param
                const regexToCheckIfRegex = /[\:\?\+\*\(\)]/g;
                if (regexToCheckIfRegex.test(pathPart)) {
                  // Remove all regexy stuff.
                  pathPart = pathPart.replace(regexToCheckIfRegex, "");

                  // If param name is 2 or less chars, or if param with same name
                  // exists, add one more digit.
                  if (
                    pathPart.length <= 2 ||
                    templateParameters.find(param => param.name === pathPart)
                  )
                    pathPart = `${pathPart}P${++this.operationIdCount}`;

                  templateParameters.push({
                    name: pathPart,
                    required: true,
                    type: "string"
                  });

                  // Convert to AMS path param
                  pathPart = `{${pathPart}}`;
                }
                return pathPart;
              })
              .join(".")
          )
          .join("-")
      )
      .join("/");

    return { urlTemplate, templateParameters };
  }

  /**
   * Generates unique operation ID
   * @param path - Operation path
   * @param method - Operation method
   */
  private generateOperationId(path: string, method: Methods) {
    path = this.trimSlash(path)
      .trim()
      .toLowerCase()
      .replace(/\/$|^\//g, "-");

    return `${path}-${method}-${++this.operationIdCount}`;
  }

  /**
   * Generates semi-understandable name for the operation
   * @param path - Operation path
   * @param method - Operation method
   */
  private generateOperationName(path: string, method: Methods) {
    path = this.trimSlash(path)
      .split(" ")
      .map(t => this.capitalize(t))
      .join(" ");
    method = this.capitalize(method) as Methods;

    return `${method} ${path}`;
  }

  /**
   * Capitalizes first letter
   * @param str - string to capitalize
   */
  private capitalize(str: string) {
    const [c, ...e] = str;
    return `${c.toUpperCase()}${e.join("").toLowerCase()}`;
  }

  /**
   * Remove leading and trialing slash
   * @param str - string to trim slashes
   */
  private trimSlash(str: string) {
    return str.trim().replace(/\/$|^\//g, " ");
  }
}

type Methods = "get" | "post" | "put" | "delete" | "patch" | "options" | "head";

interface Key {
  name: string;
  optional: boolean;
  offset: number;
}

interface Route {
  path: string;
  stack: Layer[];
  methods: { [key in Methods]?: boolean };
}

interface Layer {
  handle: Function | Router;
  name: "expressInit" | "query" | "bound dispatch" | "router" | "<anonymous>";
  params: undefined;
  path: undefined;
  keys: Key[];
  regexp: RegExp;
  route?: Route;
  method?: Methods;
}

interface Endpoint extends OperationContract {
  /** Operation identifier within an API. Must be unique in the current API Management service instance. */
  operationId: string;
}

interface Endpoints {
  [path: string]: {
    [method in Methods]?: Endpoint;
  };
}
