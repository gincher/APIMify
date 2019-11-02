import { ApiManagementClient } from '@azure/arm-apimanagement';
import { ApiContract, OperationContract, TagContract } from '@azure/arm-apimanagement/esm/models';
import { ExpressToAPIM, EndpointWithPolicyObj } from './express-to-apim';
import { PromiseHelper } from './promise';
import { Policy } from './endpoint';
import { Logger } from './logger';
import deepCompare from 'fast-deep-equal';

/**
 * Class for interacting with APIM
 */
export class APIM {
  /** instance of the Azure APIM client */
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
  private endpoints: EndpointWithPolicyObj[];
  /** List of existing tags */
  private tags: TagContract[] = [];
  /** Tag object of the APIMify tag */
  private APIMifyTag: TagContract;

  /** Object with tag generation promises */
  private tagGenerators: { [tagName: string]: Promise<TagContract> } = {};

  /**
   * Create APIM instance
   * @param apiName - API identifier
   * @param logger - a logger
   * @param resourceGroupName - The name of the resource group
   * @param serviceName - The name of the API Management service
   * @param apiVersion - API version
   * @param basePath - path to append to the express routes
   */
  constructor(
    apiName: string,
    private logger: Logger,
    private resourceGroupName: string,
    private serviceName: string,
    private apiVersion?: string,
    basePath?: string
  ) {
    // If base path, trim slashes
    if (basePath) this.basePath = ExpressToAPIM.trimSlash(basePath);

    // Split revision, if set, from api name.
    const [apiId, apiRevision] = apiName.split(';rev=');
    this.apiId = apiId;
    this.apiRevision = apiRevision && parseInt(apiRevision);
  }

  /**
   * Start the syncing operations
   * @param client - APIM client
   * @param endpoints - List of endpoints from expressjs
   * @param generateNewRevision - Should it create a new revision?
   * @param makeNewRevisionAsCurrent - Should it mark the new revision as current?
   */
  public async exec(
    client: ApiManagementClient,
    endpoints: EndpointWithPolicyObj[],
    generateNewRevision: boolean = true,
    makeNewRevisionAsCurrent: boolean = generateNewRevision
  ) {
    try {
      this.client = client;
      this.endpoints = endpoints;

      await this.getApiName();

      if (generateNewRevision) await this.createRevision();

      const oldOperations = await this.listOperations();
      if (!this.APIMifyTag) this.APIMifyTag = await this.generateTag('apimify');

      await this.sortOperationsByAction(oldOperations, this.endpoints);

      if (makeNewRevisionAsCurrent) await this.setRevisionAsCurrent();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Creates a new revision
   */
  private async createRevision() {
    try {
      // List all revisions of the api
      this.logger.info('Requesting revisions from APIM');
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
      this.logger.info('Creating a revision');
      const newApi = await this.client.api.createOrUpdate(
        this.resourceGroupName,
        this.serviceName,
        `${this.apiId};rev=${lastRev + 1}`,
        {
          sourceApiId: this.fullApiId,
          apiRevisionDescription: 'Auto-created revision by APIMify',
          path: this.apiPath
        }
      );

      this.apiId = newApi.name.split(';rev').shift();
      this.fullApiId = newApi.id;
      this.apiRevision = parseInt(newApi.apiRevision);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Makes revision current
   */
  private async setRevisionAsCurrent() {
    this.logger.info(`Setting revision as current`);
    return this.client.apiRelease.createOrUpdate(
      this.resourceGroupName,
      this.serviceName,
      this.apiId,
      `apimify${this.apiRevision}release`,
      {
        apiId: this.fullApiId,
        notes: 'Auto-created revision by APIMify'
      }
    );
  }

  /**
   * Lists all the operations and tags in an api
   */
  private async listOperations() {
    try {
      const operationsTagObj: {
        [operationId: string]: string[];
      } = {};

      this.logger.info('Requesting operations and tags from APIM');
      const [operations, operationsWithTags, tags] = await Promise.all([
        this.getAll(this.client.apiOperation.listByApi(this.resourceGroupName, this.serviceName, this.apiName), next =>
          this.client.apiOperation.listByApiNext(next)
        ),
        this.getAll(this.client.operation.listByTags(this.resourceGroupName, this.serviceName, this.apiName), next =>
          this.client.operation.listByTagsNext(next)
        ),
        this.getAll(this.client.tag.listByService(this.resourceGroupName, this.serviceName), next =>
          this.client.tag.listByServiceNext(next)
        )
      ]);

      this.tags = tags;
      this.APIMifyTag = tags.find(tag => tag.displayName === 'apimify');

      operationsWithTags.forEach(tagObj => {
        if (!tagObj.tag) return;

        if (tagObj.operation) {
          const operationId = tagObj.operation.id.split('/').pop();
          if (!operationsTagObj[operationId]) operationsTagObj[operationId] = [];
          operationsTagObj[operationId].push(tagObj.tag.name);
        }
      });

      return operations
        .filter(op => !this.basePath || op.urlTemplate.startsWith(`/${this.basePath}`))
        .map(op => ({ ...op, tags: operationsTagObj[op.name] || [] } as OperationWithTags));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Decides if an operation needed to be deleted, created or edited
   */
  private async sortOperationsByAction(oldOperations: OperationWithTags[], newOperations: EndpointWithPolicyObj[]) {
    try {
      // List of operations ids to delete
      const toDelete: string[] = [];
      // List of operations to create
      const toCreate: EndpointWithPolicyObj[] = [];
      // List of operations to edit
      const toEdit: { old: typeof oldOperations[number]; new: EndpointWithPolicyObj }[] = [];

      [...newOperations].forEach((newOp, newOpIndex) => {
        const oldOpIndex = !newOp.operationId.startsWith('apimify-')
          ? -1
          : oldOperations.findIndex(
              o =>
                o.urlTemplate.replace(/\{(.*?)(?:P\d*?|)\}/g, '{$1}') ===
                  newOp.urlTemplate.replace(/\{(.*?)(?:P\d*?|)\}/g, '{$1}') &&
                o.method.toUpperCase() === newOp.method.toUpperCase()
            );

        if (oldOpIndex !== -1) {
          // old op exists, so edit it
          toEdit.push({ old: oldOperations[oldOpIndex], new: newOp });
          oldOperations.splice(oldOpIndex, 1);
        }
        // old op not existing, needs creation
        else toCreate.push(newOp);

        newOperations.splice(newOpIndex, 1);
      });

      // Delete all ops left in oldOperations
      toDelete.push(...oldOperations.map(op => op.id.split('/').pop()));

      this.logger.info(`Deleting ${toDelete.length} operations`);
      await PromiseHelper.promiseParallelQueue(toDelete.map(del => () => this.deleteOperation(del)), 5, this.logger);
      this.logger.info(`Creating ${toCreate.length} operations`);
      await PromiseHelper.promiseParallelQueue(toCreate.map(cre => () => this.createOperation(cre)), 5, this.logger);
      this.logger.info(`Editing ${toEdit.length} operations`);
      await PromiseHelper.promiseParallelQueue(
        toEdit.map(edit => () => this.editOperation(edit.old, edit.new)),
        5,
        this.logger
      );
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Delete an operation
   * @param operationId - operation id to delete
   */
  private deleteOperation(operationId: string) {
    this.logger.info(`Deleting ${operationId}`);
    return this.client.apiOperation.deleteMethod(
      this.resourceGroupName,
      this.serviceName,
      this.apiName,
      operationId,
      '*'
    );
  }

  /**
   * create an operation
   * @param operation - operation to create
   */
  private async createOperation(operation: EndpointWithPolicyObj) {
    try {
      this.logger.info(`Creating ${operation.displayName}`);
      const createdOperation = await this.client.apiOperation.createOrUpdate(
        this.resourceGroupName,
        this.serviceName,
        this.apiName,
        operation.operationId,
        { ...operation, policies: Policy.toXML(operation.policies) }
      );
      const tags = [...(operation.tags || []), this.APIMifyTag.displayName];

      // Set tags, two at a time, and set policy
      await PromiseHelper.promiseParallelQueue(
        [
          ...tags.map(tag => () => this.setTag(createdOperation.name, tag)),
          () => this.setPolicy(operation.operationId, Policy.toXML(operation.policies))
        ],
        2,
        this.logger
      );
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Edit an operation
   * @param oldOp - existing operation
   * @param newOp - new operation
   */
  private async editOperation(oldOp: OperationWithTags, newOp: EndpointWithPolicyObj) {
    try {
      this.logger.info(`Editing ${newOp.displayName}`);
      if (
        (newOp.description || '') !== (oldOp.description || '') ||
        (newOp.displayName || '') !== (oldOp.displayName || '') ||
        !deepCompare(newOp.request || {}, oldOp.request || {}) ||
        !deepCompare(newOp.responses || [], oldOp.responses || [])
      ) {
        this.logger.info(`Modifying ${newOp.displayName}'s metadata`);
        await this.client.apiOperation.createOrUpdate(
          this.resourceGroupName,
          this.serviceName,
          this.apiName,
          oldOp.name,
          {
            description: newOp.description,
            displayName: newOp.displayName,
            request: newOp.request,
            responses: newOp.responses,
            method: newOp.method.toUpperCase(),
            urlTemplate: newOp.urlTemplate,
            templateParameters: newOp.templateParameters
          }
        );
      }

      // Check for tags to be updated
      const oldTags = [...(oldOp.tags || [])];
      const newTags = [...(newOp.tags || []), this.APIMifyTag.displayName];
      // Remove tags that are both old and new
      [...newTags].forEach((newTag, index) => {
        const oldTag = oldTags.findIndex(o => o === newTag);
        if (oldTag === -1) return;
        oldTags.splice(oldTag, 1);
        newTags.splice(index, 1);
      });

      // Delete and set tags, and set policy
      await PromiseHelper.promiseParallelQueue<any>(
        [
          ...oldTags.map(tag => () => this.removeTag(oldOp.name, tag)),
          ...newTags.map(tag => () => this.setTag(oldOp.name, tag)),
          // I don't compare because sending a request to get the policies and then sending
          // a request to update them if needed, will send more requests than sending a put
          // request to every operation updated. Microsoft apis, am I right?
          () => this.setPolicy(oldOp.name, Policy.toXML(newOp.policies))
        ],
        2,
        this.logger
      );
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * set policy to an operation
   * @param operationId - the operation ID
   * @param xml - the policy
   */
  private setPolicy(operationId: string, xml: string) {
    this.logger.info(`Setting policy to ${operationId}`);
    return this.client.apiOperationPolicy.createOrUpdate(
      this.resourceGroupName,
      this.serviceName,
      this.apiName,
      operationId,
      { format: 'rawxml', value: xml }
    );
  }

  /**
   * Assign tag to an operation
   * @param operationId - the operation ID
   * @param tagName - the name of the tag
   */
  private async setTag(operationId: string, tagName: string) {
    if (!tagName.replace(/[^A-z0-9]/g, '').length) return;

    try {
      let tag = this.tags.find(t => t.displayName === tagName);
      if (!tag) tag = await this.generateTag(tagName);

      this.logger.info(`Assigning tag ${tagName} to ${operationId}`);
      await this.client.tag.assignToOperation(
        this.resourceGroupName,
        this.serviceName,
        this.apiName,
        operationId,
        tag.name
      );
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Remove tag to an operation
   * @param operationId - the operation ID
   * @param tagName - the name of the tag
   */
  private removeTag(operationId: string, tagName: string) {
    const tag = this.tags.find(t => t.displayName === tagName);
    if (!tag) return;

    this.logger.info(`detaching tag ${tagName} to ${operationId}`);
    return this.client.tag.detachFromOperation(
      this.resourceGroupName,
      this.serviceName,
      this.apiName,
      operationId,
      tag.name
    );
  }

  /**
   * create a tag
   * @param tagName - tag's name
   */
  private async generateTag(tagName: string) {
    if (!tagName.replace(/[^A-z0-9]/g, '').length) return;

    const tag = this.tags.find(t => t.displayName === tagName);
    if (tag) return tag;

    try {
      tagName = tagName.trim();

      // If there is a tag creating process with the same tagname, return
      // it's promise. Otherwise, create it.
      if (this.tagGenerators[tagName]) return this.tagGenerators[tagName];

      this.logger.info(`Creating tag ${tagName}`);
      const promise = new Promise<TagContract>(async (resolve, reject) => {
        try {
          const tagId = tagName.replace(/[^A-z0-9]/g, '') + Date.now();

          const tag = await this.client.tag.createOrUpdate(this.resourceGroupName, this.serviceName, tagId, {
            displayName: tagName
          });

          if (this.tagGenerators[tagName]) delete this.tagGenerators[tagName];
          this.tags.push(tag);
          resolve(tag);
        } catch (e) {
          reject(e);
        }
      });

      this.tagGenerators[tagName] = promise;
      return promise;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Get api name, revision, path and fullId from apiId and apiVersion
   * The api name can be different from the api display name, and
   * if it has a version, it's even more likely to be different
   * from the display name. `getApiName` comes to the rescue!
   */
  private async getApiName() {
    try {
      const apis = await this.listApis();

      const setAPI = (api: ApiContract) => {
        // If manually set api revision, update the full api identification
        const [fullApiId] = api.id.split(';rev=');
        this.fullApiId = this.apiRevision ? `${fullApiId};rev=${this.apiRevision}` : api.id;

        this.apiId = api.name;
        this.apiPath = api.path;

        if (!this.apiRevision) this.apiRevision = parseInt(api.apiRevision);
      };

      this.logger.info('Searching for the API');
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
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Returns a list of apis
   */
  private listApis() {
    this.logger.info('Requesting APIs from APIM');
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
    try {
      let res = await (typeof firstFunc === 'function' ? firstFunc() : firstFunc);
      let nextLink = 'nextLink' in res && res['nextLink'];
      while (nextLink) {
        const nextRes = await nextLinkFunc(nextLink);
        nextLink = 'nextLink' in res && res['nextLink'];
        res = [...(res as any), ...(nextRes as any)] as any;
      }
      return res;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Api id with revision
   */
  private get apiName() {
    return `${this.apiId};rev=${this.apiRevision}`;
  }
}

type OperationWithTags = OperationContract & {
  tags: string[];
};
