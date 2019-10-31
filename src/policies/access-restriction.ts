import { begin } from "xmlbuilder";
import { Policy } from "../endpoint";

/**
 * `check-header` policy:
 * https://docs.microsoft.com/en-us/azure/api-management/api-management-access-restriction-policies#CheckHTTPHeader
 * @param config - Policy config
 * @param location - where to place the policy
 */
export const checkHeader = (
  config: CheckHeaderAttributes,
  location: "inbound" | "outbound" = "inbound"
) => {
  const { value, ...attr } = config;

  const root = begin().element("check-header", {
    ...attr,
    "ignore-case": attr["ignore-case"] ? "True" : "False"
  });
  if (value) value.forEach(v => root.element("value", {}, v));

  const xml = root.end({
    pretty: true
  });

  return Policy.create(xml, location);
};

interface CheckHeaderAttributes {
  /**
   * Allowed HTTP header value. When multiple value elements are specified,
   * the check is considered a success if any one of the values is a match.
   */
  value?: string[];
  /**
   * Error message to return in the HTTP response body if the header doesn't
   * exist or has an invalid value. This message must have any special
   * characters properly escaped.
   */
  "failed-check-error-message": string;
  /**
   * HTTP Status code to return if the header doesn't exist or has an invalid
   * value.
   */
  "failed-check-httpcode": number;
  /**
   * The name of the HTTP Header to check.
   */
  "header-name": string;
  /**
   * If set to True case is ignored when the header value is compared against
   * the set of acceptable values.
   */
  "ignore-case": boolean;
}

/**
 * `rate-limit` policy:
 * https://docs.microsoft.com/en-us/azure/api-management/api-management-access-restriction-policies#LimitCallRate
 * @param config - Policy config
 * @param location - where to place the policy
 */
export const rateLimit = (config: RateLimitAttributes) => {
  const { api, ...attr } = config;

  const root = begin().element("rate-limit", attr);
  if (api)
    api.forEach(a => {
      const { operation, ...attr } = a;
      const apiElem = root.element("api", attr);
      if (operation) operation.forEach(op => apiElem.element("operation", op));
    });

  const xml = root.end({
    pretty: true
  });

  return Policy.create(xml, "inbound");
};

interface CoreRateLimitAttributes {
  /**
   * The maximum total number of calls allowed during the time interval specified
   * in the renewal-period.
   */
  calls: number;
  /**
   * The time period in seconds after which the quota resets.
   */
  "renewal-period": number;
}

interface RateLimitAttributes extends CoreRateLimitAttributes {
  /**
   * Add one or more of these elements to impose a call rate limit on APIs
   * within the product. Product and API call rate limits are applied
   * independently. API can be referenced either via name or id. If both
   * attributes are provided, id will be used and name will be ignored.
   */
  api?: ({
    /**
     * Add one or more of these elements to impose a call rate limit on
     * operations within an API. Product, API, and operation call rate limits
     * are applied independently. Operation can be referenced either via name
     * or id. If both attributes are provided, id will be used and name will
     * be ignored.
     */
    operation: ({
      name?: string;
      id?: string;
    } & CoreRateLimitAttributes)[];

    name?: string;
    id?: string;
  } & CoreRateLimitAttributes)[];
}

/**
 * `check-header` policy:
 * https://docs.microsoft.com/en-us/azure/api-management/api-management-access-restriction-policies#CheckHTTPHeader
 * @param config - Policy config
 * @param location - where to place the policy
 */
export const rateLimitByKey = (config: RateLimitByKeyAttributes) => {
  const root = begin().element("rate-limit-by-key	", {
    ...config,
    "increment-condition": config["increment-condition"] ? "True" : "False"
  });

  const xml = root.end({
    pretty: true
  });

  return Policy.create(xml, "inbound");
};

interface RateLimitByKeyAttributes {
  /**
   * The maximum total number of calls allowed during the time interval specified in the renewal-period.
   */
  calls: string;
  /**
   *     The key to use for the rate limit policy.
   */
  "counter-key": string;
  /**
   * 	The boolean expression specifying if the request should be counted towards the quota (true).
   */
  "increment-condition"?: boolean;
  /**
   * 	The time period in seconds after which the quota resets.
   */
  "renewal-period": string;
}
