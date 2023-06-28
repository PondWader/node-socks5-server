const net = require('net')
const http = require('http')
const { createServer } = require('..')

function getAvailablePort () {
    return new Promise(resolve => {
        const server = net.createServer()
        server.listen(0, '127.0.0.1')
        server.on('listening', () => {
          const { port } = server.address()
          server.close(() => resolve(port))
        })
    })
}

function createSocks5TestServer(options) {
    return new Promise(async resolve => {
        const port = await getAvailablePort()
        const server = createServer(options)
        server.listen(port, '127.0.0.1', () => {
            resolve({
                server,
                port
            })
        })
    })
}

function createHttpTestServer() {
    return new Promise(async resolve => {
        const port = await getAvailablePort()
        const server = http.createServer((req, res) => {
            res.writeHead(200, {
                'Content-Length': 13,
                'Date': ''
            });
            res.end("Hello, world!");
        }).listen(port, '127.0.0.1', () => {
            resolve({ server, port })
        })
    })
}

function capitalizeFirstLetter(str) {
    return String.fromCharCode(str.slice(0, 1).charCodeAt(0) - 32) + str.slice(1)
}

function randomString(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

module.exports = { createSocks5TestServer, createHttpTestServer, capitalizeFirstLetter, randomString }
