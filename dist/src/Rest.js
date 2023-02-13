"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rest = exports.RequestMethod = void 0;
const undici_1 = require("undici");
const package_json_1 = __importDefault(require("../package.json"));
var RequestMethod;
(function (RequestMethod) {
    RequestMethod["Get"] = "GET";
    RequestMethod["Delete"] = "DELETE";
    RequestMethod["Post"] = "POST";
    RequestMethod["Patch"] = "PATCH";
    RequestMethod["Put"] = "PUT";
})(RequestMethod = exports.RequestMethod || (exports.RequestMethod = {}));
class Rest {
    /**
     * sessionId from poru
     */
    sessionId;
    /**
     * password to access Lavalink api
     */
    password;
    /**
     * Lavalink url for Requests
     */
    url;
    /**
     * initialized poru
     */
    poru;
    /**
     * version that is used for Lavalink api
     * @defaultValue `v3`
     */
    version;
    /**
     * The request {@link https://undici.nodejs.org/#/docs/api/Agent Agent} for the requests
     */
    agent;
    /**
     * The timeout for the requests
     * @defaultValue `15000`
     */
    requestTimeout;
    constructor(poru, node) {
        this.poru = poru;
        this.url = `http${node.secure ? "s" : ""}://${node.options.host}:${node.options.port}`;
        this.sessionId = node.sessionId;
        this.password = node.password;
        this.agent = new undici_1.Pool(this.url, node.poolOptions);
        this.version = node.apiVersion;
        this.requestTimeout = node.requestTimeout;
    }
    setSessionId(sessionId) {
        this.sessionId = sessionId;
    }
    async getAllPlayers() {
        if (!this.sessionId)
            throw new ReferenceError(`The Lavalink-node is not connected/ready, or is not Up-to date`);
        const players = await this.makeRequest(`/sessions/${this.sessionId}/players`);
        if (!Array.isArray(players))
            return [];
        return players;
    }
    async updatePlayer(options) {
        if (!this.sessionId)
            throw new ReferenceError(`The Lavalink-node is not connected/ready, or is not Up-to date`);
        const res = await this.makeRequest(`/sessions/${this.sessionId}/players/${options.guildId}/?noReplace=false`, (requestOptions) => {
            requestOptions.method = RequestMethod.Patch,
                requestOptions.body = JSON.stringify(options.data);
            if (options.noReplace) {
                const url = new URL(`${this.url}${requestOptions.path}`);
                url.search = new URLSearchParams({ noReplace: options.noReplace?.toString() || "false" }).toString();
                requestOptions.path = url.toString().replace(this.url, "");
            }
        });
        return res;
    }
    async destroyPlayer(guildId) {
        if (!this.sessionId)
            throw new ReferenceError(`The Lavalink-node is not connected/ready, or is not Up-to date`);
        await this.delete(`/sessions/${this.sessionId}/players/${guildId}`);
    }
    async patch(endpoint, body) {
        const res = await this.makeRequest(endpoint, (RequestOptions) => {
            RequestOptions.method = RequestMethod.Patch;
            RequestOptions.body = JSON.stringify(body);
        });
        return res;
    }
    async post(endpoint, body) {
        const res = await this.makeRequest(endpoint, (RequestOptions) => {
            RequestOptions.method = RequestMethod.Post,
                RequestOptions.body = JSON.stringify(body);
        });
        return res;
    }
    async delete(endpoint) {
        const res = await this.makeRequest(endpoint, (requestOptions) => {
            requestOptions.method = RequestMethod.Delete;
        });
        return res;
    }
    /**
     *
     * @param endpoint for the Request
     * @param modifyRequest modified options for the Request
     * @internal
     */
    async makeRequest(endpoint, modifyRequest) {
        const options = {
            path: `${this.version}${endpoint}`,
            headers: {
                "Content-type": "application/json",
                Authorization: this.password,
                "user-agent": `${package_json_1.default.name} (${package_json_1.default.repository.url} ${package_json_1.default.version})`
            },
            headersTimeout: this.requestTimeout,
            method: RequestMethod.Get,
        };
        modifyRequest?.(options);
        const req = await this.agent.request(options);
        if (req.statusCode === 404)
            return await req.body.json();
        if (options.method === RequestMethod.Delete)
            return;
        return await req.body.json();
    }
}
exports.Rest = Rest;
//# sourceMappingURL=Rest.js.map