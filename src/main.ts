import { Express, Router, Request, Response, NextFunction } from 'express';
import { Authentication, AzureAuthentication } from './auth';
import { ExpressToAMS } from './express-to-ams';
import { AMS } from './AMS';

class AMSify {
  private authentication: AzureAuthentication;
  private expressToAMS: ExpressToAMS;

  constructor(private config: Config) {
    this.authentication = new AzureAuthentication(config.auth);
    this.expressToAMS = new ExpressToAMS(config.express);
  }

  public async sync() {
    const client = await this.authentication.authenticate();
    const endpoints = this.expressToAMS.exec(this.config.breakOnSamePath || false);

    const ams = new AMS(
      this.config.apiId,
      this.config.resourceGroupName,
      this.config.serviceName,
      this.config.apiVersion
    );
    ams.exec(client, endpoints, this.config.generateNewRevision, this.config.makeNewRevisionAsCurrent);
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

  /**
   * Break when where is same path, for example `/user/:name([A-z\-]*)`
   * and `/user/:id(\d*)` - Azure Api Management Service can't distinguish
   * between the two.
   * @default true
   */
  breakOnSamePath?: boolean;

  /**
   * Should it create a new revision?
   * @default true
   */
  generateNewRevision?: boolean;

  /**
   * Should it mark the new revision as current?
   * @default true
   */
  makeNewRevisionAsCurrent?: boolean;
}
