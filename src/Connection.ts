import { Duplex } from "stream";
import Socks5Server from "./Server";
import { AuthSocks5Connection, Socks5ConnectionCommand, InitialisedSocks5Connection, Socks5ConnectionStatus } from "./types";

export class Socks5Connection {
    public socket: Duplex;
    public server: Socks5Server;
    public username?: string;
    public password?: string;
    public destAddress?: string;
    public destPort?: number;
    public command?: keyof typeof Socks5ConnectionCommand;
    private errorHandler = () => {};
    public metadata: any = {};

    constructor(server: Socks5Server, socket: Duplex) {
        this.socket = socket;
        this.server = server;

        socket.on('error', this.errorHandler); // Ignore errors

        socket.pause();
        this.handleGreeting();
    }

    private readBytes(len: number): Promise<Buffer> {
        return new Promise(resolve => {
            let buf = Buffer.allocUnsafe(0);

            const dataListener = (chunk: Buffer) => {
                buf = Buffer.concat([buf, chunk]);
                if (buf.length < len) return;

                this.socket.removeListener('data', dataListener);
                this.socket.push(buf.subarray(len));
                resolve(buf.subarray(0, len));
                this.socket.pause()
            }

            this.socket.on('data', dataListener);
            this.socket.resume();
        })
    }

    private async handleGreeting() {
        const ver = (await this.readBytes(1)).readUInt8();
        if (ver !== 5) return this.socket.destroy(); // Must be version 5 for socks5

        const authMethodsAmount = (await this.readBytes(1)).readUInt8();
        if (authMethodsAmount > 128 || authMethodsAmount === 0) return this.socket.destroy(); // Too many methods

        const authMethods = await this.readBytes(authMethodsAmount);

        const authMethodByteCode = this.server.authHandler ? 0x02 : 0x00;
        
        if (!authMethods.includes(authMethodByteCode)) {
            // The chosen authentication method is not available
            this.socket.write(Buffer.from([
                0x05, // Version 5 - Socks5
                0xFF // no acceptable auth modes were offered 
            ]));
            return this.socket.destroy();
        }

        this.socket.write(Buffer.from([
            0x05, // Version 5 - Socks5
            authMethodByteCode // The chosen auth method, 0x00 for no auth, 0x02 for user-pass
        ]));

        if (this.server.authHandler) this.handleUserPassword();
        else this.handleConnectionRequest();
    }

    private async handleUserPassword() {
        await this.readBytes(1); // Skip version byte, should be 1 for version 1 of user password auth

        const usernameLength = (await this.readBytes(1)).readUint8();
        const username = (await this.readBytes(usernameLength)).toString();

        const passwordLength = (await this.readBytes(1)).readUint8();
        const password = (await this.readBytes(passwordLength)).toString();

        this.username = username;
        this.password = password;

        let calledBack = false;

        const acceptCallback = () => {
            if (calledBack) return;
            calledBack = true;

            this.socket.write(Buffer.from([
                0x01, // User pass auth version
                0x00 // Success
            ]))
            this.handleConnectionRequest();
        };
        const denyCallback = () => {
            if (calledBack) return;
            calledBack = true;

            this.socket.write(Buffer.from([
                0x01, // User pass auth version
                0x01 // Failure
            ]))

            this.socket.destroy();
        }

        const resp = await this.server.authHandler!(this as AuthSocks5Connection, acceptCallback, denyCallback)

        if (resp === true) acceptCallback();
        else if (resp === false) denyCallback();
    }

    private async handleConnectionRequest() {
        await this.readBytes(1); // Skip version byte, should be 5 for socks5

        const commandByte = (await this.readBytes(1))[0]
        const command = Socks5ConnectionCommand[commandByte] as "connect" | "bind" | "udp";
        if (!command) return this.socket.destroy(); // Invalid command
        this.command = command;

        await this.readBytes(1); // Skip reserved byte, should be 0x00

        // Reading destination address
        const addrType = (await this.readBytes(1)).readUInt8();

        let address = '';
        switch(addrType) {
            case 1:
                // IPv4
                address = (await this.readBytes(4)).join('.');
                break;

            case 3:
                // Domain name
                const hostLength = (await this.readBytes(1)).readUInt8();
                address = (await this.readBytes(hostLength)).toString();
                break;

            case 4:
                // IPv6
                const bytes = await this.readBytes(16);

                for (let i = 0; i < 16; i++) {
                    if (i % 2 === 0 && i > 0) address += ':';
                    address += `${bytes[i] < 16 ? '0' : ''}${bytes[i].toString(16)}`
                }
                break;

            default:
                this.socket.destroy(); // No valid address type provided
                return;
        }
        
        const port = (await this.readBytes(2)).readUInt16BE();

        if (!this.server.supportedCommands.has(command)) {
            this.socket.write(Buffer.from([0x05, Socks5ConnectionStatus.COMMAND_NOT_SUPPORTED])); // command not supported
            return this.socket.destroy();
        }

        this.destAddress = address;
        this.destPort = port;

        let calledBack = false;
        const acceptCallback = () => {
            if (calledBack) return;
            calledBack = true;

            this.connect();
        };

        if (!this.server.rulesetValidator) return acceptCallback();

        const denyCallback = () => {
            if (calledBack) return;
            calledBack = true;

            this.socket.write(Buffer.from([
                0x05, 0x02, // connection not allowed by ruleset
                0x00,
                0x01,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00
            ])); 
            this.socket.destroy();
        }

        const resp = await this.server.rulesetValidator!(this as InitialisedSocks5Connection, acceptCallback, denyCallback);

        if (resp === true) acceptCallback();
        else if (resp === false) denyCallback();
    }

    private connect() {
        this.socket.removeListener('error', this.errorHandler);

        this.server.connectionHandler(this as InitialisedSocks5Connection, (status) => {
            if (Socks5ConnectionStatus[status] === undefined) throw new Error(`"${status}" is not a valid status.`);

            // We can just send 0x00 for bound address stuff
            this.socket.write(Buffer.from([
                0x05,
                Socks5ConnectionStatus[status],
                0x00,
                0x01,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00
            ]))

            if (status !== 'REQUEST_GRANTED') {
                this.socket.destroy()
            }
        })

        this.socket.resume();
    }
}