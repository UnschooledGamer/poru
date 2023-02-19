"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Poru = void 0;
const Node_1 = require("./Node");
const Player_1 = require("./Player");
const events_1 = require("events");
const config_1 = require("./config");
const Response_1 = require("./guild/Response");
const Plugin_1 = require("./Plugin");
class Poru extends events_1.EventEmitter {
    client;
    _nodes;
    options;
    nodes;
    players;
    userId;
    version;
    isActivated;
    send;
    constructor(client, nodes, options) {
        super();
        this.client = client;
        this._nodes = nodes;
        this.nodes = new Map();
        this.players = new Map();
        this.options = options;
        this.userId = null;
        this.version = config_1.Config.version;
        this.isActivated = false;
        this.send = null;
        this._validateOptions(options);
    }
    init(client) {
        if (this.isActivated)
            return this;
        this.userId = client.user.id;
        this._nodes.forEach((node) => this.addNode(node));
        this.isActivated = true;
        if (this.options.plugins) {
            this.options.plugins.forEach(plugin => {
                if (!(plugin instanceof Plugin_1.Plugin))
                    throw new RangeError(`Some of your Plugin does not extend Poru's Plugin.`);
                plugin.load(this);
            });
        }
        switch (this.options.library) {
            case "discord.js": {
                this.send = (packet) => {
                    const guild = client.guilds.cache.get(packet.d.guild_id);
                    if (guild)
                        guild.shard?.send(packet);
                };
                client.on("raw", async (packet) => {
                    await this.packetUpdate(packet);
                });
                break;
            }
            case "eris": {
                this.send = (packet) => {
                    const guild = client.guilds.get(packet.d.guild_id);
                    if (guild)
                        guild.shard.sendWS(packet?.op, packet?.d);
                };
                client.on("rawWS", async (packet) => {
                    await this.packetUpdate(packet);
                });
                break;
            }
            case "oceanic": {
                this.send = (packet) => {
                    const guild = client.guilds.get(packet.d.guild_id);
                    if (guild)
                        guild.shard.send(packet?.op, packet?.d);
                };
                client.on("packet", async (packet) => {
                    await this.packetUpdate(packet);
                });
                break;
            }
            case "other": {
                if (!this.send)
                    throw new Error("Send function is required in Poru Options");
                if (typeof this.send != "function")
                    throw new TypeError(`Send Function needs to be a function, but got ${typeof this.send}`);
                this.send = this.options.send;
                break;
            }
        }
    }
    _validateOptions(options) {
        if (!options)
            throw new TypeError("PoruOptions must not be empty");
        if (typeof options.plugins !== "undefined" && !Array.isArray(options.plugins))
            throw new Error(`[Poru Validation Error] Poru option "plugins" must be an Array, but got ${typeof options.plugins}`);
        if (typeof options.autoResume !== "undefined" && typeof options.autoResume !== "boolean")
            throw new TypeError(`[Poru Validation Error] Poru option "autoResume" must to be an boolean, but got ${typeof options.autoResume}`);
        if (typeof options.library !== "undefined" && typeof options.library !== "string" || typeof options.library === "undefined")
            throw new TypeError(`[Poru Validation Error] Poru option "library" needs to be an string, but got ${typeof options.library}`);
        if (options.library === "other" && typeof options.send !== "function")
            throw new TypeError(`[Poru Validation Error] Poru option "library" is "other" so "send" must be present & as a function`);
        if (typeof options.resumeKey !== "undefined" && typeof options.resumeKey !== "string")
            throw new TypeError(`[Poru Validation Error] Poru option "resumeKey" must be a string`);
        if (typeof options.resumeTimeout !== "undefined" && typeof options.resumeTimeout !== "number")
            throw new TypeError(`[Poru Validation Error] Poru option "resumeTimeout" must be a number`);
        if (typeof options.reconnectTimeout !== "undefined" && typeof options.reconnectTimeout !== "number")
            throw new TypeError(`[Poru Validation Error] Poru option "reconnectTimeout" must be a number`);
        if (typeof options.reconnectTries !== "undefined" && typeof options.reconnectTries !== "number")
            throw new TypeError(`[Poru Validation Error] Poru option "reconnectTries" must be a number`);
    }
    packetUpdate(packet) {
        if (!["VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(packet.t))
            return;
        const player = this.players.get(packet.d.guild_id);
        if (!player)
            return;
        if (packet.t === "VOICE_SERVER_UPDATE") {
            player.connection.setServersUpdate(packet.d);
        }
        if (packet.t === "VOICE_STATE_UPDATE") {
            if (packet.d.user_id !== this.userId)
                return;
            player.connection.setStateUpdate(packet.d);
        }
    }
    addNode(options) {
        const node = new Node_1.Node(this, options, this.options);
        this.nodes.set(options.name, node);
        node.connect();
        return node;
    }
    removeNode(identifier) {
        const node = this.nodes.get(identifier);
        if (!node)
            return;
        node.disconnect();
        this.nodes.delete(identifier);
    }
    getNodeByRegion(region) {
        return [...this.nodes.values()]
            .filter((node) => node.isConnected && node.regions.includes(region.toLowerCase()))
            .sort((a, b) => {
            const aLoad = a.stats.cpu
                ? (a.stats.cpu.systemLoad / a.stats.cpu.cores) * 100
                : 0;
            const bLoad = b.stats.cpu
                ? (b.stats.cpu.systemLoad / b.stats.cpu.cores) * 100
                : 0;
            return aLoad - bLoad;
        });
    }
    getNode(identifier = "auto") {
        if (!this.nodes.size)
            throw new Error(`No nodes available currently`);
        if (identifier === "auto")
            return this.leastUsedNodes;
        const node = this.nodes.get(identifier);
        if (!node)
            throw new Error("The node identifier you provided is not found");
        if (!node.isConnected)
            node.connect();
        return node;
    }
    createConnection(options) {
        const player = this.players.get(options.guildId);
        if (player)
            return player;
        if (!this.isActivated)
            throw new Error("[Poru Error] Poru is not activated, use <Poru>.init(client)");
        if (this.leastUsedNodes.length === 0)
            throw new Error("[Poru Error] No nodes are available");
        let node;
        if (options.region) {
            const region = this.getNodeByRegion(options.region)[0];
            node = this.nodes.get(region.name || this.leastUsedNodes[0].name);
        }
        else {
            node = this.nodes.get(this.leastUsedNodes[0].name);
        }
        if (!node)
            throw new Error("[Poru Error] No nodes are available");
        return this.createPlayer(node, options);
    }
    createPlayer(node, options) {
        const player = new Player_1.Player(this, node, options);
        this.players.set(options.guildId, player);
        player.connect(options);
        return player;
    }
    removeConnection(guildId) {
        this.players.get(guildId)?.destroy();
    }
    get leastUsedNodes() {
        return [...this.nodes.values()]
            .filter((node) => node.isConnected)
            .sort((a, b) => a.penalties - b.penalties);
    }
    async resolve({ query, source, requester }, node) {
        if (!node)
            node = this.leastUsedNodes[0];
        if (!node)
            throw new Error("No nodes are available.");
        const regex = /^https?:\/\//;
        if (regex.test(query)) {
            let response = await node.rest.makeRequest(`/loadtracks?identifier=${encodeURIComponent(query)}`);
            return new Response_1.Response(response, requester);
        }
        else {
            let track = `${source || "ytsearch"}:${query}`;
            let response = await node.rest.makeRequest(`/loadtracks?identifier=${encodeURIComponent(track)}`);
            return new Response_1.Response(response, requester);
        }
    }
    async decodeTrack(track, node) {
        if (!node)
            node = this.leastUsedNodes[0];
        return node.rest.makeRequest(`/decodetrack?encodedTrack=${encodeURIComponent(track)}`);
    }
    async decodeTracks(tracks, node) {
        return await node.rest.post(`/decodetracks`, tracks);
    }
    async getLavalinkInfo(name) {
        let node = this.nodes.get(name);
        return await node.rest.makeRequest(`/info`);
    }
    async getLavalinkStatus(name) {
        let node = this.nodes.get(name);
        return await node.rest.makeRequest(`/stats`);
    }
    async getLavalinkVersion(name) {
        let node = this.nodes.get(name);
        return await node.rest.makeRequest(`/version`, (R) => {
            R.path = `/version`;
        });
    }
    get(guildId) {
        return this.players.get(guildId);
    }
}
exports.Poru = Poru;
//# sourceMappingURL=Poru.js.map