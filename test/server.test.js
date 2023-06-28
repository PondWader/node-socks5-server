const { createSocks5TestServer, capitalizeFirstLetter } = require('./utils.js')
const { createServer } = require('..')
const net = require('net')

test('Server listens and closes correctly', async () => {
    const { server, port } = await createSocks5TestServer()

    function tryConnect() {
        const socket = net.createConnection({
            host: '127.0.0.1',
            port
        })
    
        return new Promise((resolve, reject) => {
            socket.on('ready', () => {
                socket.destroy()
                resolve()
            })
            socket.on('error', reject)
        })
    }

    try {
        await tryConnect()
    } catch (err) {
        server.close()
        throw err
    }
    return new Promise(resolve => server.close((err) => {
        if (err) throw err 
        expect(tryConnect).rejects.toThrow();
        resolve()
    }))
})

describe('Handlers can be set and removed', () => {
    const server = createServer()
    const defaultConnectionHandler = server.connectionHandler
    const handlerNames = ['authHandler', 'rulesetValidator', 'connectionHandler']
    for (const handlerName of handlerNames) {
        test(`${handlerName} can be set and removed`, () => {
            const handler = () => {}
            server[`set${capitalizeFirstLetter(handlerName)}`](handler)
            expect(server[handlerName]).toBe(handler)

            if (handlerName === 'connectionHandler') {
                server.useDefaultConnectionHandler()
                expect(server.connectionHandler).toBe(defaultConnectionHandler)
            } else {
                server[`disable${capitalizeFirstLetter(handlerName)}`]()
                expect(server[handlerName]).toBe(undefined)
            }
        })
    }
})
