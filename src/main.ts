import { Express, Router, Request, Response, NextFunction } from "express";
import { Authentication, AzureAuthentication } from "./auth";
import { ExpressToAMS } from "./express-to-ams";

class AMSify {
  private authentication: AzureAuthentication;
  private expressToAMS: ExpressToAMS;

  constructor(config: Config) {
    this.authentication = new AzureAuthentication(config.auth);
    this.expressToAMS = new ExpressToAMS(config.express);
  }

  public async sync() {
    const client = await this.authentication.authenticate();
  }
}

export default AMSify;

interface Config {
  /** Express element (created using `express()`) or Express router (created using `express.Router()`) */
  express: Express | Router;

  /** Azure authentication */
  auth?: Authentication;

  /**  */
  sg?: string;

  /** */
  amsname?: string;
}
