const net = require('net')
const { createHttpTestServer, createSocks5TestServer, randomString } = require('./utils')
const socks5Buffers = require('./socks5Buffers')

function handleTestConnection(socks5Port, initialData, stagedData = [], fragment = false) {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection({
            host: '127.0.0.1',
            port: socks5Port
        })

        let opened = false
        socket.on('ready', () => opened = true)

        socket.on('error', (err) => {
            if (opened) return
            reject(err)
        })

        let receivedData = Buffer.from([])
        socket.on('data', d => {
            receivedData = Buffer.concat([receivedData, d])

            for (const staged of stagedData) {
                if (!staged.done && staged.after <= receivedData.length) {
                    staged.done = true
                    socket.write(staged.data)
                }
            }
        })
        socket.on('close', () => {
            resolve(receivedData)
        })

        if (fragment) {
            let position = 0;
            const sendInterval = setInterval(() => {
                socket.write(Buffer.from([initialData[position]]));
                position++;
                if (position === initialData.length) clearInterval(sendInterval);
            }, 20);
        }
        else socket.write(initialData)
    })
}

async function httpTest(withAuth, fragment = false) {
    const httpServer = await createHttpTestServer()

    const username = randomString(11)
    const password = randomString(9)
    const { server, port } = await createSocks5TestServer(withAuth ? {
        auth: {
            username,
            password
        }
    } : undefined)

    const portBuf = Buffer.allocUnsafe(2)
    portBuf.writeUInt16BE(httpServer.port)

    try {
        const expectedBytes = withAuth ?
            [
                ...socks5Buffers.server.serverChoice(2),
                ...socks5Buffers.server.authenticationRespose(0),
                ...socks5Buffers.server.connectionResponse(0, [1, 0, 0, 0, 0], [0, 0]),
                ...Buffer.from('HTTP/1.1 200 OK\r\nContent-Length: 13\r\nDate: \r\nConnection: close\r\n\r\nHello, world!')
            ] :
            [
                ...socks5Buffers.server.serverChoice(0),
                ...socks5Buffers.server.connectionResponse(0, [1, 0, 0, 0, 0], [0, 0]),
                ...Buffer.from('HTTP/1.1 200 OK\r\nContent-Length: 13\r\nDate: \r\nConnection: close\r\n\r\nHello, world!')
            ]

        expect([...await handleTestConnection(port, Buffer.concat([
            socks5Buffers.client.greeting([withAuth ? 0x02 : 0x00]),
            withAuth ? socks5Buffers.client.authenticationRequest(username, password) : Buffer.alloc(0),
            socks5Buffers.client.connectionRequest(0x01, 0x01, Buffer.from([127, 0, 0, 1]), portBuf)
        ]), [{
            after: withAuth ? 13 : 11,
            data: 'GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n'
        }], fragment)]).toEqual(expectedBytes)
    } catch (err) {
        throw err
    } finally {
        server.close()
        httpServer.server.close()
    }
}

test('HTTP request through socks5 proxy server', () => httpTest(false))
test('HTTP request through socks5 proxy server with user-pass authentication', () => httpTest(true))

test('Connection fails to invalid address', async () => {
    const { server, port } = await createSocks5TestServer()

    expect([...await handleTestConnection(port, Buffer.concat([
        socks5Buffers.client.greeting([0x00]),
        socks5Buffers.client.connectionRequest(0x01, 0x03, Buffer.from([7, ...'invalid.test']), Buffer.from([1, 1]))
    ]))]).toEqual([
        ...socks5Buffers.server.serverChoice(0),
        ...socks5Buffers.server.connectionResponse(0x04, [1, 0, 0, 0, 0], [0, 0])
    ])

    server.close()
})

test('Connection to user-password protected server with no auth fails', async () => {
    const { server, port } = await createSocks5TestServer({
        auth: {
            username: randomString(5),
            password: randomString(5)
        }
    })

    expect([...await handleTestConnection(port, Buffer.concat([
        socks5Buffers.client.greeting([0x00])
    ]))]).toEqual([
        ...socks5Buffers.server.serverChoice(255)
    ])

    server.close()
})

test('Connection to user-password protected server with invalid auth fails', async () => {
    const { server, port } = await createSocks5TestServer({
        auth: {
            username: randomString(5),
            password: randomString(5)
        }
    })

    expect([...await handleTestConnection(port, Buffer.concat([
        socks5Buffers.client.greeting([0x02]),
        socks5Buffers.client.authenticationRequest(randomString(6), randomString(6))
    ]))]).toEqual([
        ...socks5Buffers.server.serverChoice(2),
        ...socks5Buffers.server.authenticationRespose(1)
    ])

    server.close()
})

test('Connection to server with invalid auth option fails', async () => {
    const { server, port } = await createSocks5TestServer({
        auth: {
            username: randomString(5),
            password: randomString(5)
        }
    })

    expect([...await handleTestConnection(port, Buffer.concat([
        socks5Buffers.client.greeting([0x99])
    ]))]).toEqual([
        ...socks5Buffers.server.serverChoice(255)
    ])

    server.close()
})

test('Connection ruleset validator works', async () => {
    const { server, port } = await createSocks5TestServer()

    server.setRulesetValidator((conn) => {
        return conn.destPort !== 25
    })

    expect([...await handleTestConnection(port, Buffer.concat([
        socks5Buffers.client.greeting([0x00]),
        socks5Buffers.client.connectionRequest(0x01, 0x03, Buffer.from([10, ...'google.com']), Buffer.from([0, 25]))
    ]))]).toEqual([
        ...socks5Buffers.server.serverChoice(0x00),
        ...socks5Buffers.server.connectionResponse(0x02, [1, 0, 0, 0, 0], [0, 0])
    ])

    server.close()
})

test('Fragmented packets work', () => httpTest(false, true))
