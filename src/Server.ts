import { Duplex } from "stream";
import net from "net";
import { Socks5Connection } from "./Connection";
import { AuthSocks5Connection, InitialisedSocks5Connection, Socks5ConnectionCommand, Socks5ConnectionStatus } from "./types";
import connectionHandler from "./connectionHandler";

export default class Socks5Server {
    public authHandler?: (connection: AuthSocks5Connection, accept: () => void, deny: () => void) => boolean | Promise<boolean> | any;
    public rulesetValidator?: (connection: InitialisedSocks5Connection, accept: () => void, deny: () => void) => boolean | Promise<boolean> | void;
    public connectionHandler: (connection: InitialisedSocks5Connection, sendStatus: (status: keyof typeof Socks5ConnectionStatus) => void) => void;

    public supportedCommands: Set<keyof typeof Socks5ConnectionCommand> = new Set(["connect"]);
    private server: net.Server;

    constructor() {
        this.connectionHandler = connectionHandler;

        this.server = net.createServer((socket) => {
            socket.setNoDelay();
            this._handleConnection(socket);
        });
    }

    // All the possible listen args but instead of returning the net.Server instance, returns Socks5Server instance
    listen(port?: number, hostname?: string, backlog?: number, listeningListener?: () => void): this;
    listen(port?: number, hostname?: string, listeningListener?: () => void): this;
    listen(port?: number, backlog?: number, listeningListener?: () => void): this;
    listen(port?: number, listeningListener?: () => void): this;
    listen(path: string, backlog?: number, listeningListener?: () => void): this;
    listen(path: string, listeningListener?: () => void): this;
    listen(options: import('net').ListenOptions, listeningListener?: () => void): this;
    listen(handle: any, backlog?: number, listeningListener?: () => void): this;
    listen(handle: any, listeningListener?: () => void): this;
    listen(...args: any[]) {
        this.server.listen(...args);
        return this;
    }

    close(callback?: ((err?: Error | undefined) => void) | undefined) {
        this.server.close(callback);
        return this;
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

    setConnectionHandler(handler: typeof this.connectionHandler) {
        this.connectionHandler = handler;
        return this;
    }

    useDefaultConnectionHandler() {
        this.connectionHandler = connectionHandler;
        return this;
    }

    // Not private because someone may want to inject a duplex stream to be handled as a connection
    _handleConnection(socket: Duplex) {
        new Socks5Connection(this, socket);
        return this;
    }
}