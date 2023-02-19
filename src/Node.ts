import { Poru, PoruOptions, NodeGroup } from "./Poru";
import WebSocket from "ws";
import { Config, Config as config } from "./config";
import { InvalidRestRequest, Rest, RestVersion } from "./Rest";
import { type Pool } from "undici";

export type websocketVersion = Exclude<RestVersion, "v2">
export interface NodeStats {
  players: number;
  playingPlayers: number;
  memory: {
    reservable: number;
    used: number;
    free: number;
    allocated: number;
  };
  frameStats?: {
    sent: number;
    deficit: number;
    nulled: number;
  };
  cpu: {
    cores: number;
    systemLoad: number;
    lavalinkLoad: number;
  };
  uptime: number;
}

export interface LavalinkSession {
  resumingKey?: string,
  timeout?: number
}

export class Node {
  public isConnected: boolean;
  public poru: Poru;
  public readonly name: string;
  public readonly restURL: string;
  public readonly socketURL: string;
  public password: string;
  public readonly apiVersion: RestVersion;
  public readonly version: websocketVersion;
  public readonly versionedPath: boolean;
  public readonly poolOptions: Pool.Options;
  public readonly requestTimeout: number
  public readonly secure: boolean;
  public readonly regions: Array<string>;
  public sessionId: string;
  private resumed: boolean
  public rest: Rest;
  public ws: WebSocket | null;
  public readonly resumeKey: string | null;
  public readonly resumeTimeout: number;
  public readonly autoResume: boolean;
  public readonly reconnectTimeout: number;
  public reconnectTries: number;
  public reconnectAttempt: any;
  public attempt: number;
  public stats: NodeStats | null;
  public options: NodeGroup;

  constructor(poru: Poru, node: NodeGroup, options: PoruOptions) {
    this.poru = poru;
    this.name = node.name;
    this.options = node;
    this.socketURL = `${this.secure ? "wss" : "ws"}://${node.host}:${node.port}/`;
    this.password = node.password || "youshallnotpass";
    this.apiVersion = node.apiVersion ?? Config.apiVersion;
    this.version = node.websocketVersion ?? Config.websocketVersion;
    this.requestTimeout = node.requestTimeout ?? 15e3
    this.secure = node.secure || false;
    this.regions = node.region || null;
    this.sessionId = null;
    this.rest = new Rest(poru, this);
    this.resumed = false;
    this.ws = null;
    this.resumeKey = options.resumeKey || null;
    this.resumeTimeout = options.resumeTimeout || 60;
    this.autoResume = options.autoResume || false;
    this.reconnectTimeout = options.reconnectTimeout || 5000;
    this.reconnectTries = options.reconnectTries || 5;
    this.reconnectAttempt = null;
    this.attempt = 0;
    this.isConnected = false;
    this.stats = null;
  }

  public connect() {
    if (this.ws) this.ws.close();
    const headers = {
      Authorization: this.password,
      "User-Id": this.poru.userId,
      "Client-Name": config.clientName,
    };
    if (this.resumeKey) headers["Resume-Key"] = this.resumeKey;

    const finalSocketUrl = new URL(`${this.socketURL}${this.version}/websocket`)

    this.ws = new WebSocket(finalSocketUrl.toString(), { headers });
    this.ws.on("open", this.open.bind(this));
    this.ws.on("error", this.error.bind(this));
    this.ws.on("message", this.message.bind(this));
    this.ws.on("close", this.close.bind(this));
  }

  public send(payload: any) {
    const data = JSON.stringify(payload);
    this.ws.send(data, (error) => {
      if (error) return error;
      return null;
    });
  }

  public reconnect() {
    this.reconnectAttempt = setTimeout(() => {
      if (this.attempt > this.reconnectTries) {
        this.disconnect()
        throw new Error(
          `[Poru Websocket] Unable to connect with ${this.name} node after ${this.reconnectTries} tries`
        );
      }
      this.isConnected = false;
      this.ws?.removeAllListeners();
      this.ws = null;
      this.poru.emit("nodeReconnect", this);
      this.connect();
      this.attempt++;
    }, this.reconnectTimeout);
  }
  public disconnect() {
    if (!this.isConnected) return;

    this.poru.players.forEach((player) => {
      if (player.node == this) {
        this.poru.emit("debug", this.name, `Node was disconnected, moving players`)
        player.move();
      }
    });
    this.ws.close(1000, "destroy");
    this.ws?.removeAllListeners();
    this.ws = null;
    //    this.reconnect = 1;
    this.poru.nodes.delete(this.name);
    this.poru.emit("nodeDisconnect", this);
  }

  get penalties(): number {
    let penalties = 0;
    if (!this.isConnected) return penalties;
    penalties += this.stats.players;
    penalties += Math.round(
      Math.pow(1.05, 100 * this.stats.cpu.systemLoad) * 10 - 10
    );
    if (this.stats.frameStats) {
      penalties += this.stats.frameStats.deficit;
      penalties += this.stats.frameStats.nulled * 2;
    }
    return penalties;
  }

  /**
   * the node connection is resumed with the Lavalink-node or not
   */
  get isResumed() {
    if(!this.ws) throw new Error("Lavalink-node is not Connected")

    return !!this.resumed
  }

  /**
   * fetch stats of the node via Rest api
   */
  public async fetchStats(): Promise<NodeStats|{}> {
    return await this.rest.makeRequest("/stats")
  }

  public async fetchVersion(): Promise<string| null> {
    return this.rest.makeRequest("/version", (request) => {
      request.path = "/version"
    })
  }

  /**
   * Fetches the info of the Lavalink-node
   */
  public async fetchInfo(): Promise<NodeInfo | InvalidRestRequest | null> {
    return await this.rest.makeRequest(`/info`)
  }

  private open() {
    if (this.reconnectAttempt) {
      clearTimeout(this.reconnectAttempt);
      delete this.reconnectAttempt;
    }

    this.poru.emit("nodeConnect", this);
    this.isConnected = true;
    this.poru.emit("debug", this.name, `[Web Socket] Connection ready ${this.socketURL}`);

    if (this.autoResume) {
      for (const player of this.poru.players.values()) {
        if (player.node === this) {
          player.restart();
        }
      }
    }
  }

  private setStats(packet: NodeStats) {
    this.stats = packet;
  }

  private async message(payload: any) {
    const packet = JSON.parse(payload);
    if (!packet?.op) return;

    this.poru.emit("raw", "Node", packet)
    this.poru.emit("debug", this.name, `[Web Socket] Lavalink Node Update : ${JSON.stringify(packet)} `);

    if (packet.op === "stats") {
      delete packet.op;
      this.setStats(packet);
    }
    if (packet.op === "ready") {
      this.rest.setSessionId(packet.sessionId);
      this.sessionId = packet.sessionId;
      this.resumed = packet.resumed
      this.poru.emit("debug", this.name, `[Web Socket] Ready Payload received ${JSON.stringify(packet)}`)
      
      /**
       * @todo set the players again after resumed
       */
      // if(this.isResumed) {
      //   let players = await this.rest.getAllPlayers()
        
      //   for(const player of players.values()) {
         
      //   }
      // }

      if (this.resumeKey && !this.isResumed) {
        this.rest.patch(`/sessions/${this.sessionId}`, { resumingKey: this.resumeKey, timeout: this.resumeTimeout })
        this.poru.emit("debug", this.name, `[Lavalink Rest]  Resuming configured on Lavalink`
        );
      }

    }
    const player = this.poru.players.get(packet.guildId);
    if (packet.guildId && player) player.emit(packet.op, packet);
  }

  private close(event: any): void {
    this.poru.emit("nodeDisconnect", this, event);
    this.poru.emit("debug", this.name, `[Web Socket] Connection closed with Error code : ${event || "Unknown code"
      }`
    );
    if (event !== 1000) this.reconnect();
  }

  private error(event: any): void {
    if (!event) return;
    this.poru.emit("nodeError", this, event);
    this.poru.emit(
      "debug", `[Web Socket] Connection for Lavalink Node (${this.name}) has error code: ${event.code || event
      }`
    );
  }

  public async getRoutePlannerStatus(): Promise<any> {
    return await this.rest.makeRequest(`/routeplanner/status`)
  }

  public async unmarkFailedAddress(address: string): Promise<any> {
    return this.rest.post(`/routeplanner/free/address`, { address })

  }

}


export interface NodeInfo {
  version: VersionObject,
  buildtime: number,
  git: GitObject,
  jvm: string,
  lavaplayer: object,
  sourceManagers: string[],
  filters: string[],
  plugins: pluginObject[]
}

interface VersionObject {
  semver: string,
  major: number,
  minor: number,
  patch: number,
  preRelease?: string,
}

interface GitObject {
  branch: string,
  commit: string,
  commitTime: number,
}

export interface pluginObject {
  name: string,
  version: string
}