import { AzureCliCredentials, interactiveLogin, loginWithUsernamePassword } from '@azure/ms-rest-nodeauth';
import { ApiManagementClient } from '@azure/arm-apimanagement';
import { ServiceClientCredentials } from '@azure/ms-rest-js';
import { Logger } from './logger';

/**
 * Authentication class
 */
export class AzureAuthentication {
  /**
   * Creates an authentication class
   * @param logger - a logger
   * @param authentication - authentication options
   */
  constructor(private logger: Logger, private authentication?: Authentication) {}

  /**
   * Executes authentication and returns Azure APIM client
   */
  public async authenticate() {
    try {
      let credentials: ServiceClientCredentials;
      let subscription: string;

      if (!!this.authentication && 'username' in this.authentication) {
        // Username and password authentication
        this.logger.info('Authenticating using username and password');
        credentials = await this.usernamePassword(this.authentication.username, this.authentication.password);
        subscription = this.authentication.subscription;
      } else if (!!this.authentication && 'credentials' in this.authentication) {
        // Credentials authentication
        this.logger.info('Authenticating using service credentials');
        credentials = this.authentication.credentials;
        subscription = this.authentication.subscription;
      } else if (!!this.authentication && 'subscription' in this.authentication) {
        // Interactive authentication
        this.logger.info('Authenticating using interactive authentication');
        credentials = await this.interactive();
        subscription = this.authentication.subscription;
      } else {
        // CLI Authentication
        this.logger.info('Authenticating using CLI');
        credentials = await this.CLI();
        subscription = (credentials as AzureCliCredentials).tokenInfo.subscription;
      }
      this.logger.info('Authenticated successfully');

      return this.getClient(credentials, subscription);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Initializes a new instance of the Azure APIM client
   * @param credentials - Credentials needed for the client to connect to Azure.
   * @param subscription - Microsoft Azure subscription.
   */
  private getClient(credentials: ServiceClientCredentials, subscription: string) {
    return new ApiManagementClient(credentials, subscription);
  }

  /**
   * Authenticates using CLI. Before execution, user must run `az login`.
   */
  private CLI() {
    return AzureCliCredentials.create();
  }

  /**
   * Authenticates using username and password
   * @param username
   * @param password
   */
  private usernamePassword(username: string, password: string) {
    return loginWithUsernamePassword(username, password);
  }

  /**
   * Authenticates using an interactive process.
   */
  private interactive() {
    return interactiveLogin();
  }
}

interface UsernamePasswordAuthentication {
  subscription: string;
  username: string;
  password: string;
}

interface InteractiveAuthentication {
  subscription: string;
}

interface credentialsAuthentication {
  subscription: string;
  credentials: ServiceClientCredentials;
}

export type Authentication = UsernamePasswordAuthentication | InteractiveAuthentication | credentialsAuthentication;
