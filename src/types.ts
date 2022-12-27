import { Socks5Connection } from "./Connection";
import Socks5Server from "./Server";

export enum Socks5ConnectionCommand {
    connect = 1,
    bind,
    udp
}

export enum Socks5ConnectionStatus {
    REQUEST_GRANTED,
    GENERAL_FAILURE,
    CONNECTION_NOT_ALLOWED,
    NETWORK_UNREACHABLE,
    HOST_UNREACHABLE,
    CONNECTION_REFUSED,
    TTL_EXPIRED,
    COMMAND_NOT_SUPPORTED
}

export type AuthSocks5Connection = Socks5Connection & {
    username: string,
    password: string
}

export type InitialisedSocks5Connection = Socks5Connection & {
    destAddress: string,
    destPort: number,
    command: keyof typeof Socks5ConnectionCommand
}

// net.Server.listen but returns Socks5 Server
export type socks5ServerListen = (((port?: number, hostname?: string, backlog?: number, listeningListener?: () => void) => Socks5Server) |
((port?: number, hostname?: string, listeningListener?: () => void) => Socks5Server) |
((port?: number, backlog?: number, listeningListener?: () => void) => Socks5Server) |
((port?: number, listeningListener?: () => void) => Socks5Server) |
((path: string, backlog?: number, listeningListener?: () => void) => Socks5Server) |
((path: string, listeningListener?: () => void) => Socks5Server) |
((options: import('net').ListenOptions, listeningListener?: () => void) => Socks5Server) |
((handle: any, backlog?: number, listeningListener?: () => void) => Socks5Server) |
((handle: any, listeningListener?: () => void) => Socks5Server))