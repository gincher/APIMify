import { begin } from 'xmlbuilder';
import { RequestHandler } from 'express';
import { EndpointWithPolicyObj } from './express-to-ams';

/**
 * Abstract class to extend the Policy class and the Metadata class
 */
export abstract class Endpoint {
  /** list of used policies */
  protected static endpoints: (Endpoint)[] = [];

  /** the fake express middleware */
  protected func: RequestHandler;

  /**
   * Creates a middleware
   */
  constructor() {
    this.func = (req, res, next) => next();
    Object.defineProperty(this.func, 'name', { value: 'AMSEndpoint' });
  }

  /**
   * Compares function to the endpoints. Works by comparing pointers,
   * so even if the functions are the same, they have different pointers
   * @param func - middleware function
   */
  public compare(func: RequestHandler) {
    return func === this.func;
  }

  /**
   * Looks for a middleware in the stored endpoints
   * @param func - middleware function
   */
  public static find(func: RequestHandler) {
    return Endpoint.endpoints.find(endpoint => endpoint.compare(func));
  }

  /**
   * Marges list of endpoints to a single endpoint. Will override
   * information if necessary, giving superiority to the latest
   * in the list.
   * @param endpoints - list pf endpoints
   */
  public static margeEndpoints(endpoints: Endpoint[]) {
    let finalEndpoint: Partial<EndpointWithPolicyObj> = { policies: {} };

    endpoints.forEach(endpoint => {
      if (endpoint instanceof Metadata) finalEndpoint = { ...finalEndpoint, ...endpoint.endpointMetadata };
      if (endpoint instanceof Policy)
        finalEndpoint.policies[endpoint.location] = [
          ...(finalEndpoint.policies[endpoint.location] || []),
          endpoint.xml
        ];
    });

    return finalEndpoint;
  }
}

/**
 * Metadata class to manually change the endpoint properties
 */
export class Metadata extends Endpoint {
  /** Endpoint's metadata */
  public endpointMetadata: EndpointMetadata;

  /**
   * Create a metadata
   * @param endpointMetadata - Endpoint's metadata
   */
  private constructor(metadata: EndpointMetadata) {
    super();

    this.endpointMetadata = metadata;

    Endpoint.endpoints.push(this);
  }

  /**
   * Create a metadata and returns it's express middleware
   * @param endpointMetadata - Endpoint's metadata
   */
  public static set(endpointMetadata: EndpointMetadata) {
    const metadata = new Metadata(endpointMetadata);
    return metadata.func;
  }
}

/**
 * Policy class to append XML policy to the endpoint
 */
export class Policy extends Endpoint {
  /** The XML to append */
  public xml: string;
  /** Where to place the policy */
  public location: Location;

  /**
   * Create a policy
   * @param xml - The XML to append
   * @param location - `inbound`: statements to be applied to the request.
   *                   `backend`: statements to be applied before the request is forwarded to the backend service.
   *                   `outbound`: statements to be applied to the response.
   *                   `on-error`: statements to be applied if there is an error condition.
   */
  private constructor(xml: string, location: Location) {
    super();

    this.xml = xml;
    this.location = location;

    Endpoint.endpoints.push(this);
  }

  /**
   * Create a policy and returns it's express middleware
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
   * Convert policies object to an XML
   * @param policies - policies object
   */
  public static toXML(policies: EndpointWithPolicyObj['policies']) {
    return `
      <policies>
        <inbound>
          ${(policies && policies['inbound'].join('\n          ')) || ''}
          <base />
        </inbound>
        <backend>
          ${(policies && policies['backend'].join('\n          ')) || ''}
          <base />
        </backend>
        <outbound>
          ${(policies && policies['outbound'].join('\n          ')) || ''}
          <base />
        </outbound>
        <on-error>
          ${(policies && policies['on-error'].join('\n          ')) || ''}
          <base />
        </on-error>
      </policies>
    `;
  }
}

/**
 * `inbound`: statements to be applied to the request.
 * `backend`: statements to be applied before the request is forwarded to the backend service.
 * `outbound`: statements to be applied to the response.
 * `on-error`: statements to be applied if there is an error condition.
 */
export type Location = 'inbound' | 'backend' | 'outbound' | 'on-error';

/**
 * Endpoint's metadata
 */
export type EndpointMetadata = Partial<Omit<EndpointWithPolicyObj, 'policies'>>;
