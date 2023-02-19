import { Node, NodeStats } from "./Node";
import { type Dispatcher, type Response, Pool} from "undici";
import { Poru } from "./Poru";
import PkgInfo from "../package.json"
import { LavalinkPlayer, Player } from "./Player";
import { LavalinkFiltersData } from "./Filters";
import { type IVoiceServer } from "./Connection";

export interface updatePlayerOptions {
  guildId: string;
  data: {
    encodedTrack?: string;
    identifier?: string;
    startTime?: number;
    endTime?: number;
    volume?: number;
    position?: number;
    paused?: Boolean;
    filters?: Partial<LavalinkFiltersData>;
    voice?: Partial<IVoiceServer>;
  };
  /**
   * Whether to replace the current track with the new track.
   * @link https://github.com/freyacodes/Lavalink/blob/master/IMPLEMENTATION.md#update-player
   */
  noReplace?: boolean
}

export type RouteLike = `/${string}`;

export enum RequestMethod {
  "Get" = "GET",
  "Delete" = "DELETE",
  "Post" = "POST",
  "Patch" = "PATCH",
  "Put" = "PUT",
}

export type RestVersion = "v3" | "v4";

export type modifyRequest = (options: Dispatcher.RequestOptions) => void;

/**
 * Received when a API Request encounters an error
 * @url https://github.com/freyacodes/Lavalink/blob/master/IMPLEMENTATION.md#error-responses
 */
export interface InvalidRestRequest {
  /**
   * The timestamp of the error in milliseconds
   */
  timestamp?: number,
  /**
   * The HTTP status code
   */
  status?: number,
  /**
   * The HTTP status code message
   */
  error?: string,
  /**
   * The stack trace of the error when trace=true as query param has been sent
   */
  trace?: string,
  /**
   * The error message
   */
  message?: string,
  /**
   * The api Request path
   */
  path?: string
}

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
  public readonly poru: Poru;
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
    this.requestTimeout = node.requestTimeout
  }

  public setSessionId(sessionId: string) {
    this.sessionId = sessionId;
  }

  async getAllPlayers(): Promise<LavalinkPlayer[]> {
    if(!this.sessionId) throw new ReferenceError(`The Lavalink-node is not connected/ready, or is not Up-to date`)
    const players = await this.makeRequest(`/sessions/${this.sessionId}/players`) as LavalinkPlayer[]

    if(!Array.isArray(players)) return []

    return players;
  }

  public async updatePlayer(options: updatePlayerOptions) {
    if(!this.sessionId) throw new ReferenceError(`The Lavalink-node is not connected/ready, or is not Up-to date`)

    const res = await this.makeRequest<Player>(`/sessions/${this.sessionId}/players/${options.guildId}/?noReplace=false`, (requestOptions) => {
      requestOptions.method = RequestMethod.Patch,
      requestOptions.body = JSON.stringify(options.data)

      if(options.noReplace) {
        const url = new URL(`${this.url}${requestOptions.path}`);
        url.search = new URLSearchParams({ noReplace: options.noReplace?.toString() || "false" }).toString()
        requestOptions.path = url.toString().replace(this.url, "")
      }
    })

    return res
  }

  public async destroyPlayer(guildId: string) {
    if(!this.sessionId) throw new ReferenceError(`The Lavalink-node is not connected/ready, or is not Up-to date`)

    await this.delete(`/sessions/${this.sessionId}/players/${guildId}`);
  }

  public async patch<T>(endpoint: RouteLike, body): Promise<T> {

    const res = await this.makeRequest<T>(endpoint, (RequestOptions) => {
      RequestOptions.method = RequestMethod.Patch;
      RequestOptions.body = JSON.stringify(body);
    })

    return res
  }
  public async post<T>(endpoint: RouteLike, body): Promise<T> {
    const res = await this.makeRequest<T>(endpoint, (RequestOptions) => {
      RequestOptions.method = RequestMethod.Post,
      RequestOptions.body = JSON.stringify(body)
    })

    return res
  }

  public async delete(endpoint: RouteLike) {

    const res = await this.makeRequest(endpoint, (requestOptions) => {
      requestOptions.method = RequestMethod.Delete;
    }) 

    return res
  }

  /**
   * 
   * @param endpoint for the Request
   * @param modifyRequest modified options for the Request
   * @internal
   */
  public async makeRequest<T>(endpoint: RouteLike, modifyRequest?: modifyRequest): Promise<T> {
    const options: Dispatcher.RequestOptions = {
      path: `/${this.version}${endpoint}`,
      headers: {
        "Content-type": "application/json",
        Authorization: this.password,
        "user-agent": `${PkgInfo.name} (${PkgInfo.repository.url} ${PkgInfo.version})`
      },
      headersTimeout: this.requestTimeout,
      method: RequestMethod.Get,
    }

    modifyRequest?.(options)
    
    const url = new URL(`${this.url}${options.path}`)
    url.searchParams.append("trace", "true")
    options.path = url.toString().replace(this.url, "")

    const req = await this.agent.request(options)

    if(req.statusCode === 404) return await req.body.json() as T satisfies InvalidRestRequest;
    if(options.method === RequestMethod.Delete) return;

    return await req.body.json()
  }
}