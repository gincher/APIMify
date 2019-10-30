import { RequestHandler } from "express";

export class Policy {
  public static policies: Policy[] = [];
  public func: RequestHandler;

  /**
   * Create a policy
   * @param xml - The XML to append
   * @param location - `inbound`: statements to be applied to the request.
   *                   `backend`: statements to be applied before the request is forwarded to the backend service.
   *                   `outbound`: statements to be applied to the response.
   *                   `on-error`: statements to be applied if there is an error condition.
   */
  constructor(private xml: string, private location: Location) {
    this.func = (req, res, next) => next();
    Policy.policies.push(this);
  }

  /**
   * Compares function to the policy. Works by comparing pointers,
   * so even if the functions are the same, they have different pointers
   * @param func - middleware function
   */
  public compare(func: RequestHandler) {
    return func === this.func;
  }

  /**
   * Create a policy and returns it's function
   * @param xml - The XML to append
   * @param location - `inbound`: statements to be applied to the request.
   *                   `backend`: statements to be applied before the request is forwarded to the backend service.
   *                   `outbound`: statements to be applied to the response.
   *                   `on-error`: statements to be applied if there is an error condition.
   */
  public static create(xml: string, location: Location) {
    const policy = new Policy(xml, location);
    return policy.func;
  }

  /**
   * Looks for a middleware in the stored policies
   * @param func - middleware function
   */
  public static find(func: RequestHandler) {
    return Policy.policies.find(policy => policy.compare(func));
  }
}

/**
 * `inbound`: statements to be applied to the request.
 * `backend`: statements to be applied before the request is forwarded to the backend service.
 * `outbound`: statements to be applied to the response.
 * `on-error`: statements to be applied if there is an error condition.
 */
export type Location = "inbound" | "backend" | "outbound" | "on-error";
