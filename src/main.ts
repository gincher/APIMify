// Export metadata and policies
export { Metadata, Policy } from './endpoint';
export * from './policies';

import { Express, Router, Request, Response, NextFunction } from 'express';
import { Authentication, AzureAuthentication } from './auth';
import { ExpressToAMS } from './express-to-ams';
import { AMS } from './AMS';
import { Logger, LoggerMethods } from './logger';

/**
 * Sync your express route with Azure Api Management Service using this magic!
 */
export class AMSify {
  /** Authentication class */
  private authentication: AzureAuthentication;
  /** ExpressToAMS class */
  private expressToAMS: ExpressToAMS;
  /** ExpressToAMS class */
  private logger: Logger;

  /**
   * Sync your express route with Azure Api Management Service using this magic!
   * @param config - magical configuration
   */
  constructor(private config: Config) {
    this.logger = new Logger(config.logger, config.logLevel);
    this.authentication = new AzureAuthentication(this.logger, config.auth);
    this.expressToAMS = new ExpressToAMS(this.logger, config.express);
  }

  /**
   * Execute the sync process
   */
  public async sync() {
    this.logger.info('Sync started');

    const client = await this.authentication.authenticate().catch(e => this.logger.error(e));
    if (!client) return Promise.reject();

    const endpointsObj = this.expressToAMS.exec(this.config.breakOnSamePath || false);
    const endpoints = Object.values(endpointsObj).flatMap(endpoint => Object.values(endpoint));

    const ams = new AMS(
      this.config.apiId,
      this.logger,
      this.config.resourceGroupName,
      this.config.serviceName,
      this.config.apiVersion
    );
    return ams.exec(client, endpoints, this.config.generateNewRevision, this.config.makeNewRevisionAsCurrent);
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
   */
  breakOnSamePath?: boolean;

  /**
   * Should it create a new revision?
   */
  generateNewRevision?: boolean;

  /**
   * Should it mark the new revision as current?
   */
  makeNewRevisionAsCurrent?: boolean;

  /**
   * Logger
   */
  logger?: LoggerMethods<(str: string) => void>;

  /**
   * What level you want to log
   */
  logLevel?: LoggerMethods<boolean>;
}
