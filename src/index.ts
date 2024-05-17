import Socks5Server from "./Server";
import connectionHandler from "./connectionHandler";

type ServerOptions = {
    auth?: {
        username: string;
        password: string;
    }
    port?: number;
    hostname?: string;
}

export function createServer(opts?: ServerOptions) {
    const server = new Socks5Server();

    if (opts?.auth) server.setAuthHandler((conn) => {
        return conn.username === opts.auth!.username && conn.password === opts.auth!.password
    })

    if (opts?.port) server.listen(opts.port, opts.hostname);

    return server;
}

export { Socks5Server, connectionHandler as defaultConnectionHandler };