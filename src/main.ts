import { Express, Router, Request, Response, NextFunction } from "express";
import { Authentication, AzureAuthentication } from "./auth";
import { ExpressToAMS } from "./express-to-ams";
import { AMS } from "./AMS";

class AMSify {
  private authentication: AzureAuthentication;
  private expressToAMS: ExpressToAMS;

  constructor(private config: Config) {
    this.authentication = new AzureAuthentication(config.auth);
    this.expressToAMS = new ExpressToAMS(config.express);
  }

  public async sync() {
    const client = await this.authentication.authenticate();
    const endpoints = this.expressToAMS.exec();

    const ams = new AMS(
      this.config.resourceGroupName,
      this.config.serviceName,
      this.config.apiId,
      this.config.apiVersion
    );
    ams.exec(client, endpoints);
  }
}

export default AMSify;

interface Config {
  /** Express element (created using `express()`) or Express router (created using `express.Router()`) */
  express: Express | Router;

  /** Azure authentication */
  auth?: Authentication;

  /** The name of the resource group. */
  resourceGroupName: string;

  /** The name of the API Management service. */
  serviceName: string;

  /** API identifier */
  apiId: string;

  /** API version */
  apiVersion?: string;

  /** Path to append to the express routes */
  basePath?: string;
}
