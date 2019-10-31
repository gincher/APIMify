import {
  AzureCliCredentials,
  interactiveLogin,
  loginWithUsernamePassword
} from "@azure/ms-rest-nodeauth";
import { ApiManagementClient } from "@azure/arm-apimanagement";
import { ServiceClientCredentials } from "@azure/ms-rest-js";

/**
 * Authentication class
 */
export class AzureAuthentication {
  /**
   * Creates an authentication class
   * @param authentication - authentication options
   */
  constructor(private authentication?: Authentication) {}

  /**
   * Executes authentication and returns Azure AMS client
   */
  public async authenticate() {
    let credentials: ServiceClientCredentials;
    let subscription: string;

    if (!!this.authentication && "username" in this.authentication) {
      // Username and password authentication
      credentials = await this.usernamePassword(
        this.authentication.username,
        this.authentication.password
      );
      subscription = this.authentication.subscription;
    } else if (!!this.authentication && "credentials" in this.authentication) {
      // Credentials authentication
      credentials = this.authentication.credentials;
      subscription = this.authentication.subscription;
    } else if (!!this.authentication && "subscription" in this.authentication) {
      // Interactive authentication
      credentials = await this.interactive();
      subscription = this.authentication.subscription;
    } else {
      // CLI Authentication
      credentials = await this.CLI();
      subscription = (credentials as AzureCliCredentials).tokenInfo
        .subscription;
    }

    return this.getClient(credentials, subscription);
  }

  /**
   * Initializes a new instance of the Azure AMS client
   * @param credentials - Credentials needed for the client to connect to Azure.
   * @param subscription - Microsoft Azure subscription.
   */
  private getClient(
    credentials: ServiceClientCredentials,
    subscription: string
  ) {
    return new ApiManagementClient(credentials, subscription);
  }

  /**
   * Authenticates using CLI. Before execution, user must run `az login`.
   */
  private async CLI() {
    return await AzureCliCredentials.create();
  }

  /**
   * Authenticates using username and password
   * @param username
   * @param password
   */
  private async usernamePassword(username: string, password: string) {
    return await loginWithUsernamePassword(username, password);
  }

  /**
   * Authenticates using an interactive process.
   */
  private async interactive() {
    return await interactiveLogin();
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

export type Authentication =
  | UsernamePasswordAuthentication
  | InteractiveAuthentication
  | credentialsAuthentication;
