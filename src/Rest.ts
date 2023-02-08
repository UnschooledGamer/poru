import { Node, NodeStats } from "./Node";
import { type Dispatcher, fetch, type Response, type Agent, Pool } from "undici";
import { Poru } from "./Poru";

export interface playOptions {
  guildId: string;
  data: {
    encodedTrack?: string;
    identifier?: string;
    startTime?: number;
    endTime?: number;
    volume?: number;
    position?: number;
    paused?: Boolean;
    filters?: Object;
    voice?: any;
  };
}

export type RouteLike = `/${string}`;

export enum RequestMethod {
  "Get" = "GET",
  "Delete" = "DELETE",
  "Post" = "POST",
  "Patch" = "PATCH",
  "Put" = "PUT",
}

export type RestVersion = "v2" | "v3" | "v4";

export type modifyRequest = (options: Dispatcher.RequestOptions) => void;

export class Rest {
  /**
   * sessionId from poru
   */
  private sessionId: string;
  /**
   * password to access Lavalink api
   */
  private password: string;
  /**
   * Lavalink url for Requests
   */
  public url: string;
  /**
   * initialized poru
   */
  public poru: Poru;
  /**
   * version that is used for Lavalink api
   * @defaultValue `v3`
   */
  public version: RestVersion
  /**
   * The request {@link https://undici.nodejs.org/#/docs/api/Agent Agent} for the requests
   */
  public agent: Dispatcher
  /**
   * whether to send the request with version or not
   * @defaultValue `true`
   */
  public readonly versionedPath?: boolean;
  /**
   * The timeout for the requests
   * @defaultValue `15000`
   */
  public requestTimeout: number;

  constructor(poru: Poru, node: Node) {
    this.poru = poru;
    this.url = `http${node.secure ? "s" : ""}://${node.options.host}:${node.options.port
      }`;
    this.sessionId = node.sessionId;
    this.password = node.password;
    this.agent = new Pool(this.url, node.poolOptions);
    this.version = node.apiVersion;
    this.versionedPath = node.versionedPath;
    this.requestTimeout = node.requestTimeout
  }

  public setSessionId(sessionId: string) {
    this.sessionId = sessionId;
  }

  getAllPlayers() {
    return this.get(`/sessions/${this.sessionId}/players`);
  }

  public async updatePlayer(options: playOptions) {
    return await this.patch(
      `/sessions/${this.sessionId}/players/${options.guildId}/?noReplace=false`,
      options.data
    );
  }

  public async destroyPlayer(guildId: string) {
    await this.delete(`/sessions/${this.sessionId}/players/${guildId}`);
  }

  public async get(path: RouteLike) {
    let req = await fetch(this.url + path, {
      method: RequestMethod.Get,
      headers: {
        "Content-Type": "application/json",
        Authorization: this.password,
      },
    });
    return await this.parseResponse(req);
  }

  public async patch(endpoint: RouteLike, body) {
    let req = await fetch(this.url + this.version + endpoint, {
      method: RequestMethod.Patch,
      headers: {
        "Content-Type": "application/json",
        Authorization: this.password,
      },
      body: JSON.stringify(body),
    });

    return await this.parseResponse(req);
  }
  public async post(endpoint: RouteLike, body) {
    let req = await fetch(this.url + this.version + endpoint, {
      method: RequestMethod.Post,
      headers: {
        "Content-Type": "application/json",
        Authorization: this.password,
      },
      body: JSON.stringify(body),
    });

    return await this.parseResponse(req);
  }

  public async delete(endpoint: RouteLike) {
    let req = await fetch(this.url + this.version + endpoint, {
      method: RequestMethod.Delete,
      headers: {
        "Content-Type": "application/json",
        Authorization: this.password,
      },
    });

    return await this.parseResponse(req);
  }


  public async makeRequest<T>(endpoint: RouteLike, modifyRequest?: modifyRequest): Promise<T> {
    const options: Dispatcher.RequestOptions = {
      path: `${this.versionedPath && this.version ? `/${this.version}` : ""}${endpoint}`,
      headers: {
        Authorization: this.password
      },
      headersTimeout: this.requestTimeout,
      method: RequestMethod.Get
    }

    modifyRequest?.(options)

    const req = this.agent.request(options)

    if(options.method === RequestMethod.Delete) return;

    return await (await req).body.json()
  }

  private async parseResponse(req: Response) {
    const jsonBody = await req.json().catch(() => null);
    this.poru.emit("raw", "Rest", jsonBody);
    return await jsonBody;
  }
}