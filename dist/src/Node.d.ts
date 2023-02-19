import { Poru, PoruOptions, NodeGroup } from "./Poru";
import WebSocket from "ws";
import { InvalidRestRequest, Rest, RestVersion } from "./Rest";
import { type Pool } from "undici";
export type websocketVersion = Exclude<RestVersion, "v2">;
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
    resumingKey?: string;
    timeout?: number;
}
export declare class Node {
    isConnected: boolean;
    poru: Poru;
    readonly name: string;
    readonly restURL: string;
    readonly socketURL: string;
    password: string;
    readonly apiVersion: RestVersion;
    readonly version: websocketVersion;
    readonly versionedPath: boolean;
    readonly poolOptions: Pool.Options;
    readonly requestTimeout: number;
    readonly secure: boolean;
    readonly regions: Array<string>;
    sessionId: string;
    private resumed;
    rest: Rest;
    ws: WebSocket | null;
    readonly resumeKey: string | null;
    readonly resumeTimeout: number;
    readonly autoResume: boolean;
    readonly reconnectTimeout: number;
    reconnectTries: number;
    reconnectAttempt: any;
    attempt: number;
    stats: NodeStats | null;
    options: NodeGroup;
    constructor(poru: Poru, node: NodeGroup, options: PoruOptions);
    connect(): void;
    send(payload: any): void;
    reconnect(): void;
    disconnect(): void;
    get penalties(): number;
    /**
     * the node connection is resumed with the Lavalink-node or not
     */
    get isResumed(): boolean;
    /**
     * fetch stats of the node via Rest api
     */
    fetchStats(): Promise<NodeStats | {}>;
    fetchVersion(): Promise<string | null>;
    /**
     * Fetches the info of the Lavalink-node
     */
    fetchInfo(): Promise<NodeInfo | InvalidRestRequest | null>;
    private open;
    private setStats;
    private message;
    private close;
    private error;
    getRoutePlannerStatus(): Promise<any>;
    unmarkFailedAddress(address: string): Promise<any>;
}
export interface NodeInfo {
    version: VersionObject;
    buildtime: number;
    git: GitObject;
    jvm: string;
    lavaplayer: object;
    sourceManagers: string[];
    filters: string[];
    plugins: pluginObject[];
}
interface VersionObject {
    semver: string;
    major: number;
    minor: number;
    patch: number;
    preRelease?: string;
}
interface GitObject {
    branch: string;
    commit: string;
    commitTime: number;
}
export interface pluginObject {
    name: string;
    version: string;
}
export {};
