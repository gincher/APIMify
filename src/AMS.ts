import { ApiManagementClient } from "@azure/arm-apimanagement";
import { OperationContract } from "@azure/arm-apimanagement/esm/models";
import { Endpoints, ExpressToAMS } from "./express-to-ams";

export class AMS {
  /** instance of the Azure AMS client */
  private client: ApiManagementClient;

  /**
   * Create AMS instance
   * @param resourceGroupName - The name of the resource group
   * @param serviceName - The name of the API Management service
   * @param apiId - API identifier
   * @param apiVersion - API version
   * @param basePath - path to append to the express routes
   */
  constructor(
    private resourceGroupName: string,
    private serviceName: string,
    private apiId: string,
    private apiVersion?: string,
    private basePath: string = ""
  ) {
    if (basePath) this.basePath = ExpressToAMS.trimSlash(basePath);
  }

  public async exec(client: ApiManagementClient, endpoints: Endpoints) {
    this.client = client;
    this.apiId = await this.getApiName();
    await this.listOperations();
  }

  private async listOperations() {
    const tags = await this.client.operation.listByTags(
      this.resourceGroupName,
      this.serviceName,
      this.apiId,
      { includeNotTaggedOperations: true }
    );
    console.log({ tags: JSON.stringify(tags, null, 2) });

    let operations: OperationContract[] = await this.getAll(
      this.client.apiOperation.listByApi(
        this.resourceGroupName,
        this.serviceName,
        this.apiId
      ),
      next => this.client.apiOperation.listByApiNext(next)
    );

    if (this.basePath)
      operations = operations.filter(operation =>
        operation.urlTemplate.startsWith(`/${this.basePath}`)
      );
  }

  private async getApiName() {
    const apis = await this.listApis();

    if (this.apiVersion) {
      const api = apis.find(
        api =>
          api.apiVersion === this.apiVersion &&
          (api.displayName === this.apiId ||
            api.path === this.apiId ||
            api.name === this.apiId)
      );

      if (api) return api.name;
    }

    const apiByName = apis.find(api => api.name === this.apiId);
    if (apiByName) return apiByName.name;

    const apiByDisplayName = apis.find(
      api => api.displayName === this.apiId || api.path === this.apiId
    );
    if (apiByDisplayName) return apiByDisplayName.name;

    throw new Error("API not found");
  }

  private listApis() {
    return this.getAll(
      this.client.api.listByService(this.resourceGroupName, this.serviceName),
      next => this.client.api.listByServiceNext(next)
    );
  }

  private async getAll<T>(
    firstFunc: (() => Promise<T>) | Promise<T>,
    nextLinkFunc: (next: string) => Promise<T>
  ): Promise<T> {
    let res = await (typeof firstFunc === "function" ? firstFunc() : firstFunc);
    let nextLink = "nextLink" in res && res["nextLink"];
    while (nextLink) {
      const nextRes = await nextLinkFunc(nextLink);
      nextLink = "nextLink" in res && res["nextLink"];
      res = [...(res as any), ...(nextRes as any)] as any;
    }
    return res;
  }
}
