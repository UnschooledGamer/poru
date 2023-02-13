import { Node } from "./Node";
import { type Dispatcher } from "undici";
import { Poru } from "./Poru";
import { Player } from "./Player";
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
    noReplace?: boolean;
}
export type RouteLike = `/${string}`;
export declare enum RequestMethod {
    "Get" = "GET",
    "Delete" = "DELETE",
    "Post" = "POST",
    "Patch" = "PATCH",
    "Put" = "PUT"
}
export type RestVersion = "v2" | "v3" | "v4";
export type modifyRequest = (options: Dispatcher.RequestOptions) => void;
/**
 * Received when a API Request encounters an error
 * @url https://github.com/freyacodes/Lavalink/blob/master/IMPLEMENTATION.md#error-responses
 */
export interface InvalidRestRequest {
    /**
     * The timestamp of the error in milliseconds
     */
    timestamp?: number;
    /**
     * The HTTP status code
     */
    status?: number;
    /**
     * The HTTP status code message
     */
    error?: string;
    /**
     * The stack trace of the error when trace=true as query param has been sent
     */
    trace?: string;
    /**
     * The error message
     */
    message?: string;
    /**
     * The api Request path
     */
    path?: string;
}
export declare class Rest {
    /**
     * sessionId from poru
     */
    private sessionId;
    /**
     * password to access Lavalink api
     */
    private password;
    /**
     * Lavalink url for Requests
     */
    url: string;
    /**
     * initialized poru
     */
    readonly poru: Poru;
    /**
     * version that is used for Lavalink api
     * @defaultValue `v3`
     */
    version: RestVersion;
    /**
     * The request {@link https://undici.nodejs.org/#/docs/api/Agent Agent} for the requests
     */
    agent: Dispatcher;
    /**
     * The timeout for the requests
     * @defaultValue `15000`
     */
    requestTimeout: number;
    constructor(poru: Poru, node: Node);
    setSessionId(sessionId: string): void;
    getAllPlayers(): Promise<Player[]>;
    updatePlayer(options: updatePlayerOptions): Promise<Player>;
    destroyPlayer(guildId: string): Promise<void>;
    patch<T>(endpoint: RouteLike, body: any): Promise<T>;
    post<T>(endpoint: RouteLike, body: any): Promise<T>;
    delete(endpoint: RouteLike): Promise<unknown>;
    /**
     *
     * @param endpoint for the Request
     * @param modifyRequest modified options for the Request
     * @internal
     */
    makeRequest<T>(endpoint: RouteLike, modifyRequest?: modifyRequest): Promise<T>;
}
