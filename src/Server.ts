import { Duplex, EventEmitter } from "stream";
import net from "net";
import { Socks5Connection } from "./Connection";
import { AuthSocks5Connection, InitialisedSocks5Connection, Socks5ConnectionCommand, Socks5ConnectionStatus } from "./types";
import connectionHandler from "./connectionHandler";

export default class Socks5Server {
    public authHandler?: (connection: AuthSocks5Connection, accept: () => void, deny: () => void) => boolean | Promise<boolean> | void;
    public rulesetValidator?: (connection: InitialisedSocks5Connection, accept: () => void, deny: () => void) => boolean | Promise<boolean> | void;
    public connectionHandler: (connection: InitialisedSocks5Connection, sendStatus: (status: keyof typeof Socks5ConnectionStatus) => void) => void

    public supportedCommands: Set<keyof typeof Socks5ConnectionCommand> = new Set(["connect"]);
    private server: net.Server;
    public listen;
    public close;

    constructor() {
        this.connectionHandler = connectionHandler;

        this.server = net.createServer((socket) => {
            this._handleConnection(socket);
        });

        this.listen = ((...args: any) => {
            this.server.listen(...args);
            return this;
        }) as (port?: number | undefined, hostname?: string | undefined, backlog?: number | undefined, listeningListener?: (() => void) | undefined) => Socks5Server
        this.close = ((...args: any) => {
            this.server.close(...args);
            return this;
        }) as (callback?: ((err?: Error | undefined) => void) | undefined) => Socks5Server;
    }

    setAuthHandler(handler: typeof this.authHandler) {
        this.authHandler = handler;
        return this;
    }

    disableAuthHandler() {
        this.authHandler = undefined;
        return this;
    }

    setRulesetValidator(handler: typeof this.rulesetValidator) {
        this.rulesetValidator = handler;
        return this;
    }

    disableRulesetValidator() {
        this.rulesetValidator = undefined;
        return this;
    }

    // Not private because someone may want to inject a duplex stream to be handled as a connection
    _handleConnection(socket: Duplex) {
        new Socks5Connection(this, socket);
        return this;
    }
}