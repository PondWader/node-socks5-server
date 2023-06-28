import { InitialisedSocks5Connection, Socks5ConnectionStatus } from "./types";
import net from "net";

// The default connection handler

export default function (connection: InitialisedSocks5Connection, sendStatus: (status: keyof typeof Socks5ConnectionStatus) => void) {
    if (connection.command !== 'connect') return sendStatus('COMMAND_NOT_SUPPORTED');

    connection.socket.on('error', () => {}); // Ignore errors

    const stream = net.createConnection({
        host: connection.destAddress,
        port: connection.destPort
    });

    let streamOpened = false;
    stream.on('error', (err: Error & {code: string}) => {
        if (!streamOpened) {
            switch (err.code) {
                case 'ENOENT':
                case 'ENOTFOUND':
                case 'ETIMEDOUT':
                case 'EADDRNOTAVAIL':
                case 'EHOSTUNREACH':
                    sendStatus('HOST_UNREACHABLE');
                    break;
                case 'ENETUNREACH':
                    sendStatus('NETWORK_UNREACHABLE')
                    break;
                case 'ECONNREFUSED':
                    sendStatus('CONNECTION_REFUSED');
                    break;
                default:
                    sendStatus('GENERAL_FAILURE');
            }
        }
    })

    stream.on('ready', () => {
        streamOpened = true;
        sendStatus('REQUEST_GRANTED');
        connection.socket.pipe(stream).pipe(connection.socket);
    })

    connection.socket.on('close', () => stream.destroy());
}