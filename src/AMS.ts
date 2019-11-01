import { ApiManagementClient } from '@azure/arm-apimanagement';
import {
  OperationContract,
  TagTagResourceContractProperties,
  OperationTagResourceContractProperties,
  ApiContract
} from '@azure/arm-apimanagement/esm/models';
import { Endpoints, ExpressToAMS } from './express-to-ams';

/**
 * Class for interacting with AMS
 */
export class AMS {
  /** instance of the Azure AMS client */
  private client: ApiManagementClient;
  /** API identifier */
  private apiId: string;
  /** full API identifier, with subscription, service name, etc */
  private fullApiId: string;
  /** API revision number */
  private apiRevision: number;
  /** API version-less path */
  private apiPath: string;
  /** base path for routes */
  private basePath: string = '';
  /** list of endpoints to add */
  private endpoints: Endpoints;
  /** List of existing tags */
  private tags: TagTagResourceContractProperties[] = [];
  /** Tag object of the AMSify tag */
  private AMSifyTag: TagTagResourceContractProperties;

  /**
   * Create AMS instance
   * @param apiName - API identifier
   * @param resourceGroupName - The name of the resource group
   * @param serviceName - The name of the API Management service
   * @param apiVersion - API version
   * @param basePath - path to append to the express routes
   */
  constructor(
    apiName: string,
    private resourceGroupName: string,
    private serviceName: string,
    private apiVersion?: string,
    basePath?: string
  ) {
    // If base path, trim slashes
    if (basePath) this.basePath = ExpressToAMS.trimSlash(basePath);

    // Split revision, if set, from api name.
    const [apiId, apiRevision] = apiName.split(';rev=');
    this.apiId = apiId;
    this.apiRevision = apiRevision && parseInt(apiRevision);
  }

  /**
   *
   * @param generateNewRevision - Should it create a new revision?
   * @param makeNewRevisionAsCurrent - Should it mark the new revision as current?
   */
  public async exec(
    client: ApiManagementClient,
    endpoints: Endpoints,
    generateNewRevision: boolean = true,
    makeNewRevisionAsCurrent: boolean = generateNewRevision
  ) {
    this.client = client;
    this.endpoints = endpoints;

    await this.getApiName();

    if (generateNewRevision) this.createRevision();
    if (makeNewRevisionAsCurrent) this.setRevisionAsCurrent();

    // await this.listOperations();
  }

  /**
   * Creates a new revision
   */
  private async createRevision() {
    // List all revisions of the api
    const revisions = await this.getAll(
      this.client.apiRevision.listByService(this.resourceGroupName, this.serviceName, this.apiId),
      next => this.client.apiRevision.listByServiceNext(next)
    );

    // Find the last revision number
    const lastRev = revisions.reduce((lastRev, revision) => {
      const revNum = parseInt(revision.apiRevision);
      if (revNum > lastRev) lastRev = revNum;
      return lastRev;
    }, 0);

    // create revision
    const newApi = await this.client.api.createOrUpdate(
      this.resourceGroupName,
      this.serviceName,
      `${this.apiId};rev=${lastRev + 1}`,
      {
        sourceApiId: this.fullApiId,
        apiRevisionDescription: 'Auto-created revision by AMSify',
        path: this.apiPath
      }
    );

    this.apiId = newApi.name;
    this.fullApiId = newApi.id;
    this.apiRevision = parseInt(newApi.apiRevision);
  }

  /**
   * Makes revision current
   */
  private async setRevisionAsCurrent() {
    await this.client.apiRelease.createOrUpdate(
      this.resourceGroupName,
      this.serviceName,
      this.apiId,
      `amsify${this.apiRevision}release`,
      {
        apiId: this.fullApiId,
        notes: 'Auto-created revision by AMSify'
      }
    );
  }

  /**
   * Lists all the operations and tags in an api
   */
  private async listOperations() {
    let AMSifyTag: TagTagResourceContractProperties;
    const tags: { [tagId: string]: TagTagResourceContractProperties } = {};
    const operationsObj: {
      [operationId: string]: OperationTagResourceContractProperties & {
        tags: string[];
      };
    } = {};

    const operationsByTags = await this.getAll(
      this.client.operation.listByTags(this.resourceGroupName, this.serviceName, this.apiName, {
        includeNotTaggedOperations: true
      }),
      next =>
        this.client.operation.listByTagsNext(next, {
          includeNotTaggedOperations: true
        })
    );

    operationsByTags.forEach(tagObj => {
      if (tagObj.operation) {
        // If operation is not under base path, skip.
        if (this.basePath && !tagObj.operation.urlTemplate.startsWith(`/${this.basePath}`)) return;

        // Append operation to the operationObj, and add it's tags
        operationsObj[tagObj.operation.id] = {
          ...tagObj.operation,
          tags: [
            // Add previous tags
            ...((operationsObj[tagObj.operation.id] && operationsObj[tagObj.operation.id].tags) || []),
            // Add new tag
            ...((tagObj.tag && [tagObj.tag.id]) || [])
          ]
        };
      }
      // If has tag, append to ag list
      if (tagObj.tag) {
        if (tagObj.tag.name === 'amsify') AMSifyTag = tagObj.tag;
        tags[tagObj.tag.id] = tagObj.tag;
      }
    });

    this.tags = Object.values(tags);
    this.AMSifyTag = AMSifyTag;

    return operationsObj;
  }

  /**
   * Get api name, revision, path and fullId from apiId and apiVersion
   * The api name can be different from the api display name, and
   * if it has a version, it's even more likely to be different
   * from the display name. `getApiName` comes to the rescue!
   */
  private async getApiName() {
    const apis = await this.listApis();

    const setAPI = (api: ApiContract) => {
      // If manually set api revision, update the full api identification
      const [fullApiId] = api.id.split(';rev=');
      this.fullApiId = this.apiRevision ? `${fullApiId};rev=${this.apiRevision}` : api.id;

      this.apiId = api.name;
      this.apiPath = api.path;

      if (!this.apiRevision) this.apiRevision = parseInt(api.apiRevision);
    };

    // If api version, look for it
    if (this.apiVersion) {
      const api = apis.find(
        api =>
          api.apiVersion === this.apiVersion &&
          (api.displayName === this.apiId || api.path === this.apiId || api.name === this.apiId)
      );

      if (api) return setAPI(api);
    }

    // Look by name first
    const apiByName = apis.find(api => api.name === this.apiId);
    if (apiByName) return setAPI(apiByName);

    // Then search by display name or path
    const apiByDisplayName = apis.find(api => api.displayName === this.apiId || api.path === this.apiId);
    if (apiByDisplayName) return setAPI(apiByDisplayName);

    throw new Error('API not found');
  }

  /**
   * Returns a list of apis
   */
  private listApis() {
    return this.getAll(this.client.api.listByService(this.resourceGroupName, this.serviceName), next =>
      this.client.api.listByServiceNext(next)
    );
  }

  /**
   * Function to fetch all data, by following the nextLink
   * @param firstFunc - a function or a promise with nextLink
   * @param nextLinkFunc - a function to pass the nextLink
   */
  private async getAll<T>(
    firstFunc: (() => Promise<T>) | Promise<T>,
    nextLinkFunc: (next: string) => Promise<T>
  ): Promise<T> {
    let res = await (typeof firstFunc === 'function' ? firstFunc() : firstFunc);
    let nextLink = 'nextLink' in res && res['nextLink'];
    while (nextLink) {
      const nextRes = await nextLinkFunc(nextLink);
      nextLink = 'nextLink' in res && res['nextLink'];
      res = [...(res as any), ...(nextRes as any)] as any;
    }
    return res;
  }

  /**
   * Api id with revision
   */
  private get apiName() {
    return `${this.apiId};rev=${this.apiRevision}`;
  }
}
